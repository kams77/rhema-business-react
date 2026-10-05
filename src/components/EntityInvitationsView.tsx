// src/components/EntityInvitationsView.tsx
import React, { useState, useMemo } from 'react';
import type { User, HierarchicalEntity, EntityInvitation, EntityInvitationNotification } from '../types';
import { 
  KeyRound, 
  Building2, 
  UserCheck, 
  Plus, 
  Copy, 
  Check, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  Trash2, 
  RefreshCw, 
  Search, 
  Filter, 
  Bell, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  Users, 
  Sparkles,
  Calendar,
  Layers
} from 'lucide-react';
import { isInvitationExpired, formatTimeRemaining, format10DigitKey, isEntityManager } from '../utils/invitationUtils';

interface EntityInvitationsViewProps {
  currentUser: User;
  entities: HierarchicalEntity[];
  users: User[];
  invitations: EntityInvitation[];
  notifications: EntityInvitationNotification[];
  onOpenInviteModal: () => void;
  onOpenConnectModal: () => void;
  onOpenNotificationsModal: () => void;
  onRevokeInvitation: (invitationId: string) => void;
  onExtendInvitation: (invitationId: string, hoursToAdd: number) => void;
  onConnectWithKey: (key: string) => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

export const EntityInvitationsView: React.FC<EntityInvitationsViewProps> = ({
  currentUser,
  entities,
  users,
  invitations,
  notifications,
  onOpenInviteModal,
  onOpenConnectModal,
  onOpenNotificationsModal,
  onRevokeInvitation,
  onExtendInvitation,
  onConnectWithKey,
  onLogAction
}) => {
  const [filterTab, setFilterTab] = useState<'issued' | 'received' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const currentUserMatricule = (currentUser.matricule || currentUser.employeeCode || '').toUpperCase().trim();
  const canInvite = isEntityManager(currentUser, entities);

  // Notifications non lues
  const unreadNotifsCount = notifications.filter(n => {
    const matchMat = (n.recipientMatricule || '').toUpperCase().trim() === currentUserMatricule;
    const matchId = n.recipientUserId === currentUser.id;
    return (matchMat || matchId) && !n.isRead;
  }).length;

  // Filtrage des invitations
  const filteredInvitations = useMemo(() => {
    return invitations.filter(inv => {
      if (filterTab === 'issued') {
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
        const isTarget = (inv.invitedAgentMatricule || '').toUpperCase().trim() === currentUserMatricule ||
                         inv.invitedAgentId === currentUser.id;
        if (!isTarget) return false;
      }

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

  // Statistiques
  const stats = useMemo(() => {
    const active = invitations.filter(i => !isInvitationExpired(i) && i.status !== 'revoquee').length;
    const inSession = invitations.filter(i => i.status === 'en_session').length;
    const expired = invitations.filter(i => isInvitationExpired(i) || i.status === 'expiree').length;
    const totalIssued = invitations.length;

    return { active, inSession, expired, totalIssued };
  }, [invitations]);

  const handleCopyKey = (inv: EntityInvitation) => {
    navigator.clipboard.writeText(inv.authKey10Digits);
    setCopiedKeyId(inv.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleRevoke = (inv: EntityInvitation) => {
    if (window.confirm(`Voulez-vous révoquer définitivement la clé ${inv.authKey10Digits} de ${inv.invitedAgentName} ?`)) {
      onRevokeInvitation(inv.id);
      if (onLogAction) {
        onLogAction('Révocation Clé Inter-Entités', `Clé ${inv.authKey10Digits} révoquée pour ${inv.invitedAgentName}.`, 'securite');
      }
    }
  };

  const handleExtend = (inv: EntityInvitation) => {
    onExtendInvitation(inv.id, 24);
    if (onLogAction) {
      onLogAction('Prorogation Clé Inter-Entités', `Délai prolongé de +24h pour la clé ${inv.authKey10Digits}.`, 'securite');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* BANNIÈRE DE PROTOCOLE OFFICIEL RDC */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <KeyRound className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-white tracking-tight">
                  Invitations & Habilitations Inter-Entités
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                  CLÉ UNIQUE 10 CHIFFRES
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
                  RDC CONFORME 2026
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Les responsables d'entités habilitent des agents d'autres entités à se connecter à leur structure en saisissant leur <strong>matricule</strong>. Le système génère une <strong>clé d'authentification unique de 10 chiffres</strong> et notifie immédiatement l'agent avec le délai émis.
              </p>
            </div>
          </div>

          {/* ACTIONS PRINCIPALES */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Bouton Voir Notifications */}
            <button
              onClick={onOpenNotificationsModal}
              className="px-3.5 py-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 transition relative shadow"
            >
              <Bell className="w-4 h-4 text-indigo-400" />
              <span>Notifications Reçues</span>
              {unreadNotifsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold animate-pulse">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Bouton Se Connecter via Clé 10 Chiffres */}
            <button
              onClick={onOpenConnectModal}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 transition shadow-lg shadow-amber-500/20 active:scale-95"
            >
              <KeyRound className="w-4 h-4" />
              <span>Se Connecter via Clé (10 chiffres)</span>
            </button>

            {/* Bouton Inviter un Agent (Réservé aux Responsables) */}
            {canInvite && (
              <button
                onClick={onOpenInviteModal}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-indigo-600/30 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Inviter un Agent (Matricule)</span>
              </button>
            )}
          </div>
        </div>

        {/* CARTES KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Invitations Actives
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
              {stats.active}
            </div>
            <div className="text-[10px] text-emerald-400/80">Clés valides en cours</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Sessions en Cours
            </div>
            <div className="text-xl font-black text-sky-400 font-mono mt-0.5">
              {stats.inSession}
            </div>
            <div className="text-[10px] text-sky-400/80">Agents connectés en hôte</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Total Clés Émises
            </div>
            <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
              {stats.totalIssued}
            </div>
            <div className="text-[10px] text-amber-400/80">Format strict 10 chiffres</div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Clés Expirées / Clôturées
            </div>
            <div className="text-xl font-black text-slate-300 font-mono mt-0.5">
              {stats.expired}
            </div>
            <div className="text-[10px] text-slate-500">Délai échu respecté</div>
          </div>
        </div>
      </div>

      {/* FILTRES ET LISTE DES INVITATIONS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filterTab === 'all'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-slate-950'
              }`}
            >
              Toutes les Invitations ({invitations.length})
            </button>
            <button
              onClick={() => setFilterTab('issued')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filterTab === 'issued'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-slate-950'
              }`}
            >
              Émises par mes Entités
            </button>
            <button
              onClick={() => setFilterTab('received')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                filterTab === 'received'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white bg-slate-950'
              }`}
            >
              Reçues par Moi ({currentUserMatricule})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filtrer par matricule, clé, agent..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* LISTE DES CARTES D'INVITATION */}
        {filteredInvitations.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <KeyRound className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-white">Aucune invitation trouvée</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Utilisez le bouton ci-dessus pour inviter un agent d'une autre entité via son matricule.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvitations.map(inv => {
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
                        : inv.status === 'en_session'
                          ? 'bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-950/20'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Colonne d'information */}
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                          {inv.invitationCode}
                        </span>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black border ${
                          isRevoked
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : expired
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : inv.status === 'en_session'
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 animate-pulse'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {isRevoked ? 'RÉVOQUÉE' : expired ? 'EXPIRÉE' : inv.status === 'en_session' ? 'SESSION ACTIVE' : 'ACTIVE'}
                        </span>

                        <span className="text-xs text-slate-400">
                          Émis par <strong className="text-white">{inv.inviterUserName}</strong> ({inv.inviterRoleTitle})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Entité Hôte d'Accueil</span>
                          <span className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate">{inv.hostEntityName}</span>
                          </span>
                        </div>

                        <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Agent Invité & Matricule</span>
                          <span className="font-bold text-amber-300 flex items-center gap-1.5 mt-0.5">
                            <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">{inv.invitedAgentName}</span>
                            <span className="font-mono text-[10px] px-1 rounded bg-amber-500/20 text-amber-300">
                              {inv.invitedAgentMatricule}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-300">
                        <strong>Motif de la Mission :</strong> {inv.purpose}
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>Délai de validité : <strong>{inv.validityDurationHours} heures</strong></span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>Échéance : <strong className={expired ? 'text-rose-400 font-mono' : 'text-amber-400 font-mono'}>{remaining.text}</strong></span>
                        </span>
                      </div>
                    </div>

                    {/* Bloc Clé 10 Chiffres & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 lg:border-l lg:border-slate-800 lg:pl-5">
                      <div className="bg-slate-950 p-3 rounded-2xl border border-amber-500/40 text-center min-w-[170px]">
                        <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                          Clé Unique (10 chiffres)
                        </div>
                        <div className="font-mono text-lg font-black text-amber-400 tracking-widest mt-0.5">
                          {format10DigitKey(inv.authKey10Digits)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Transmise par notification</div>
                      </div>

                      <div className="flex sm:flex-col gap-1.5">
                        <button
                          onClick={() => handleCopyKey(inv)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs flex items-center justify-center gap-1 transition"
                          title="Copier la clé"
                        >
                          {copiedKeyId === inv.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          <span className="sm:hidden text-xs">Copier</span>
                        </button>

                        {!isRevoked && !expired && (
                          <button
                            onClick={() => onConnectWithKey(inv.authKey10Digits)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition shadow"
                            title="Se connecter immédiatement avec cette clé"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Connecter</span>
                          </button>
                        )}

                        {!isRevoked && !expired && (
                          <button
                            onClick={() => handleExtend(inv)}
                            className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 transition"
                            title="Prolonger de +24h"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>+24h</span>
                          </button>
                        )}

                        {!isRevoked && (
                          <button
                            onClick={() => handleRevoke(inv)}
                            className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 text-xs flex items-center justify-center transition"
                            title="Révoquer cette clé"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
