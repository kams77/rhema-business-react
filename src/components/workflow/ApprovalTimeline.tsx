// src/components/workflow/ApprovalTimeline.tsx — affichage du circuit de validation et de l'historique.
import React from 'react';
import { Check, Clock, X, PenLine, Stamp } from 'lucide-react';
import type { ApprovalStep, WorkflowHistoryEntry } from '../../types';

const fmt = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Circuit en ligne compacte (cartes) : ✓ visé, ● en cours, ○ à venir, ✕ rejeté. */
export const ApprovalChips: React.FC<{ steps: ApprovalStep[] }> = ({ steps }) => {
  const currentId = steps.some(s => s.status === 'rejete') ? undefined : steps.find(s => s.status === 'en_attente')?.id;
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Circuit de validation">
      {steps.map((s, i) => {
        const isCurrent = s.id === currentId;
        const cls = s.status === 'approuve'
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : s.status === 'rejete'
          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          : isCurrent
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
          : 'bg-slate-800 text-slate-400 border-slate-700';
        return (
          <li key={s.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-600 text-[10px]" aria-hidden="true">›</span>}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`}
              title={`${s.label}${s.expectedHolderName ? ` — ${s.expectedHolderName}` : ''}${s.actorName ? ` — ${s.status === 'rejete' ? 'rejeté' : 'visé'} par ${s.actorName}` : ''}`}
            >
              {s.status === 'approuve' ? <Check className="w-3 h-3" /> : s.status === 'rejete' ? <X className="w-3 h-3" /> : isCurrent ? <Clock className="w-3 h-3" /> : <span className="w-3 h-3 inline-flex items-center justify-center">{i + 1}</span>}
              <span className="max-w-[140px] truncate">{s.expectedHolderName || s.label}</span>
              {s.kind === 'signature' && <PenLine className="w-3 h-3 opacity-70" aria-label="signature" />}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

/** Circuit détaillé (fenêtre de consultation) : une ligne par étape avec l'auteur, la date et le commentaire. */
export const ApprovalTimeline: React.FC<{ steps: ApprovalStep[]; title?: string }> = ({ steps, title = 'Circuit de validation' }) => {
  const currentId = steps.some(s => s.status === 'rejete') ? undefined : steps.find(s => s.status === 'en_attente')?.id;
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        <Stamp className="w-3.5 h-3.5 text-indigo-400" /> {title}
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const isCurrent = s.id === currentId;
          return (
            <li
              key={s.id}
              className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                s.status === 'approuve' ? 'border-emerald-500/30 bg-emerald-500/10'
                : s.status === 'rejete' ? 'border-rose-500/30 bg-rose-500/10'
                : isCurrent ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-slate-800 bg-slate-950/40'
              }`}
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                s.status === 'approuve' ? 'bg-emerald-600 text-white'
                : s.status === 'rejete' ? 'bg-rose-600 text-white'
                : isCurrent ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400'
              }`}>
                {s.status === 'approuve' ? <Check className="w-3.5 h-3.5" /> : s.status === 'rejete' ? <X className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-slate-200">{s.label}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">{s.kind === 'signature' ? 'Signature' : 'Visa'}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {s.status === 'approuve' && <>Visé par <strong className="text-slate-200">{s.actorName}</strong> le {fmt(s.at)}</>}
                  {s.status === 'rejete' && <>Rejeté par <strong className="text-slate-200">{s.actorName}</strong> le {fmt(s.at)}</>}
                  {s.status === 'en_attente' && (isCurrent
                    ? <>En attente de <strong className="text-amber-300">{s.expectedHolderName || s.label}</strong></>
                    : <>À venir{s.expectedHolderName ? ` — ${s.expectedHolderName}` : ''}</>)}
                </div>
                {s.comment && <p className="text-[11px] text-slate-300 mt-1 italic">« {s.comment} »</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/** Historique horodaté (journal de la pièce ou de la tâche). */
export const HistoryList: React.FC<{ entries: WorkflowHistoryEntry[] }> = ({ entries }) => (
  <ol className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
    {[...entries].reverse().map(h => (
      <li key={h.id} className="text-[11px] text-slate-400 border-l-2 border-slate-700 pl-2.5">
        <div className="text-slate-200 font-medium">{h.label}</div>
        <div>{h.actorName} — {fmt(h.at)}</div>
        {h.comment && <div className="italic text-slate-300">« {h.comment} »</div>}
      </li>
    ))}
  </ol>
);

export const formatDateTime = fmt;
