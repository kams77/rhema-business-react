// src/components/SecurityView.tsx
import React, { useState } from 'react';
import type { SecurityAlert, User, Organization } from '../types';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  FileWarning, 
  UserX, 
  Clock, 
  Gavel,
  Radio,
  CheckCircle2,
  X
} from 'lucide-react';

interface SecurityViewProps {
  alerts: SecurityAlert[];
  currentUser: User;
  users: User[];
  organization: Organization;
  onLockUser: (userId: string) => void;
  onUnlockUser: (userId: string) => void;
  onResolveAlert: (alertId: string) => void;
  onTriggerTestBreach: () => void;
}

export const SecurityView: React.FC<SecurityViewProps> = ({
  alerts,
  currentUser,
  users,
  organization,
  onLockUser,
  onUnlockUser,
  onResolveAlert,
  onTriggerTestBreach,
}) => {
  const [selectedAlertForSummon, setSelectedAlertForSummon] = useState<SecurityAlert | null>(null);

  const lockedUsers = users.filter(u => u.status === 'verrouille' || u.status === 'convoque');

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critique':
        return <span className="bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase animate-pulse">Critique</span>;
      case 'haute':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Haute</span>;
      default:
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase">Moyenne</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* En-tête avec bouton de simulation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h2 className="text-xl font-black text-white">Centre de Sécurité & Détection Anti-Intrusion</h2>
          </div>
          <p className="text-xs text-slate-400">
            Surveillance périmétrique des accès non autorisés, verrouillage d'agent et convocations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onTriggerTestBreach}
            className="flex items-center gap-2 bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-red-600/20 transition"
          >
            <Radio className="w-4 h-4 animate-pulse" />
            Simuler une infraction d'accès
          </button>
        </div>
      </div>

      {/* Statistiques de Sécurité */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Alertes Récentes</p>
            <p className="text-2xl font-mono font-black text-white mt-1">{alerts.length}</p>
          </div>
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Comptes Verrouillés</p>
            <p className="text-2xl font-mono font-black text-white mt-1">{lockedUsers.length}</p>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Cloisonnement RBAC</p>
            <p className="text-sm font-bold text-emerald-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> 100% Hermétique
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Comptes sous surveillance ou verrouillés */}
      {lockedUsers.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl p-5 shadow-lg space-y-3">
          <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <UserX className="w-4 h-4" /> Comptes Actuellement Bloqués ({lockedUsers.length})
          </h3>
          <div className="space-y-2">
            {lockedUsers.map(user => (
              <div key={user.id} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">{user.name} ({user.roleTitle})</p>
                  <p className="text-[11px] text-slate-400">Statut : <strong className="text-amber-400">{user.status.toUpperCase()}</strong></p>
                </div>
                {currentUser.role === 'dg' && (
                  <button
                    onClick={() => onUnlockUser(user.id)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Déverrouiller
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Journal des Alertes Anti-Intrusion */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" /> Flux d'Infractions & Tentatives de Décloisonnement
        </h3>

        {alerts.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400 text-xs">
            Aucune tentative d'intrusion détectée. Le système est intègre.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getSeverityBadge(alert.severity)}
                    <span className="text-xs font-mono text-slate-400">{alert.timestamp}</span>
                    <span className="text-xs text-slate-500 font-mono">• IP : {alert.ipAddress}</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-100">{alert.userName} ({alert.userRole.toUpperCase()})</h4>
                  <p className="text-xs text-red-400 mt-1 font-medium">{alert.reason}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Entité cible non autorisée : <strong className="text-slate-200">{alert.targetEntityName}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedAlertForSummon(alert)}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    Convoquer l'agent
                  </button>

                  <button
                    onClick={() => onResolveAlert(alert.id)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    Classer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Convocation Disciplinaire Officielle */}
      {selectedAlertForSummon && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-xl w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-bold text-white">Ordre de Convocation Disciplinaire</h3>
              </div>
              <button
                onClick={() => setSelectedAlertForSummon(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white text-slate-900 p-6 rounded-xl space-y-4 text-xs font-sans">
              <div className="border-b pb-3">
                <p className="font-black text-sm uppercase text-blue-950">{organization.name}</p>
                <p className="text-[10px] text-slate-500">Direction Générale & Commission de Discipline</p>
              </div>

              <div>
                <p className="font-bold text-red-600 uppercase text-xs">Objet : Notification d'Infraction & Convocation</p>
                <p className="mt-2 text-slate-700">
                  L'agent <strong>{selectedAlertForSummon.userName}</strong> ({selectedAlertForSummon.userRole}) est formellement convoqué devant la direction suite à la tentative d'accès non autorisée sur l'entité <strong>{selectedAlertForSummon.targetEntityName}</strong> enregistrée sous l'IP <strong>{selectedAlertForSummon.ipAddress}</strong> le {selectedAlertForSummon.timestamp}.
                </p>
              </div>

              <div className="p-3 bg-slate-100 rounded border border-slate-200 text-slate-800">
                <p><strong>Date de comparution :</strong> Sous 24 heures ouvrables au siège de Kintambo.</p>
                <p><strong>Membres du collège :</strong> Directeur Général, DRH, Responsable Sécurité.</p>
              </div>

              <div className="pt-2 text-right">
                <p className="font-bold text-slate-900">{organization.managerName}</p>
                <p className="text-[10px] text-slate-500">{organization.managerRole}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  onLockUser(selectedAlertForSummon.userId);
                  setSelectedAlertForSummon(null);
                }}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
              >
                Signer & Verrouiller le compte de l'agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};