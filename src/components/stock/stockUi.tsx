// src/components/stock/stockUi.tsx — éléments communs du module Stocks & Hubs.
import React from 'react';
import type { LogisticsHub, LogisticsItem, StockMovementItem, StockSettings } from '../../types';
import { isTransfer, movementSign, normalizeCategory } from '../../../shared/stock.mjs';
import { csvRow, downloadCsv } from '../../utils/exportUtils';

export const card = 'bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl';
export const input = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white';
export const label = 'block text-[11px] font-semibold text-slate-400 mb-1';
export const th = 'p-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap';
export const td = 'p-2.5 text-xs text-slate-200';
export const btnPrimary = 'px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow disabled:opacity-40 disabled:cursor-not-allowed';
export const btnSecondary = 'px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 disabled:opacity-40';

/** Nombre au format français (espace fine remplacée par une espace simple). */
export const fmt = (n: number, digits = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).replace(/[  ]/g, ' ');

export const money = (n: number, currency: string) => `${fmt(n, 0)} ${currency}`;

export const frDate = (d?: string) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR') : '—');

export const categoryLabel = (settings: StockSettings, c?: string) => settings.categoryLabels[normalizeCategory(c || '')] || c || '—';

export const CATEGORY_IDS = ['vsat', 'energie_solaire', 'hybride'] as const;

export const hubName = (hubs: LogisticsHub[], id?: string) => hubs.find(h => h.id === id)?.name || id || '—';

export const activeHubs = (hubs: LogisticsHub[]) => hubs.filter(h => h.status !== 'inactif');

export const activeItems = (catalog: LogisticsItem[]) => catalog.filter(c => !c.archived);

/** Site concerné par un mouvement (source pour une sortie ou un transfert, destination pour une entrée). */
export const movementSite = (m: StockMovementItem, settings: StockSettings) =>
  isTransfer(m) ? m.sourceHubId : movementSign(m, settings) > 0 ? m.destinationHubId : m.sourceHubId;

export const STATUS_LABEL: Record<string, string> = {
  en_attente_visa: 'Au visa',
  valide: 'Validé',
  en_transit: 'En transit',
  receptionne: 'Reçu',
  rejete: 'Rejeté',
  annule: 'Annulé',
};

export const STATUS_CLASS: Record<string, string> = {
  en_attente_visa: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  valide: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  en_transit: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  receptionne: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejete: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  annule: 'bg-slate-700/40 text-slate-400 border-slate-600',
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${STATUS_CLASS[status] || STATUS_CLASS.annule}`}>
    {STATUS_LABEL[status] || status}
  </span>
);

/** Colonne « CONTRÔLE » : OK en vert, sinon les anomalies en rouge. */
export const ControlCell: React.FC<{ issues: string[] }> = ({ issues }) =>
  issues.length === 0 ? (
    <span className="text-[10px] font-bold text-emerald-400">OK</span>
  ) : (
    <span className="text-[10px] font-bold text-rose-400" title={issues.join(' • ')}>⚠ {issues[0]}{issues.length > 1 ? ` (+${issues.length - 1})` : ''}</span>
  );

export const Kpi: React.FC<{ title: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'default' | 'warn' | 'danger' | 'ok' | 'info'; onClick?: () => void }> = ({ title, value, hint, tone = 'default', onClick }) => {
  const tones = {
    default: 'text-white',
    warn: 'text-amber-300',
    danger: 'text-rose-300',
    ok: 'text-emerald-300',
    info: 'text-sky-300',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`${card} !p-3.5 text-left ${onClick ? 'hover:border-slate-600 transition' : ''}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
      <div className={`text-2xl font-black font-mono mt-1 ${tones[tone]}`}>{value}</div>
      {hint && <div className="text-[10.5px] text-slate-500 mt-0.5">{hint}</div>}
    </Tag>
  );
};

/** Téléchargement d'un CSV (séparateur ; pour Excel en français, protégé contre les formules). */
export function downloadCsvRows(rows: unknown[][], filename: string) {
  downloadCsv(rows.map(r => csvRow(r)), filename);
}

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">{children}</div>
);

/** Fenêtre modale simple (fond sombre, titre, contenu, fermeture). */
export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} my-6 shadow-2xl`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none px-2" aria-label="Fermer">×</button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

/** Peut viser : selon le circuit du bon, sinon responsable logistique. */
export function visaState(ctx: { approvalState?: (id: string) => { canAct: boolean; waiting?: string } | undefined; canManage: boolean }, id: string) {
  const s = ctx.approvalState?.(id);
  return s ? s : { canAct: ctx.canManage, waiting: ctx.canManage ? undefined : 'un responsable logistique' };
}
