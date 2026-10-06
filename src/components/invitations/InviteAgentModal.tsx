// src/components/invitations/InviteAgentModal.tsx
import React, { useState, useMemo } from 'react';
import type { User, HierarchicalEntity, EntityInvitation, EntityInvitationNotification } from '../../types';
import { 
  X, 
  KeyRound, 
  Send, 
  Clock, 
  Building2, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Sparkles,
  RefreshCw,
  Search,
  Users,
  Calendar,
  Lock,
  ArrowRight
} from 'lucide-react';
import { generate10DigitAuthKey, getManagedEntities, resolveAgentsByMatricules, format10DigitKey } from '../../utils/invitationUtils';
import { nextReference } from '../../lib/sequence';
import { newId } from '../../utils/id';

interface InviteAgentModalProps {
  currentUser: User;
  entities: HierarchicalEntity[];
  users: User[];
  /** Codes d'invitation déjà attribués (numérotation suivie). */
  existingCodes?: string[];
  onClose: () => void;
  onSendInvitation: (invitation: EntityInvitation, notification: EntityInvitationNotification) => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

export const InviteAgentModal: React.FC<InviteAgentModalProps> = ({
  currentUser,
  entities,
  users,
  existingCodes = [],
  onClose,
  onSendInvitation,
  onLogAction
}) => {
  // Liste des entités gérées par l'utilisateur connecté
  const managedEntities = useMemo(() => getManagedEntities(currentUser, entities), [currentUser, entities]);
  const availableTargetEntities = managedEntities.length > 0 ? managedEntities : entities;

  // État du formulaire
  const [hostEntityId, setHostEntityId] = useState<string>(availableTargetEntities[0]?.id || '');
  const [matriculeInput, setMatriculeInput] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [durationHours, setDurationHours] = useState<number>(24);
  const [accessScope, setAccessScope] = useState<'lecture' | 'operant_delegue' | 'superviseur_temporaire'>('operant_delegue');
  const [authKey, setAuthKey] = useState<string>(() => generate10DigitAuthKey());
  const [copiedKey, setCopiedKey] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<{ count: number; key: string; hostName: string } | null>(null);

  // Résolution instantanée des matricules
  const { matchedAgents, notFoundMatricules } = useMemo(() => {
    return resolveAgentsByMatricules(matriculeInput, users);
  }, [matriculeInput, users]);

  // Entité sélectionnée
  const selectedHostEntity = useMemo(() => {
    return entities.find(e => e.id === hostEntityId) || entities[0];
  }, [entities, hostEntityId]);

  // Date et heure d'expiration calculées
  const calculatedExpiry = useMemo(() => {
    const d = new Date(Date.now() + durationHours * 3600 * 1000);
    return {
      iso: d.toISOString(),
      formatted: d.toLocaleString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }, [durationHours]);

  // Régénérer une nouvelle clé 10 chiffres
  const handleRegenerateKey = () => {
    setAuthKey(generate10DigitAuthKey());
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(authKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Sélection d'un agent suggéré
  const handleSelectSuggestedAgent = (agent: User) => {
    const agentMat = agent.matricule || agent.employeeCode || '';
    if (!agentMat) return;

    if (!matriculeInput.trim()) {
      setMatriculeInput(agentMat);
    } else {
      const tokens = matriculeInput.split(/[,;\s]+/).filter(t => t.length > 0);
      if (!tokens.includes(agentMat)) {
        setMatriculeInput([...tokens, agentMat].join(', '));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (matchedAgents.length === 0) return;
    if (!purpose.trim()) return;

    // Créer une invitation pour chaque agent trouvé
    const takenCodes = [...existingCodes];
    matchedAgents.forEach((agent, index) => {
      // Clé unique pour chaque agent (la première utilise authKey, les suivantes en génèrent une nouvelle si multi-agents)
      const agentKey = index === 0 ? authKey : generate10DigitAuthKey();
      const invId = newId('inv');
      const invCode = nextReference('INV', takenCodes);
      takenCodes.push(invCode);

      const invitation: EntityInvitation = {
        id: invId,
        invitationCode: invCode,
        authKey10Digits: agentKey,
        hostEntityId: selectedHostEntity?.id || 'dept-ops',
        hostEntityName: selectedHostEntity?.name || 'Entité RHEMA BUSINESS',
        hostEntityCode: selectedHostEntity?.code || 'ENT',
        inviterUserId: currentUser.id,
        inviterUserName: currentUser.name,
        inviterRoleTitle: currentUser.roleTitle || 'Responsable d\'Entité',
        invitedAgentMatricule: agent.matricule || agent.employeeCode || 'MAT-AGENT',
        invitedAgentId: agent.id,
        invitedAgentName: agent.name,
        invitedAgentEmail: agent.email,
        invitedAgentHomeEntity: agent.departmentName || 'Entité d\'origine',
        purpose: purpose.trim(),
        accessScope,
        validityDurationHours: durationHours,
        expiresAt: calculatedExpiry.iso,
        createdAt: new Date().toISOString(),
        status: 'active',
        notes: `Invitation émise par ${currentUser.name} (${currentUser.roleTitle}) pour mission inter-entités.`
      };

      const notification: EntityInvitationNotification = {
        id: `notif-${Date.now()}-${index}`,
        recipientUserId: agent.id,
        recipientMatricule: agent.matricule || agent.employeeCode || 'MAT-AGENT',
        title: `Habilitation Inter-Entités : Accès à ${selectedHostEntity?.name}`,
        message: `Le responsable ${currentUser.name} (${currentUser.roleTitle}) vous invite à vous connecter à son entité "${selectedHostEntity?.name}". Votre clé d'authentification unique à 10 chiffres est : ${agentKey}. Délai de validité accordé : ${durationHours}h (Expire le ${calculatedExpiry.formatted}).`,
        authKey10Digits: agentKey,
        hostEntityId: selectedHostEntity?.id || 'dept-ops',
        hostEntityName: selectedHostEntity?.name || 'Entité RHEMA',
        inviterName: currentUser.name,
        inviterRole: currentUser.roleTitle || 'Responsable d\'Entité',
        expiresAt: calculatedExpiry.iso,
        validityHours: durationHours,
        purpose: purpose.trim(),
        isRead: false,
        createdAt: new Date().toISOString(),
        invitationId: invId
      };

      onSendInvitation(invitation, notification);
    });

    if (onLogAction) {
      onLogAction(
        'Émission d\'Invitation Inter-Entités',
        `Invitation envoyée à ${matchedAgents.length} agent(s) pour se connecter à "${selectedHostEntity?.name}" avec clé unique 10 chiffres. Délai : ${durationHours}h.`,
        'securite'
      );
    }

    setCreatedSummary({
      count: matchedAgents.length,
      key: authKey,
      hostName: selectedHostEntity?.name || 'Entité Hôte'
    });
    setIsSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* EN-TÊTE MODALE */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Inviter un Agent d'une autre Entité</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
                  CLÉ 10 CHIFFRES
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Génération d'une clé d'authentification unique avec notification instantanée et délai émis
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

        {/* CONTENU PRINCIPAL */}
        {isSuccess && createdSummary ? (
          /* ÉCRAN DE CONFIRMATION AVEC LA CLÉ ÉMISE */
          <div className="p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h4 className="text-xl font-black text-white">
                Invitation{createdSummary.count > 1 ? 's' : ''} Émise{createdSummary.count > 1 ? 's' : ''} & Notification{createdSummary.count > 1 ? 's' : ''} Envoyée{createdSummary.count > 1 ? 's' : ''} !
              </h4>
              <p className="text-xs text-slate-300 mt-2 max-w-md mx-auto">
                Le message de notification avec la <strong>Clé d'authentification Unique de 10 chiffres</strong> et le délai d'expiration a été transmis avec succès {createdSummary.count > 1 ? `aux ${createdSummary.count} agents` : "à l'agent concerné"}.
              </p>
            </div>

            {/* CARTE D'AFFICHAGE DE LA CLÉ À 10 CHIFFRES */}
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 max-w-md mx-auto space-y-3">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Clé d'Authentification Unique (10 chiffres)
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-2xl font-black text-amber-400 tracking-widest bg-slate-900 px-4 py-2 rounded-xl border border-amber-500/30 shadow-inner">
                  {format10DigitKey(createdSummary.key)}
                </span>
                <button
                  onClick={handleCopyKey}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
                  title="Copier la clé"
                >
                  {copiedKey ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-left text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Entité Hôte d'Accueil :</span>
                  <span className="font-bold text-white truncate max-w-[200px]">{createdSummary.hostName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Délai de Validité émis :</span>
                  <span className="font-bold text-indigo-400">{durationHours} heures</span>
                </div>
                <div className="flex justify-between">
                  <span>Expiration :</span>
                  <span className="font-bold text-slate-300">{calculatedExpiry.formatted}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Terminer & Retourner
              </button>
            </div>
          </div>
        ) : (
          /* FORMULAIRE DE CRÉATION D'INVITATION */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* 1. CHOIX DE L'ENTITÉ D'ACCUEIL */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Entité Hôte (Votre entité d'accueil vers laquelle l'agent se connectera)</span>
              </label>
              <select
                value={hostEntityId}
                onChange={e => setHostEntityId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                {availableTargetEntities.map(e => (
                  <option key={e.id} value={e.id}>
                    [{e.level.toUpperCase()}] {e.name} ({e.code}) — {e.managerName || 'Direction'}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. MATRICULE(S) DE L'AGENT OU DU GROUPE D'AGENTS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Matricule de l'agent concerné (ou plusieurs matricules séparés par virgule)</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  Ex: <code className="text-amber-400 font-mono">MAT-012-TECH</code> ou <code className="text-amber-400 font-mono">MAT-007-OPS</code>
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Saisissez le matricule (ex: MAT-012-TECH, MAT-007-OPS, MAT-014-LOG...)"
                  value={matriculeInput}
                  onChange={e => setMatriculeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              {/* RÉSULTAT DE LA RÉSOLUTION AUTOMATIQUE DU MATRICULE */}
              {matchedAgents.length > 0 && (
                <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-2">
                  <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{matchedAgents.length} agent(s) identifié(s) dans le système :</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchedAgents.map(agent => (
                      <div key={agent.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{agent.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                              {agent.matricule || agent.employeeCode}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                            {agent.departmentName || agent.roleTitle}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avertissement matricule non trouvé */}
              {notFoundMatricules.length > 0 && (
                <div className="mt-2 p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>Matricule(s) non reconnu(s) : <strong>{notFoundMatricules.join(', ')}</strong></span>
                </div>
              )}

              {/* Suggestions rapides d'agents pour faciliter la saisie */}
              {matchedAgents.length === 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-slate-400 block mb-1.5">Suggestions d'agents d'autres entités :</span>
                  <div className="flex flex-wrap gap-1.5">
                    {users.slice(1, 7).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectSuggestedAgent(u)}
                        className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 font-mono flex items-center gap-1 transition"
                      >
                        <span>{u.matricule || u.employeeCode}</span>
                        <span className="text-slate-500 font-sans">({u.name.split(' ')[0]})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. MOTIF OFFICIEL DE L'INVITATION */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Motif Officiel de l'Invitation Inter-Entités
              </label>
              <input
                type="text"
                placeholder="Ex: Mission d'appui technique VSAT terrain, Audit comptable et rapprochement, Visa bordereaux..."
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                required
              />
            </div>

            {/* 4. DÉLAI D'ACCÈS ÉMIS PAR LE RESPONSABLE & ÉCHÉANCE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Délai de Validité Émis</span>
                </label>
                <select
                  value={durationHours}
                  onChange={e => setDurationHours(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={4}>4 heures (Mission courte)</option>
                  <option value={12}>12 heures (Journée de travail)</option>
                  <option value={24}>24 heures (1 jour ouvré)</option>
                  <option value={48}>48 heures (2 jours)</option>
                  <option value={72}>72 heures (3 jours)</option>
                  <option value={168}>7 jours (1 semaine)</option>
                  <option value={336}>14 jours (2 semaines)</option>
                  <option value={720}>30 jours (1 mois)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Portée des Droits Accordés</span>
                </label>
                <select
                  value={accessScope}
                  onChange={e => setAccessScope(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="lecture">Lecture & Consultation seule</option>
                  <option value="operant_delegue">Opérant Délégué (Saisie & Traitement)</option>
                  <option value="superviseur_temporaire">Superviseur Temporaire (Visa)</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Date & Heure d'expiration calculée :</span>
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {calculatedExpiry.formatted}
                </span>
              </div>
            </div>

            {/* 5. APERÇU DE LA CLÉ D'AUTHENTIFICATION UNIQUE (10 CHIFFRES) */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Clé d'Authentification Unique de 10 Chiffres Générée</span>
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                  title="Générer une autre clé à 10 chiffres"
                >
                  <RefreshCw className="w-3 h-3" />
                  Régénérer
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
                <div className="font-mono font-black text-lg text-amber-400 tracking-widest">
                  {format10DigitKey(authKey)}
                </div>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Copiée !' : 'Copier'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Cette clé unique de 10 chiffres sera automatiquement transmise dans le message de notification à l'agent avec le délai émis.
              </p>
            </div>

            {/* BOUTONS D'ACTION */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={matchedAgents.length === 0 || !purpose.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Envoyer Invitation & Notification ({matchedAgents.length || 0} Agent{matchedAgents.length > 1 ? 's' : ''})</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
