// src/components/AgentCrudView.tsx
import React, { useState } from 'react';
import { nextReference } from '../lib/sequence';
import type { User, HierarchicalEntity, UserRole, Organization } from '../types';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Search, 
  Mail, 
  Phone,
  Building,
  CheckCircle2,
  X,
  FileCheck2,
  AlertTriangle,
  Layers,
  Crown,
  Briefcase
} from 'lucide-react';
import { 
  getRoleBadgeClass, 
  isUserVisibleToUser, 
  canUserManageAgent, 
  getEntitiesInUserScope,
  getRoleRank 
} from '../utils/rbac';

interface AgentCrudViewProps {
  users: User[];
  currentUser: User;
  entities: HierarchicalEntity[];
  organization?: Organization;
  onCreateUser: (newUser: Omit<User, 'id' | 'failedAccessAttempts'>) => void;
  onRevokeUser: (userId: string) => void;
  onToggleUserStatus: (userId: string) => void;
  onToggleDelegation?: (userId: string) => void;
}

export const AgentCrudView: React.FC<AgentCrudViewProps> = ({
  users,
  currentUser,
  entities,
  organization,
  onCreateUser,
  onRevokeUser,
  onToggleUserStatus,
  onToggleDelegation,
}) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Entités dans le périmètre autorisé de l'utilisateur connecté
  const scopedEntities = getEntitiesInUserScope(currentUser, entities);

  // Formulaire nouvel agent
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const nextMatricule = () => nextReference('MAT', users.map(u => u.matricule));
  const [matricule, setMatricule] = useState(nextMatricule);
  const [role, setRole] = useState<UserRole>('agent');
  const [roleTitle, setRoleTitle] = useState('Agent Opérationnel');
  const [phone, setPhone] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [entityId, setEntityId] = useState(scopedEntities[0]?.id || '');
  const [canApproveServiceDocuments, setCanApproveServiceDocuments] = useState(false);

  // 1. Filtrage selon les RÈGLES STRICTES DE CONFIDENTIALITÉ (1 à 6)
  // - DG : voit tout le personnel de l'entreprise
  // - Chef de Département : voit son département + directions, divisions et services affiliés
  // - Chef de Direction : voit sa direction + divisions et services affiliés
  // - Chef de Division : voit sa division + services affiliés
  // - Chef de Service : voit uniquement son service
  // - Agent : voit son service ou lui-même
  const visibleUsers = users.filter(u => isUserVisibleToUser(currentUser, u, entities));

  const filteredUsers = visibleUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.roleTitle.toLowerCase().includes(search.toLowerCase()) ||
    (u.matricule && u.matricule.toLowerCase().includes(search.toLowerCase()))
  );

  // Habilitation à recruter : DG et Chefs hiérarchiques dans leur périmètre
  const canRecruit = currentUser.role !== 'agent';

  // Rôles autorisés à la création selon le rang hiérarchique
  const creatorRank = getRoleRank(currentUser.role);
  const selectableRoles: { value: UserRole; label: string }[] = [
    { value: 'agent', label: 'Agent Exécutant' },
    ...(creatorRank > 2 ? [{ value: 'chef_service' as UserRole, label: 'Chef de Service' }] : []),
    ...(creatorRank > 3 ? [{ value: 'chef_division' as UserRole, label: 'Chef de Division' }] : []),
    ...(creatorRank > 4 ? [{ value: 'directeur' as UserRole, label: 'Chef de Direction / Directeur' }] : []),
    ...(creatorRank > 5 ? [{ value: 'chef_departement' as UserRole, label: 'Chef de Département' }] : []),
  ];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const mail = email.trim().toLowerCase();
    if (users.some(u => u.email.trim().toLowerCase() === mail)) {
      setCreateError('Cet email est déjà utilisé par un autre compte.');
      return;
    }
    if (matricule.trim() && users.some(u => (u.matricule || '').toLowerCase() === matricule.trim().toLowerCase())) {
      setCreateError('Ce matricule est déjà attribué.');
      return;
    }
    setCreateError(null);

    const targetEnt = entities.find(e => e.id === entityId);

    onCreateUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      matricule,
      employeeCode: matricule,
      role,
      roleTitle,
      organizationId: organization?.id || 'org-1',
      serviceId: targetEnt?.level === 'service' ? targetEnt.id : undefined,
      divisionId: targetEnt?.level === 'division' ? targetEnt.id : undefined,
      directionId: targetEnt?.level === 'direction' ? targetEnt.id : undefined,
      departementId: targetEnt?.level === 'departement' ? targetEnt.id : undefined,
      departmentName: targetEnt?.name || 'Service Opérationnel',
      status: 'actif',
      phone,
      canCreateSubAgents: role !== 'agent',
      canApproveServiceDocuments: role === 'agent' ? canApproveServiceDocuments : true,
    });

    setName('');
    setEmail('');
    setMatricule(nextReference('MAT', [...users.map(u => u.matricule), matricule]));
    setShowModal(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. EN-TÊTE DU MODULE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-black text-white">Gestion des Collaborateurs & Agents</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {filteredUsers.length} Collaborateurs dans votre périmètre
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Annuaire hiérarchique certifié • Visibilité & habilitations de gestion selon les règles strictes RBAC
          </p>
        </div>

        {canRecruit && (
          <button
            onClick={() => {
              if (scopedEntities.length > 0) setEntityId(scopedEntities[0].id);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enrôler un Collaborateur</span>
          </button>
        )}
      </div>

      {/* 2. RAPPEL DES RÈGLES STRICTES DE CONFIDENTIALITÉ & POUVOIRS */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-xs space-y-2">
        <div className="flex items-center gap-2 text-indigo-300 font-bold">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Matrice des Règles Strictes de Confidentialité & Pouvoirs (1 à 6) :</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px] text-slate-300 mt-2">
          <div className={`p-2.5 rounded-xl border ${currentUser.role === 'dg' ? 'bg-indigo-950/40 border-indigo-500/40 text-white' : 'bg-slate-950/60 border-slate-800'}`}>
            <strong className="text-indigo-400 block mb-0.5">1. Le DG (Directeur Général)</strong>
            <span>Voit TOUT et peut TOUT faire à l'échelle de l'organisation sans restriction.</span>
          </div>
          <div className={`p-2.5 rounded-xl border ${currentUser.role === 'chef_departement' ? 'bg-indigo-950/40 border-indigo-500/40 text-white' : 'bg-slate-950/60 border-slate-800'}`}>
            <strong className="text-blue-400 block mb-0.5">2. Chef de Département</strong>
            <span>Voit tout et gère son département + directions, divisions et services affiliés.</span>
          </div>
          <div className={`p-2.5 rounded-xl border ${currentUser.role === 'directeur' ? 'bg-indigo-950/40 border-indigo-500/40 text-white' : 'bg-slate-950/60 border-slate-800'}`}>
            <strong className="text-sky-400 block mb-0.5">3. Chef de Direction</strong>
            <span>Pouvoir de sa direction jusqu'aux divisions et services de sa direction.</span>
          </div>
          <div className={`p-2.5 rounded-xl border ${currentUser.role === 'chef_division' ? 'bg-indigo-950/40 border-indigo-500/40 text-white' : 'bg-slate-950/60 border-slate-800'}`}>
            <strong className="text-cyan-400 block mb-0.5">4. Chef de Division</strong>
            <span>Pouvoir commence au niveau de sa division jusqu'aux services affiliés.</span>
          </div>
          <div className={`p-2.5 rounded-xl border ${currentUser.role === 'chef_service' ? 'bg-indigo-950/40 border-indigo-500/40 text-white' : 'bg-slate-950/60 border-slate-800'}`}>
            <strong className="text-amber-400 block mb-0.5">5. Chef de Service</strong>
            <span>Pouvoir STRICTEMENT limité au niveau de son propre service.</span>
          </div>
          <div className={`p-2.5 rounded-xl border ${currentUser.role === 'agent' ? 'bg-emerald-950/40 border-emerald-500/40 text-white' : 'bg-slate-950/60 border-slate-800'}`}>
            <strong className="text-emerald-400 block mb-0.5">6. Agents Opérationnels</strong>
            <span>Exécutent les tâches. Visa de documents uniquement si délégation formelle du Chef de Service.</span>
          </div>
        </div>
      </div>

      {/* 3. BARRE DE RECHERCHE */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par nom, matricule, fonction, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-sm"
        />
      </div>

      {/* 4. GRILLE DES COLLABORATEURS ACCESSIBLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(user => {
          const isSelf = user.id === currentUser.id;
          const canManage = canUserManageAgent(currentUser, user, entities);
          const isAgent = user.role === 'agent';

          return (
            <div
              key={user.id}
              className={`bg-slate-900/90 border rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition space-y-4 ${
                isSelf ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow text-sm">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-white">{user.name}</h3>
                        {isSelf && (
                          <span className="text-[9px] font-bold bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/40">
                            VOUS
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border inline-block mt-0.5 ${getRoleBadgeClass(user.role)}`}>
                        {user.role.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    user.status === 'actif'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border-red-500/30 animate-pulse'
                  }`}>
                    {user.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400">
                  <p className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">{user.roleTitle}</span>
                  </p>
                  {user.matricule && (
                    <p className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                      <span className="text-slate-500">Matricule :</span>
                      <strong className="text-white">{user.matricule}</strong>
                    </p>
                  )}
                  {user.departmentName && (
                    <p className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">Affectation : {user.departmentName}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{user.phone || '+243 81 279 1228'}</span>
                  </p>
                </div>

                {/* RÈGLE STRICTE 6 : DÉLÉGATION DE VISA DE DOCUMENTS POUR AGENTS */}
                {isAgent && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Délégation Visa Service (Règle 6) :</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        user.canApproveServiceDocuments
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {user.canApproveServiceDocuments ? '✓ Visa Habilité' : '✗ Non Habilité'}
                      </span>

                      {canManage && onToggleDelegation && (
                        <button
                          onClick={() => onToggleDelegation(user.id)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition border ${
                            user.canApproveServiceDocuments
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                              : 'bg-emerald-600 text-white hover:bg-emerald-500 border-transparent shadow'
                          }`}
                        >
                          {user.canApproveServiceDocuments ? 'Révoquer Délégation' : 'Conférer Visa Service'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions d'administration selon la hiérarchie stricte */}
              {canManage && !isSelf && (
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <button
                    onClick={() => onToggleUserStatus(user.id)}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white transition"
                  >
                    {user.status === 'actif' ? (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-400" /> Suspendre
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-emerald-400" /> Réactiver
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onRevokeUser(user.id)}
                    className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Révoquer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 5. MODALE CRÉATION / ENRÔLEMENT COLLABORATEUR DANS LE PÉRIMÈTRE */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" /> Enrôler un Nouveau Collaborateur
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Nom et Prénom *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Patrick Kabeya"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Email Professionnel *</label>
                  <input
                    type="email"
                    required
                    placeholder="p.kabeya@rhemabusiness.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Matricule Officiel</label>
                  <input
                    type="text"
                    required
                    value={matricule}
                    onChange={e => setMatricule(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Rang Hiérarchique</label>
                  <select
                    value={role}
                    onChange={e => {
                      const newRole = e.target.value as UserRole;
                      setRole(newRole);
                      if (newRole === 'agent') setRoleTitle('Agent Opérationnel');
                      else if (newRole === 'chef_service') setRoleTitle('Chef de Service');
                      else if (newRole === 'chef_division') setRoleTitle('Chef de Division');
                      else if (newRole === 'directeur') setRoleTitle('Directeur de Direction');
                      else if (newRole === 'chef_departement') setRoleTitle('Chef de Département');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white"
                  >
                    {selectableRoles.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Intitulé Exact du Poste</label>
                <input
                  type="text"
                  required
                  value={roleTitle}
                  onChange={e => setRoleTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Affectation dans votre périmètre autorisé</label>
                <select
                  value={entityId}
                  onChange={e => setEntityId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {scopedEntities.map(ent => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} ({ent.level.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {role === 'agent' && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canApproveServiceDocuments}
                        onChange={e => setCanApproveServiceDocuments(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                      />
                      <span>Conférer la délégation de visa des documents de service (Règle 6)</span>
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed pl-5">
                    Permet à cet agent d'approuver certains documents opérationnels rattachés strictement à son service d'affectation.
                  </p>
                </div>
              )}

              {createError && (
                <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{createError}</p>
              )}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30"
                >
                  Enrôler l'agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
