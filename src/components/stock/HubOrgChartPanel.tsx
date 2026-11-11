// Organigramme interne d'un hub : cellules (réception, magasin, expédition…), leurs chefs et membres.
// Créé et tenu à jour par le responsable du hub ou par la centrale logistique ; consultable par l'équipe.
// Il décrit l'organisation du site ; les circuits de visa restent ceux de l'organigramme de l'entreprise.
import React, { useMemo, useState } from 'react';
import { Network, Pencil, Plus, Printer, Trash2, UserRound, Users } from 'lucide-react';
import type { HubOrgPerson, HubOrgUnit } from '../../types';
import type { StockContext } from './StockHubsModule';
import { A4Sheet } from '../branding/A4Sheet';
import { Empty, Modal, btnPrimary, btnSecondary, card, input, label } from './stockUi';
import { canEditHubOrg, hubOrgIssues } from '../../../shared/stock.mjs';

const newId = () => `cel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Membres de l'équipe du hub ayant un compte (responsable + équipe du portail). */
function teamAccounts(ctx: StockContext) {
  const hub = ctx.portalHub!;
  const ids = [hub.managerId, ...(hub.staffIds || [])].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  return ids.map(id => ctx.users?.find(u => u.id === id)).filter(Boolean) as NonNullable<StockContext['users']>[number][];
}

const personLabel = (p?: HubOrgPerson) => (p ? `${p.name}${p.title ? ` — ${p.title}` : ''}` : '');

export const HubOrgChartPanel: React.FC<StockContext> = ctx => {
  const hub = ctx.portalHub!;
  const units = ctx.hubOrgs[hub.id] || [];
  const canEdit = canEditHubOrg(ctx.currentUser, hub, ctx.canManage);
  const [editing, setEditing] = useState<HubOrgUnit | 'new' | null>(null);
  const [newParent, setNewParent] = useState<string | undefined>();
  const [printView, setPrintView] = useState(false);
  const team = teamAccounts(ctx);

  const children = (parentId?: string) => units.filter(u => (u.parentId || undefined) === parentId).sort((a, b) => a.name.localeCompare(b.name));
  const placed = useMemo(() => new Set(units.flatMap(u => [u.leader?.userId, ...u.members.map(m => m.userId)]).filter(Boolean)), [units]);
  const unplaced = team.filter(u => !placed.has(u.id) && u.id !== hub.managerId);
  const people = units.reduce((t, u) => t + (u.leader ? 1 : 0) + u.members.length, 0);

  const save = (next: HubOrgUnit[], summary: string) => ctx.onUpdateHubOrg(hub.id, next, summary);
  const remove = (u: HubOrgUnit) => {
    if (children(u.id).length) return;
    if (!window.confirm(`Supprimer la cellule « ${u.name} » de l'organigramme du hub ?`)) return;
    save(units.filter(x => x.id !== u.id), `cellule « ${u.name} » supprimée`);
  };

  const Box: React.FC<{ u: HubOrgUnit; depth: number }> = ({ u, depth }) => (
    <div className={depth ? 'ml-6 pl-4 border-l border-slate-700' : ''}>
      <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 mt-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-black text-white flex items-center gap-1.5"><Network className="w-3.5 h-3.5 text-amber-400" /> {u.name}</div>
            {u.mission && <div className="text-[11px] text-slate-400 mt-0.5">{u.mission}</div>}
          </div>
          {canEdit && (
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => { setNewParent(u.id); setEditing('new'); }} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800" title="Ajouter une sous-cellule" aria-label={`Ajouter une sous-cellule à ${u.name}`}><Plus className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => setEditing(u)} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800" title="Modifier" aria-label={`Modifier ${u.name}`}><Pencil className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => remove(u)} disabled={children(u.id).length > 0} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/10 disabled:opacity-30" title={children(u.id).length ? 'Supprimez d\'abord les sous-cellules' : 'Supprimer'} aria-label={`Supprimer ${u.name}`}><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
            <div className="text-[10px] font-bold uppercase text-amber-300">Chef de cellule</div>
            <div className="text-slate-100 font-semibold">{u.leader ? personLabel(u.leader) : <span className="text-slate-500 font-normal">À désigner</span>}</div>
          </div>
          <div className="md:col-span-2 bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Membres ({u.members.length})</div>
            <div className="text-slate-200">{u.members.length ? u.members.map(m => personLabel(m)).join(' · ') : <span className="text-slate-500">Aucun membre</span>}</div>
          </div>
        </div>
      </div>
      {children(u.id).map(c => <Box key={c.id} u={c} depth={depth + 1} />)}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h3 className="text-sm font-bold text-white">Organigramme du hub {hub.name}</h3>
          <p className="text-[11px] text-slate-400 max-w-3xl">
            L'organisation interne du site : ses cellules, leurs chefs et leurs membres (avec ou sans compte dans l'application).
            {canEdit ? ' Vous pouvez le modifier.' : ' Tenu par le responsable du hub et la centrale logistique.'} Il ne change pas les circuits de visa.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPrintView(v => !v)} className={btnSecondary}><Printer className="w-3.5 h-3.5" /> {printView ? 'Vue normale' : 'Version A4'}</button>
          {canEdit && <button type="button" onClick={() => { setNewParent(undefined); setEditing('new'); }} className={btnPrimary}><Plus className="w-4 h-4" /> Nouvelle cellule</button>}
        </div>
      </div>

      {printView ? (
        <div className="overflow-x-auto flex flex-col items-center gap-3 bg-slate-950/40 rounded-2xl p-4 border border-slate-800">
          <button type="button" onClick={() => window.print()} className={btnPrimary}><Printer className="w-4 h-4" /> Imprimer (A4)</button>
          <A4Sheet organization={ctx.organization} footerExtra={`Organigramme du hub ${hub.name} — ${new Date().toLocaleDateString('fr-FR')}`}>
            <h2 className="text-lg font-black uppercase text-slate-950">Organigramme du hub {hub.name}</h2>
            <p className="text-[11px] text-slate-600 mb-4">{[hub.city, hub.province].filter(Boolean).join(' • ')} • Responsable du site : <strong>{hub.managerName || '—'}</strong> • {units.length} cellule(s), {people} personne(s) placée(s)</p>
            <PrintTree units={units} />
          </A4Sheet>
        </div>
      ) : (
        <div className={card}>
          <div className="bg-gradient-to-r from-amber-500/20 to-transparent border border-amber-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center"><UserRound className="w-5 h-5" /></div>
              <div>
                <div className="text-[10px] font-bold uppercase text-amber-300">Responsable du site</div>
                <div className="text-sm font-black text-white">{hub.managerName || 'À désigner par la centrale'}</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-300 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {units.length} cellule(s) · {people} personne(s) placée(s)</div>
          </div>
          {units.length === 0 ? (
            <div className="mt-3"><Empty>{canEdit ? 'Aucune cellule. Commencez par « Nouvelle cellule » : par exemple Réception, Magasin, Expédition, Sécurité.' : "Le responsable du hub n'a pas encore créé l'organigramme."}</Empty></div>
          ) : children(undefined).map(u => <Box key={u.id} u={u} depth={0} />)}
          {unplaced.length > 0 && (
            <p className="text-[11px] text-amber-300 mt-3">Membres de l'équipe du portail pas encore placés : {unplaced.map(u => u.name).join(', ')}.</p>
          )}
        </div>
      )}

      {editing && (
        <UnitModal
          ctx={ctx}
          units={units}
          unit={editing === 'new' ? null : editing}
          parentId={editing === 'new' ? newParent : undefined}
          onClose={() => setEditing(null)}
          onSave={(next, summary) => { save(next, summary); setEditing(null); }}
        />
      )}
    </div>
  );
};

/** Arbre imprimable (texte sombre sur la feuille A4). */
const PrintTree: React.FC<{ units: HubOrgUnit[]; parentId?: string; depth?: number }> = ({ units, parentId, depth = 0 }) => {
  const kids = units.filter(u => (u.parentId || undefined) === parentId).sort((a, b) => a.name.localeCompare(b.name));
  if (!kids.length) return depth === 0 ? <p className="text-sm text-slate-500">Aucune cellule.</p> : null;
  return (
    <div className={depth ? 'ml-6 pl-3 border-l-2 border-slate-300' : ''}>
      {kids.map(u => (
        <div key={u.id} className="mb-2.5" style={{ breakInside: 'avoid' }}>
          <div className="border border-slate-300 rounded-lg px-3 py-2 bg-slate-50">
            <div className="text-[12px] font-black text-slate-900">{u.name}</div>
            {u.mission && <div className="text-[10px] text-slate-600">{u.mission}</div>}
            <div className="text-[10.5px] text-slate-800 mt-1"><strong>Chef :</strong> {u.leader ? personLabel(u.leader) : 'à désigner'}</div>
            {u.members.length > 0 && <div className="text-[10.5px] text-slate-700"><strong>Membres :</strong> {u.members.map(m => personLabel(m)).join(' • ')}</div>}
          </div>
          <div className="mt-2"><PrintTree units={units} parentId={u.id} depth={depth + 1} /></div>
        </div>
      ))}
    </div>
  );
};

const UnitModal: React.FC<{
  ctx: StockContext;
  units: HubOrgUnit[];
  unit: HubOrgUnit | null;
  parentId?: string;
  onClose: () => void;
  onSave: (next: HubOrgUnit[], summary: string) => void;
}> = ({ ctx, units, unit, parentId, onClose, onSave }) => {
  const team = teamAccounts(ctx);
  const [name, setName] = useState(unit?.name || '');
  const [parent, setParent] = useState(unit ? unit.parentId || '' : parentId || '');
  const [mission, setMission] = useState(unit?.mission || '');
  const [leaderKey, setLeaderKey] = useState(unit?.leader ? (unit.leader.userId || 'libre') : '');
  const [leaderName, setLeaderName] = useState(unit?.leader && !unit.leader.userId ? unit.leader.name : '');
  const [leaderTitle, setLeaderTitle] = useState(unit?.leader?.title || '');
  const [accountMembers, setAccountMembers] = useState<string[]>((unit?.members || []).filter(m => m.userId).map(m => m.userId!));
  const [freeMembers, setFreeMembers] = useState<HubOrgPerson[]>((unit?.members || []).filter(m => !m.userId));
  const [error, setError] = useState('');

  // Une cellule ne peut pas être rattachée à elle-même ni à ses sous-cellules.
  const descendants = useMemo(() => {
    const out = new Set<string>();
    const walk = (id: string) => units.filter(u => u.parentId === id).forEach(c => { out.add(c.id); walk(c.id); });
    if (unit) { out.add(unit.id); walk(unit.id); }
    return out;
  }, [units, unit]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const acc = (id: string): HubOrgPerson => {
      const u = team.find(x => x.id === id)!;
      return { userId: u.id, name: u.name, title: u.roleTitle };
    };
    const leader: HubOrgPerson | undefined = leaderKey === '' ? undefined
      : leaderKey === 'libre' ? (leaderName.trim() ? { name: leaderName.trim(), title: leaderTitle.trim() || undefined } : undefined)
      : { ...acc(leaderKey), title: leaderTitle.trim() || acc(leaderKey).title };
    if (leaderKey === 'libre' && !leader) return setError('Indiquez le nom du chef de cellule.');
    const members = [
      ...accountMembers.filter(id => id !== leader?.userId).map(acc),
      ...freeMembers.filter(m => m.name.trim()).map(m => ({ name: m.name.trim(), title: m.title?.trim() || undefined })),
    ];
    const next: HubOrgUnit = { id: unit?.id || newId(), name: name.trim(), parentId: parent || undefined, mission: mission.trim() || undefined, leader, members };
    const all = unit ? units.map(u => (u.id === unit.id ? next : u)) : [...units, next];
    const issues = hubOrgIssues(all);
    if (issues.length) return setError(issues[0]);
    onSave(all, unit ? `cellule « ${next.name} » modifiée` : `cellule « ${next.name} » créée`);
  };

  return (
    <Modal title={unit ? `Modifier la cellule ${unit.name}` : 'Nouvelle cellule du hub'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={label}>Nom de la cellule</label>
          <input value={name} onChange={e => setName(e.target.value)} className={input} placeholder="ex. Réception & contrôle qualité" aria-label="Nom de la cellule" />
        </div>
        <div>
          <label className={label}>Rattachée à</label>
          <select value={parent} onChange={e => setParent(e.target.value)} className={input} aria-label="Rattachée à">
            <option value="">Responsable du site (premier niveau)</option>
            {units.filter(u => !descendants.has(u.id)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Mission (facultatif)</label>
          <input value={mission} onChange={e => setMission(e.target.value)} className={input} placeholder="ex. Déchargement, comptage et contrôle des arrivages" aria-label="Mission" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Chef de cellule</label>
            <select value={leaderKey} onChange={e => setLeaderKey(e.target.value)} className={input} aria-label="Chef de cellule">
              <option value="">— À désigner —</option>
              {team.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              <option value="libre">Autre personne (sans compte)…</option>
            </select>
          </div>
          <div>
            <label className={label}>Fonction du chef</label>
            <input value={leaderTitle} onChange={e => setLeaderTitle(e.target.value)} className={input} placeholder="ex. Chef magasinier" aria-label="Fonction du chef" />
          </div>
          {leaderKey === 'libre' && (
            <div className="col-span-2">
              <label className={label}>Nom du chef (sans compte)</label>
              <input value={leaderName} onChange={e => setLeaderName(e.target.value)} className={input} aria-label="Nom du chef sans compte" />
            </div>
          )}
        </div>
        <div>
          <label className={label}>Membres ayant un compte (équipe du portail)</label>
          {team.length === 0 ? <p className="text-[11px] text-slate-500">Aucun compte dans l'équipe du hub : la centrale l'ajoute dans l'onglet Sites.</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-950/40 border border-slate-800 rounded-xl p-2">
              {team.map(u => (
                <label key={u.id} className="flex items-center gap-2 text-xs text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-800/60">
                  <input type="checkbox" checked={accountMembers.includes(u.id)} onChange={() => setAccountMembers(accountMembers.includes(u.id) ? accountMembers.filter(x => x !== u.id) : [...accountMembers, u.id])} aria-label={`Membre : ${u.name}`} />
                  <span>{u.name}<span className="block text-[10px] text-slate-500">{u.roleTitle}</span></span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className={label}>Autres membres (sans compte : manutentionnaires, gardiens, chauffeurs…)</label>
          <div className="space-y-1.5">
            {freeMembers.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input value={m.name} onChange={e => setFreeMembers(freeMembers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} placeholder="Nom" aria-label={`Nom du membre ${i + 1}`} />
                <input value={m.title || ''} onChange={e => setFreeMembers(freeMembers.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={input} placeholder="Fonction" aria-label={`Fonction du membre ${i + 1}`} />
                <button type="button" onClick={() => setFreeMembers(freeMembers.filter((_, j) => j !== i))} className="p-2 rounded-lg text-rose-300 hover:bg-rose-500/10" aria-label={`Retirer le membre ${i + 1}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setFreeMembers([...freeMembers, { name: '', title: '' }])} className="text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Ajouter une personne</button>
          </div>
        </div>
        {error && <p className="text-xs font-semibold text-rose-400">⚠ {error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" className={btnPrimary} disabled={!name.trim()}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
};
