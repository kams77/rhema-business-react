// src/lib/integrity.ts — empreintes SHA-256 réelles (Web Crypto).
//
// Une empreinte permet de vérifier qu'un document n'a pas été modifié depuis son émission :
// on recalcule l'empreinte de son contenu et on la compare à celle enregistrée.
// Elle ne remplace pas une signature électronique qualifiée (certificat d'un prestataire agréé).

/** Sérialisation stable : les clés sont triées, pour qu'un même contenu donne toujours la même empreinte. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter(k => obj[k] !== undefined)
    .sort()
    .map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

/** Empreinte SHA-256 (hexadécimal) d'un texte. */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Le chiffrement du navigateur est indisponible. Ouvrez l'application en HTTPS (ou via http://localhost).");
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** Empreinte SHA-256 d'un objet (forme canonique), en excluant éventuellement certains champs. */
export async function contentHash(value: Record<string, unknown>, exclude: string[] = []): Promise<string> {
  const copy: Record<string, unknown> = { ...value };
  for (const k of exclude) delete copy[k];
  return sha256Hex(canonicalJson(copy));
}

/** Format court lisible : « sha256:1a2b3c4d…9f8e7d6c ». */
export function shortHash(hex: string | undefined): string {
  if (!hex) return '—';
  const h = hex.replace(/^sha256:/i, '');
  return h.length > 20 ? `sha256:${h.slice(0, 12)}…${h.slice(-8)}` : `sha256:${h}`;
}
