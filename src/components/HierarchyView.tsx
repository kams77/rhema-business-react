// src/components/HierarchyView.tsx
import React, { useState } from 'react';
import type { HierarchicalEntity, Organization, User, EntityLevel, UserRole } from '../types';
import { 
  Building, 
  ShieldCheck, 
  CheckCircle2, 
  Lock, 
  Plus, 
  Sparkles, 
  SlidersHorizontal, 
  ShieldAlert,
  ChevronRight,
  FolderTree,
  KeyRound,
  Pencil,
  Trash2,
  Users
} from 'lucide-react';
import { isEntityInUserScope, isEntityDescendantOf } from '../utils/rbac';
import { canWriteEntity, canDeleteEntity } from '../../shared/access.mjs';
import { orgInitials } from '../config';

interface HierarchyViewProps {
  organization: Organization;
  entities: HierarchicalEntity[];
  currentUser: User;
  users?: User[];
  onAddEntity?: (entity: Omit<HierarchicalEntity, 'id'>) => void;
  onDeleteEntity?: (id: string) => void;
  /** Modification d'une entité (nom, code, responsable, rattachement). */
  onUpdateEntity?: (id: string, changes: Partial<HierarchicalEntity>) => void;
  onOpenOrgIdentity?: () => void;
  onOpenInvitationsManager?: () => void;
  onOpenInviteAgent?: () => void;
  activeInvitationsCount?: number;
}

export const HierarchyView: React.FC<HierarchyViewProps> = ({
  organization,
  entities = [],
  currentUser,
  users = [],
  onAddEntity = (_entity: Omit<HierarchicalEntity, 'id'>) => {},
  onDeleteEntity,
  onUpdateEntity,
  onOpenOrgIdentity = () => {},
  onOpenInvitationsManager,
  onOpenInviteAgent,
  activeInvitationsCount = 0,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Formulaire d'ajout / de modification d'une entité
  const emptyForm = {
    name: '',
    code: '',
    level: 'departement' as EntityLevel,
    parentId: '',
    managerName: '',
    managerEmail: '',
    description: '',
  };
  const [newEntity, setNewEntity] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const LEVEL_ORDER: Record<EntityLevel, number> = { departement: 1, direction: 2, division: 3, service: 4 };
  const LEVEL_LABEL: Record<EntityLevel, string> = { departement: 'Département', direction: 'Direction', division: 'Division', service: 'Service' };
  const byId = new Map(entities.map(e => [e.id, e]));
  const childrenOf = (id?: string) => entities.filter(e => (id ? e.parentId === id : !e.parentId || !byId.has(e.parentId)));
  const countOf = (level: EntityLevel) => entities.filter(e => e.level === level).length;

  /** Agents rattachés à l'entité ou à l'une de ses sous-entités (comptes non suspendus). */
  const membersOf = (entityId: string) => users.filter(u => {
    if (u.status === 'suspendu') return false;
    const anchor = u.serviceId || u.divisionId || u.directionId || u.departementId;
    return !!anchor && isEntityDescendantOf(anchor, entityId, entities);
  }).length;

  const dgNames = users.filter(u => u.role === 'dg' && u.status !== 'suspendu').map(u => u.name).join(' & ');
  const responsible = organization.managerName || organization.directorGeneral || 'la Direction Générale';

  /** Rattachements possibles : entités d'un niveau supérieur, hors de l'entité modifiée et de ses sous-entités. */
  const parentOptions = entities.filter(e =>
    LEVEL_ORDER[e.level] < LEVEL_ORDER[newEntity.level] &&
    !(editingId && isEntityDescendantOf(e.id, editingId, entities))
  );

  const openCreate = () => {
    setEditingId(null);
    setFormError(null);
    setNewEntity({ ...emptyForm, level: countOf('departement') ? 'direction' : 'departement', parentId: entities.find(e => e.level === 'departement')?.id || '' });
    setShowAddModal(true);
  };

  const openEdit = (ent: HierarchicalEntity) => {
    setEditingId(ent.id);
    setFormError(null);
    setNewEntity({
      name: ent.name,
      code: ent.code,
      level: ent.level,
      parentId: ent.parentId || '',
      managerName: ent.managerName && ent.managerName !== 'Non assigné' ? ent.managerName : '',
      managerEmail: ent.managerEmail || '',
      description: ent.description || '',
    });
    setShowAddModal(true);
  };

  const askDelete = (ent: HierarchicalEntity) => {
    const subs = childrenOf(ent.id).length;
    const members = membersOf(ent.id);
    if (subs > 0) {
      setNotice(`« ${ent.name} » contient ${subs} sous-entité(s) : supprimez-les ou rattachez-les ailleurs d'abord.`);
      return;
    }
    if (members > 0) {
      setNotice(`${members} agent(s) sont affectés à « ${ent.name} » : changez leur affectation (Gestion & CRUD Agents → Modifier) avant de supprimer l'entité.`);
      return;
    }
    if (!window.confirm(`Supprimer l'entité « ${ent.name} » (${ent.code}) ?`)) return;
    onDeleteEntity?.(ent.id);
    setNotice(`Entité « ${ent.name} » supprimée.`);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newEntity.name.trim();
    const code = newEntity.code.trim().toUpperCase();
    if (!name || !code) return;
    if (entities.some(x => x.id !== editingId && x.code.toUpperCase() === code)) {
      setFormError(`Le code ${code} est déjà utilisé par une autre entité.`);
      return;
    }
    const fields = {
      name,
      code,
      level: newEntity.level,
      parentId: newEntity.parentId || undefined,
      managerName: newEntity.managerName.trim() || 'Non assigné',
      managerEmail: newEntity.managerEmail.trim() || undefined,
      description: newEntity.description.trim() || undefined,
    };
    const before = editingId ? byId.get(editingId) : undefined;
    const after = { ...(before || {}), ...fields, id: editingId || 'nouvelle', organizationId: organization.id };
    if (!canWriteEntity(currentUser, before, after, entities)) {
      setFormError('Ce rattachement sort de votre périmètre : choisissez une entité placée sous votre responsabilité.');
      return;
    }
    if (editingId) {
      onUpdateEntity?.(editingId, fields);
      setNotice(`Entité « ${name} » modifiée.`);
    } else {
      onAddEntity({ ...fields, organizationId: organization.id, agentCount: 0 });
      setNotice(`Entité « ${name} » ajoutée.`);
    }
    setShowAddModal(false);
    setEditingId(null);
    setNewEntity(emptyForm);
  };

  /** Carte d'une entité et, en dessous, ses sous-entités (tous niveaux, rattachements libres). */
  const LEVEL_STYLE: Record<EntityLevel, { tag: string; card: string; badge: string }> = {
    departement: { tag: 'DEP', card: 'bg-slate-900/90 border-purple-500/40', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    direction: { tag: 'DIR', card: 'bg-slate-900/80 border-blue-500/40', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    division: { tag: 'DIV', card: 'bg-slate-900/70 border-cyan-500/40', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    service: { tag: 'SRV', card: 'bg-emerald-950/20 border-emerald-500/40', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  };
  const renderNode = (ent: HierarchicalEntity, depth: number): React.ReactNode => {
    const st = LEVEL_STYLE[ent.level] || LEVEL_STYLE.service;
    const inScope = isEntityInUserScope(currentUser, ent.id, entities);
    const editable = !!onUpdateEntity && canWriteEntity(currentUser, ent, ent, entities);
    const removable = !!onDeleteEntity && canDeleteEntity(currentUser, ent, entities);
    const kids = childrenOf(ent.id).sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.localeCompare(b.name, 'fr'));
    const members = membersOf(ent.id);
    return (
      <div key={ent.id} className="space-y-2">
        <div className={`p-3.5 rounded-xl border transition-all ${st.card} ${inScope ? '' : 'opacity-85'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center text-[11px] font-bold shrink-0 ${st.badge}`}>{st.tag}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${st.badge}`}>
                    {LEVEL_LABEL[ent.level]} ({ent.code})
                  </span>
                  <span className="text-xs text-slate-300">Responsable : {ent.managerName || 'Non assigné'}</span>
                  {inScope && currentUser.role !== 'dg' && (
                    <span className="text-[10px] px-1.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">✓ Dans votre périmètre</span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-white mt-0.5">{ent.name}</h4>
                {ent.description && <p className="text-xs text-slate-400 mt-0.5">{ent.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                <Users className="w-3 h-3" /> {members} agent{members > 1 ? 's' : ''}
              </span>
              {editable && (
                <button type="button" onClick={() => openEdit(ent)} title="Modifier" aria-label={`Modifier ${ent.name}`}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {removable && (
                <button type="button" onClick={() => askDelete(ent)} title="Supprimer" aria-label={`Supprimer ${ent.name}`}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-red-400 border border-slate-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        {kids.length > 0 && (
          <div className={`space-y-2 border-l-2 border-slate-700/50 ${depth === 0 ? 'pl-4 sm:pl-8' : 'pl-4 sm:pl-6'}`}>
            {kids.map(k => renderNode(k, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. BANNIÈRE SUPÉRIEURE DE L'ORGANISATION (FIDÈLE À LA CAPTURE) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center p-1.5 shadow-md shrink-0">
            <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center font-black text-white text-base">
              {orgInitials(organization.name)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase tracking-wider border border-blue-500/30">
                🏢 ENTREPRISE
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {organization.rccm || organization.registrationNumber || 'RCCM non renseigné'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-1">
              {organization.name}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Identité et logo officiels définis par {responsible}. Supervision globale par le DG et administration déconcentrée par les chefs d'entités.
            </p>
          </div>
        </div>

        {/* Boutons d'Action Droite */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onOpenInvitationsManager && (
            <button
              onClick={onOpenInvitationsManager}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition shadow-sm"
              title="Gérer les invitations inter-entités et clés uniques à 10 chiffres"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Invitations Inter-Entités</span>
              {activeInvitationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-black">
                  {activeInvitationsCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={onOpenOrgIdentity}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Identité & Logo (DG)</span>
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 border border-slate-700 transition"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span>Politique Structurelle</span>
          </button>

          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Entité</span>
          </button>
        </div>
      </div>

      {/* 2. LES 4 PILULES DE NIVEAU (EXACTES À LA CAPTURE) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Niveau 1 : Départements */}
        <div className="p-3.5 rounded-xl border bg-purple-950/20 border-purple-800/40 text-purple-300">
          <div className="text-[10px] uppercase font-bold tracking-wider">Niveau 1</div>
          <div className="text-sm font-bold flex items-center justify-between mt-1">
            <span>Départements</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{countOf('departement')} configuré{''}{countOf('departement') > 1 ? 's' : ''}</div>
        </div>

        {/* Niveau 2 : Directions */}
        <div className="p-3.5 rounded-xl border bg-blue-950/20 border-blue-800/40 text-blue-300">
          <div className="text-[10px] uppercase font-bold tracking-wider">Niveau 2</div>
          <div className="text-sm font-bold flex items-center justify-between mt-1">
            <span>Directions</span>
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{countOf('direction')} configuré{'e'}{countOf('direction') > 1 ? 's' : ''}</div>
        </div>

        {/* Niveau 3 : Divisions */}
        <div className="p-3.5 rounded-xl border bg-cyan-950/20 border-cyan-800/40 text-cyan-300">
          <div className="text-[10px] uppercase font-bold tracking-wider">Niveau 3</div>
          <div className="text-sm font-bold flex items-center justify-between mt-1">
            <span>Divisions</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{countOf('division')} configuré{'e'}{countOf('division') > 1 ? 's' : ''}</div>
        </div>

        {/* Niveau 4 : Services & Agents */}
        <div className="p-3.5 rounded-xl border bg-emerald-950/20 border-emerald-800/40 text-emerald-300">
          <div className="text-[10px] uppercase font-bold tracking-wider">Niveau 4</div>
          <div className="text-sm font-bold flex items-center justify-between mt-1">
            <span>Services & Agents</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{countOf('service')} configuré{''}{countOf('service') > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* 3. CARTE DORÉE DE HAUTE HIÉRARCHIE (DG) */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 p-4.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-base shrink-0">
            DG
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Haute Hiérarchie (Super Utilisateur Global)
              </span>
              <span className="text-xs text-slate-400">{dgNames || 'Direction Générale'}</span>
            </div>
            <h2 className="text-base font-bold text-white mt-0.5">
              Présidence & Direction Générale (PDG / DG / DGA)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Autorité suprême : voit TOUTES les publications du plus bas au plus haut niveau et dispose du pouvoir exclusif de création et révocation de tout agent.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="w-4 h-4" /> Accès universel débloqué
          </span>
        </div>
      </div>

      {/* 4. ARBORESCENCE HIÉRARCHIQUE (tous niveaux, à partir des entités sans parent) */}
      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 p-3 rounded-xl border border-sky-500/30 bg-sky-950/30 text-xs text-sky-200">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-sky-300 hover:text-white" aria-label="Fermer">✕</button>
        </div>
      )}
      <div className="space-y-4">
        {entities.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-slate-700 text-center space-y-2">
            <FolderTree className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-bold text-white">Votre organigramme est vide</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Ajoutez vos départements, directions, divisions et services avec « Nouvelle Entité », puis affectez-y vos agents dans « Gestion & CRUD Agents ».
            </p>
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white">
              <Plus className="w-4 h-4" /> Ajouter la première entité
            </button>
          </div>
        ) : (
          childrenOf(undefined)
            .sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level] || x.name.localeCompare(y.name, 'fr'))
            .map(ent => renderNode(ent, 0))
        )}
      </div>

      {/* Modal Ajout / Modification d'Entité */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {editingId ? <Pencil className="w-4 h-4 text-indigo-400" /> : <Plus className="w-4 h-4 text-indigo-400" />}
                {editingId ? 'Modifier l\'entité' : 'Ajouter une entité'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white" aria-label="Fermer">✕</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label htmlFor="ent-name" className="text-slate-400 font-semibold block mb-1">Nom de l'entité *</label>
                <input
                  id="ent-name"
                  type="text"
                  required
                  placeholder="Ex : Direction des Infrastructures Réseaux"
                  value={newEntity.name}
                  onChange={e => setNewEntity({ ...newEntity, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ent-code" className="text-slate-400 font-semibold block mb-1">Code *</label>
                  <input
                    id="ent-code"
                    type="text"
                    required
                    placeholder="DIR-INFRA"
                    value={newEntity.code}
                    onChange={e => setNewEntity({ ...newEntity, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="ent-level" className="text-slate-400 font-semibold block mb-1">Niveau</label>
                  <select
                    id="ent-level"
                    value={newEntity.level}
                    disabled={!!editingId}
                    onChange={e => {
                      const level = e.target.value as EntityLevel;
                      const parentOk = entities.some(x => x.id === newEntity.parentId && LEVEL_ORDER[x.level] < LEVEL_ORDER[level]);
                      setNewEntity({ ...newEntity, level, parentId: parentOk ? newEntity.parentId : '' });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white disabled:opacity-60"
                  >
                    <option value="departement">Département</option>
                    <option value="direction">Direction</option>
                    <option value="division">Division</option>
                    <option value="service">Service</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="ent-parent" className="text-slate-400 font-semibold block mb-1">Rattachée à</label>
                <select
                  id="ent-parent"
                  value={newEntity.parentId}
                  onChange={e => setNewEntity({ ...newEntity, parentId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                >
                  <option value="">Direction Générale (aucune entité au-dessus)</option>
                  {parentOptions.map(p => (
                    <option key={p.id} value={p.id}>{LEVEL_LABEL[p.level]} — {p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ent-manager" className="text-slate-400 font-semibold block mb-1">Responsable</label>
                  <input
                    id="ent-manager"
                    type="text"
                    placeholder="Nom du responsable"
                    value={newEntity.managerName}
                    onChange={e => setNewEntity({ ...newEntity, managerName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label htmlFor="ent-email" className="text-slate-400 font-semibold block mb-1">Email du responsable</label>
                  <input
                    id="ent-email"
                    type="email"
                    placeholder="nom@entreprise.cd"
                    value={newEntity.managerEmail}
                    onChange={e => setNewEntity({ ...newEntity, managerEmail: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ent-desc" className="text-slate-400 font-semibold block mb-1">Mission (facultatif)</label>
                <input
                  id="ent-desc"
                  type="text"
                  placeholder="Ex : Paie, recrutement et dossiers du personnel"
                  value={newEntity.description}
                  onChange={e => setNewEntity({ ...newEntity, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Le responsable affiché ici est indicatif : les visas et validations reviennent au compte qui occupe le poste (rôle + affectation) dans « Gestion & CRUD Agents ».
              </p>

              {formError && <p role="alert" className="text-[11px] text-red-400 font-semibold">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow"
                >
                  {editingId ? 'Enregistrer les modifications' : 'Enregistrer l\'entité'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Politique Structurelle */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" /> Politique Structurelle
            </h3>
            <p className="text-xs text-slate-400">
              L'arborescence à 4 niveaux (Département, Direction, Division, Service) est active et conforme au standard conventionnel OHADA.
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};