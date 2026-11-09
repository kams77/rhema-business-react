// Suivi mensuel (feuille SUIVI_MENSUEL du classeur) : entrées et sorties par mois et par catégorie,
// hors « Stock initial », avec transferts envoyés / reçus, pour un site ou tout le réseau.
import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import type { StockContext } from './StockHubsModule';
import { CATEGORY_IDS, btnSecondary, card, categoryLabel, downloadCsvRows, fmt, input, label, td, th } from './stockUi';
import { monthlyTracking } from '../../../shared/stock.mjs';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export const MonthlyPanel: React.FC<StockContext> = ctx => {
  const { movements, catalog, settings, hubs, today } = ctx;
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [hubId, setHubId] = useState('');
  const years = useMemo(() => {
    const ys = new Set<number>([Number(today.slice(0, 4))]);
    movements.forEach(m => m.date && ys.add(Number(m.date.slice(0, 4))));
    return [...ys].sort((a, b) => b - a);
  }, [movements, today]);
  const rows = useMemo(() => monthlyTracking(movements, catalog, settings, year, hubId || undefined), [movements, catalog, settings, year, hubId]);
  const total = (f: (r: typeof rows[number]) => number) => rows.reduce((t, r) => t + f(r), 0);
  const maxBar = Math.max(1, ...rows.map(r => Math.max(r.entries, r.exits)));

  const exportCsv = () => downloadCsvRows([
    ['Année', year, 'Site', hubId ? hubs.find(h => h.id === hubId)?.name : 'Tout le réseau'],
    ['Mois', ...CATEGORY_IDS.flatMap(c => [`Entrées ${categoryLabel(settings, c)}`, `Sorties ${categoryLabel(settings, c)}`]), 'Total entrées', 'Total sorties', 'Net', 'Transferts envoyés', 'Transferts reçus'],
    ...rows.map(r => [MONTHS[r.month - 1], ...CATEGORY_IDS.flatMap(c => [r.byCategory[c]?.entries || 0, r.byCategory[c]?.exits || 0]), r.entries, r.exits, r.entries - r.exits, r.sent, r.received]),
  ], `suivi-mensuel-${year}${hubId ? `-${hubs.find(h => h.id === hubId)?.code}` : ''}.csv`);

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-end gap-3 justify-between`}>
        <div className="flex gap-3 items-end">
          <div>
            <label className={label}>Année</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className={input} aria-label="Année">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Site</label>
            <select value={hubId} onChange={e => setHubId(e.target.value)} className={input} aria-label="Site">
              <option value="">Tout le réseau</option>
              {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 max-w-md">Hors « Stock initial ». Pour le réseau entier, un transfert ne change pas le stock total : il apparaît à part (envoyés / reçus).</p>
        <button type="button" onClick={exportCsv} className={btnSecondary}><Download className="w-3.5 h-3.5" /> Exporter (CSV)</button>
      </div>

      <div className={`${card} !p-0 overflow-x-auto`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50">
              <th className={th} rowSpan={2}>Mois</th>
              {CATEGORY_IDS.map(c => <th key={c} className={`${th} text-center border-l border-slate-800`} colSpan={2}>{categoryLabel(settings, c)}</th>)}
              <th className={`${th} text-center border-l border-slate-800`} colSpan={3}>Total</th>
              <th className={`${th} text-center border-l border-slate-800`} colSpan={2}>Transferts</th>
              <th className={`${th} border-l border-slate-800`} rowSpan={2}>Entrées / sorties</th>
            </tr>
            <tr className="border-b border-slate-800 bg-slate-950/50">
              {CATEGORY_IDS.flatMap(c => [
                <th key={`${c}-e`} className={`${th} text-right border-l border-slate-800`}>Entrées</th>,
                <th key={`${c}-s`} className={`${th} text-right`}>Sorties</th>,
              ])}
              <th className={`${th} text-right border-l border-slate-800`}>Entrées</th><th className={`${th} text-right`}>Sorties</th><th className={`${th} text-right`}>Net</th>
              <th className={`${th} text-right border-l border-slate-800`}>Envoyés</th><th className={`${th} text-right`}>Reçus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.map(r => {
              const net = r.entries - r.exits;
              const current = `${year}-${String(r.month).padStart(2, '0')}` === today.slice(0, 7);
              return (
                <tr key={r.month} className={current ? 'bg-amber-500/[0.06]' : ''}>
                  <td className={`${td} font-semibold`}>{MONTHS[r.month - 1]}</td>
                  {CATEGORY_IDS.flatMap(c => [
                    <td key={`${c}-e`} className={`${td} text-right font-mono border-l border-slate-800/70 text-emerald-300`}>{fmt(r.byCategory[c]?.entries || 0)}</td>,
                    <td key={`${c}-s`} className={`${td} text-right font-mono text-rose-300`}>{fmt(r.byCategory[c]?.exits || 0)}</td>,
                  ])}
                  <td className={`${td} text-right font-mono font-bold border-l border-slate-800/70 text-emerald-300`}>{fmt(r.entries)}</td>
                  <td className={`${td} text-right font-mono font-bold text-rose-300`}>{fmt(r.exits)}</td>
                  <td className={`${td} text-right font-mono font-bold ${net < 0 ? 'text-rose-300' : ''}`}>{net > 0 ? '+' : ''}{fmt(net)}</td>
                  <td className={`${td} text-right font-mono border-l border-slate-800/70`}>{fmt(r.sent)}</td>
                  <td className={`${td} text-right font-mono`}>{fmt(r.received)}</td>
                  <td className={`${td} border-l border-slate-800/70 w-40`}>
                    <div className="h-1.5 rounded bg-emerald-500/80 mb-0.5" style={{ width: `${(r.entries / maxBar) * 100}%` }} />
                    <div className="h-1.5 rounded bg-rose-500/80" style={{ width: `${(r.exits / maxBar) * 100}%` }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-700 font-bold">
              <td className={`${td} font-black`}>TOTAL {year}</td>
              {CATEGORY_IDS.flatMap(c => [
                <td key={`${c}-e`} className={`${td} text-right font-mono border-l border-slate-800/70`}>{fmt(total(r => r.byCategory[c]?.entries || 0))}</td>,
                <td key={`${c}-s`} className={`${td} text-right font-mono`}>{fmt(total(r => r.byCategory[c]?.exits || 0))}</td>,
              ])}
              <td className={`${td} text-right font-mono border-l border-slate-800/70`}>{fmt(total(r => r.entries))}</td>
              <td className={`${td} text-right font-mono`}>{fmt(total(r => r.exits))}</td>
              <td className={`${td} text-right font-mono`}>{fmt(total(r => r.entries - r.exits))}</td>
              <td className={`${td} text-right font-mono border-l border-slate-800/70`}>{fmt(total(r => r.sent))}</td>
              <td className={`${td} text-right font-mono`}>{fmt(total(r => r.received))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
