// Stock par site (feuille STOCK_SITES du classeur) : une ligne par article, une colonne par site.
// Rouge = négatif, orange = sous le seuil d'alerte de l'article (sites actifs).
import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { StockContext } from './StockHubsModule';
import { CATEGORY_IDS, Empty, btnSecondary, card, categoryLabel, downloadCsvRows, fmt, input, td, th } from './stockUi';
import { computeBalances, normalizeCategory } from '../../../shared/stock.mjs';

export const StockMatrixPanel: React.FC<StockContext> = ctx => {
  const { catalog, hubs, movements, settings } = ctx;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [onlyAlerts, setOnlyAlerts] = useState(ctx.initialFilter === 'alert');
  const [showInactive, setShowInactive] = useState(false);
  const sites = hubs.filter(h => showInactive || h.status !== 'inactif');
  const bal = useMemo(() => computeBalances(movements, settings), [movements, settings]);

  const cellState = (qty: number, thr: number, inactive: boolean) =>
    qty < 0 ? 'neg' : !inactive && thr > 0 && qty < thr ? 'low' : 'ok';

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog
      .filter(c => !c.archived || sites.some(h => bal.get(h.id, c.id) !== 0))
      .filter(c => !cat || normalizeCategory(c.category) === cat)
      .filter(c => !needle || `${c.sku} ${c.name} ${c.brand}`.toLowerCase().includes(needle))
      .map(c => {
        const thr = Number(c.minAlertThreshold) || 0;
        const cells = sites.map(h => ({ hub: h, qty: bal.get(h.id, c.id), transit: bal.inTransit(h.id, c.id) }));
        const total = cells.reduce((t, x) => t + x.qty, 0);
        const alerts = cells.filter(x => cellState(x.qty, thr, x.hub.status === 'inactif') !== 'ok').length;
        return { c, thr, cells, total, alerts };
      })
      .filter(r => !onlyAlerts || r.alerts > 0)
      .sort((a, b) => normalizeCategory(a.c.category).localeCompare(normalizeCategory(b.c.category)) || a.c.sku.localeCompare(b.c.sku));
  }, [catalog, sites, bal, q, cat, onlyAlerts]);

  const exportCsv = () => downloadCsvRows([
    ['Code article', 'Désignation', 'Catégorie', 'Seuil', ...sites.map(h => h.name), 'Total réseau'],
    ...rows.map(r => [r.c.sku, r.c.name, categoryLabel(settings, r.c.category), r.thr, ...r.cells.map(x => x.qty), r.total]),
  ], `stock-par-site-${ctx.today}.csv`);

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Stock par site</h3>
            <p className="text-[11px] text-slate-400">
              Calculé automatiquement à partir des mouvements validés et des transferts.
              <span className="ml-2 inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-600" /> négatif</span>
              <span className="ml-2 inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> sous le seuil</span>
              <span className="ml-2 text-sky-300">+n</span> = en transit vers le site
            </p>
          </div>
          <button type="button" onClick={exportCsv} className={btnSecondary}><Download className="w-3.5 h-3.5" /> Exporter (CSV)</button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Code, désignation, marque…" className={`${input} pl-8`} aria-label="Rechercher un article" />
          </div>
          <select value={cat} onChange={e => setCat(e.target.value)} className={`${input} !w-auto`} aria-label="Catégorie">
            <option value="">Toutes les catégories</option>
            {CATEGORY_IDS.map(c => <option key={c} value={c}>{categoryLabel(settings, c)}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={onlyAlerts} onChange={e => setOnlyAlerts(e.target.checked)} /> Seulement les alertes</label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Afficher les sites inactifs</label>
        </div>
      </div>

      <div className={`${card} !p-0 overflow-x-auto`}>
        {rows.length === 0 ? <div className="p-4"><Empty>Aucun article à afficher.</Empty></div> : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50">
                <th className={`${th} sticky left-0 bg-slate-900`}>Article</th>
                <th className={`${th} text-right`}>Seuil</th>
                {sites.map(h => <th key={h.id} className={`${th} text-right`} title={h.name}>{h.code || h.name}</th>)}
                <th className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map(r => (
                <tr key={r.c.id}>
                  <td className={`${td} sticky left-0 bg-slate-900`}>
                    <div className="font-semibold">{r.c.name}{r.c.archived && <span className="ml-1 text-[10px] text-slate-500">(archivé)</span>}</div>
                    <div className="text-[10.5px] text-slate-500 font-mono">{r.c.sku} · {categoryLabel(settings, r.c.category)}</div>
                  </td>
                  <td className={`${td} text-right font-mono text-slate-400`}>{r.thr || '—'}</td>
                  {r.cells.map(x => {
                    const s = cellState(x.qty, r.thr, x.hub.status === 'inactif');
                    return (
                      <td key={x.hub.id} className={`${td} text-right font-mono ${s === 'neg' ? 'bg-rose-600/80 text-white font-bold' : s === 'low' ? 'bg-amber-500/25 text-amber-200 font-bold' : ''}`}>
                        {x.qty ? fmt(x.qty) : <span className="text-slate-600">0</span>}
                        {x.transit > 0 && <span className="ml-1 text-[10px] text-sky-300">+{x.transit}</span>}
                      </td>
                    );
                  })}
                  <td className={`${td} text-right font-mono font-bold`}>{fmt(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-700">
                <td className={`${td} font-black sticky left-0 bg-slate-900`}>TOTAL</td>
                <td />
                {sites.map((h, i) => <td key={h.id} className={`${td} text-right font-mono font-bold`}>{fmt(rows.reduce((t, r) => t + r.cells[i].qty, 0))}</td>)}
                <td className={`${td} text-right font-mono font-black`}>{fmt(rows.reduce((t, r) => t + r.total, 0))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};
