// src/lib/storage.ts
// Persistance locale des données de l'application (navigateur).
// Toutes les clés sont préfixées et versionnées pour permettre des migrations futures.

export const STORAGE_PREFIX = 'rhema:v1:';
export const STORAGE_ERROR_EVENT = 'rhema:storage-error';
export const BACKUP_APP_ID = 'rhema-business';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  version: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

const fullKey = (key: string) => `${STORAGE_PREFIX}${key}`;

// Bloque toute écriture pendant une réinitialisation ou une restauration,
// pour qu'un enregistrement en attente ne vienne pas écraser les nouvelles données.
let writesSuspended = false;

/** À appeler juste avant un rechargement de page qui suit une restauration ou une remise à zéro. */
export function suspendWritesUntilReload() {
  writesSuspended = true;
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Accès refusé (navigation privée stricte, cookies bloqués…)
    return null;
  }
}

function reportError(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: message }));
}

export function loadValue<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(fullKey(key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Donnée corrompue : on repart de la valeur par défaut sans planter l'application.
    console.warn(`[storage] Valeur illisible pour "${key}", valeur par défaut utilisée.`);
    return fallback;
  }
}

export function saveValue<T>(key: string, value: T): boolean {
  if (writesSuspended) return false;
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(fullKey(key), JSON.stringify(value));
    return true;
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    reportError(
      isQuota
        ? "Espace de stockage du navigateur plein : les dernières modifications n'ont pas pu être enregistrées. Exportez une sauvegarde puis supprimez des documents volumineux (logos, scans)."
        : "Impossible d'enregistrer les données dans ce navigateur."
    );
    return false;
  }
}

export function removeValue(key: string) {
  getStorage()?.removeItem(fullKey(key));
}

function appKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  return keys;
}

/** Taille approximative (en octets) des données enregistrées par l'application. */
export function getStorageUsageBytes(): number {
  const storage = getStorage();
  if (!storage) return 0;
  return appKeys(storage).reduce((total, k) => total + k.length + (storage.getItem(k)?.length ?? 0), 0) * 2;
}

export function hasSavedData(): boolean {
  const storage = getStorage();
  return !!storage && appKeys(storage).length > 0;
}

export function buildBackup(): BackupFile {
  const storage = getStorage();
  const data: Record<string, unknown> = {};
  if (storage) {
    for (const k of appKeys(storage)) {
      // La session en cours n'est jamais exportée.
      if (k === fullKey('session')) continue;
      try {
        data[k.slice(STORAGE_PREFIX.length)] = JSON.parse(storage.getItem(k) ?? 'null');
      } catch {
        /* clé illisible ignorée */
      }
    }
  }
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackup() {
  const backup = buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = backup.exportedAt.slice(0, 16).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `rhema-sauvegarde-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Vérifie puis restaure un fichier de sauvegarde. Lève une erreur lisible si le fichier est invalide. */
export function restoreBackup(content: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Ce fichier n'est pas un fichier JSON valide.");
  }
  const backup = parsed as Partial<BackupFile>;
  if (!backup || backup.app !== BACKUP_APP_ID || typeof backup.data !== 'object' || backup.data === null) {
    throw new Error("Ce fichier n'est pas une sauvegarde RHEMA Business.");
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new Error('Cette sauvegarde provient d\'une version plus récente de l\'application.');
  }
  const storage = getStorage();
  if (!storage) throw new Error('Le stockage du navigateur est indisponible.');

  // Copie de secours de l'état actuel, au cas où l'écriture échouerait à mi-chemin.
  const previous = buildBackup();
  writesSuspended = true;
  try {
    clearAllData();
    for (const [k, v] of Object.entries(backup.data)) {
      if (k === 'session') continue;
      storage.setItem(fullKey(k), JSON.stringify(v));
    }
  } catch {
    clearAllData();
    for (const [k, v] of Object.entries(previous.data)) {
      try { storage.setItem(fullKey(k), JSON.stringify(v)); } catch { /* ignore */ }
    }
    writesSuspended = false;
    throw new Error("La restauration a échoué (espace insuffisant ?). Les données précédentes ont été conservées.");
  }
}

export function clearAllData() {
  const storage = getStorage();
  if (!storage) return;
  for (const k of appKeys(storage)) storage.removeItem(k);
}

/** Efface toutes les données enregistrées et bloque les écritures jusqu'au rechargement. */
export function resetAllData() {
  writesSuspended = true;
  clearAllData();
}
