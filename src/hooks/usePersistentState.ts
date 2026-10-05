// src/hooks/usePersistentState.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { loadValue, saveValue } from '../lib/storage';
import { remoteStore } from '../lib/remoteStore';
import { API_MODE } from '../config';

interface PersistentOptions {
  /**
   * Mode serveur uniquement : utiliser la valeur par défaut fournie quand la donnée n'existe pas
   * encore sur le serveur (réglages, calculateurs…). Par défaut, les listes démarrent vides et les
   * objets vides, pour ne jamais mélanger des données de démonstration aux données réelles.
   */
  keepDefaultInApi?: boolean;
}

/**
 * Comme useState, mais la valeur est conservée :
 * - en mode local : dans le navigateur (clé préfixée « rhema:v1: ») ;
 * - en mode serveur (VITE_BACKEND=api) : sur le serveur, partagée entre tous les utilisateurs.
 *
 * @param key     Nom unique de la donnée (ex. « users », « logistics.hubs »)
 * @param initial Valeur par défaut utilisée si rien n'est encore enregistré
 */
export const usePersistentState: <T>(
  key: string,
  initial: T | (() => T),
  options?: PersistentOptions
) => [T, Dispatch<SetStateAction<T>>] = API_MODE ? useRemoteState : useLocalState;

const resolve = <T,>(initial: T | (() => T)): T =>
  typeof initial === 'function' ? (initial as () => T)() : initial;

/** Valeur « vide » de même forme que la valeur par défaut. */
function emptyLike<T>(value: T): T {
  if (Array.isArray(value)) return [] as unknown as T;
  if (value && typeof value === 'object') return {} as T;
  return value;
}

// ---------------------------------------------------------------------------
// Mode serveur
// ---------------------------------------------------------------------------
function useRemoteState<T>(key: string, initial: T | (() => T), options: PersistentOptions = {}): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const fallback = resolve(initial);
    return remoteStore.get<T>(key, options.keepDefaultInApi ? fallback : emptyLike(fallback));
  });
  const latest = useRef(value);

  // Modifications venues du serveur (collègue, fusion, refus) : mise à jour de l'écran sans renvoi.
  useEffect(
    () =>
      remoteStore.subscribe(key, v => {
        latest.current = v as T;
        setValue(v as T);
      }),
    [key]
  );

  const set = useCallback<Dispatch<SetStateAction<T>>>(
    action => {
      const next = typeof action === 'function' ? (action as (prev: T) => T)(latest.current) : action;
      if (Object.is(next, latest.current)) return;
      latest.current = next;
      setValue(next);
      remoteStore.set(key, next);
    },
    [key]
  );

  return [value, set];
}

// ---------------------------------------------------------------------------
// Mode local (navigateur)
// ---------------------------------------------------------------------------
function useLocalState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => loadValue<T>(key, resolve(initial)));

  const latest = useRef(value);
  const pending = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const isFirstRender = useRef(true);

  // Enregistrement différé (250 ms) pour regrouper les modifications rapprochées.
  useEffect(() => {
    latest.current = value;
    if (isFirstRender.current) {
      // La valeur vient déjà du stockage (ou des données par défaut) : rien à écrire.
      isFirstRender.current = false;
      return;
    }
    pending.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      pending.current = false;
      saveValue(key, latest.current);
    }, 250);
  }, [key, value]);

  // Ne jamais perdre une modification en attente (fermeture d'onglet, démontage du composant).
  useEffect(() => {
    const flush = () => {
      if (!pending.current) return;
      window.clearTimeout(timer.current);
      pending.current = false;
      saveValue(key, latest.current);
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [key]);

  return [value, setValue];
}
