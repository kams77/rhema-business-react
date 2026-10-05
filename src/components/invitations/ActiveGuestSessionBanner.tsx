// src/components/invitations/ActiveGuestSessionBanner.tsx
import React from 'react';
import type { EntityInvitation, User } from '../../types';
import { Building2, KeyRound, LogOut, Clock, ShieldCheck } from 'lucide-react';
import { format10DigitKey, formatTimeRemaining } from '../../utils/invitationUtils';

interface ActiveGuestSessionBannerProps {
  guestInvitation: EntityInvitation;
  currentUser: User;
  onExitGuestSession: () => void;
}

export const ActiveGuestSessionBanner: React.FC<ActiveGuestSessionBannerProps> = ({
  guestInvitation,
  currentUser,
  onExitGuestSession
}) => {
  const remaining = formatTimeRemaining(guestInvitation.expiresAt);

  return (
    <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-500/40 text-amber-200 px-4 py-2 shadow-lg sticky top-0 z-50 animate-in slide-in-from-top-2">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <span className="font-extrabold text-white uppercase tracking-wider">
              Session Invité Inter-Entités Active :
            </span>{' '}
            <span className="text-amber-300 font-bold">
              Vous êtes connecté à "{guestInvitation.hostEntityName}"
            </span>{' '}
            <span className="text-slate-400">
              (Habilité par {guestInvitation.inviterUserName})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-amber-500/30 font-mono text-[11px]">
            <KeyRound className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400 font-bold">{format10DigitKey(guestInvitation.authKey10Digits)}</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-300">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{remaining.text}</span>
          </div>

          <button
            onClick={onExitGuestSession}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95"
            title="Quitter la session invité et retourner à votre entité d'origine"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Quitter la Session Invité</span>
          </button>
        </div>
      </div>
    </div>
  );
};
