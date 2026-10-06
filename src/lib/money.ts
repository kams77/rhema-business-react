// src/lib/money.ts — montants : arrondis, conversion USD/CDF, lecture de montants saisis.

/** Arrondi au centime (USD). */
export function round2(n: number): number {
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
}

/** Conversion USD -> CDF, arrondie au franc. */
export function usdToCdf(usd: number, rate: number): number {
  return Number.isFinite(usd) && rate > 0 ? Math.round(usd * rate) : 0;
}

/** Conversion CDF -> USD, arrondie au centime. */
export function cdfToUsd(cdf: number, rate: number): number {
  return Number.isFinite(cdf) && rate > 0 ? round2(cdf / rate) : 0;
}

/** Deux montants sont-ils égaux au centime près ? */
export function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/** « 27 293 310 CDF » */
export function formatCDF(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} CDF`;
}

/** « 9 576,60 $ » */
export function formatUSD(n: number): string {
  return `${round2(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

/**
 * Lit un montant saisi ou importé, au format français ou anglais :
 * « 1200,50 », « 1 200,50 », « 1.200,50 », « 1,200.50 », « 1200.50 », « $ 1 200 ».
 * Renvoie null si la valeur est vide ou illisible (un vrai 0 renvoie 0).
 */
export function parseAmount(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/[\s  ]/g, '').replace(/[^0-9,.\-]/g, '');
  if (!s || s === '-' ) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Le dernier séparateur est le séparateur décimal, l'autre sépare les milliers.
    const dec = lastComma > lastDot ? ',' : '.';
    const thousands = dec === ',' ? '.' : ',';
    s = s.split(thousands).join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    // Une seule virgule suivie de 3 chiffres exactement et plusieurs groupes => milliers (« 1,200,000 »).
    const parts = s.split(',');
    s = parts.length > 2 && parts.slice(1).every(p => p.length === 3) ? parts.join('') : parts.join('.');
    if ((s.match(/\./g) || []).length > 1) return null;
  } else if ((s.match(/\./g) || []).length > 1) {
    const parts = s.split('.');
    if (!parts.slice(1).every(p => p.length === 3)) return null;
    s = parts.join('');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
