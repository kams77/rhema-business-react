// src/components/ToastStack.tsx
// Notifications courtes affichées en bas de l'écran (succès, erreurs, informations).
import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  /** Durée d'affichage en ms ; 0 = reste affiché jusqu'à fermeture manuelle. */
  duration: number;
}

const STYLES: Record<ToastType, { box: string; Icon: typeof Info }> = {
  success: { box: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100', Icon: CheckCircle2 },
  error: { box: 'bg-rose-950/95 border-rose-500/50 text-rose-100', Icon: AlertTriangle },
  info: { box: 'bg-slate-900/95 border-indigo-500/50 text-slate-100', Icon: Info },
};

const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast.duration) return;
    const t = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  const { box, Icon } = STYLES[toast.type];
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto w-full max-w-md border rounded-2xl shadow-2xl backdrop-blur p-3.5 flex items-start gap-3 text-sm ${box}`}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <p className="flex-1 leading-relaxed break-words">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Fermer la notification"
        className="p-1 -m-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastStack: React.FC<{ toasts: ToastMessage[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 z-[60] flex flex-col items-center sm:items-end gap-2 pointer-events-none">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
