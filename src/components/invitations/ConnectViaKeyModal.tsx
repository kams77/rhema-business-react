// src/components/invitations/ConnectViaKeyModal.tsx
import React, { useState, useMemo } from 'react';
import type { User, EntityInvitation, HierarchicalEntity } from '../../types';
import { 
  X, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Clock, 
  UserCheck, 
  ArrowRight, 
  ShieldCheck, 
  Lock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { isInvitationExpired, formatTimeRemaining, format10DigitKey } from '../../utils/invitationUtils';

interface ConnectViaKeyModalProps {
  currentUser: User;
  invitations: EntityInvitation[];
  entities: HierarchicalEntity[];
  onClose: () => void;
  onConnectToEntity: (invitation: EntityInvitation) => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

export const ConnectViaKeyModal: React.FC<ConnectViaKeyModalProps> = ({
  currentUser,
  invitations,
  entities,
  onClose,
  onConnectToEntity,
  onLogAction
}) => {
  const [inputKey, setInputKey] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtrer les invitations actives de l'utilisateur connecté
  const userPendingInvitations = useMemo(() => {
    const userMat = (currentUser.matricule || currentUser.employeeCode || '').toUpperCase().trim();
    return invitations.filter(inv => {
      const matchMat = (inv.invitedAgentMatricule || '').toUpperCase().trim() === userMat;
      const matchId = inv.invitedAgentId === currentUser.id;
      const notExpired = !isInvitationExpired(inv);
      return (matchMat || matchId) && notExpired && (inv.status === 'active' || inv.status === 'en_session');
    });
  }, [invitations, currentUser]);

  // Nettoyage de la clé saisie (chiffres uniquement)
  const cleanKey = inputKey.replace(/\D/g, '');

  // Recherche de l'invitation correspondante à la clé
  const matchedInvitation = useMemo(() => {
    if (cleanKey.length !== 10) return null;
    return invitations.find(inv => {
      const invKeyClean = (inv.authKey10Digits || '').replace(/\D/g, '');
      return invKeyClean === cleanKey;
    }) || null;
  }, [cleanKey, invitations]);

  // Vérification de validité de l'invitation trouvée
  const invitationStatus = useMemo(() => {
    if (!matchedInvitation) return null;
    const expired = isInvitationExpired(matchedInvitation);
    const timeRemaining = formatTimeRemaining(matchedInvitation.expiresAt);
    return {
      expired,
      timeRemaining,
      isRevoked: matchedInvitation.status === 'revoquee'
    };
  }, [matchedInvitation]);

  const handleUseQuickKey = (key: string) => {
    setInputKey(key);
    setErrorMsg(null);
  };

  const handleActivateConnection = () => {
    if (!matchedInvitation) {
      setErrorMsg('Veuillez saisir une clé d\'authentification unique valide à 10 chiffres.');
      return;
    }

    if (invitationStatus?.expired || invitationStatus?.isRevoked) {
      setErrorMsg('Cette clé d\'authentification est expirée ou a été révoquée par le responsable de l\'entité.');
      return;
    }

    if (onLogAction) {
      onLogAction(
        'Connexion Inter-Entités via Clé Unique',
        `Agent ${currentUser.name} (${currentUser.matricule}) connecté à l'entité "${matchedInvitation.hostEntityName}" via clé unique 10 chiffres ${matchedInvitation.authKey10Digits}.`,
        'securite'
      );
    }

    onConnectToEntity(matchedInvitation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* EN-TÊTE MODALE */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Connexion à une Entité Invitée</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Authentification temporaire via votre Clé Unique de 10 chiffres
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

        {/* CONTENU DU FORMULAIRE */}
        <div className="p-6 space-y-5">
          {/* SAISIE DE LA CLÉ À 10 CHIFFRES */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Clé d'Authentification Unique (10 chiffres)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {cleanKey.length}/10 chiffres
              </span>
            </label>

            <div className="relative">
              <input
                type="text"
                maxLength={11}
                placeholder="Ex: 84920 18365"
                value={inputKey}
                onChange={e => {
                  setInputKey(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-2xl px-4 py-3.5 text-center text-lg font-mono font-black text-amber-400 tracking-widest placeholder-slate-600 focus:outline-none shadow-inner"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 text-center">
              Saisissez la clé reçue dans votre notification de mission inter-entités.
            </p>
          </div>

          {/* ERREUR EVENTUELLE */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* DÉTAILS DE L'INVITATION TROUVÉE */}
          {matchedInvitation && invitationStatus && (
            <div className={`p-4 rounded-2xl border transition-all ${
              invitationStatus.expired || invitationStatus.isRevoked
                ? 'bg-rose-950/20 border-rose-500/30'
                : 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-950/20'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                  {matchedInvitation.invitationCode}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black border ${
                  invitationStatus.expired || invitationStatus.isRevoked
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {invitationStatus.isRevoked 
                    ? 'RÉVOQUÉE' 
                    : invitationStatus.expired 
                      ? 'DÉLAI EXPIRÉ' 
                      : 'Habilitation Valide'}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Entité Cible d'Accueil :</div>
                  <div className="text-sm font-black text-white flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span>{matchedInvitation.hostEntityName}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Responsable émetteur :</span>
                    <span className="font-semibold text-white">{matchedInvitation.inviterUserName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Agent invité :</span>
                    <span className="font-mono text-indigo-300 font-bold">{matchedInvitation.invitedAgentName} ({matchedInvitation.invitedAgentMatricule})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Délai restant :</span>
                    <span className={`font-mono font-bold ${invitationStatus.expired ? 'text-rose-400' : 'text-amber-400'}`}>
                      {invitationStatus.timeRemaining.text}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                    <strong>Motif :</strong> {matchedInvitation.purpose}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LISTE RAPIDE DES CLÉS REÇUES PAR L'AGENT CONNECTÉ */}
          {userPendingInvitations.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 block mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Vos Clés d'Invitation en Attente ({userPendingInvitations.length}) :</span>
              </span>

              <div className="space-y-2">
                {userPendingInvitations.map(inv => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => handleUseQuickKey(inv.authKey10Digits)}
                    className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-amber-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{inv.hostEntityName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Par {inv.inviterUserName} • {formatTimeRemaining(inv.expiresAt).text}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-black text-amber-400 bg-slate-900 px-2 py-1 rounded border border-amber-500/30">
                        {format10DigitKey(inv.authKey10Digits)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

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
              type="button"
              onClick={handleActivateConnection}
              disabled={!matchedInvitation || invitationStatus?.expired || invitationStatus?.isRevoked}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Activer la Connexion à l'Entité Hôte</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
