// server/auth.mjs — mots de passe et sessions (même format d'empreinte que src/lib/auth.ts).
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(crypto.pbkdf2);
const PREFIX = 'pbkdf2-sha256';
const ITERATIONS = 150_000;

export const MAX_FAILED_ATTEMPTS = 5;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_MAX_MS = 10 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 10;

export function isPasswordHash(value) {
  return typeof value === 'string' && value.startsWith(`${PREFIX}$`);
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await pbkdf2(password, salt, ITERATIONS, 32, 'sha256');
  return `${PREFIX}$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || !isPasswordHash(stored)) return false;
  const [, iter, saltB64, hashB64] = stored.split('$');
  const expected = Buffer.from(hashB64, 'base64');
  const computed = await pbkdf2(password, Buffer.from(saltB64, 'base64'), Number(iter), expected.length, 'sha256');
  return expected.length === computed.length && crypto.timingSafeEqual(expected, computed);
}

/** Empreinte factice : permet de faire le même calcul quand le compte n'existe pas (pas de fuite par la durée). */
let dummyHash;
export async function burnTime(password) {
  dummyHash ??= await hashPassword('rhema-dummy-password');
  await verifyPassword(String(password ?? ''), dummyHash);
}

/** Mêmes règles que l'application (src/lib/auth.ts). Renvoie un message ou null. */
export function validatePasswordStrength(password, user = {}) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (password.length > 200) return 'Le mot de passe est trop long.';
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  const lower = password.toLowerCase();
  if (lower.includes('rhema2026') || lower.includes('password') || lower.includes('motdepasse')) {
    return 'Ce mot de passe est trop courant. Choisissez-en un autre.';
  }
  if (user.email && lower.includes(String(user.email).split('@')[0].toLowerCase())) {
    return 'Le mot de passe ne doit pas contenir votre identifiant.';
  }
  return null;
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/** Seule l'empreinte du jeton est stockée en base : une fuite de la base ne donne pas accès aux sessions. */
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function safeEqualStrings(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
