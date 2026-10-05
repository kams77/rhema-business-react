// src/utils/id.ts

/** Identifiant unique, même pour deux éléments créés dans la même milliseconde. */
export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

/** Date et heure lisibles (ex. « 05/10/2026 15:30:12 »), utilisées dans les journaux. */
export function nowStamp(date: Date = new Date()): string {
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
