// Journal des mouvements (feuille MOUVEMENTS du classeur) : une ligne par article,
// filtres, colonne « Contrôle », et saisie d'un nouveau bon soumis au circuit de visa.
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, Plus, Printer, Search } from 'lucide-react';
import type { StockMovementItem } from '../../types';
import type { StockContext } from './StockHubsModule';
import {
  ControlCell, Empty, Modal, StatusPill, activeHubs, activeItems, btnPrimary, btnSecondary, card, categoryLabel,
  downloadCsvRows, fmt, frDate, hubName, input, label, movementSite, td, th, visaState,
} from './stockUi';
import { LinesEditor, emptyLine, lineErrors, type Line } from './LinesEditor';
import { buildMovement } from './buildMovement';
import { availableForExit, isTransfer, movementSign, movementTypeLabel } from '../../../shared/stock.mjs';

export const MovementsPanel: React.FC<StockContext> = ctx => {
  const { movements, hubs, catalog, settings } = ctx;
  const [q, setQ] = useState('');
  const [site, setSite] = useState(ctx.portalHub?.id || '');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(ctx.initialFilter === 'issues');
  const [creating, setCreating] = useState(ctx.initialFilter === 'new' && ctx.canCreate);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return movements
      .filter(m => !isTransfer(m))
      .filter(m => !site || movementSite(m, settings) === site)
      .filter(m => !type || m.type === type)
      .filter(m => !status || m.status === status)
      .filter(m => !from || (m.date || '') >= from)
      .filter(m => !to || (m.date || '').slice(0, 10) <= to)
      .filter(m => !onlyIssues || ctx.issuesOf(m).length > 0)
      .filter(m => !needle || [m.movementNumber, m.referenceDocumentNumber, m.counterparty, m.notes, m.operatorName, ...m.items.flatMap(i => [i.sku, i.name, ...i.serialNumbers])]
        .some(v => (v || '').toLowerCase().includes(needle)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.movementNumber.localeCompare(a.movementNumber));
  }, [movements, q, site, type, status, from, to, onlyIssues, settings, ctx]);

  const exportCsv = () => {
    const out: unknown[][] = [['N° mouvement', 'Date', 'Site', 'Type', 'Sens', 'Code article', 'Désignation', 'Catégorie', 'Quantité', 'Quantité signée', 'Prix unitaire', 'Valeur', 'Référence', 'Client / Fournisseur', 'Statut', 'Saisi par', 'Visé par', 'Contrôle']];
    for (const m of rows) {
      const sign = movementSign(m, settings);
      for (const it of m.items) {
        const c = catalog.find(x => x.id === it.catalogItemId);
        out.push([m.movementNumber, m.date?.slice(0, 10), hubName(hubs, movementSite(m, settings)), movementTypeLabel(m, settings), sign > 0 ? 'Entrée' : 'Sortie',
          it.sku, it.name, categoryLabel(settings, c?.category), it.quantity, sign * it.quantity, it.unitPriceUSD, it.quantity * it.unitPriceUSD,
          m.referenceDocumentNumber, m.counterparty || m.destinationClientSite || '', m.status, m.operatorName, m.approvedByManagerName || '', ctx.issuesOf(m).join(' ; ') || 'OK']);
      }
    }
    downloadCsvRows(out, `mouvements-stock-${ctx.today}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Journal des mouvements</h3>
            <p className="text-[11px] text-slate-400">Une ligne par article. Entrées et sorties d'un site ; les envois entre sites se saisissent dans « Transferts ».</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={exportCsv} className={btnSecondary}><Download className="w-3.5 h-3.5" /> Exporter (CSV)</button>
            <button type="button" onClick={() => setCreating(true)} className={btnPrimary} disabled={!ctx.canCreate || !activeHubs(ctx.scopeHubs).length || !activeItems(catalog).length}
              title={ctx.canCreate ? undefined : "Vous n'êtes affecté à aucun hub : demandez à la centrale logistique de vous ajouter à une équipe."}>
              <Plus className="w-4 h-4" /> Nouveau mouvement
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <div className="col-span-2 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="N°, article, n° de série, client…" className={`${input} pl-8`} aria-label="Rechercher" />
          </div>
          <select value={site} onChange={e => setSite(e.target.value)} className={input} aria-label="Site" disabled={!!ctx.portalHub}>
            {!ctx.portalHub && <option value="">Tous les sites</option>}
            {ctx.scopeHubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} className={input} aria-label="Type">
            <option value="">Tous les types</option>
            {settings.movementTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className={input} aria-label="Statut">
            <option value="">Tous les statuts</option>
            <option value="en_attente_visa">Au visa</option>
            <option value="valide">Validé</option>
            <option value="rejete">Rejeté</option>
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={input} aria-label="Du" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={input} aria-label="Au" />
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-300">
          <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} /> Seulement les lignes à corriger (⚠)
        </label>
      </div>

      <div className={`${card} !p-0 overflow-x-auto`}>
        {rows.length === 0 ? (
          <div className="p-4"><Empty>Aucun mouvement ne correspond aux filtres.</Empty></div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50">
                <th className={th}>N°</th><th className={th}>Date</th><th className={th}>Site</th><th className={th}>Type</th>
                <th className={th}>Article</th><th className={`${th} text-right`}>Qté</th><th className={`${th} text-right`}>Valeur</th>
                <th className={th}>Client / Fourn.</th><th className={th}>Statut</th><th className={th}>Contrôle</th><th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.flatMap(m => m.items.map((it, i) => (
                <MovementRow key={`${m.id}-${i}`} ctx={ctx} m={m} itemIndex={i} />
              )))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <NewMovementModal ctx={ctx} onClose={() => setCreating(false)} />}
    </div>
  );
};

const MovementRow: React.FC<{ ctx: StockContext; m: StockMovementItem; itemIndex: number }> = ({ ctx, m, itemIndex }) => {
  const { settings, hubs } = ctx;
  const it = m.items[itemIndex];
  const sign = movementSign(m, settings);
  const first = itemIndex === 0;
  const visa = visaState(ctx, m.id);
  const issues = ctx.issuesOf(m);
  return (
    <tr className={issues.length ? 'bg-rose-500/[0.04]' : ''}>
      <td className={`${td} font-mono font-bold whitespace-nowrap`}>{first ? m.movementNumber : ''}</td>
      <td className={`${td} whitespace-nowrap`}>{first ? frDate(m.date) : ''}</td>
      <td className={td}>{first ? hubName(hubs, movementSite(m, settings)) : ''}</td>
      <td className={td}>
        {first && (
          <span className={`text-[11px] font-semibold ${sign > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {sign > 0 ? '▲' : '▼'} {movementTypeLabel(m, settings)}
          </span>
        )}
      </td>
      <td className={td}>
        <div className="font-semibold min-w-[11rem]">{it.name}</div>
        <div className="text-[10.5px] text-slate-500 font-mono">{it.sku}{it.serialNumbers.length ? ` · S/N ${it.serialNumbers.slice(0, 3).join(', ')}${it.serialNumbers.length > 3 ? '…' : ''}` : ''}</div>
      </td>
      <td className={`${td} text-right font-mono font-bold ${sign > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{sign > 0 ? '+' : '−'}{fmt(it.quantity)}</td>
      <td className={`${td} text-right font-mono`}>{fmt(it.quantity * it.unitPriceUSD)}</td>
      <td className={td}>{first ? m.counterparty || m.destinationClientSite || '—' : ''}</td>
      <td className={td}>{first && <StatusPill status={m.status} />}</td>
      <td className={td}>{first && <ControlCell issues={issues} />}</td>
      <td className={td}>
        {first && (
          <div className="flex items-center gap-1.5">
            {m.status === 'en_attente_visa' && (visa.canAct ? (
              <button type="button" onClick={() => ctx.onApproveMovement(m.id)} className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Viser
              </button>
            ) : (
              <span className="text-[10.5px] text-amber-300 whitespace-nowrap">Attend {visa.waiting}</span>
            ))}
            <button type="button" onClick={() => ctx.onPrintDocument(m, sign > 0 ? 'bes' : 'bss')} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800" title="Imprimer le bon (A4)" aria-label={`Imprimer ${m.movementNumber}`}>
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

const NewMovementModal: React.FC<{ ctx: StockContext; onClose: () => void }> = ({ ctx, onClose }) => {
  const { settings, hubs, catalog, movements, currentUser } = ctx;
  const types = settings.movementTypes.filter(t => t.active);
  const [typeId, setTypeId] = useState(types[0]?.id || '');
  const [date, setDate] = useState(ctx.today);
  const [hubId, setHubId] = useState(activeHubs(ctx.scopeHubs)[0]?.id || '');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [reference, setReference] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const t = types.find(x => x.id === typeId);
  const isExit = t?.sign === -1;
  const available = isExit ? (itemId: string) => availableForExit(movements, settings, hubId, itemId) : undefined;
  const items = activeItems(catalog);
  const errors = [
    !t && 'Choisissez un type.',
    !hubId && 'Choisissez un site.',
    !date && 'Indiquez la date.',
    date > ctx.today && 'La date ne peut pas être dans le futur.',
    ...lines.flatMap(l => lineErrors(l, available)),
  ].filter(Boolean) as string[];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.length || !t) return;
    const mvt = buildMovement({
      movements, catalog, hubs, user: currentUser, type: t.id, typeLabel: t.label, sign: t.sign, date,
      sourceHubId: isExit ? hubId : undefined, destinationHubId: isExit ? undefined : hubId,
      lines, reference, counterparty, notes,
    });
    ctx.onAddMovement(mvt);
    onClose();
  };

  return (
    <Modal title="Nouveau mouvement de stock" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={label}>Type de mouvement</label>
            <select value={typeId} onChange={e => setTypeId(e.target.value)} className={input} aria-label="Type de mouvement">
              {types.map(x => <option key={x.id} value={x.id}>{x.sign > 0 ? '▲' : '▼'} {x.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{isExit ? 'Site (sortie de)' : 'Site (entrée dans)'}</label>
            <select value={hubId} onChange={e => setHubId(e.target.value)} className={input} aria-label="Site">
              {activeHubs(ctx.scopeHubs).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Date</label>
            <input type="date" value={date} max={ctx.today} onChange={e => setDate(e.target.value)} className={input} aria-label="Date" />
          </div>
          <div>
            <label className={label}>Référence (BL, facture, bon client…)</label>
            <input value={reference} onChange={e => setReference(e.target.value)} className={input} placeholder="ex. BL-2026-0142" aria-label="Référence" />
          </div>
          <div>
            <label className={label}>{isExit ? 'Client / projet' : 'Fournisseur / origine'}</label>
            <input value={counterparty} onChange={e => setCounterparty(e.target.value)} className={input} aria-label="Client ou fournisseur" />
          </div>
          <div>
            <label className={label}>Commentaire</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className={input} aria-label="Commentaire" />
          </div>
        </div>

        <LinesEditor lines={lines} onChange={setLines} catalog={items} settings={settings} available={available} />

        <div className="text-[11px] text-slate-400 bg-slate-950/50 border border-slate-800 rounded-xl p-3 leading-relaxed">
          Le bon est envoyé au <strong className="text-slate-200">circuit de visa</strong>. Le stock du site ne change qu'après validation.
          {isExit && ' Une sortie ne peut pas dépasser le stock disponible (bons déjà au visa déduits).'}
        </div>
        {submitted && errors.length > 0 && <p className="text-xs font-semibold text-rose-400">⚠ {errors[0]}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" className={btnPrimary}>Soumettre au visa</button>
        </div>
      </form>
    </Modal>
  );
};
