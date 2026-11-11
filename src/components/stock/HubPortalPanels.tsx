// Portails des hubs : le tableau de bord propre à un site (pour son équipe) et la supervision
// de tous les sites par la centrale logistique.
import React, { useMemo } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ExternalLink, PackageCheck, Users } from 'lucide-react';
import type { LogisticsHub } from '../../types';
import type { StockContext } from './StockHubsModule';
import { Empty, Kpi, StatusPill, btnPrimary, btnSecondary, card, fmt, frDate, hubName, money, td, th } from './stockUi';
import { isLateTransfer, isTransfer, movementSign, movementTouchesHub, movementTypeLabel, sentDay, transitDays } from '../../../shared/stock.mjs';

/** Indicateurs d'un site, communs au portail et à la supervision. */
function hubFigures(ctx: StockContext, hub: LogisticsHub) {
  const { stocks, movements, settings, today } = ctx;
  const rows = stocks.filter(s => s.hubId === hub.id);
  const units = rows.reduce((t, s) => t + s.quantityAvailable, 0);
  const value = rows.reduce((t, s) => t + Math.max(0, s.quantityAvailable) * s.unitPriceUSD, 0);
  const alerts = hub.status === 'inactif' ? [] : rows.filter(s => s.quantityAvailable < 0 || (s.minAlertThreshold > 0 && s.quantityAvailable < s.minAlertThreshold));
  const incoming = movements.filter(m => isTransfer(m) && m.status === 'en_transit' && m.destinationHubId === hub.id);
  const outgoing = movements.filter(m => isTransfer(m) && m.status === 'en_transit' && m.sourceHubId === hub.id);
  const late = incoming.filter(m => isLateTransfer(m, settings, today));
  const pending = movements.filter(m => m.status === 'en_attente_visa' && movementTouchesHub(m, hub.id, settings));
  const mine = movements.filter(m => movementTouchesHub(m, hub.id, settings)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.movementNumber.localeCompare(a.movementNumber));
  const team = [hub.managerId, ...(hub.staffIds || [])].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  return { rows, units, value, alerts, incoming, outgoing, late, pending, mine, team, last: mine[0]?.date };
}

const teamNames = (ctx: StockContext, ids: string[]) =>
  ids.map(id => ctx.users?.find(u => u.id === id)?.name).filter(Boolean) as string[];

/** Tableau de bord du portail d'un site. */
export const HubPortalDashboard: React.FC<StockContext> = ctx => {
  const hub = ctx.portalHub!;
  const f = useMemo(() => hubFigures(ctx, hub), [ctx, hub]);
  const { settings, hubs, goTo } = ctx;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi title="Unités en stock" value={fmt(f.units)} hint={`${f.rows.filter(r => r.quantityAvailable > 0).length} article(s) présents`} onClick={() => goTo('matrix')} />
        <Kpi title={`Valeur (${settings.currency})`} value={fmt(f.value)} hint="prix du catalogue" tone="info" />
        <Kpi title="Alertes de stock" value={f.alerts.length} hint="rupture ou sous le seuil" tone={f.alerts.length ? 'warn' : 'ok'} onClick={() => goTo('matrix', 'alert')} />
        <Kpi title="À réceptionner" value={f.incoming.length} hint={f.late.length ? `dont ${f.late.length} en retard` : 'transferts en route vers le hub'} tone={f.late.length ? 'danger' : f.incoming.length ? 'info' : 'ok'} onClick={() => goTo('transfers', 'en_transit')} />
        <Kpi title="Envoyés en transit" value={f.outgoing.length} hint="pas encore reçus" onClick={() => goTo('transfers', 'en_transit')} />
        <Kpi title="Bons au visa" value={f.pending.length} hint="n'ont pas encore d'effet" tone={f.pending.length ? 'warn' : 'ok'} onClick={() => goTo('movements')} />
      </div>

      <div className={`${card} flex flex-wrap gap-2 items-center`}>
        <span className="text-xs font-bold text-slate-300 mr-2">Actions du hub :</span>
        <button type="button" onClick={() => goTo('movements', 'new')} className={btnPrimary} disabled={!ctx.canCreate}><ArrowDownToLine className="w-4 h-4" /> Entrée ou sortie</button>
        <button type="button" onClick={() => goTo('transfers', 'new')} className={btnSecondary} disabled={!ctx.canCreate}><ArrowLeftRight className="w-3.5 h-3.5" /> Envoyer vers un autre site</button>
        <button type="button" onClick={() => goTo('transfers', 'en_transit')} className={btnSecondary}><PackageCheck className="w-3.5 h-3.5" /> Réceptionner</button>
        <button type="button" onClick={() => goTo('report')} className={btnSecondary}><ArrowUpFromLine className="w-3.5 h-3.5" /> Rapport du hub (A4)</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><PackageCheck className="w-4 h-4 text-sky-400" /> À réceptionner</h3>
          {f.incoming.length === 0 ? <Empty>Aucun transfert en route vers ce hub.</Empty> : (
            <table className="w-full text-left">
              <thead><tr className="border-b border-slate-800"><th className={th}>N°</th><th className={th}>Depuis</th><th className={th}>Envoyé le</th><th className={`${th} text-right`}>Unités</th><th className={`${th} text-right`}>Jours</th></tr></thead>
              <tbody className="divide-y divide-slate-800/70">
                {f.incoming.map(m => (
                  <tr key={m.id} className={isLateTransfer(m, settings, ctx.today) ? 'bg-rose-500/[0.06]' : ''}>
                    <td className={`${td} font-mono font-bold`}>{m.movementNumber}</td>
                    <td className={td}>{hubName(hubs, m.sourceHubId)}</td>
                    <td className={td}>{frDate(sentDay(m))}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(m.items.reduce((t, i) => t + i.quantity, 0))}</td>
                    <td className={`${td} text-right font-mono ${isLateTransfer(m, settings, ctx.today) ? 'text-rose-300 font-bold' : ''}`}>{transitDays(m, ctx.today) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={card}>
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Alertes de stock</h3>
          {f.alerts.length === 0 ? <Empty>Aucun article sous le seuil d'alerte.</Empty> : (
            <table className="w-full text-left">
              <thead><tr className="border-b border-slate-800"><th className={th}>Article</th><th className={`${th} text-right`}>Stock</th><th className={`${th} text-right`}>Seuil</th><th className={`${th} text-right`}>En route</th></tr></thead>
              <tbody className="divide-y divide-slate-800/70">
                {f.alerts.slice(0, 10).map(s => (
                  <tr key={s.catalogItemId}>
                    <td className={td}><div className="font-semibold">{s.name}</div><div className="text-[10.5px] text-slate-500 font-mono">{s.sku}</div></td>
                    <td className={`${td} text-right font-mono font-bold ${s.quantityAvailable <= 0 ? 'text-rose-300' : 'text-amber-300'}`}>{fmt(s.quantityAvailable)}</td>
                    <td className={`${td} text-right font-mono text-slate-400`}>{s.minAlertThreshold}</td>
                    <td className={`${td} text-right font-mono text-sky-300`}>{s.quantityInTransit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-bold text-white mb-3">Derniers mouvements du hub</h3>
        {f.mine.length === 0 ? <Empty>Aucun mouvement pour ce hub.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-slate-800"><th className={th}>N°</th><th className={th}>Date</th><th className={th}>Opération</th><th className={`${th} text-right`}>Unités</th><th className={th}>Saisi par</th><th className={th}>Statut</th></tr></thead>
              <tbody className="divide-y divide-slate-800/70">
                {f.mine.slice(0, 8).map(m => {
                  const units = m.items.reduce((t, i) => t + i.quantity, 0);
                  const out = isTransfer(m) ? m.sourceHubId === hub.id : movementSign(m, settings) < 0;
                  return (
                    <tr key={m.id}>
                      <td className={`${td} font-mono font-bold`}>{m.movementNumber}</td>
                      <td className={td}>{frDate(m.date)}</td>
                      <td className={td}>
                        {isTransfer(m)
                          ? (out ? `Transfert vers ${hubName(hubs, m.destinationHubId)}` : `Transfert depuis ${hubName(hubs, m.sourceHubId)}`)
                          : movementTypeLabel(m, settings)}
                      </td>
                      <td className={`${td} text-right font-mono font-bold ${out ? 'text-rose-300' : 'text-emerald-300'}`}>{out ? '−' : '+'}{fmt(units)}</td>
                      <td className={td}>{m.operatorName}</td>
                      <td className={td}><StatusPill status={m.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/** Supervision de tous les sites par la centrale logistique. */
export const HubsSupervisionPanel: React.FC<StockContext & { onOpenPortal: (hubId: string) => void }> = props => {
  const { hubs, settings, onOpenPortal, goTo } = props;
  const list = useMemo(() => hubs.map(h => ({ hub: h, f: hubFigures(props, h) })), [props, hubs]);
  const total = (k: 'units' | 'value') => list.reduce((t, x) => t + x.f[k], 0);
  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h3 className="text-sm font-bold text-white">Centrale logistique — supervision des hubs</h3>
          <p className="text-[11px] text-slate-400 max-w-3xl">
            Chaque hub a son portail : son équipe y saisit ses entrées, sorties et envois, et réceptionne ce qui lui arrive. La centrale voit tous les hubs,
            ouvre le portail de n'importe lequel, compose les équipes (onglet Sites) et seule annule un transfert.
          </p>
        </div>
        <div className="text-right text-xs text-slate-300">
          <div><strong className="font-mono text-white">{fmt(total('units'))}</strong> unités · <strong className="font-mono text-white">{money(total('value'), settings.currency)}</strong></div>
          <div className="text-slate-500">{hubs.filter(h => h.status !== 'inactif').length} hub(s) actif(s)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map(({ hub, f }) => {
          const names = teamNames(props, f.team);
          return (
            <div key={hub.id} className={`${card} flex flex-col gap-3 ${hub.status === 'inactif' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-mono font-bold text-amber-300">{hub.code}</div>
                  <div className="text-sm font-black text-white">{hub.name}</div>
                  <div className="text-[11px] text-slate-400">{[hub.city, hub.province].filter(Boolean).join(' · ')}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${hub.status === 'inactif' ? 'border-slate-600 text-slate-400' : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'}`}>{hub.status === 'inactif' ? 'Inactif' : 'Actif'}</span>
              </div>
              <div className="text-[11px] text-slate-300 flex items-start gap-1.5">
                <Users className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />
                <span>
                  <strong>{hub.managerName || 'Sans responsable'}</strong>
                  {names.length > 1 ? ` + ${names.length - 1} membre(s) : ${names.filter(n => n !== hub.managerName).join(', ')}` : names.length === 0 ? ' · aucune équipe affectée' : ''}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950/50 rounded-xl p-2"><div className="text-[10px] text-slate-500">Unités</div><div className="font-mono font-black text-white">{fmt(f.units)}</div></div>
                <div className="bg-slate-950/50 rounded-xl p-2"><div className="text-[10px] text-slate-500">Alertes</div><div className={`font-mono font-black ${f.alerts.length ? 'text-amber-300' : 'text-emerald-300'}`}>{f.alerts.length}</div></div>
                <div className="bg-slate-950/50 rounded-xl p-2"><div className="text-[10px] text-slate-500">À recevoir</div><div className={`font-mono font-black ${f.late.length ? 'text-rose-300' : 'text-sky-300'}`}>{f.incoming.length}{f.late.length ? ' ⏰' : ''}</div></div>
              </div>
              <div className="text-[11px] text-slate-400 space-y-0.5">
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span>{f.pending.length} bon(s) au visa · {f.outgoing.length} envoi(s) en route</span>
                  <span>Dernier mouvement : {f.last ? frDate(f.last) : '—'}</span>
                </div>
                <div>Organigramme : {(props.hubOrgs[hub.id] || []).length ? `${(props.hubOrgs[hub.id] || []).length} cellule(s)` : <span className="text-slate-500">pas encore créé</span>}</div>
              </div>
              <div className="flex gap-2 mt-auto">
                <button type="button" onClick={() => onOpenPortal(hub.id)} className={`${btnPrimary} flex-1 justify-center`}><ExternalLink className="w-4 h-4" /> Ouvrir le portail</button>
                <button type="button" onClick={() => goTo('sites')} className={btnSecondary} title="Responsable, équipe et statut du hub">Équipe</button>
              </div>
            </div>
          );
        })}
      </div>
      {hubs.length === 0 && <Empty>Aucun hub. Créez-les dans l'onglet Sites.</Empty>}
    </div>
  );
};
