// Tableau de bord du stock (feuille TABLEAU_DE_BORD du classeur) : tout est calculé.
import React, { useMemo } from 'react';
import { BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { StockContext } from './StockHubsModule';
import { CATEGORY_IDS, Kpi, card, categoryLabel, fmt, money, td, th } from './stockUi';
import { isLateTransfer, isTransfer, movementEffects, normalizeCategory } from '../../../shared/stock.mjs';

export const StockDashboardPanel: React.FC<StockContext> = ctx => {
  const { stocks, hubs, movements, settings, catalog, today, goTo } = ctx;
  const month = today.slice(0, 7);
  const activeIds = new Set(hubs.filter(h => h.status !== 'inactif').map(h => h.id));

  const data = useMemo(() => {
    const byCat: Record<string, number> = {};
    let units = 0;
    let value = 0;
    for (const s of stocks) {
      const q = Math.max(0, s.quantityAvailable);
      units += s.quantityAvailable;
      value += q * s.unitPriceUSD;
      const c = normalizeCategory(s.category);
      byCat[c] = (byCat[c] || 0) + s.quantityAvailable;
    }
    const transfersOpen = movements.filter(m => isTransfer(m) && m.status === 'en_transit');
    const unitsInTransit = transfersOpen.reduce((t, m) => t + m.items.reduce((u, i) => u + i.quantity, 0), 0);
    const late = transfersOpen.filter(m => isLateTransfer(m, settings, today)).length;
    let entries = 0;
    let exits = 0;
    for (const m of movements) {
      if (isTransfer(m) || m.type === 'stock_initial') continue;
      for (const e of movementEffects(m, settings)) {
        if (!e.day.startsWith(month)) continue;
        if (e.qty > 0) entries += e.qty;
        else exits += -e.qty;
      }
    }
    const underThreshold = stocks.filter(s => activeIds.has(s.hubId) && s.minAlertThreshold > 0 && s.quantityAvailable < s.minAlertThreshold).length;
    const toFix = movements.filter(m => ctx.issuesOf(m).length > 0).length;
    const perSite = hubs.map(h => {
      const rows = stocks.filter(s => s.hubId === h.id);
      const cats: Record<string, number> = {};
      rows.forEach(s => { const c = normalizeCategory(s.category); cats[c] = (cats[c] || 0) + s.quantityAvailable; });
      return {
        hub: h,
        cats,
        total: rows.reduce((t, s) => t + s.quantityAvailable, 0),
        transit: rows.reduce((t, s) => t + s.quantityInTransit, 0),
        under: h.status === 'inactif' ? 0 : rows.filter(s => s.minAlertThreshold > 0 && s.quantityAvailable < s.minAlertThreshold).length,
      };
    });
    return { byCat, units, value, transfersOpen: transfersOpen.length, unitsInTransit, late, entries, exits, underThreshold, toFix, perSite };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks, hubs, movements, settings, today]);

  const maxCat = Math.max(1, ...CATEGORY_IDS.map(c => data.byCat[c] || 0));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi title="Total articles en stock" value={fmt(data.units)} hint={`dans ${hubs.length} site(s)`} onClick={() => goTo('matrix')} />
        {CATEGORY_IDS.map(c => (
          <Kpi key={c} title={categoryLabel(settings, c)} value={fmt(data.byCat[c] || 0)} hint="unités en stock" />
        ))}
        <Kpi title={`Valeur du stock (${settings.currency})`} value={fmt(data.value)} hint="selon les prix du catalogue" tone="info" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi title="Unités en transit" value={fmt(data.unitsInTransit)} hint={`${data.transfersOpen} transfert(s) en cours`} tone="info" onClick={() => goTo('transfers', 'en_transit')} />
        <Kpi title="Transferts en retard" value={data.late} hint={`> ${settings.transitAlertDays} jours sans réception`} tone={data.late ? 'danger' : 'ok'} onClick={() => goTo('transfers', 'late')} />
        <Kpi title="Entrées du mois" value={fmt(data.entries)} hint="hors stock initial et transferts" tone="ok" onClick={() => goTo('movements')} />
        <Kpi title="Sorties du mois" value={fmt(data.exits)} hint="hors transferts" tone="warn" onClick={() => goTo('movements')} />
        <Kpi title="Articles sous seuil" value={data.underThreshold} hint="sites actifs" tone={data.underThreshold ? 'warn' : 'ok'} onClick={() => goTo('matrix', 'alert')} />
      </div>

      <div className={`${card} !py-3 flex items-center gap-2 text-xs ${data.toFix ? 'text-rose-300' : 'text-emerald-300'}`}>
        {data.toFix ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
        {data.toFix ? (
          <button type="button" onClick={() => goTo('movements', 'issues')} className="font-semibold hover:underline">
            ⚠ Lignes à corriger : {data.toFix} (colonne « Contrôle » des mouvements et des transferts)
          </button>
        ) : (
          <span className="font-semibold">✔ Aucune ligne de saisie à corriger.</span>
        )}
      </div>

      <div className={card}>
        <h3 className="text-sm font-bold text-white mb-3">Stock par site</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className={th}>Site</th>
                <th className={th}>Région</th>
                {CATEGORY_IDS.map(c => <th key={c} className={`${th} text-right`}>{categoryLabel(settings, c)}</th>)}
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} text-right`}>En transit vers ce site</th>
                <th className={`${th} text-right`}>Articles sous seuil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {data.perSite.map(r => (
                <tr key={r.hub.id} className={r.hub.status === 'inactif' ? 'opacity-50' : ''}>
                  <td className={`${td} font-semibold`}>
                    <button type="button" onClick={() => goTo('report', r.hub.id)} className="hover:underline text-left">{r.hub.name}</button>
                    {r.hub.status === 'inactif' && <span className="ml-1.5 text-[10px] text-slate-500">(inactif)</span>}
                  </td>
                  <td className={td}>{r.hub.province}</td>
                  {CATEGORY_IDS.map(c => <td key={c} className={`${td} text-right font-mono`}>{fmt(r.cats[c] || 0)}</td>)}
                  <td className={`${td} text-right font-mono font-bold`}>{fmt(r.total)}</td>
                  <td className={`${td} text-right font-mono text-sky-300`}>{r.transit ? fmt(r.transit) : '—'}</td>
                  <td className={`${td} text-right font-mono ${r.under ? 'text-amber-300 font-bold' : 'text-slate-500'}`}>{r.under || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-700">
                <td className={`${td} font-black`} colSpan={2}>TOTAL RÉSEAU</td>
                {CATEGORY_IDS.map(c => <td key={c} className={`${td} text-right font-mono font-bold`}>{fmt(data.byCat[c] || 0)}</td>)}
                <td className={`${td} text-right font-mono font-black`}>{fmt(data.units)}</td>
                <td className={`${td} text-right font-mono font-bold text-sky-300`}>{fmt(data.perSite.reduce((t, r) => t + r.transit, 0))}</td>
                <td className={`${td} text-right font-mono font-bold text-amber-300`}>{data.underThreshold}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <h3 className="text-sm font-bold text-white mb-3">Répartition par catégorie</h3>
          <div className="space-y-2.5">
            {CATEGORY_IDS.map(c => (
              <div key={c}>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>{categoryLabel(settings, c)}</span>
                  <span className="font-mono font-bold">{fmt(data.byCat[c] || 0)} unités</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(0, ((data.byCat[c] || 0) / maxCat) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] text-slate-500 mt-3">{catalog.filter(c => !c.archived).length} article(s) au catalogue · {money(data.value, settings.currency)} de valeur totale.</p>
        </div>

        <div className={card}>
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4 text-amber-400" /> Mode d'emploi en 6 étapes</h3>
          <ol className="text-xs text-slate-300 space-y-1.5 list-decimal pl-4">
            <li><strong>Paramètres</strong> et <strong>Sites</strong> : catégories, types de mouvement, délai d'alerte, liste des sites. Puis <strong>Catalogue</strong> : code, catégorie, désignation, seuil d'alerte, prix.</li>
            <li>Enregistrer le stock de départ de chaque site dans <strong>Mouvements</strong>, type « Stock initial ».</li>
            <li>Chaque entrée ou sortie d'un site (réception fournisseur, vente, installation, retour, perte…) = un mouvement, visé par le circuit avant de compter.</li>
            <li>Chaque envoi vers un autre site = un <strong>Transfert</strong> : il part « En transit » après visa, puis « Reçu » à l'arrivée avec la date et la quantité reçue. Ne pas le ressaisir en mouvement.</li>
            <li>Surveiller la colonne <strong>Contrôle</strong> : toute ligne marquée ⚠ doit être corrigée.</li>
            <li>Consulter le tableau de bord, le stock par site, le rapport de site et le suivi mensuel : rien à saisir, tout est calculé.</li>
          </ol>
          <p className="text-[10.5px] text-slate-500 mt-3 leading-relaxed">
            <strong className="text-slate-400">Règle de calcul :</strong> stock d'un site = entrées − sorties validées + transferts reçus − transferts envoyés (hors annulés).
            Un transfert diminue le stock du site source dès l'envoi et augmente celui du site destination à la réception, de la quantité réellement reçue.
          </p>
        </div>
      </div>
    </div>
  );
};
