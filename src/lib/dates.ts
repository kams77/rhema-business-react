// src/lib/dates.ts — dates « locales » (heure de Kinshasa, UTC+1).
//
// new Date().toISOString() donne la date en UTC : entre minuit et 1 h du matin à Kinshasa,
// elle renvoie la veille. Ces fonctions utilisent toujours le calendrier local.

const pad = (n: number) => String(n).padStart(2, '0');

/** Date locale au format AAAA-MM-JJ. */
export function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Aujourd'hui (AAAA-MM-JJ, calendrier local). */
export function todayLocal(): string {
  return toLocalISODate(new Date());
}

/** Date locale et heure (« AAAA-MM-JJ HH:MM »), triable. */
export function localDateTime(d: Date = new Date()): string {
  return `${toLocalISODate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Lit une date AAAA-MM-JJ comme une date locale (sans décalage de fuseau). */
export function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Aujourd'hui + n jours (AAAA-MM-JJ). */
export function addDaysLocal(n: number, from: string | Date = new Date()): string {
  const base = typeof from === 'string' ? parseLocalDate(from) ?? new Date() : new Date(from);
  base.setDate(base.getDate() + n);
  return toLocalISODate(base);
}

/** Année en cours (pour les numéros de référence). */
export function currentYear(): number {
  return new Date().getFullYear();
}

/**
 * Nombre de jours ouvrables (lundi à samedi exclu le dimanche, comme le Code du travail congolais
 * compte les congés en jours ouvrables) entre deux dates incluses. Renvoie 0 si la plage est invalide.
 */
export function workingDaysBetween(startIso: string, endIso: string): number {
  const start = parseLocalDate(startIso);
  const end = parseLocalDate(endIso);
  if (!start || !end || end < start) return 0;
  let n = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) n++;
  }
  return n;
}
