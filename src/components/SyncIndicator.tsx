// src/components/SyncIndicator.tsx — état de l'enregistrement sur le serveur (mode serveur).
import React, { useEffect, useState } from 'react';
import { remoteStore, SYNC_STATUS_EVENT } from '../lib/remoteStore';
import type { SyncStatus } from '../lib/remoteStore';

export const SyncIndicator: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus>({ pending: 0, offline: false, lastSavedAt: null });

  useEffect(() => {
    const onStatus = (e: Event) => setStatus((e as CustomEvent<SyncStatus>).detail);
    window.addEventListener(SYNC_STATUS_EVENT, onStatus);
    // Avertit avant de quitter la page si des modifications ne sont pas encore enregistrées.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (remoteStore.hasPendingChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener(SYNC_STATUS_EVENT, onStatus);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  const { label, dot, text } = status.offline
    ? { label: 'Hors ligne — modifications en attente', dot: 'bg-rose-500', text: 'text-rose-200' }
    : status.pending > 0
      ? { label: 'Enregistrement…', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-200' }
      : { label: 'Enregistré sur le serveur', dot: 'bg-emerald-400', text: 'text-slate-300' };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-3 left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 shadow-lg text-[11px] ${text}`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {label}
    </div>
  );
};
