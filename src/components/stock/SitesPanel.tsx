// Sites (feuille PARAMETRES du classeur, liste des sites) : code, nom, région, ville,
// responsable, statut Actif / Inactif. Un site inactif reste dans l'historique et les rapports.
import React, { useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { LogisticsHub } from '../../types';
import type { StockContext } from './StockHubsModule';
import { canAccessLogistics } from '../../utils/rbac';
import { Empty, Modal, btnPrimary, btnSecondary, card, fmt, input, label, td, th } from './stockUi';

const STATUS: Record<LogisticsHub['status'], { label: string; cls: string }> = {
  actif: { label: 'Actif', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  maintenance: { label: 'Maintenance', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  saturation: { label: 'Saturé', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  inactif: { label: 'Inactif', cls: 'bg-slate-700/40 text-slate-400 border-slate-600' },
};

export const SitesPanel: React.FC<StockContext> = ctx => {
  const { hubs, stocks, canManage } = ctx;
  const [editing, setEditing] = useState<LogisticsHub | 'new' | null>(null);
  const totals = useMemo(() => {
    const map = new Map<string, { units: number; value: number; under: number }>();
    for (const s of stocks) {
      const t = map.get(s.hubId) || { units: 0, value: 0, under: 0 };
      t.units += s.quantityAvailable;
      t.value += Math.max(0, s.quantityAvailable) * s.unitPriceUSD;
      if (s.minAlertThreshold > 0 && s.quantityAvailable < s.minAlertThreshold) t.under += 1;
      map.set(s.hubId, t);
    }
    return map;
  }, [stocks]);

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap justify-between items-center gap-2`}>
        <div>
          <h3 className="text-sm font-bold text-white">Sites (hubs et dépôts)</h3>
          <p className="text-[11px] text-slate-400">Un site « Inactif » n'apparaît plus dans les saisies, mais garde son historique.{!canManage && ' Lecture seule.'}</p>
        </div>
        {canManage && <button type="button" onClick={() => setEditing('new')} className={btnPrimary}><Plus className="w-4 h-4" /> Nouveau site</button>}
      </div>
      <div className={`${card} !p-0 overflow-x-auto`}>
        {hubs.length === 0 ? <div className="p-4"><Empty>Aucun site.</Empty></div> : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50">
                <th className={th}>Code</th><th className={th}>Nom</th><th className={th}>Région / ville</th><th className={th}>Responsable</th><th className={th}>Équipe du portail</th>
                <th className={th}>Statut</th><th className={`${th} text-right`}>Unités</th><th className={`${th} text-right`}>Valeur ({ctx.settings.currency})</th>
                <th className={`${th} text-right`}>Sous seuil</th>{canManage && <th className={th}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {hubs.map(h => {
                const t = totals.get(h.id) || { units: 0, value: 0, under: 0 };
                return (
                  <tr key={h.id} className={h.status === 'inactif' ? 'opacity-60' : ''}>
                    <td className={`${td} font-mono font-bold`}>{h.code}</td>
                    <td className={`${td} font-semibold`}>
                      <button type="button" onClick={() => ctx.goTo('report', h.id)} className="hover:underline text-left">{h.name}</button>
                    </td>
                    <td className={td}>{h.province}{h.city ? ` — ${h.city}` : ''}</td>
                    <td className={td}>{h.managerName || '—'}<div className="text-[10.5px] text-slate-500">{h.managerContact}</div></td>
                    <td className={td}>
                      {(() => {
                        const names = (h.staffIds || []).map(id => ctx.users?.find(u => u.id === id)?.name).filter(Boolean) as string[];
                        return names.length ? <span title={names.join(', ')}>{names.length} membre(s) · <span className="text-slate-400">{names.slice(0, 2).join(', ')}{names.length > 2 ? '…' : ''}</span></span> : <span className="text-slate-500">—</span>;
                      })()}
                    </td>
                    <td className={td}><span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS[h.status]?.cls}`}>{STATUS[h.status]?.label || h.status}</span></td>
                    <td className={`${td} text-right font-mono font-bold`}>{fmt(t.units)}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(t.value)}</td>
                    <td className={`${td} text-right font-mono ${t.under && h.status !== 'inactif' ? 'text-amber-300 font-bold' : 'text-slate-500'}`}>{h.status === 'inactif' ? '—' : t.under || '—'}</td>
                    {canManage && (
                      <td className={td}>
                        <button type="button" onClick={() => setEditing(h)} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800" aria-label={`Modifier ${h.name}`} title="Modifier"><Pencil className="w-3.5 h-3.5" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {editing && <SiteModal ctx={ctx} hub={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const SiteModal: React.FC<{ ctx: StockContext; hub: LogisticsHub | null; onClose: () => void }> = ({ ctx, hub, onClose }) => {
  const users = (ctx.users || []).filter(u => u.status !== 'suspendu');
  const [f, setF] = useState({
    code: hub?.code || '',
    name: hub?.name || '',
    province: hub?.province || '',
    city: hub?.city || '',
    address: hub?.address || '',
    managerId: hub?.managerId || '',
    managerName: hub?.managerName || '',
    managerContact: hub?.managerContact || '',
    status: hub?.status || 'actif',
  });
  const [staff, setStaff] = useState<string[]>(hub?.staffIds || []);
  // Candidats à l'équipe : comptes actifs ayant accès au module logistique.
  const candidates = users.filter(u => canAccessLogistics(u) && u.id !== f.managerId);
  const toggleStaff = (id: string) => setStaff(staff.includes(id) ? staff.filter(x => x !== id) : [...staff, id]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const pickManager = (id: string) => {
    const u = users.find(x => x.id === id);
    setF({ ...f, managerId: id, managerName: u?.name || f.managerName, managerContact: u?.phone || u?.email || f.managerContact });
  };
  const code = f.code.trim().toUpperCase();
  const errors = [
    !code && 'Le code du site est obligatoire.',
    code && ctx.hubs.some(h => h.code.toUpperCase() === code && h.id !== hub?.id) && `Le code ${code} existe déjà.`,
    !f.name.trim() && 'Le nom du site est obligatoire.',
  ].filter(Boolean) as string[];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length) return;
    const manager = users.find(u => u.id === f.managerId);
    const next: LogisticsHub = {
      ...(hub || {
        id: `hub-${Date.now().toString(36)}`, storageCapacityM3: 0, currentOccupancyRate: 0, coverageZones: [], securityLevel: 'Standard',
        createdAt: new Date().toISOString().slice(0, 10), managerEmail: '',
      }),
      code,
      name: f.name.trim(),
      province: f.province.trim(),
      city: f.city.trim(),
      address: f.address.trim(),
      managerId: f.managerId || undefined,
      managerName: f.managerName.trim(),
      managerContact: f.managerContact.trim(),
      managerEmail: manager?.email || hub?.managerEmail || '',
      status: f.status as LogisticsHub['status'],
      staffIds: staff.filter(id => id !== f.managerId),
    };
    if (hub) ctx.onUpdateHub(next);
    else ctx.onAddHub(next);
    onClose();
  };

  return (
    <Modal title={hub ? `Modifier le site ${hub.name}` : 'Nouveau site'} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div><label className={label}>Code (unique)</label><input value={f.code} onChange={set('code')} className={`${input} font-mono uppercase`} aria-label="Code du site" /></div>
        <div>
          <label className={label}>Statut</label>
          <select value={f.status} onChange={set('status')} className={input} aria-label="Statut du site">
            {(Object.keys(STATUS) as LogisticsHub['status'][]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={label}>Nom du site</label><input value={f.name} onChange={set('name')} className={input} aria-label="Nom du site" /></div>
        <div><label className={label}>Région / province</label><input value={f.province} onChange={set('province')} className={input} aria-label="Région" /></div>
        <div><label className={label}>Ville</label><input value={f.city} onChange={set('city')} className={input} aria-label="Ville" /></div>
        <div className="col-span-2"><label className={label}>Adresse</label><input value={f.address} onChange={set('address')} className={input} aria-label="Adresse" /></div>
        <div className="col-span-2">
          <label className={label}>Responsable du site (reçoit les tâches de réception)</label>
          <select value={f.managerId} onChange={e => pickManager(e.target.value)} className={input} aria-label="Responsable du site">
            <option value="">— Aucun compte (saisie libre ci-dessous) —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}{u.departmentName ? ` — ${u.departmentName}` : ''}</option>)}
          </select>
        </div>
        <div><label className={label}>Nom affiché</label><input value={f.managerName} onChange={set('managerName')} className={input} aria-label="Nom du responsable" /></div>
        <div><label className={label}>Contact</label><input value={f.managerContact} onChange={set('managerContact')} className={input} aria-label="Contact du responsable" /></div>
        <div className="col-span-2">
          <label className={label}>Équipe du portail (en plus du responsable)</label>
          <p className="text-[10.5px] text-slate-500 mb-1.5">Les membres saisissent les entrées, sorties et envois de ce hub et réceptionnent ce qui lui arrive. Ils ne voient que ce hub.</p>
          {candidates.length === 0 ? <p className="text-[11px] text-slate-500">Aucun compte disponible : le compte doit avoir accès au module logistique.</p> : (
            <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-950/40 border border-slate-800 rounded-xl p-2">
              {candidates.map(u => (
                <label key={u.id} className="flex items-center gap-2 text-xs text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-800/60">
                  <input type="checkbox" checked={staff.includes(u.id)} onChange={() => toggleStaff(u.id)} aria-label={`Équipe : ${u.name}`} />
                  <span>{u.name}<span className="block text-[10px] text-slate-500">{u.roleTitle}</span></span>
                </label>
              ))}
            </div>
          )}
        </div>
        {f.status === 'inactif' && hub?.status !== 'inactif' && (
          <p className="col-span-2 text-[11px] text-amber-300">Le site n'apparaîtra plus dans les nouvelles saisies. Son stock et son historique restent consultables.</p>
        )}
        {errors.length > 0 && <p className="col-span-2 text-xs font-semibold text-rose-400">⚠ {errors[0]}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" className={btnPrimary} disabled={errors.length > 0}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
};
