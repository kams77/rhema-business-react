// src/components/LoginView.tsx
import React, { useState } from 'react';
import type { User, Organization } from '../types';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Fingerprint,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { DEMO_MODE, DEMO_PASSWORD } from '../config';
import {
  MAX_FAILED_ATTEMPTS,
  MIN_PASSWORD_LENGTH,
  checkUserPassword,
  hashPassword,
  validatePasswordStrength,
} from '../lib/auth';

interface LoginViewProps {
  organization: Organization;
  organizations?: Organization[];
  onSelectOrg?: (org: Organization) => void;
  users: User[];
  onLogin: (user: User, method: 'credentials' | 'demo') => void;
  /** Mot de passe erroné : l'application incrémente le compteur et verrouille si nécessaire. */
  onFailedAttempt?: (user: User) => void;
  /** Nouveau mot de passe choisi (empreinte déjà calculée). */
  onPasswordChanged?: (userId: string, passwordHash: string) => void;
  onOpenOnboarding?: () => void;
  onboardingSuccessMsg?: string | null;
  /** Message affiché après une déconnexion automatique (inactivité…). */
  sessionNotice?: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  organization,
  organizations = [],
  onSelectOrg,
  users,
  onLogin,
  onFailedAttempt,
  onPasswordChanged,
  onOpenOnboarding,
  onboardingSuccessMsg,
  sessionNotice
}) => {
  // Champs pré-remplis uniquement en mode démonstration.
  const [identifier, setIdentifier] = useState(DEMO_MODE ? 'dg@rhemabusiness.com' : '');
  const [password, setPassword] = useState(DEMO_MODE ? DEMO_PASSWORD : '');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Étape « changement de mot de passe obligatoire »
  const [userToUpdate, setUserToUpdate] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedDemoCategory, setSelectedDemoCategory] = useState<'all' | 'dg' | 'finance' | 'rh' | 'operations' | 'logistics' | 'security'>('all');

  const isLocked = (u: User) => u.status === 'verrouille' || u.status === 'suspendu';

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChecking) return;
    setErrorMsg(null);

    const cleanInput = identifier.trim().toLowerCase();
    const foundUser = users.find(
      u => u.email.toLowerCase() === cleanInput ||
           (u.matricule && u.matricule.toLowerCase() === cleanInput) ||
           (u.employeeCode && u.employeeCode.toLowerCase() === cleanInput)
    );

    // Message volontairement identique : on ne révèle pas si le compte existe.
    const genericError = 'Identifiant ou mot de passe incorrect.';

    if (!foundUser) {
      setErrorMsg(genericError);
      return;
    }

    if (isLocked(foundUser)) {
      setErrorMsg(`Accès refusé : ce compte est verrouillé. Contactez la Direction Générale pour le débloquer.`);
      return;
    }

    setIsChecking(true);
    try {
      const ok = await checkUserPassword(foundUser, password);
      if (!ok) {
        onFailedAttempt?.(foundUser);
        const remaining = MAX_FAILED_ATTEMPTS - (foundUser.failedAccessAttempts + 1);
        setErrorMsg(
          remaining > 0
            ? `${genericError} Il vous reste ${remaining} essai${remaining > 1 ? 's' : ''} avant le verrouillage du compte.`
            : 'Trop de tentatives : le compte a été verrouillé. Contactez la Direction Générale.'
        );
        return;
      }

      if (foundUser.mustChangePassword && !DEMO_MODE) {
        setUserToUpdate(foundUser);
        setPassword('');
        return;
      }

      onLogin(foundUser, 'credentials');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de la vérification du mot de passe.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToUpdate || isChecking) return;
    setErrorMsg(null);

    const weakness = validatePasswordStrength(newPassword, userToUpdate);
    if (weakness) {
      setErrorMsg(weakness);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsChecking(true);
    try {
      if (await checkUserPassword(userToUpdate, newPassword)) {
        setErrorMsg("Le nouveau mot de passe doit être différent de l'ancien.");
        return;
      }
      const passwordHash = await hashPassword(newPassword);
      onPasswordChanged?.(userToUpdate.id, passwordHash);
      const { password: _legacy, ...rest } = userToUpdate;
      onLogin({ ...rest, passwordHash, mustChangePassword: false }, 'credentials');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Impossible d\'enregistrer le mot de passe.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleQuickDemoLogin = (user: User) => {
    if (!DEMO_MODE) return;
    setErrorMsg(null);
    if (user.status === 'verrouille' || user.status === 'suspendu') {
      setErrorMsg(`Blocage de sécurité actif : Le compte de ${user.name} est verrouillé (${user.failedAccessAttempts} tentatives non autorisées détectées). Ce compte démontre le dispositif anti-intrusion.`);
      return;
    }
    onLogin(user, 'demo');
  };

  const filteredDemoUsers = users.filter(u => {
    if (selectedDemoCategory === 'all') return true;
    if (selectedDemoCategory === 'dg') return u.role === 'dg';
    if (selectedDemoCategory === 'finance') return u.directionId === 'dir-finance' || u.departementId === 'dept-daf' || u.roleTitle.toLowerCase().includes('compt') || u.roleTitle.toLowerCase().includes('finan');
    if (selectedDemoCategory === 'rh') return u.directionId === 'dir-rh' || u.roleTitle.toLowerCase().includes('rh') || u.roleTitle.toLowerCase().includes('paie');
    if (selectedDemoCategory === 'operations') return u.departementId === 'dept-ops' || u.roleTitle.toLowerCase().includes('vsat') || u.roleTitle.toLowerCase().includes('réseau') || u.roleTitle.toLowerCase().includes('opérat');
    if (selectedDemoCategory === 'logistics') return u.directionId === 'dir-log' || u.roleTitle.toLowerCase().includes('logistique') || u.roleTitle.toLowerCase().includes('hub') || u.departmentName?.toLowerCase().includes('logistique');
    if (selectedDemoCategory === 'security') return u.status === 'verrouille' || u.failedAccessAttempts > 0;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white">
      {/* Halo décoratif d'arrière-plan */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-indigo-900/20 via-blue-900/10 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Barre d'en-tête discret */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 p-0.5 shadow-lg flex items-center justify-center font-black text-white text-base">
            RB
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white tracking-wide">{organization.name}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                RD CONGO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {organization.registrationNumber} • Kinshasa
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
          <Fingerprint className="w-3.5 h-3.5" />
          <span>Authentification Scellée SHA-256</span>
        </div>
      </header>

      {/* Corps principal en deux colonnes */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 my-auto">
        
        {/* Colonne Gauche : Formulaire de connexion sécurisé */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div className="mb-6">
            {/* BOUTON PREMIÈRE UTILISATION : CRÉATION D'ORGANISATION */}
            {DEMO_MODE && onOpenOnboarding && (
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="w-full mb-4 p-3 rounded-2xl bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-600/40 text-left flex items-center justify-between transition group shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow">
                    <Sparkles className="w-4 h-4 text-white animate-spin-slow" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block group-hover:text-indigo-200">
                      Première Utilisation ? Créer une Organisation
                    </span>
                    <span className="text-[10px] text-slate-300">
                      Assistant d'initialisation & connexion obligatoire des agents
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition" />
              </button>
            )}

            {sessionNotice && (
              <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5" role="status">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{sessionNotice}</div>
              </div>
            )}

            {/* MESSAGE DE SUCCÈS ONBOARDING */}
            {onboardingSuccessMsg && (
              <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="block text-emerald-300 font-bold mb-0.5">Organisation Déployée avec Succès !</strong>
                  {onboardingSuccessMsg}
                </div>
              </div>
            )}

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Connectivité Obligatoire des Agents via Login</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {userToUpdate ? 'Nouveau mot de passe' : 'Connexion Sécurisée'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {userToUpdate
                ? `Bonjour ${userToUpdate.name}. Pour sécuriser votre compte, choisissez un mot de passe personnel avant de continuer.`
                : "Connectez-vous avec vos identifiants d'entreprise pour accéder à votre espace de travail et habilitations hiérarchiques."}
            </p>

            {/* SÉLECTEUR D'ORGANISATION SI MULTIPLES */}
            {organizations.length > 1 && onSelectOrg && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Organisation sélectionnée :
                </label>
                <select
                  value={organization.id}
                  onChange={e => {
                    const sel = organizations.find(o => o.id === e.target.value);
                    if (sel) onSelectOrg(sel);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.registrationNumber || 'RDC'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in" role="alert">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {userToUpdate ? (
            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <div>
                <label htmlFor="new-password" className="text-slate-300 font-semibold block mb-1.5">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    autoFocus
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="absolute right-3.5 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Au moins {MIN_PASSWORD_LENGTH} caractères, avec au moins une lettre et un chiffre.
                </p>
              </div>
              <div>
                <label htmlFor="confirm-password" className="text-slate-300 font-semibold block mb-1.5">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isChecking}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-60 disabled:cursor-wait text-white font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isChecking ? 'Enregistrement…' : 'Enregistrer et continuer'}</span>
              </button>
              <button
                type="button"
                onClick={() => { setUserToUpdate(null); setNewPassword(''); setConfirmPassword(''); setErrorMsg(null); }}
                className="w-full py-2 text-slate-400 hover:text-white"
              >
                Annuler
              </button>
            </form>
          ) : (
          <form onSubmit={handleManualLogin} className="space-y-4 text-xs">
            <div>
              <label htmlFor="login-identifier" className="text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                <span>Email ou Matricule Professionnel</span>
                <span className="text-[10px] text-slate-500 font-mono">Ex: dg@... ou MAT-001-DG</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  id="login-identifier"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="nom@rhemabusiness.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
                <span>Mot de passe</span>
                {DEMO_MODE && <span className="text-[10px] text-indigo-400 font-mono">Démo : {DEMO_PASSWORD}</span>}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-3.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Règlement de Sécurité Opérationnelle :
              </div>
              <p>
                Toute tentative d'accès à des documents financiers ou RH hors de votre périmètre hiérarchique émet une alerte automatique. Après {MAX_FAILED_ATTEMPTS} mots de passe erronés, le compte est verrouillé.
              </p>
            </div>

            <button
              type="submit"
              disabled={isChecking}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-60 disabled:cursor-wait text-white font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
            >
              <LogIn className="w-4 h-4" />
              <span>{isChecking ? 'Vérification…' : 'Ouvrir la Session de Travail'}</span>
            </button>
          </form>
          )}
        </div>

        {/* Colonne Droite : Sélecteur d'Agent & Comptes Démo Vérifiables (mode démonstration uniquement) */}
        {DEMO_MODE && (
        <div className="w-full max-w-xl space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-indigo-400" />
                  Connexion Rapide en 1 Clic (Données Vérifiables)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cliquez sur un profil ci-dessous pour vous connecter instantanément et tester les habilitations RBAC spécifiques à son rang :
                </p>
              </div>
            </div>

            {/* Filtres par Rôle */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'Tous les collaborateurs' },
                { id: 'dg', label: 'Direction Générale' },
                { id: 'finance', label: 'DAF & Finance' },
                { id: 'rh', label: 'RH & Paie' },
                { id: 'operations', label: 'Télécoms VSAT' },
                { id: 'logistics', label: 'Logistique & Hubs' },
                { id: 'security', label: 'Compte Verrouillé' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedDemoCategory(f.id as any)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                    selectedDemoCategory === f.id
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Grille des comptes cliquables */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
              {filteredDemoUsers.map(u => {
                const isLocked = u.status === 'verrouille' || u.status === 'suspendu';
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickDemoLogin(u)}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition group relative ${
                      isLocked
                        ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-500/50'
                        : 'bg-slate-950/70 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-950'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md ${
                      isLocked
                        ? 'bg-rose-600'
                        : u.role === 'dg'
                        ? 'bg-purple-600'
                        : u.role === 'chef_departement' || u.role === 'directeur'
                        ? 'bg-blue-600'
                        : 'bg-indigo-600'
                    }`}>
                      {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-white text-xs truncate group-hover:text-indigo-300 transition">
                          {u.name}
                        </span>
                        {isLocked ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                            Bloqué
                          </span>
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition shrink-0" />
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {u.roleTitle}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-slate-500">
                        <span className="text-slate-400">{u.matricule || u.employeeCode || 'MAT-RB'}</span>
                        <span>•</span>
                        <span className="truncate">{u.email}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Mot de passe des comptes de test : <strong className="text-indigo-400 font-mono">{DEMO_PASSWORD}</strong></span>
              <span className="text-slate-500 font-mono">{filteredDemoUsers.length} profils disponibles</span>
            </div>
          </div>

          {/* Synthèse des rôles et droits vérifiables */}
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-purple-300">
              <div className="font-bold">Direction Générale</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Vision transversale intégrale</div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-800/40 text-blue-300">
              <div className="font-bold">Directeurs DAF & RH</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Contrats & Bulletins certifiés</div>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-950/20 border border-sky-800/40 text-sky-300">
              <div className="font-bold">Agents VSAT & Compta</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Cloisonnement strict par service</div>
            </div>
          </div>
        </div>
        )}

      </main>

      {/* Pied de page officiel */}
      <footer className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/80 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          © 2026 <strong>RHEMA BUSINESS</strong> — Télécoms, VSAT, Réseaux & Intégration Technologique en République Démocratique du Congo.
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span>RCCM/20-A-01120</span>
          <span>•</span>
          <span>BCC Conforme (USD & CDF)</span>
          <span>•</span>
          <span>Code du Travail RDC</span>
        </div>
      </footer>
    </div>
  );
};
