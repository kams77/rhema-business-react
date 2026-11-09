// Transferts inter-sites (feuille TRANSFERTS du classeur) : envoi « En transit » après visa,
// réception avec date et quantité réellement reçue, écart, jours de transit, retard, annulation.
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, PackageCheck, Plus, Printer, Search, XCircle } from 'lucide-react';
import type { StockMovementItem } from '../../types';
import type { StockContext } from './StockHubsModule';
import {
  ControlCell, Empty, Modal, StatusPill, activeHubs, activeItems, btnPrimary, btnSecondary, card, downloadCsvRows,
  fmt, frDate, hubName, input, label, td, th, visaState,
} from './stockUi';
import { LinesEditor, emptyLine, lineErrors, type Line } from './LinesEditor';
import { buildMovement } from './buildMovement';
import {
  TRANSFER_TYPE, availableForExit, isLateTransfer, isTransfer, receivedQty, sentDay, transitDays,
} from '../../../shared/stock.mjs';

export const TransfersPanel: React.FC<StockContext> = ctx => {
  const { movements, hubs, settings, today } = ctx;
  const init = ctx.initialFilter;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(init === 'en_transit' ? 'en_transit' : '');
  const [onlyLate, setOnlyLate] = useState(init === 'late');
  const [site, setSite] = useState('');
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<StockMovementItem | null>(null);
  const [cancelling, setCancelling] = useState<StockMovementItem | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return movements
      .filter(isTransfer)
      .filter(m => !status || m.status === status)
      .filter(m => !onlyLate || isLateTransfer(m, settings, today))
      .filter(m => !site || m.sourceHubId === site || m.destinationHubId === site)
      .filter(m => !needle || [m.movementNumber, m.carrier, m.shippingRef, m.notes, ...m.items.flatMap(i => [i.sku, i.name, ...i.serialNumbers])]
        .some(v => (v || '').toLowerCase().includes(needle)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.movementNumber.localeCompare(a.movementNumber));
  }, [movements, q, status, onlyLate, site, settings, today]);

  const canReceive = (m: StockMovementItem) =>
    m.status === 'en_transit' && (ctx.canManage || hubs.find(h => h.id === m.destinationHubId)?.managerId === ctx.currentUser.id);

  const exportCsv = () => {
    const out: unknown[][] = [['N° transfert', 'Date', 'Site source', 'Site destination', 'Code article', 'Désignation', 'Qté envoyée', 'Date envoi', 'Statut', 'Date réception', 'Qté reçue', 'Écart', 'Jours de transit', 'En retard', 'Transporteur', 'Réf. expédition', 'Contrôle']];
    for (const m of rows) {
      for (const it of m.items) {
        const rec = m.status === 'receptionne' ? receivedQty(m, it) : '';
        out.push([m.movementNumber, m.date?.slice(0, 10), hubName(hubs, m.sourceHubId), hubName(hubs, m.destinationHubId), it.sku, it.name, it.quantity,
          ['en_transit', 'receptionne'].includes(m.status) ? sentDay(m) : '', m.status, m.receivedAt?.slice(0, 10) || '', rec,
          m.status === 'receptionne' ? it.quantity - receivedQty(m, it) : '', transitDays(m, today) ?? '', isLateTransfer(m, settings, today) ? 'OUI' : '',
          m.carrier || '', m.shippingRef || '', ctx.issuesOf(m).join(' ; ') || 'OK']);
      }
    }
    downloadCsvRows(out, `transferts-${today}.csv`);
  };

  const late = movements.filter(m => isLateTransfer(m, settings, today)).length;

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Transferts entre sites</h3>
            <p className="text-[11px] text-slate-400">
              Le site source est débité dès l'envoi (après visa) ; le site destination est crédité à la réception, de la quantité réellement reçue.
              Alerte au-delà de {settings.transitAlertDays} jours en transit.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={exportCsv} className={btnSecondary}><Download className="w-3.5 h-3.5" /> Exporter (CSV)</button>
            <button type="button" onClick={() => setCreating(true)} className={btnPrimary} disabled={activeHubs(hubs).length < 2}>
              <Plus className="w-4 h-4" /> Nouveau transfert
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="col-span-2 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="N°, article, transporteur…" className={`${input} pl-8`} aria-label="Rechercher" />
          </div>
          <select value={site} onChange={e => setSite(e.target.value)} className={input} aria-label="Site">
            <option value="">Tous les sites</option>
            {hubs.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className={input} aria-label="Statut">
            <option value="">Tous les statuts</option>
            <option value="en_attente_visa">Au visa</option>
            <option value="en_transit">En transit</option>
            <option value="receptionne">Reçu</option>
            <option value="annule">Annulé</option>
            <option value="rejete">Rejeté</option>
          </select>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={onlyLate} onChange={e => setOnlyLate(e.target.checked)} /> En retard seulement ({late})
          </label>
        </div>
      </div>

      <div className={`${card} !p-0 overflow-x-auto`}>
        {rows.length === 0 ? (
          <div className="p-4"><Empty>Aucun transfert ne correspond aux filtres.</Empty></div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50">
                <th className={th}>N°</th><th className={th}>Source → Destination</th><th className={th}>Article</th>
                <th className={`${th} text-right`}>Envoyé</th><th className={th}>Envoi</th><th className={th}>Statut</th>
                <th className={th}>Réception</th><th className={`${th} text-right`}>Reçu</th><th className={`${th} text-right`}>Écart</th>
                <th className={`${th} text-right`}>Jours</th><th className={th}>Contrôle</th><th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.flatMap(m => m.items.map((it, i) => {
                const first = i === 0;
                const lateRow = isLateTransfer(m, settings, today);
                const days = transitDays(m, today);
                const received = m.status === 'receptionne' ? receivedQty(m, it) : null;
                const gap = received === null ? null : it.quantity - received;
                const visa = visaState(ctx, m.id);
                return (
                  <tr key={`${m.id}-${i}`} className={lateRow ? 'bg-rose-500/[0.06]' : ''}>
                    <td className={`${td} font-mono font-bold whitespace-nowrap`}>{first ? m.movementNumber : ''}</td>
                    <td className={td}>{first && <span className="whitespace-nowrap">{hubName(hubs, m.sourceHubId)} <span className="text-amber-400">→</span> {hubName(hubs, m.destinationHubId)}</span>}</td>
                    <td className={td}>
                      <div className="font-semibold min-w-[11rem]">{it.name}</div>
                      <div className="text-[10.5px] text-slate-500 font-mono">{it.sku}</div>
                    </td>
                    <td className={`${td} text-right font-mono font-bold`}>{fmt(it.quantity)}</td>
                    <td className={`${td} whitespace-nowrap`}>{first ? (['en_transit', 'receptionne'].includes(m.status) || m.sentAt ? frDate(sentDay(m)) : '—') : ''}</td>
                    <td className={td}>{first && <StatusPill status={m.status} />}</td>
                    <td className={`${td} whitespace-nowrap`}>{first ? frDate(m.receivedAt) : ''}</td>
                    <td className={`${td} text-right font-mono`}>{received === null ? '—' : fmt(received)}</td>
                    <td className={`${td} text-right font-mono ${gap ? 'text-rose-300 font-bold' : 'text-slate-500'}`}>{gap === null ? '—' : gap ? fmt(gap) : '0'}</td>
                    <td className={`${td} text-right font-mono ${lateRow ? 'text-rose-300 font-bold' : ''}`}>{first ? (days ?? '—') : ''}{first && lateRow ? ' ⏰' : ''}</td>
                    <td className={td}>{first && <ControlCell issues={ctx.issuesOf(m)} />}</td>
                    <td className={td}>
                      {first && (
                        <div className="flex items-center gap-1.5">
                          {m.status === 'en_attente_visa' && (visa.canAct ? (
                            <button type="button" onClick={() => ctx.onApproveMovement(m.id)} className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Viser
                            </button>
                          ) : <span className="text-[10.5px] text-amber-300 whitespace-nowrap">Attend {visa.waiting}</span>)}
                          {canReceive(m) && (
                            <button type="button" onClick={() => setReceiving(m)} className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1">
                              <PackageCheck className="w-3.5 h-3.5" /> Réceptionner
                            </button>
                          )}
                          {m.status === 'en_transit' && ctx.canManage && (
                            <button type="button" onClick={() => setCancelling(m)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/10" title="Annuler le transfert" aria-label={`Annuler ${m.movementNumber}`}>
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button type="button" onClick={() => ctx.onPrintDocument(m, 'otih')} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800" title="Imprimer l'ordre de transfert (A4)" aria-label={`Imprimer ${m.movementNumber}`}>
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        )}
      </div>

      {creating && <NewTransferModal ctx={ctx} onClose={() => setCreating(false)} />}
      {receiving && <ReceiveModal ctx={ctx} m={receiving} onClose={() => setReceiving(null)} />}
      {cancelling && <CancelModal ctx={ctx} m={cancelling} onClose={() => setCancelling(null)} />}
    </div>
  );
};

const NewTransferModal: React.FC<{ ctx: StockContext; onClose: () => void }> = ({ ctx, onClose }) => {
  const { hubs, catalog, settings, movements, currentUser } = ctx;
  const sites = activeHubs(hubs);
  const [source, setSource] = useState(sites[0]?.id || '');
  const [dest, setDest] = useState(sites[1]?.id || '');
  const [date, setDate] = useState(ctx.today);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [carrier, setCarrier] = useState('');
  const [shippingRef, setShippingRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const available = (itemId: string) => availableForExit(movements, settings, source, itemId);
  const errors = [
    !source && 'Choisissez le site source.',
    !dest && 'Choisissez le site destination.',
    source && source === dest && 'Le site source et le site destination doivent être différents.',
    date > ctx.today && 'La date ne peut pas être dans le futur.',
    ...lines.flatMap(l => lineErrors(l, available)),
  ].filter(Boolean) as string[];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (errors.length) return;
    ctx.onAddMovement(buildMovement({
      movements, catalog, hubs, user: currentUser, type: TRANSFER_TYPE, date, sourceHubId: source, destinationHubId: dest,
      lines, reference: shippingRef, notes, carrier, shippingRef,
    }));
    onClose();
  };

  return (
    <Modal title="Nouveau transfert entre sites" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={label}>Site source (expédie)</label>
            <select value={source} onChange={e => setSource(e.target.value)} className={input} aria-label="Site source">
              {sites.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Site destination (reçoit)</label>
            <select value={dest} onChange={e => setDest(e.target.value)} className={input} aria-label="Site destination">
              {sites.map(h => <option key={h.id} value={h.id} disabled={h.id === source}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Date de l'ordre</label>
            <input type="date" value={date} max={ctx.today} onChange={e => setDate(e.target.value)} className={input} aria-label="Date" />
          </div>
          <div>
            <label className={label}>Transporteur</label>
            <input value={carrier} onChange={e => setCarrier(e.target.value)} className={input} placeholder="ex. Camion société, DHL…" aria-label="Transporteur" />
          </div>
          <div>
            <label className={label}>Réf. expédition / lettre de voiture</label>
            <input value={shippingRef} onChange={e => setShippingRef(e.target.value)} className={input} aria-label="Référence d'expédition" />
          </div>
          <div>
            <label className={label}>Commentaire</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className={input} aria-label="Commentaire" />
          </div>
        </div>
        <LinesEditor lines={lines} onChange={setLines} catalog={activeItems(catalog)} settings={settings} available={available} />
        <div className="text-[11px] text-slate-400 bg-slate-950/50 border border-slate-800 rounded-xl p-3 leading-relaxed">
          L'ordre de transfert passe par le <strong className="text-slate-200">circuit de visa</strong>. Après validation, il part « En transit » :
          le stock du site source baisse et une tâche de réception est créée pour le responsable du site destination.
          Ne saisissez pas ce transfert une seconde fois dans « Mouvements ».
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

const ReceiveModal: React.FC<{ ctx: StockContext; m: StockMovementItem; onClose: () => void }> = ({ ctx, m, onClose }) => {
  const sent = sentDay(m);
  const [receivedAt, setReceivedAt] = useState(ctx.today);
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(m.items.map(i => [i.catalogItemId, String(i.quantity)])));
  const [receiver, setReceiver] = useState(ctx.currentUser.name);
  const [notes, setNotes] = useState('');
  const parsed = Object.fromEntries(m.items.map(i => [i.catalogItemId, Number(qty[i.catalogItemId])]));
  const errors = [
    !receivedAt && 'Indiquez la date de réception.',
    receivedAt && sent && receivedAt < sent && `La réception ne peut pas précéder l'envoi (${frDate(sent)}).`,
    receivedAt > ctx.today && 'La date ne peut pas être dans le futur.',
    ...m.items.map(i => {
      const v = parsed[i.catalogItemId];
      return (!Number.isInteger(v) || v < 0 || v > i.quantity) && `${i.name} : quantité reçue entre 0 et ${i.quantity}.`;
    }),
  ].filter(Boolean) as string[];
  const gap = m.items.reduce((t, i) => t + (i.quantity - (Number.isInteger(parsed[i.catalogItemId]) ? parsed[i.catalogItemId] : i.quantity)), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length) return;
    ctx.onReceiveTransfer(m.id, { receivedAt, receivedQuantities: parsed, receivedByName: receiver, notes });
    onClose();
  };

  return (
    <Modal title={`Réception du transfert ${m.movementNumber}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-slate-300">
          {hubName(ctx.hubs, m.sourceHubId)} → <strong>{hubName(ctx.hubs, m.destinationHubId)}</strong> · envoyé le {frDate(sent)}
          {m.carrier ? ` · ${m.carrier}` : ''}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Date de réception</label>
            <input type="date" value={receivedAt} min={sent} max={ctx.today} onChange={e => setReceivedAt(e.target.value)} className={input} aria-label="Date de réception" />
          </div>
          <div>
            <label className={label}>Réceptionné par</label>
            <input value={receiver} onChange={e => setReceiver(e.target.value)} className={input} aria-label="Réceptionné par" />
          </div>
        </div>
        <table className="w-full text-left">
          <thead><tr className="border-b border-slate-800"><th className={th}>Article</th><th className={`${th} text-right`}>Envoyé</th><th className={`${th} text-right`}>Reçu</th></tr></thead>
          <tbody>
            {m.items.map(i => (
              <tr key={i.catalogItemId} className="border-b border-slate-800/60">
                <td className={td}>{i.name}<div className="text-[10.5px] text-slate-500 font-mono">{i.sku}</div></td>
                <td className={`${td} text-right font-mono`}>{i.quantity}</td>
                <td className={`${td} text-right`}>
                  <input type="number" min={0} max={i.quantity} step={1} value={qty[i.catalogItemId]} onChange={e => setQty({ ...qty, [i.catalogItemId]: e.target.value })}
                    className={`${input} !w-24 text-right ml-auto`} aria-label={`Quantité reçue ${i.name}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {gap > 0 && (
          <div>
            <p className="text-xs font-bold text-rose-300 mb-1">Écart de {gap} unité(s) : précisez la raison (casse, manquant, erreur d'envoi…).</p>
            <input value={notes} onChange={e => setNotes(e.target.value)} className={input} placeholder="Raison de l'écart" aria-label="Raison de l'écart" />
          </div>
        )}
        {errors.length > 0 && <p className="text-xs font-semibold text-rose-400">⚠ {errors[0]}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" className={btnPrimary} disabled={errors.length > 0 || (gap > 0 && !notes.trim())}>Confirmer la réception</button>
        </div>
      </form>
    </Modal>
  );
};

const CancelModal: React.FC<{ ctx: StockContext; m: StockMovementItem; onClose: () => void }> = ({ ctx, m, onClose }) => {
  const [reason, setReason] = useState('');
  return (
    <Modal title={`Annuler le transfert ${m.movementNumber}`} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); if (!reason.trim()) return; ctx.onCancelTransfer(m.id, reason.trim()); onClose(); }} className="space-y-4">
        <p className="text-xs text-slate-300 leading-relaxed">
          La marchandise revient dans le stock de <strong>{hubName(ctx.hubs, m.sourceHubId)}</strong>, la tâche de réception est close et l'annulation est inscrite au journal d'audit.
          Utilisez-la seulement si la marchandise n'est jamais partie ou est revenue au site source.
        </p>
        <div>
          <label className={label}>Motif (obligatoire)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className={input} aria-label="Motif de l'annulation" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Retour</button>
          <button type="submit" disabled={!reason.trim()} className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs disabled:opacity-40">Annuler le transfert</button>
        </div>
      </form>
    </Modal>
  );
};

