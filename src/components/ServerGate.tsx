// src/components/ServerGate.tsx — point d'entrée en mode serveur (VITE_BACKEND=api).
// Installation au premier démarrage → connexion → chargement des données → application.
import React, { useEffect, useRef, useState } from 'react';
import { Database, KeyRound, Upload, Sparkles, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import App from '../App';
import { LoginView } from './LoginView';
import { OrganizationOnboardingWizard } from './OrganizationOnboardingWizard';
import { api, ApiError } from '../lib/api';
import type { PublicStatus } from '../lib/api';
import { remoteStore } from '../lib/remoteStore';
import { createStandardPayrollSystem } from '../data/standardPayroll';
import type { HierarchicalEntity, Organization, User } from '../types';

const NOTICE_KEY = 'rhema:notice';

type Phase =
  | { name: 'loading' }
  | { name: 'unreachable'; message: string }
  | { name: 'setup' }
  | { name: 'login' }
  | { name: 'loadingData' }
  | { name: 'app'; user: User };

const fallbackOrg = (s: PublicStatus | null): Organization => ({
  id: s?.organization?.id ?? 'org',
  name: s?.organization?.name ?? 'RHEMA Business',
  type: (s?.organization?.type as Organization['type']) ?? 'entreprise',
  registrationNumber: s?.organization?.registrationNumber ?? '',
  logo: s?.organization?.logo,
  headquarters: 'Kinshasa',
  email: '',
  phone: '',
} as Organization);

export const ServerGate: React.FC = () => {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(() => {
    try {
      const n = sessionStorage.getItem(NOTICE_KEY);
      sessionStorage.removeItem(NOTICE_KEY);
      return n;
    } catch {
      return null;
    }
  });
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const openApp = async (user: User) => {
    setPhase({ name: 'loadingData' });
    try {
      await remoteStore.loadAll();
      setPhase({ name: 'app', user });
    } catch (err) {
      setPhase({ name: 'unreachable', message: err instanceof Error ? err.message : 'Chargement impossible.' });
    }
  };

  const start = async () => {
    setPhase({ name: 'loading' });
    try {
      const s = await api.status();
      setStatus(s);
      if (!s.initialized) return setPhase({ name: 'setup' });
      try {
        const me = await api.me();
        if (!me.mustChangePassword) return void openApp(me.user);
      } catch {
        /* pas de session : écran de connexion */
      }
      setPhase({ name: 'login' });
    } catch (err) {
      setPhase({ name: 'unreachable', message: err instanceof Error ? err.message : 'Serveur injoignable.' });
    }
  };

  useEffect(() => {
    void start();
  }, []);

  /** Déconnexion : on enregistre ce qui reste, on ferme la session, puis on recharge la page. */
  const logout = async (message: string | null) => {
    await remoteStore.flush().catch(() => {});
    remoteStore.stop();
    await api.logout().catch(() => {});
    try {
      if (message) sessionStorage.setItem(NOTICE_KEY, message);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  switch (phase.name) {
    case 'loading':
    case 'loadingData':
      return (
        <CenteredCard>
          <div className="flex items-center gap-3 text-slate-300" role="status">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            {phase.name === 'loading' ? 'Connexion au serveur…' : 'Chargement des données de l\'organisation…'}
          </div>
        </CenteredCard>
      );

    case 'unreachable':
      return (
        <CenteredCard>
          <div className="space-y-4 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <h1 className="text-lg font-bold text-white">Serveur indisponible</h1>
            <p className="text-sm text-slate-400">{phase.message}</p>
            <button onClick={() => void start()} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Réessayer
            </button>
          </div>
        </CenteredCard>
      );

    case 'setup':
      return (
        <SetupScreen
          codeRequired={!!status?.setupCodeRequired}
          onDone={msg => {
            setSuccessMsg(msg);
            void start();
          }}
        />
      );

    case 'login':
      return (
        <LoginView
          organization={fallbackOrg(status)}
          users={[]}
          onLogin={user => void openApp(user)}
          onboardingSuccessMsg={successMsg}
          sessionNotice={notice}
          remoteLogin={async (identifier, password) => {
            setNotice(null);
            return api.login(identifier, password);
          }}
          remoteChangePassword={async newPassword => (await api.changePassword(newPassword)).user}
        />
      );

    case 'app':
      return <App serverUser={phase.user} onServerLogout={msg => void logout(msg)} />;
  }
};

// ---------------------------------------------------------------------------
// Écran d'installation (premier démarrage)
// ---------------------------------------------------------------------------
const SetupScreen: React.FC<{ codeRequired: boolean; onDone: (message: string) => void }> = ({ codeRequired, onDone }) => {
  const [code, setCode] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const ensureCode = () => {
    if (codeRequired && !code.trim()) {
      setError('Saisissez d\'abord le code d\'installation (variable SETUP_CODE du serveur).');
      return false;
    }
    setError(null);
    return true;
  };

  const submit = async (users: unknown[], data: Record<string, unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.setup({ setupCode: code.trim(), users, data });
      onDone(message);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Installation impossible.');
    } finally {
      setBusy(false);
    }
  };

  const handleWizard = (d: { organization: Organization; entities: HierarchicalEntity[]; users: User[] }) => {
    setShowWizard(false);
    void submit(
      d.users,
      {
        organizations: [d.organization],
        currentOrg: d.organization,
        entities: d.entities,
        payrollConfigs: { [d.organization.id]: createStandardPayrollSystem(d.organization.id, d.organization.name) },
      },
      `L'organisation « ${d.organization.name} » est créée sur le serveur. Connectez-vous avec le compte DG ; chaque collaborateur choisira son mot de passe à sa première connexion.`
    );
  };

  const handleBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !ensureCode()) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.app !== 'rhema-business' || typeof backup.data !== 'object') {
        throw new Error('Ce fichier n\'est pas une sauvegarde RHEMA Business.');
      }
      const users = Array.isArray(backup.data.users) ? backup.data.users : [];
      const { users: _u, session: _s, ...data } = backup.data;
      await submit(users, data, `Sauvegarde importée (${users.length} comptes). Connectez-vous avec vos identifiants habituels.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fichier illisible.');
    }
  };

  return (
    <CenteredCard wide>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Installation du serveur RHEMA Business</h1>
            <p className="text-sm text-slate-400">La base de données est vide. Choisissez comment démarrer.</p>
          </div>
        </div>

        {codeRequired && (
          <div>
            <label htmlFor="setup-code" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Code d'installation
            </label>
            <input
              id="setup-code"
              type="password"
              autoComplete="off"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Valeur de SETUP_CODE (fichier docker-compose)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <button
            disabled={busy}
            onClick={() => ensureCode() && setShowWizard(true)}
            className="text-left p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white space-y-1"
          >
            <Sparkles className="w-5 h-5" />
            <div className="font-bold">Créer mon organisation</div>
            <div className="text-xs text-indigo-100">Assistant : entreprise, organigramme et comptes des collaborateurs.</div>
          </button>
          <button
            disabled={busy}
            onClick={() => ensureCode() && fileInput.current?.click()}
            className="text-left p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-60 text-slate-100 space-y-1"
          >
            <Upload className="w-5 h-5" />
            <div className="font-bold">Importer une sauvegarde</div>
            <div className="text-xs text-slate-400">Fichier .json exporté depuis l'application (menu Sauvegarde).</div>
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={handleBackup} />
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-300" role="status">
            <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement sur le serveur…
          </div>
        )}
      </div>

      <OrganizationOnboardingWizard isOpen={showWizard} onClose={() => setShowWizard(false)} onCompleteOnboarding={handleWizard} />
    </CenteredCard>
  );
};

const CenteredCard: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide }) => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
    <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl`}>
      {children}
    </div>
  </div>
);
