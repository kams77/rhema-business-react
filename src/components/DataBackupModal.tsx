// src/components/DataBackupModal.tsx
// Sauvegarde locale : export / import d'un fichier JSON et remise à zéro des données.
import React, { useRef, useState } from 'react';
import { Database, Download, Upload, RotateCcw, X, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import {
  downloadBackup,
  getStorageUsageBytes,
  restoreBackup,
  resetAllData,
} from '../lib/storage';

interface DataBackupModalProps {
  isOpen: boolean;
  canManage: boolean;
  onClose: () => void;
  onAudit?: (action: string, details: string) => void;
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} Ko` : `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;

// La plupart des navigateurs accordent environ 5 Mo par site.
const QUOTA_ESTIMATE = 5 * 1024 * 1024;

export const DataBackupModal: React.FC<DataBackupModalProps> = ({ isOpen, canManage, onClose, onAudit }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const usage = getStorageUsageBytes();
  const usagePct = Math.min(100, Math.round((usage / QUOTA_ESTIMATE) * 100));

  const handleExport = () => {
    setError(null);
    onAudit?.('Export de sauvegarde', 'Téléchargement d\'un fichier de sauvegarde complet des données locales.');
    downloadBackup();
    setInfo('Sauvegarde téléchargée. Conservez ce fichier en lieu sûr : il contient toutes les données de l\'entreprise.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setInfo(null);
    if (file.size > 20 * 1024 * 1024) {
      setError('Fichier trop volumineux (20 Mo maximum).');
      return;
    }
    if (!window.confirm('Restaurer cette sauvegarde remplacera TOUTES les données actuelles de ce navigateur. Continuer ?')) {
      return;
    }
    try {
      restoreBackup(await file.text());
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restauration impossible.');
    }
  };

  const handleReset = () => {
    resetAllData();
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-title"
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 id="backup-title" className="text-base font-bold text-white">Sauvegarde des données</h3>
              <p className="text-xs text-slate-400">Les données sont enregistrées dans ce navigateur.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Espace utilisé</span>
            <span className="font-mono">{formatSize(usage)} / ~5 Mo</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${usagePct > 85 ? 'bg-rose-500' : usagePct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.max(usagePct, 2)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Les données ne sont pas partagées entre ordinateurs. Exportez régulièrement une sauvegarde pour ne rien perdre
            (changement de navigateur, nettoyage de l'historique…).
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex gap-2" role="alert">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {info && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex gap-2" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {info}
          </div>
        )}

        {!canManage ? (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs flex gap-2">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            Seule la Direction Générale peut exporter, restaurer ou effacer les données.
          </div>
        ) : (
          <div className="space-y-2.5">
            <button
              onClick={handleExport}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
            >
              <Download className="w-4 h-4" /> Exporter une sauvegarde (.json)
            </button>

            <button
              onClick={() => fileInput.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold transition"
            >
              <Upload className="w-4 h-4" /> Restaurer depuis un fichier
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />

            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-transparent hover:bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold transition"
              >
                <RotateCcw className="w-4 h-4" /> Revenir aux données de démonstration
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 space-y-2">
                <p className="text-xs text-rose-200">
                  Toutes les données enregistrées dans ce navigateur seront effacées définitivement. Pensez à exporter une sauvegarde avant.
                </p>
                <div className="flex gap-2">
                  <button onClick={handleReset} className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">
                    Oui, tout effacer
                  </button>
                  <button onClick={() => setConfirmReset(false)} className="flex-1 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
