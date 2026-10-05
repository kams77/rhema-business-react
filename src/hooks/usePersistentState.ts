// src/hooks/usePersistentState.ts
import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { loadValue, saveValue } from '../lib/storage';

/**
 * Comme useState, mais la valeur est relue au démarrage et enregistrée
 * dans le navigateur à chaque modification (clé préfixée « rhema:v1: »).
 *
 * @param key     Nom unique de la donnée (ex. « users », « logistics.hubs »)
 * @param initial Valeur par défaut utilisée si rien n'est encore enregistré
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === 'function' ? (initial as () => T)() : initial;
    return loadValue<T>(key, fallback);
  });

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
