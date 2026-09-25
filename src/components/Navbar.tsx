// src/components/Navbar.tsx
import React, { useState } from 'react';
import type { User, Organization, SecurityAlert } from '../types';
import { 
  Building2, 
  ShieldAlert, 
  UserCheck, 
  ChevronDown, 
  PlusCircle, 
  Lock, 
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Briefcase
} from 'lucide-react';
import { getRoleBadgeClass } from '../utils/rbac';

interface NavbarProps {
  organizations?: Organization[];
  currentOrg?: Organization;
  onSelectOrg?: (org: Organization) => void;
  users?: User[];
  currentUser?: User;
  onSelectUser?: (user: User) => void;
  securityAlerts?: SecurityAlert[];
  onOpenSecurity?: () => void;
  onOpenNewAccount?: () => void;
  onOpenHelp?: () => void;
  onOpenOrgIdentity?: () => void;
  onOpenWorkspace?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  organizations = [],
  currentOrg,
  onSelectOrg = () => {},
  users = [],
  currentUser,
  onSelectUser = () => {},
  securityAlerts = [],
  onOpenSecurity = () => {},
  onOpenNewAccount = () => {},
  onOpenHelp = () => {},
  onOpenOrgIdentity = () => {},
  onOpenWorkspace = () => {},
}) => {
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const activeAlertCount = (securityAlerts || []).filter(a => a && a.status !== 'resolue').length;

  const activeOrg = currentOrg || organizations[0] || {
    id: 'org-1',
    name: 'RHEMA BUSINESS',
    type: 'entreprise' as const,
  };

  const activeUser = currentUser || users[0] || {
    id: 'user-dg',
    name: 'Dr. Amadou Diallo',
    role: 'dg' as const,
    roleTitle: 'Président Directeur Général (PDG / DG)',
    status: 'actif' as const,
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-6 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Logo & Nom Organisation */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenOrgIdentity}
            title={activeUser.role === 'dg' ? "Modifier le Logo & Nom de l'entreprise (DG)" : "Logo officiel scellé"}
            className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg overflow-hidden shrink-0 hover:border-indigo-500 transition p-1"
          >
            {activeOrg.logo ? (
              <img src={activeOrg.logo} alt={activeOrg.name} className="w-full h-full object-contain rounded-lg" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center rounded-lg font-black text-white text-xs">
                RB
              </div>
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Plateforme Hiérarchique</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono border border-emerald-500/30 font-semibold">
                Laravel Eloquent Ready
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                  className="flex items-center gap-1.5 text-sm font-bold text-white hover:text-indigo-300 transition py-0.5"
                >
                  <span className="truncate max-w-[170px] sm:max-w-xs">{activeOrg.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showOrgDropdown && (
                  <div className="absolute left-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Sélectionner l'Organisation
                    </div>
                    <div className="space-y-1 my-1">
                      {organizations.map(org => (
                        <button
                          key={org.id}
                          onClick={() => {
                            onSelectOrg(org);
                            setShowOrgDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                            activeOrg.id === org.id
                              ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="truncate font-medium">{org.name}</div>
                          {activeOrg.id === org.id && <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-slate-800 pt-2 mt-1 space-y-1">
                      <button
                        onClick={() => {
                          setShowOrgDropdown(false);
                          onOpenOrgIdentity();
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 hover:bg-indigo-500/10 flex items-center gap-2"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        Gérer le Nom & Logo ({activeUser.role === 'dg' ? 'Droit DG' : 'Consultation'})
                      </button>

                      <button
                        onClick={() => {
                          setShowOrgDropdown(false);
                          onOpenNewAccount();
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Créer une nouvelle organisation
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bouton Logo & Nom (DG) */}
              {activeUser.role === 'dg' ? (
                <button
                  onClick={onOpenOrgIdentity}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[10px] font-semibold text-indigo-300 transition shrink-0"
                >
                  <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                  <span>Logo & Nom (DG)</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-medium text-slate-400 shrink-0">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Logo scellé</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Boutons d'Action & Sélecteur de Rôles */}
        <div className="flex items-center gap-2.5">
          {/* Bouton Espace Employé (Travail) */}
          <button
            onClick={onOpenWorkspace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500/20 to-blue-600/20 hover:from-sky-500/30 hover:to-blue-600/30 border border-sky-400/40 text-xs font-semibold text-sky-200 transition shadow-sm"
          >
            <Briefcase className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Espace Employé (Travail)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>

          {/* Bouton Centre Sécurité */}
          <button
            onClick={onOpenSecurity}
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
              activeAlertCount > 0
                ? 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span className="hidden md:inline">Centre Sécurité</span>
            {activeAlertCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
                {activeAlertCount}
              </span>
            )}
          </button>

          {/* Sélecteur de Rôle / Utilisateur */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-left transition"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                {activeUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-100 truncate max-w-[150px]">
                  {activeUser.name}
                </div>
                <div className={`text-[10px] font-medium px-1.5 py-0.2 rounded border inline-block ${getRoleBadgeClass(activeUser.role)}`}>
                  {activeUser.roleTitle}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-50">
                <div className="px-2 pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  Changer d'utilisateur pour tester les privilèges :
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        onSelectUser(u);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition ${
                        activeUser.id === u.id
                          ? 'bg-indigo-600/25 border border-indigo-500/40 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{u.roleTitle}</div>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-mono ${getRoleBadgeClass(u.role)}`}>
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bouton Guide d'aide (?) */}
          <button
            onClick={onOpenHelp}
            title="Guide des règles & logique hiérarchique"
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};