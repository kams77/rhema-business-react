// src/components/invitations/NotificationsDrawerModal.tsx
import React from 'react';
import type { EntityInvitationNotification, User } from '../../types';
import { 
  X, 
  Bell, 
  KeyRound, 
  Building2, 
  Clock, 
  Copy, 
  Check, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { format10DigitKey, formatTimeRemaining } from '../../utils/invitationUtils';

interface NotificationsDrawerModalProps {
  currentUser: User;
  notifications: EntityInvitationNotification[];
  onClose: () => void;
  onConnectWithKey: (key: string) => void;
  onMarkAsRead: (notifId: string) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationsDrawerModal: React.FC<NotificationsDrawerModalProps> = ({
  currentUser,
  notifications,
  onClose,
  onConnectWithKey,
  onMarkAsRead,
  onMarkAllAsRead
}) => {
  const [copiedKeyId, setCopiedKeyId] = React.useState<string | null>(null);

  const currentUserMatricule = (currentUser.matricule || currentUser.employeeCode || '').toUpperCase().trim();

  // Notifications adressées à l'utilisateur connecté
  const userNotifications = notifications.filter(n => {
    const matchMat = (n.recipientMatricule || '').toUpperCase().trim() === currentUserMatricule;
    const matchId = n.recipientUserId === currentUser.id;
    return matchMat || matchId;
  });

  const unreadCount = userNotifications.filter(n => !n.isRead).length;

  const handleCopyKey = (notif: EntityInvitationNotification) => {
    navigator.clipboard.writeText(notif.authKey10Digits);
    setCopiedKeyId(notif.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* EN-TÊTE */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 relative">
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-slate-900" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Notifications & Invitations Reçues</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold border border-rose-500/30">
                    {unreadCount} NON LUE{unreadCount > 1 ? 'S' : ''}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Messages officiels avec clés d'authentification uniques de 10 chiffres
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

        {/* LISTE DES NOTIFICATIONS */}
        <div className="p-6 space-y-4">
          {userNotifications.length > 0 && unreadCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={onMarkAllAsRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition"
              >
                Tout marquer comme lu
              </button>
            </div>
          )}

          {userNotifications.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <Bell className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-white">Aucune notification d'invitation</div>
              <p className="text-xs text-slate-400">
                Vous n'avez pas d'invitation en attente pour le moment.
              </p>
            </div>
          ) : (
            userNotifications.map(notif => {
              const remaining = formatTimeRemaining(notif.expiresAt);

              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    !notif.isRead
                      ? 'bg-slate-950 border-amber-500/40 shadow-lg shadow-amber-950/20'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/30">
                        INVITATION INTER-ENTITÉS
                      </span>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white">
                    {notif.title}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {notif.message}
                  </p>

                  {/* CARTE D'AFFICHAGE DE LA CLÉ DE 10 CHIFFRES */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                        Votre Clé d'Authentification Unique (10 Chiffres)
                      </div>
                      <div className="font-mono text-base font-black text-amber-400 tracking-wider">
                        {format10DigitKey(notif.authKey10Digits)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopyKey(notif)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition"
                        title="Copier la clé"
                      >
                        {copiedKeyId === notif.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => {
                          onMarkAsRead(notif.id);
                          onConnectWithKey(notif.authKey10Digits);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 transition shadow"
                      >
                        <span>Se Connecter</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-indigo-400" />
                      <span>{notif.hostEntityName}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-amber-300">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>{remaining.text}</span>
                    </span>
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
