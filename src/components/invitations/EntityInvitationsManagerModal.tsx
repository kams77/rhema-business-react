// src/components/invitations/EntityInvitationsManagerModal.tsx
import React, { useState, useMemo } from 'react';
import type { User, HierarchicalEntity, EntityInvitation, EntityInvitationNotification } from '../../types';
import { 
  X, 
  KeyRound, 
  Plus, 
  Copy, 
  Check, 
  Clock, 
  Building2, 
  UserCheck, 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  RefreshCw, 
  Search,
  Filter,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { isInvitationExpired, formatTimeRemaining, format10DigitKey } from '../../utils/invitationUtils';

interface EntityInvitationsManagerModalProps {
  currentUser: User;
  entities: HierarchicalEntity[];
  users: User[];
  invitations: EntityInvitation[];
  onClose: () => void;
  onOpenInviteModal: () => void;
  onOpenConnectModal: () => void;
  onRevokeInvitation: (invitationId: string) => void;
  onExtendInvitation: (invitationId: string, hoursToAdd: number) => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

export const EntityInvitationsManagerModal: React.FC<EntityInvitationsManagerModalProps> = ({
  currentUser,
  entities,
  users,
  invitations,
  onClose,
  onOpenInviteModal,
  onOpenConnectModal,
  onRevokeInvitation,
  onExtendInvitation,
  onLogAction
}) => {
  const [filterTab, setFilterTab] = useState<'issued' | 'received' | 'all'>('issued');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const currentUserMatricule = (currentUser.matricule || currentUser.employeeCode || '').toUpperCase().trim();

  // Filtrer les invitations
  const filteredInvitations = useMemo(() => {
    return invitations.filter(inv => {
      // Filtre d'onglet
      if (filterTab === 'issued') {
        // Invitations émises par l'utilisateur connecté ou son entité
        const isAuthor = inv.inviterUserId === currentUser.id;
        const isManagerOfHost = entities.some(
          e => e.id === inv.hostEntityId && (
            e.managerEmail === currentUser.email || 
            currentUser.role === 'dg' ||
            (e.managerName && e.managerName.toLowerCase().includes(currentUser.name.toLowerCase()))
          )
        );
        if (!isAuthor && !isManagerOfHost) return false;
      } else if (filterTab === 'received') {
        // Invitations où l'utilisateur connecté est l'agent invité
        const isTarget = (inv.invitedAgentMatricule || '').toUpperCase().trim() === currentUserMatricule ||
                         inv.invitedAgentId === currentUser.id;
        if (!isTarget) return false;
      }

      // Recherche par texte
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = inv.invitationCode.toLowerCase().includes(q);
        const matchKey = inv.authKey10Digits.includes(q);
        const matchAgent = inv.invitedAgentName.toLowerCase().includes(q) || inv.invitedAgentMatricule.toLowerCase().includes(q);
        const matchHost = inv.hostEntityName.toLowerCase().includes(q);
        const matchPurpose = inv.purpose.toLowerCase().includes(q);
        if (!matchCode && !matchKey && !matchAgent && !matchHost && !matchPurpose) return false;
      }

      return true;
    });
  }, [invitations, filterTab, searchQuery, currentUser, entities, currentUserMatricule]);

  const handleCopyKey = (inv: EntityInvitation) => {
    navigator.clipboard.writeText(inv.authKey10Digits);
    setCopiedKeyId(inv.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleRevoke = (inv: EntityInvitation) => {
    if (window.confirm(`Confirmez-vous la révocation immédiate de la clé d'authentification ${inv.authKey10Digits} pour ${inv.invitedAgentName} ?`)) {
      onRevokeInvitation(inv.id);
      if (onLogAction) {
        onLogAction('Révocation Clé Inter-Entités', `Clé ${inv.authKey10Digits} révoquée pour l'agent ${inv.invitedAgentName}.`, 'securite');
      }
    }
  };

  const handleExtend = (inv: EntityInvitation) => {
    onExtendInvitation(inv.id, 24);
    if (onLogAction) {
      onLogAction('Prorogation Clé Inter-Entités', `Validité de la clé ${inv.authKey10Digits} prolongée de +24h pour ${inv.invitedAgentName}.`, 'securite');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* EN-TÊTE MODALE */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Gestion des Invitations Inter-Entités & Clés Uniques</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Supervision des accès accordés, délais émis et clés d'authentification à 10 chiffres
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BARRE D'ACTIONS ET ONGLETS */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Onglets */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setFilterTab('issued')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  filterTab === 'issued'
                    ? 'bg-indigo-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Invitations Émises
              </button>
              <button
                onClick={() => setFilterTab('received')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  filterTab === 'received'
                    ? 'bg-indigo-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Invitations Reçues (Moi)
              </button>
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  filterTab === 'all'
                    ? 'bg-indigo-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Toutes ({invitations.length})
              </button>
            </div>

            {/* Boutons d'action : Inviter et Se connecter */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  onClose();
                  onOpenConnectModal();
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Se Connecter via Clé</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenInviteModal();
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Inviter un Agent (Matricule)</span>
              </button>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher par matricule, nom d'agent, clé 10 chiffres, entité ou motif..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* LISTE DES INVITATIONS */}
        <div className="p-6 space-y-3.5">
          {filteredInvitations.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <KeyRound className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-white">Aucune invitation trouvée</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {filterTab === 'issued'
                  ? "Vous n'avez pas encore émis d'invitation inter-entités. Cliquez sur '+ Inviter un Agent' pour générer une clé 10 chiffres."
                  : "Aucune invitation correspondante aux critères de filtrage."}
              </p>
            </div>
          ) : (
            filteredInvitations.map(inv => {
              const expired = isInvitationExpired(inv);
              const remaining = formatTimeRemaining(inv.expiresAt);
              const isRevoked = inv.status === 'revoquee';

              return (
                <div
                  key={inv.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isRevoked
                      ? 'bg-slate-950/40 border-slate-800 opacity-60'
                      : expired
                        ? 'bg-rose-950/15 border-rose-500/25'
                        : 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Bloc gauche : Info entité & agent */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                          {inv.invitationCode}
                        </span>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black border ${
                          isRevoked
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : expired
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : inv.status === 'en_session'
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 animate-pulse'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {isRevoked ? 'RÉVOQUÉE' : expired ? 'EXPIRÉE' : inv.status === 'en_session' ? 'EN SESSION ACTIVE' : 'ACTIVE'}
                        </span>

                        <span className="text-[11px] text-slate-400">
                          Émise par <strong>{inv.inviterUserName}</strong> ({inv.inviterRoleTitle})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Hôte : {inv.hostEntityName}</span>
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Agent invité : {inv.invitedAgentName} ({inv.invitedAgentMatricule})</span>
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 leading-relaxed">
                        <strong>Motif :</strong> {inv.purpose}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Délai initial : {inv.validityDurationHours}h</span>
                        </span>
                        <span>•</span>
                        <span className={`font-mono ${expired ? 'text-rose-400' : 'text-amber-400'}`}>
                          {remaining.text}
                        </span>
                      </div>
                    </div>

                    {/* Bloc droit : Clé 10 chiffres & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 lg:border-l lg:border-slate-800/80 lg:pl-4">
                      {/* Clé 10 chiffres */}
                      <div className="bg-slate-900 p-2.5 rounded-xl border border-amber-500/30 text-center">
                        <div className="text-[9px] uppercase font-bold text-slate-400">Clé Unique (10 chiffres)</div>
                        <div className="font-mono text-base font-black text-amber-400 tracking-wider">
                          {format10DigitKey(inv.authKey10Digits)}
                        </div>
                      </div>

                      {/* Boutons d'action */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyKey(inv)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                          title="Copier la clé 10 chiffres"
                        >
                          {copiedKeyId === inv.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>

                        {!isRevoked && !expired && (
                          <button
                            onClick={() => handleExtend(inv)}
                            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition"
                            title="Prolonger le délai de +24h"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>+24h</span>
                          </button>
                        )}

                        {!isRevoked && (
                          <button
                            onClick={() => handleRevoke(inv)}
                            className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition"
                            title="Révoquer l'accès immédiatement"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
