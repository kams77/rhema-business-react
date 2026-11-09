// src/lib/attendance.ts — pointage automatique (écrans).
//
// Mode serveur : le serveur pointe lui-même (arrivée à la première activité du jour, départ à la
// déconnexion ou à la dernière activité) ; l'écran lit les journées et déclare les pauses.
// Mode navigateur (sans serveur) : mêmes règles, appliquées et enregistrées dans ce navigateur.
import { useCallback, useEffect, useState } from 'react';
import { API_MODE } from '../config';
import { apiFetch } from './api';
import { loadValue, saveValue } from './storage';
import type { AttendanceDay, HierarchicalEntity, User } from '../types';
import {
  applyAttendanceEvent,
  canSeeAttendanceOf,
  localDay,
} from '../../shared/attendance.mjs';

export {
  NORMAL_DAY_HOURS,
  breakSeconds,
  isOnBreak,
  workedSeconds,
} from '../../shared/attendance.mjs';

export interface AttendanceSnapshot {
  /** Jour local (serveur) */
  today: string;
  /** Heure du serveur au moment de la lecture (ISO) */
  now: string;
  days: AttendanceDay[];
}

/** Clé de stockage du mode navigateur. */
const LOCAL_KEY = 'pointage';

let lastLocalActivity = { userId: '', at: 0 };

function localEvent(user: Pick<User, 'id' | 'name'>, type: 'activite' | 'pause' | 'reprise' | 'depart'): AttendanceDay | null {
  const now = new Date();
  // Activité : une écriture par minute au plus (comme le serveur).
  if (type === 'activite') {
    if (lastLocalActivity.userId === user.id && now.getTime() - lastLocalActivity.at < 60_000) return null;
    lastLocalActivity = { userId: user.id, at: now.getTime() };
  } else if (type === 'depart') {
    lastLocalActivity = { userId: '', at: 0 };
  }
  const r = applyAttendanceEvent(loadValue<AttendanceDay[]>(LOCAL_KEY, []), { id: user.id, name: user.name }, type, now.toISOString(), localDay(now));
  if (r.changed) saveValue(LOCAL_KEY, r.days);
  return r.record;
}

/** Jour AAAA-MM-JJ décalé de n jours. */
export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const attendance = {
  /** Activité de l'utilisateur (mode navigateur ; en mode serveur, chaque requête compte). */
  touch(user: User) {
    if (!API_MODE) localEvent(user, 'activite');
  },
  /** Déconnexion : départ (mode navigateur ; en mode serveur, la route de déconnexion s'en charge). */
  depart(user: User) {
    if (!API_MODE) localEvent(user, 'depart');
  },
  /** Pause ou reprise déclarée par l'agent. */
  async declare(user: User, type: 'pause' | 'reprise'): Promise<AttendanceDay | null> {
    if (API_MODE) return (await apiFetch<{ day: AttendanceDay | null }>('POST', '/api/pointage', { type })).day;
    return localEvent(user, type);
  },
  /** Journées visibles par l'utilisateur sur une période (lui-même, ou son périmètre s'il est responsable). */
  async list(viewer: User, from: string, to: string, entities: HierarchicalEntity[], users: User[]): Promise<AttendanceSnapshot> {
    if (API_MODE) {
      return apiFetch<AttendanceSnapshot>('GET', `/api/pointage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    }
    // Consulter l'application est une activité : l'arrivée du jour est enregistrée si besoin.
    localEvent(viewer, 'activite');
    const now = new Date();
    const byId = new Map(users.map(u => [u.id, u]));
    const days = loadValue<AttendanceDay[]>(LOCAL_KEY, []).filter(d => {
      if (d.date < from || d.date > to) return false;
      const target = byId.get(d.userId) || ({ id: d.userId, role: 'agent' } as User);
      return canSeeAttendanceOf(viewer, target, entities);
    });
    return { today: localDay(now), now: now.toISOString(), days };
  },
};

/**
 * Journées de présence d'une période, rafraîchies toutes les minutes.
 * `offsetMs` = écart entre l'horloge du serveur et celle du poste (pour les compteurs en direct).
 */
export function useAttendance(viewer: User, from: string, to: string, entities: HierarchicalEntity[], users: User[]) {
  const [snapshot, setSnapshot] = useState<AttendanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const s = await attendance.list(viewer, from, to, entities, users);
      setSnapshot(s);
      setOffsetMs(Date.parse(s.now) - Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pointages indisponibles.');
    }
    // Les listes (entities, users) changent souvent d'identité : on suit leur taille.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.id, from, to, entities.length, users.length]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { snapshot, error, offsetMs, refresh };
}

/** Heure locale HH:MM d'un horodatage ISO. */
export const clock = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

/** Durée « 7 h 45 » à partir de secondes. */
export function duration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}
