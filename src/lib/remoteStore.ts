// src/lib/remoteStore.ts — données partagées via le serveur (mode VITE_BACKEND=api).
//
// - Toutes les données sont chargées après la connexion (loadAll).
// - Chaque modification est envoyée au serveur après un court délai, avec sa version.
// - Si un collègue a modifié la même donnée entre-temps (409), les deux versions sont fusionnées.
// - Toutes les 20 s, les données modifiées par d'autres sont récupérées.
// - En cas de coupure réseau, les envois sont mis en attente et retentés.
import { ApiError, apiFetch } from './api';
import { threeWayMerge } from './merge';

export const SYNC_STATUS_EVENT = 'rhema:sync-status';
export const SYNC_NOTICE_EVENT = 'rhema:sync-notice';

export interface SyncStatus {
  pending: number;
  offline: boolean;
  lastSavedAt: number | null;
}

type Listener = (value: unknown) => void;

const SAVE_DELAY_MS = 400;
const POLL_MS = 20_000;
const RETRY_MS = 10_000;

const values = new Map<string, unknown>();
const bases = new Map<string, unknown>(); // dernière version connue du serveur
const versions = new Map<string, number>();
const listeners = new Map<string, Set<Listener>>();
const timers = new Map<string, number>();
const dirty = new Set<string>();
const inFlight = new Set<string>();
const sentAuditIds = new Set<string>();

let loaded = false;
let offline = false;
let lastSavedAt: number | null = null;
let pollTimer: number | undefined;

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function emitStatus() {
  const detail: SyncStatus = { pending: dirty.size + inFlight.size, offline, lastSavedAt };
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail }));
}

function notice(type: 'info' | 'error', message: string) {
  window.dispatchEvent(new CustomEvent(SYNC_NOTICE_EVENT, { detail: { type, message } }));
}

function publish(key: string, value: unknown) {
  values.set(key, value);
  listeners.get(key)?.forEach(cb => cb(value));
}

function rememberAudit(list: unknown) {
  if (Array.isArray(list)) for (const e of list) if (e && typeof e.id === 'string') sentAuditIds.add(e.id);
}

export const remoteStore = {
  isLoaded: () => loaded,

  /** Charge toutes les données de l'organisation (après connexion). */
  async loadAll() {
    const res = await apiFetch<{ values: Record<string, unknown>; versions: Record<string, number> }>('GET', '/api/data');
    for (const [k, v] of Object.entries(res.values)) {
      values.set(k, v);
      bases.set(k, clone(v));
    }
    for (const [k, v] of Object.entries(res.versions)) versions.set(k, v);
    rememberAudit(res.values.auditLogs);
    loaded = true;
    startPolling();
    emitStatus();
  },

  has: (key: string) => values.has(key),
  get: <T,>(key: string, fallback: T): T => (values.has(key) ? (values.get(key) as T) : fallback),

  subscribe(key: string, cb: Listener) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(cb);
    return () => listeners.get(key)?.delete(cb);
  },

  /** Modification locale : sera envoyée au serveur. */
  set(key: string, value: unknown) {
    values.set(key, value);
    dirty.add(key);
    window.clearTimeout(timers.get(key));
    timers.set(key, window.setTimeout(() => {
      timers.delete(key);
      void save(key);
    }, SAVE_DELAY_MS));
    emitStatus();
  },

  /** Envoie immédiatement tout ce qui est en attente (avant déconnexion). */
  async flush() {
    for (const key of [...dirty]) {
      window.clearTimeout(timers.get(key));
      timers.delete(key);
      await save(key);
    }
  },

  hasPendingChanges: () => dirty.size + inFlight.size > 0,

  stop() {
    window.clearInterval(pollTimer);
  },
};

async function save(key: string, attempt = 0): Promise<void> {
  if (!dirty.has(key) || inFlight.has(key)) return;
  dirty.delete(key);
  inFlight.add(key);
  emitStatus();
  const local = values.get(key);
  let retryNow = false;
  try {
    let payload = local;
    if (key === 'auditLogs') {
      // Journal en ajout seul : on n'envoie que les nouvelles entrées.
      payload = Array.isArray(local) ? local.filter((e: any) => e && !sentAuditIds.has(e.id)) : [];
      if ((payload as unknown[]).length === 0) return;
    }
    const res = await apiFetch<{ version: number }>('PUT', `/api/data/${encodeURIComponent(key)}`, {
      value: payload,
      version: versions.get(key) ?? 0,
    });
    versions.set(key, res.version);
    if (key === 'auditLogs') {
      rememberAudit(payload);
    } else if (key === 'users') {
      // On relit l'annuaire du serveur (les mots de passe provisoires n'y figurent plus).
      const fresh = await apiFetch<{ value: unknown; version: number }>('GET', '/api/data/users');
      versions.set(key, fresh.version);
      bases.set(key, clone(fresh.value));
      if (!dirty.has(key)) publish(key, fresh.value);
    } else {
      bases.set(key, clone(local));
    }
    offline = false;
    lastSavedAt = Date.now();
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && attempt < 3) {
      // Un collègue a modifié la même donnée : fusion puis nouvel envoi.
      const remote = err.body?.value;
      const merged = threeWayMerge(bases.get(key), local, remote);
      versions.set(key, err.body?.version ?? 0);
      bases.set(key, clone(remote));
      // Si l'utilisateur a encore modifié pendant l'envoi, on fusionne aussi sa dernière version.
      const latest = dirty.has(key) ? threeWayMerge(local, values.get(key), merged) : merged;
      publish(key, latest);
      notice('info', 'Des modifications d\'un collègue ont été fusionnées avec les vôtres.');
      dirty.add(key);
      retryNow = true;
    } else if (err instanceof ApiError && err.status === 0) {
      // Hors ligne : on réessaiera plus tard.
      offline = true;
      dirty.add(key);
      window.setTimeout(() => void save(key), RETRY_MS);
    } else if (err instanceof ApiError && err.status !== 401) {
      // Refus du serveur (droits, données invalides) : retour à la dernière version enregistrée.
      notice('error', `Modification non enregistrée : ${err.message}`);
      if (bases.has(key) && !dirty.has(key)) publish(key, clone(bases.get(key)));
    }
  } finally {
    inFlight.delete(key);
    emitStatus();
  }
  if (retryNow) return save(key, attempt + 1);
  // Une modification arrivée pendant l'envoi, sans envoi programmé ?
  if (dirty.has(key) && !timers.has(key) && !offline) void save(key);
}

function startPolling() {
  window.clearInterval(pollTimer);
  pollTimer = window.setInterval(() => void pullChanges(), POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pullChanges();
  });
}

/** Récupère les données modifiées par d'autres utilisateurs. */
async function pullChanges() {
  if (!loaded || document.visibilityState === 'hidden') return;
  try {
    const { versions: server } = await apiFetch<{ versions: Record<string, number> }>('GET', '/api/data/versions');
    offline = false;
    for (const [key, v] of Object.entries(server)) {
      if (v === (versions.get(key) ?? 0) || dirty.has(key) || inFlight.has(key)) continue;
      const res = await apiFetch<{ value: unknown; version: number }>('GET', `/api/data/${encodeURIComponent(key)}`);
      if (dirty.has(key) || inFlight.has(key)) continue; // modifié localement entre-temps : l'envoi fusionnera
      versions.set(key, res.version);
      bases.set(key, clone(res.value));
      if (key === 'auditLogs') rememberAudit(res.value);
      publish(key, res.value);
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) offline = true;
  }
  emitStatus();
}

// Envoi de dernière chance à la fermeture de l'onglet.
window.addEventListener('pagehide', () => {
  for (const key of [...dirty]) {
    if (key === 'auditLogs' || key === 'users') continue;
    void apiFetch('PUT', `/api/data/${encodeURIComponent(key)}`, { value: values.get(key), version: versions.get(key) ?? 0 }, { keepalive: true }).catch(() => {});
  }
});
