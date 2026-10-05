// src/lib/auth.ts
// Hachage des mots de passe (PBKDF2-SHA-256 via Web Crypto) et gestion de la session de travail.
//
// ⚠️ L'application fonctionne entièrement dans le navigateur : ce module empêche de stocker
// les mots de passe en clair et limite les essais, mais il ne remplace pas un vrai serveur
// d'authentification pour un déploiement multi-postes.

import type { User } from '../types';

const PBKDF2_ITERATIONS = 150_000;
const HASH_PREFIX = 'pbkdf2-sha256';

export const MAX_FAILED_ATTEMPTS = 5;
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min d'inactivité
export const SESSION_MAX_DURATION_MS = 10 * 60 * 60 * 1000; // 10 h maximum
export const MIN_PASSWORD_LENGTH = 10;

const SESSION_KEY = 'rhema:session';

// ---------------------------------------------------------------------------
// Encodage
// ---------------------------------------------------------------------------
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (b64: string): Uint8Array => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Le chiffrement du navigateur est indisponible. Ouvrez l'application en HTTPS (ou via http://localhost)."
    );
  }
  return subtle;
}

async function derive(password: string, salt: BufferSource, iterations: number): Promise<Uint8Array> {
  const subtle = getSubtle();
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

// ---------------------------------------------------------------------------
// Mots de passe
// ---------------------------------------------------------------------------
export function isPasswordHash(value: string | undefined): boolean {
  return !!value && value.startsWith(`${HASH_PREFIX}$`);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/** Comparaison à temps constant pour ne pas révéler d'information par la durée. */
function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, iter, saltB64, hashB64] = stored.split('$');
  if (prefix !== HASH_PREFIX || !iter || !saltB64 || !hashB64) return false;
  const computed = await derive(password, fromBase64(saltB64) as BufferSource, Number(iter));
  return safeEqual(computed, fromBase64(hashB64));
}

/**
 * Vérifie le mot de passe d'un utilisateur.
 * Accepte aussi l'ancien format en clair (comptes pas encore migrés).
 */
export async function checkUserPassword(user: User, password: string): Promise<boolean> {
  if (user.passwordHash) return verifyPassword(password, user.passwordHash);
  if (user.password) return user.password === password;
  return false;
}

/** Renvoie un message d'erreur si le mot de passe est trop faible, sinon null. */
export function validatePasswordStrength(password: string, user?: Pick<User, 'email' | 'name'>): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  const lower = password.toLowerCase();
  if (lower.includes('rhema2026') || lower.includes('password') || lower.includes('motdepasse')) {
    return 'Ce mot de passe est trop courant. Choisissez-en un autre.';
  }
  if (user?.email && lower.includes(user.email.split('@')[0].toLowerCase())) {
    return "Le mot de passe ne doit pas contenir votre identifiant.";
  }
  return null;
}

/** Mot de passe temporaire aléatoire (à changer à la première connexion). */
export function generateTemporaryPassword(length = 12): string {
  // Sans caractères ambigus (0/O, 1/l/I) pour faciliter la transmission orale.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  // Garantit au moins un chiffre pour respecter la règle de robustesse.
  return /\d/.test(out) ? out : out.slice(0, -1) + '7';
}

/**
 * Remplace les mots de passe en clair par leur empreinte.
 * Renvoie null si aucun compte n'avait besoin d'être migré.
 */
export async function migratePlaintextPasswords(users: User[], forceChangeOnFirstLogin: boolean): Promise<User[] | null> {
  if (!users.some(u => u.password && !u.passwordHash)) return null;
  return Promise.all(
    users.map(async u => {
      if (!u.password || u.passwordHash) return u;
      const { password, ...rest } = u;
      return {
        ...rest,
        passwordHash: await hashPassword(password),
        mustChangePassword: rest.mustChangePassword ?? forceChangeOnFirstLogin,
      };
    })
  );
}

// ---------------------------------------------------------------------------
// Session (sessionStorage : effacée à la fermeture de l'onglet)
// ---------------------------------------------------------------------------
export interface StoredSession {
  userId: string;
  orgId: string;
  startedAt: number;
  lastActivityAt: number;
}

export function saveSession(session: StoredSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* stockage indisponible : la session ne survivra pas au rechargement */
  }
}

export function touchSession() {
  const s = loadSession();
  if (s) saveSession({ ...s, lastActivityAt: Date.now() });
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Renvoie la session si elle est toujours valide (sinon l'efface et renvoie null). */
export function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    const now = Date.now();
    if (
      typeof s.userId !== 'string' ||
      now - s.startedAt > SESSION_MAX_DURATION_MS ||
      now - s.lastActivityAt > SESSION_IDLE_TIMEOUT_MS
    ) {
      clearSession();
      return null;
    }
    return s;
  } catch {
    clearSession();
    return null;
  }
}
