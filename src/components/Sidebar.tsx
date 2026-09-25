// src/components/Sidebar.tsx
import React from 'react';
import type { User, Organization } from '../types';
import { 
  Briefcase,
  Network, 
  Files, 
  Workflow, 
  ShieldAlert, 
  Users, 
  FileCode2, 
  History,
  ChevronRight,
  Fingerprint,
  Coins
} from 'lucide-react';

export type ActiveTab = 
  | 'workspace'
  | 'hierarchy' 
  | 'documents' 
  | 'workflows' 
  | 'payroll'
  | 'security' 
  | 'agents' 
  | 'audit' 
  | 'laravel';

interface SidebarProps {
  currentTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentUser?: User;
  unreadAlertsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  unreadAlertsCount = 2,
}) => {
  const activeUser = currentUser || {
    id: 'default-user',
    name: 'Dr. Amadou Diallo',
    role: 'dg' as const,
    roleTitle: 'Président Directeur Général (PDG / DG)',
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string | number; badgeColor?: string }[] = [
    {
      id: 'workspace',
      label: 'Espace Employé (Connexion & Travail)',
      icon: <Briefcase className="w-4 h-4 text-sky-400" />,
      badge: 'Portail Employé',
      badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold',
    },
    {
      id: 'hierarchy',
      label: 'Organigramme & Entités',
      icon: <Network className="w-4 h-4" />,
    },
    {
      id: 'documents',
      label: 'Documents & Workflows',
      icon: <Files className="w-4 h-4" />,
      badge: 'RH / Paie',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'workflows',
      label: 'Tâches & Approbations',
      icon: <Workflow className="w-4 h-4" />,
    },
    {
      id: 'payroll',
      label: 'Système de Paie RH',
      icon: <Coins className="w-4 h-4 text-amber-400" />,
      badge: 'RH & Salaires',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'security',
      label: 'Sécurité & Anti-Intrusion',
      icon: <ShieldAlert className="w-4 h-4" />,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold',
    },
    {
      id: 'agents',
      label: 'Gestion & CRUD Agents',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'audit',
      label: 'Journal d’Audit Immuable',
      icon: <History className="w-4 h-4" />,
    },
    {
      id: 'laravel',
      label: 'Architecture Laravel 11/12',
      icon: <FileCode2 className="w-4 h-4" />,
      badge: 'Backend Code',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-61px)] select-none">
      {/* Carte Session Active (Fidèle à la Capture) */}
      <div className="p-3.5 border-b border-slate-800/80 bg-slate-950/40 m-2 rounded-xl">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>Session Active</span>
          <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            En ligne
          </span>
        </div>
        <div className="font-semibold text-xs text-white truncate">{activeUser.name}</div>
        <div className="text-[11px] text-indigo-400 font-medium truncate mt-0.5">{activeUser.roleTitle}</div>
        
        {/* Périmètre */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
          <span>Périmètre :</span>
          <span className="font-semibold text-slate-200">
            {activeUser.role === 'dg' ? '★ Global (Toute l’Entité)' : '📋 Service Opérationnel'}
          </span>
        </div>
      </div>

      {/* Liste des Modules */}
      <nav className="flex-1 p-2 space-y-1">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Modules Principaux
        </div>
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {item.badge !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Règle de cloisonnement en bas */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[10px] uppercase tracking-wider">
          <Fingerprint className="w-3.5 h-3.5" />
          Règle de Cloisonnement
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Toute tentative d’accès hors périmètre hiérarchique déclenche une alerte DG et le verrouillage après récidive.
        </p>
      </div>
    </aside>
  );
};