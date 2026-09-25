// src/components/AgentCrudView.tsx
import React, { useState } from 'react';
import type { User, HierarchicalEntity, UserRole } from '../types';
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
  X
} from 'lucide-react';
import { getRoleBadgeClass } from '../utils/rbac';

interface AgentCrudViewProps {
  users: User[];
  currentUser: User;
  entities: HierarchicalEntity[];
  onCreateUser: (newUser: Omit<User, 'id' | 'failedAccessAttempts'>) => void;
  onRevokeUser: (userId: string) => void;
  onToggleUserStatus: (userId: string) => void;
}

export const AgentCrudView: React.FC<AgentCrudViewProps> = ({
  users,
  currentUser,
  entities,
  onCreateUser,
  onRevokeUser,
  onToggleUserStatus,
}) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Formulaire nouvel agent
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [roleTitle, setRoleTitle] = useState('Agent Opérationnel VSAT');
  const [phone, setPhone] = useState('+243 81 279 1228');
  const [entityId, setEntityId] = useState(entities[0]?.id || '');

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.roleTitle.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    onCreateUser({
      name,
      email,
      role,
      roleTitle,
      organizationId: 'org-1',
      serviceId: entityId,
      status: 'actif',
      phone,
      canCreateSubAgents: role !== 'agent',
    });

    setName('');
    setEmail('');
    setShowModal(false);
  };

  const canManageAgent = (target: User) => {
    if (currentUser.role === 'dg') return true;
    if (target.role === 'dg') return false;
    return currentUser.role === 'chef_departement' || currentUser.role === 'directeur';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-black text-white">Gestion des Collaborateurs & Agents</h2>
          </div>
          <p className="text-xs text-slate-400">
            Annuaire des effectifs, affectations de services et accréditations de sécurité
          </p>
        </div>

        {currentUser.role === 'dg' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition"
          >
            <UserPlus className="w-4 h-4" />
            Recruter un agent
          </button>
        )}
      </div>

      {/* Barre de Recherche */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher par nom, fonction, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Grille des Agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(user => {
          const entity = entities.find(e => e.id === (user.serviceId || user.directionId || user.departementId));

          return (
            <div
              key={user.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{user.name}</h3>
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
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{user.phone || '+243 81 279 1228'}</span>
                  </p>
                </div>
              </div>

              {/* Actions d'administration */}
              {canManageAgent(user) && user.id !== currentUser.id && (
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => onToggleUserStatus(user.id)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
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
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Révoquer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Création Agent */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-semibold block mb-1">Rang / Rôle</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white"
                  >
                    <option value="chef_service">Chef de Service</option>
                    <option value="directeur">Directeur</option>
                    <option value="chef_departement">Chef Département</option>
                    <option value="agent">Agent Exécutant</option>
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
                <label className="text-xs text-slate-400 font-semibold block mb-1">Intitulé du Poste</label>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={e => setRoleTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">Service d'affectation</label>
                <select
                  value={entityId}
                  onChange={e => setEntityId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {entities.map(ent => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} ({ent.level})
                    </option>
                  ))}
                </select>
              </div>

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