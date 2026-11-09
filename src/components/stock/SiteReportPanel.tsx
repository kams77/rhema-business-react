// Rapport de site (feuille RAPPORT_SITE du classeur) : choisir un site et une période ;
// par article : ouverture, entrées, sorties, transferts reçus / envoyés, clôture, seuil, statut.
// Affiché sur une feuille A4 imprimable, exportable en PDF et en CSV.
import React, { useMemo, useState } from 'react';
import { Download, FileDown, Printer } from 'lucide-react';
import type { StockContext } from './StockHubsModule';
import { A4Sheet } from '../branding/A4Sheet';
import { btnPrimary, btnSecondary, card, categoryLabel, downloadCsvRows, fmt, frDate, input, label } from './stockUi';
import { siteReport } from '../../../shared/stock.mjs';
import { exportSiteReportPdf } from '../../utils/stockReportPdf';

const STATUS_STYLE: Record<string, string> = {
  OK: 'text-emerald-700',
  'STOCK BAS': 'text-amber-700 bg-amber-50',
  RUPTURE: 'text-rose-700 bg-rose-50',
  NÉGATIF: 'text-white bg-rose-600',
};

export const SiteReportPanel: React.FC<StockContext> = ctx => {
  const { hubs, movements, catalog, settings, organization, today } = ctx;
  const [hubId, setHubId] = useState(ctx.initialFilter && hubs.some(h => h.id === ctx.initialFilter) ? ctx.initialFilter : hubs[0]?.id || '');
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [hideEmpty, setHideEmpty] = useState(true);
  const hub = hubs.find(h => h.id === hubId);

  const rows = useMemo(() => {
    if (!hubId || from > to) return [];
    const all = siteReport(movements, catalog, settings, hubId, from, to);
    return hideEmpty ? all.filter(r => r.opening || r.entries || r.exits || r.received || r.sent || r.closing || r.inTransit) : all;
  }, [movements, catalog, settings, hubId, from, to, hideEmpty]);

  const totals = rows.reduce((t, r) => ({
    opening: t.opening + r.opening, entries: t.entries + r.entries, exits: t.exits + r.exits, received: t.received + r.received,
    sent: t.sent + r.sent, closing: t.closing + r.closing, inTransit: t.inTransit + r.inTransit,
  }), { opening: 0, entries: 0, exits: 0, received: 0, sent: 0, closing: 0, inTransit: 0 });
  const alerts = rows.filter(r => r.status !== 'OK').length;

  const csv = () => downloadCsvRows([
    ['Site', hub?.name || '', 'Du', from, 'Au', to],
    ['Code article', 'Désignation', 'Catégorie', 'Stock ouverture', 'Entrées', 'Sorties', 'Transferts reçus', 'Transferts envoyés', 'Stock clôture', 'Seuil', 'En transit vers le site', 'Statut'],
    ...rows.map(r => [r.sku, r.name, categoryLabel(settings, r.category), r.opening, r.entries, r.exits, r.received, r.sent, r.closing, r.threshold, r.inTransit, r.status]),
  ], `rapport-site-${hub?.code || hubId}-${from}-${to}.csv`);

  const pdf = () => hub && exportSiteReportPdf(organization, {
    siteName: hub.name,
    siteDetails: [hub.city, hub.province, hub.managerName && `Responsable : ${hub.managerName}`].filter(Boolean).join(' • '),
    from: frDate(from),
    to: frDate(to),
    generatedBy: ctx.currentUser.name,
    rows: rows.map(r => ({ ...r, category: categoryLabel(settings, r.category) })),
  });

  return (
    <div className="space-y-4">
      <div className={`${card} grid grid-cols-2 md:grid-cols-6 gap-3 items-end`}>
        <div className="col-span-2">
          <label className={label}>Site</label>
          <select value={hubId} onChange={e => setHubId(e.target.value)} className={input} aria-label="Site du rapport">
            {hubs.map(h => <option key={h.id} value={h.id}>{h.name}{h.status === 'inactif' ? ' (inactif)' : ''}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Du</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={input} aria-label="Date de début" />
        </div>
        <div>
          <label className={label}>Au</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={input} aria-label="Date de fin" />
        </div>
        <div className="col-span-2 flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={csv} className={btnSecondary} disabled={!rows.length}><Download className="w-3.5 h-3.5" /> CSV</button>
          <button type="button" onClick={pdf} className={btnSecondary} disabled={!rows.length}><FileDown className="w-3.5 h-3.5" /> PDF</button>
          <button type="button" onClick={() => window.print()} className={btnPrimary} disabled={!rows.length}><Printer className="w-4 h-4" /> Imprimer (A4)</button>
        </div>
        <label className="col-span-2 md:col-span-6 flex items-center gap-2 text-[11px] text-slate-300">
          <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} /> Masquer les articles sans stock ni mouvement sur la période
        </label>
        {from > to && <p className="col-span-2 md:col-span-6 text-xs font-semibold text-rose-400">⚠ La date de début doit précéder la date de fin.</p>}
      </div>

      <div className="overflow-x-auto pb-2 flex justify-center bg-slate-950/40 rounded-2xl p-4 border border-slate-800">
        <A4Sheet organization={organization} footerExtra={`Rapport de stock — ${hub?.name || ''} — ${frDate(from)} au ${frDate(to)}`}>
          <div className="flex justify-between items-start gap-4 border-b border-slate-200 pb-3 mb-4">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-950">Rapport de stock du site</h2>
              <p className="text-sm font-bold text-slate-800">{hub?.name || '—'}</p>
              <p className="text-[11px] text-slate-600">{[hub?.city, hub?.province].filter(Boolean).join(' • ')}{hub?.managerName ? ` • Responsable : ${hub.managerName}` : ''}</p>
            </div>
            <div className="text-right text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <div className="font-bold uppercase text-[10px] text-slate-500">Période</div>
              <div className="font-mono font-bold text-slate-900">{frDate(from)} → {frDate(to)}</div>
              <div className="mt-1">{rows.length} article(s) • {alerts} alerte(s)</div>
            </div>
          </div>

          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                {['Article', 'Ouverture', 'Entrées', 'Sorties', 'Reçus', 'Envoyés', 'Clôture', 'Seuil', 'Transit', 'Statut'].map((h, i) => (
                  <th key={h} className={`px-1.5 py-1.5 font-bold uppercase text-[9px] tracking-wide ${i === 0 ? 'text-left' : i === 9 ? 'text-center' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.itemId} className={`border-b border-slate-200 ${i % 2 ? '' : 'bg-slate-50'}`}>
                  <td className="px-1.5 py-1">
                    <div className="font-semibold text-slate-900 leading-tight">{r.name}</div>
                    <div className="font-mono text-[9px] text-slate-500">{r.sku} · {categoryLabel(settings, r.category)}</div>
                  </td>
                  {[r.opening, r.entries, r.exits, r.received, r.sent].map((v, j) => (
                    <td key={j} className={`px-1.5 py-1 text-right font-mono ${v < 0 ? 'text-rose-700' : 'text-slate-800'}`}>{fmt(v)}</td>
                  ))}
                  <td className={`px-1.5 py-1 text-right font-mono font-bold ${r.closing < 0 ? 'text-rose-700' : 'text-slate-950'}`}>{fmt(r.closing)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-slate-600">{r.threshold || '—'}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-sky-700">{r.inTransit || '—'}</td>
                  <td className="px-1.5 py-1 text-center"><span className={`px-1.5 py-0.5 rounded font-bold text-[9px] whitespace-nowrap ${STATUS_STYLE[r.status]}`}>{r.status}</span></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-2 py-6 text-center text-slate-500">Aucun stock ni mouvement pour ce site sur la période.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-800 font-bold text-slate-950">
                  <td className="px-1.5 py-1.5 uppercase text-[10px]">Total site</td>
                  {[totals.opening, totals.entries, totals.exits, totals.received, totals.sent, totals.closing].map((v, j) => (
                    <td key={j} className="px-1.5 py-1.5 text-right font-mono">{fmt(v)}</td>
                  ))}
                  <td />
                  <td className="px-1.5 py-1.5 text-right font-mono text-sky-700">{fmt(totals.inTransit)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>

          <p className="text-[9.5px] text-slate-500 mt-3 leading-relaxed">
            Clôture = ouverture + entrées − sorties + transferts reçus − transferts envoyés. Statut : NÉGATIF (&lt; 0), RUPTURE (= 0),
            STOCK BAS (sous le seuil d'alerte de l'article), sinon OK. « Transit » = quantités en route vers ce site à ce jour.
          </p>

          <div className="grid grid-cols-2 gap-10 mt-10 text-[11px] text-slate-600">
            <div><div>Responsable du site</div><div className="border-b border-slate-300 h-12" /></div>
            <div><div>Responsable logistique</div><div className="border-b border-slate-300 h-12" /></div>
          </div>
        </A4Sheet>
      </div>
    </div>
  );
};
