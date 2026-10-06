// src/lib/merge.ts — fusion « à trois voies » quand deux personnes modifient la même donnée.
//
// base   : la version que j'avais chargée
// local  : ma version modifiée
// remote : la version enregistrée entre-temps par un collègue
//
// Règles : les ajouts et suppressions des deux côtés sont conservés ; si le même élément
// (même « id ») a été modifié des deux côtés, ma modification l'emporte.

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isIdList = (v: unknown): v is Array<{ id: string }> =>
  Array.isArray(v) && v.every(x => isRecord(x) && typeof x.id === 'string');

export function threeWayMerge<T>(base: T, local: T, remote: T): T {
  if (same(local, base)) return remote;
  if (same(local, remote) || same(remote, base)) return local;

  if (isIdList(base ?? []) && isIdList(local) && isIdList(remote)) {
    const b = new Map((base as unknown as Array<{ id: string }> ?? []).map(x => [x.id, x]));
    const l = new Map(local.map(x => [x.id, x]));
    const r = new Map(remote.map(x => [x.id, x]));
    const out: Array<{ id: string }> = [];

    // Mes ajouts, en tête (l'application ajoute les nouveaux éléments au début).
    for (const item of local) if (!b.has(item.id) && !r.has(item.id)) out.push(item);

    for (const item of remote) {
      const mine = l.get(item.id);
      const original = b.get(item.id);
      if (mine) {
        out.push(original && !same(mine, original) ? mine : item);
      } else if (!original || !same(item, original)) {
        // Supprimé chez moi mais modifié (ou ajouté) par le collègue : on garde sa version.
        out.push(item);
      }
    }

    // Supprimé par le collègue mais modifié chez moi : on garde ma version.
    for (const item of local) {
      const original = b.get(item.id);
      if (original && !r.has(item.id) && !same(item, original)) out.push(item);
    }
    return out as unknown as T;
  }

  if (isRecord(local) && isRecord(remote)) {
    const b = isRecord(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(local), ...Object.keys(remote)])) {
      const merged = threeWayMerge(b[k], local[k], remote[k]);
      if (merged !== undefined) out[k] = merged;
    }
    return out as T;
  }

  return local;
}
