// src/lib/sequence.ts — numéros de référence uniques et suivis (FAC-2026-001, MAT-2026-014…).
//
// Le numéro suivant = plus grand numéro existant de l'année + 1 : jamais de doublon après une
// suppression (contrairement à « nombre d'éléments + 1 ») et la numérotation repart à 1 chaque année.
import { currentYear } from './dates';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Prochaine référence « PREFIXE-AAAA-NNN ».
 * @param prefix   ex. « FAC-VSAT », « MAT », « DOC »
 * @param existing références déjà attribuées (toutes années confondues)
 * @param width    nombre minimal de chiffres
 */
export function nextReference(prefix: string, existing: Array<string | undefined | null>, width = 3, year = currentYear()): string {
  const re = new RegExp(`^${escape(prefix)}-${year}-(\\d+)$`, 'i');
  let max = 0;
  for (const ref of existing) {
    const m = ref ? re.exec(ref.trim()) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${year}-${String(max + 1).padStart(width, '0')}`;
}

/** Plusieurs références d'un coup (import en masse). */
export function nextReferences(prefix: string, existing: Array<string | undefined | null>, count: number, width = 3): string[] {
  const out: string[] = [];
  const all = [...existing];
  for (let i = 0; i < count; i++) {
    const ref = nextReference(prefix, all, width);
    out.push(ref);
    all.push(ref);
  }
  return out;
}

/** Code aléatoire sûr (générateur cryptographique) de n chiffres, le premier non nul. */
export function secureDigits(n: number): string {
  const bytes = new Uint32Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b, i) => (i === 0 ? 1 + (b % 9) : b % 10)).join('');
}

/** Masque une clé dans les journaux : « 48•••••••21 ». */
export function maskSecret(s: string): string {
  return s.length <= 4 ? '•'.repeat(s.length) : `${s.slice(0, 2)}${'•'.repeat(s.length - 4)}${s.slice(-2)}`;
}
