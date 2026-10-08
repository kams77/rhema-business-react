// src/App.tsx
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { usePersistentState } from './hooks/usePersistentState';
import { newId, nowStamp } from './utils/id';
import { invoiceBankDetails } from './lib/bank';
import { AUDIT_GENESIS, auditChainHash, contentHashSync } from './lib/integrity';
import { API_MODE, DEMO_MODE, DEMO_PASSWORD } from './config';
import { SESSION_EXPIRED_EVENT } from './lib/api';
import { SYNC_NOTICE_EVENT } from './lib/remoteStore';
import { SyncIndicator } from './components/SyncIndicator';
import { STORAGE_ERROR_EVENT } from './lib/storage';
import { ToastStack } from './components/ToastStack';
import type { ToastMessage, ToastType } from './components/ToastStack';
import { DataBackupModal } from './components/DataBackupModal';
import {
  MAX_FAILED_ATTEMPTS,
  TEMP_LOCK_MS,
  clearSession,
  generateTemporaryPassword,
  loadSession,
  migratePlaintextPasswords,
  saveSession,
  touchSession,
} from './lib/auth';
import type { 
  Organization, 
  HierarchicalEntity,
  User, 
  DocumentItem, 
  TaskItem, 
  SecurityAlert,
  AuditLog,
  PayrollSystemConfig,
  EmployeeContract,
  PayrollRunPeriod,
  PurchaseOrderItem,
  DeliveryNoteItem,
  ShipmentTracking,
  ProformaInvoiceItem,
  NetToPayInvoiceItem,
  LogisticsItem,
  ShipmentWorkflowStep
} from './types';
import { 
  initialOrganizations, 
  initialEntities, 
  initialUsers, 
  initialDocuments, 
  initialTasks,
  initialSecurityAlerts,
  initialAuditLogs,
  initialContracts
} from './data/initialData';
import { 
  initialLogisticsCatalog,
  initialPurchaseOrders,
  initialDeliveryNotes,
  initialShipments,
  initialProformas,
  initialNetToPayInvoices,
  initialHubs,
  initialHubStocks,
  initialStockMovements
} from './data/initialLogisticsData';
import { canAccessLogistics, canUserApproveDocument, isLogisticsManager } from './utils/rbac';
import {
  SHIPMENT_STEP_LABELS,
  anchorEntity,
  buildDocumentChain,
  buildTaskApprovalChain,
  canActOnDocument,
  canDeleteDocument,
  canDeleteTask,
  canEditTask,
  canExecuteTask,
  canTickTaskStep,
  canValidateTaskNow,
  createDocument,
  createTask,
  currentStep,
  directManagerUser,
  decideDocument,
  documentType,
  historyEntry,
  intervenant,
  submitDocument,
  taskRoleOf,
  waitingFor,
} from './lib/workflow';
import type { DocumentAction, TaskAction } from './lib/workflow';
import type { 
  LogisticsHub, 
  HubStockItem, 
  StockMovementItem,
  EntityInvitation,
  EntityInvitationNotification
} from './types';
import { 
  initialEntityInvitations, 
  initialInvitationNotifications 
} from './data/initialInvitationData';
import { isEntityManager } from './utils/invitationUtils';
import { InviteAgentModal } from './components/invitations/InviteAgentModal';
import { ConnectViaKeyModal } from './components/invitations/ConnectViaKeyModal';
import { EntityInvitationsManagerModal } from './components/invitations/EntityInvitationsManagerModal';
import { NotificationsDrawerModal } from './components/invitations/NotificationsDrawerModal';
import { ActiveGuestSessionBanner } from './components/invitations/ActiveGuestSessionBanner';
import { 
  createStandardPayrollSystem, 
  initialPayrollConfigs 
} from './data/standardPayroll';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { EmployeeWorkspaceView } from './components/EmployeeWorkspaceView';
import { OrganizationOnboardingWizard } from './components/OrganizationOnboardingWizard';
import { RegulationGuideModal } from './components/RegulationGuideModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { ActiveTab } from './components/Sidebar';
import { canUserAccessTab } from './utils/rbac';
import { OrganizationIdentityModal } from './components/OrganizationIdentityModal';
import {
  ShieldAlert
} from 'lucide-react';

// Modules chargés à la demande : la page de connexion s'affiche plus vite.
const HierarchyView = lazy(() => import('./components/HierarchyView').then(m => ({ default: m.HierarchyView })));
const DocumentsView = lazy(() => import('./components/DocumentsView').then(m => ({ default: m.DocumentsView })));
const WorkflowsView = lazy(() => import('./components/WorkflowsView').then(m => ({ default: m.WorkflowsView })));
const SecurityView = lazy(() => import('./components/SecurityView').then(m => ({ default: m.SecurityView })));
const AgentCrudView = lazy(() => import('./components/AgentCrudView').then(m => ({ default: m.AgentCrudView })));
const AuditView = lazy(() => import('./components/AuditView').then(m => ({ default: m.AuditView })));
const BulkImportView = lazy(() => import('./components/BulkImportView').then(m => ({ default: m.BulkImportView })));
const LogisticsModuleView = lazy(() => import('./components/LogisticsModuleView').then(m => ({ default: m.LogisticsModuleView })));
const LaravelIntegrationView = lazy(() => import('./components/LaravelIntegrationView').then(m => ({ default: m.LaravelIntegrationView })));
const EntityInvitationsView = lazy(() => import('./components/EntityInvitationsView').then(m => ({ default: m.EntityInvitationsView })));

interface AppProps {
  /** Mode serveur : utilisateur déjà authentifié par le serveur (voir ServerGate). */
  serverUser?: User;
  /** Mode serveur : fermeture de session (déconnexion ou expiration). */
  onServerLogout?: (notice: string | null) => void;
}

export default function App({ serverUser, onServerLogout }: AppProps = {}) {
  const [organizations, setOrganizations] = usePersistentState<Organization[]>('organizations', initialOrganizations);
  const [currentOrg, setCurrentOrg] = usePersistentState<Organization>('currentOrg', initialOrganizations[0], { keepDefaultInApi: true });
  const [entities, setEntities] = usePersistentState<HierarchicalEntity[]>('entities', initialEntities);
  const [users, setUsers] = usePersistentState<User[]>('users', initialUsers);
  const [contracts, setContracts] = usePersistentState<EmployeeContract[]>('contracts', initialContracts);
  const [documents, setDocuments] = usePersistentState<DocumentItem[]>('documents', initialDocuments);
  const [tasks, setTasks] = usePersistentState<TaskItem[]>('tasks', initialTasks);
  
  const [alerts, setAlerts] = usePersistentState<SecurityAlert[]>('securityAlerts', initialSecurityAlerts);
  const [logs, setLogs] = usePersistentState<AuditLog[]>('auditLogs', initialAuditLogs);

  // =========================================================================
  // AUTHENTIFICATION & SESSION
  // =========================================================================
  // La session (onglet en cours) survit au rechargement de la page, mais expire
  // après 30 min d'inactivité ou 10 h au total (voir src/lib/auth.ts).
  const [restoredSession] = useState(() => {
    if (API_MODE) {
      // Mode serveur : la session a déjà été vérifiée par le serveur.
      return serverUser ? { user: users.find(u => u.id === serverUser.id) ?? serverUser } : null;
    }
    const session = loadSession();
    const user = session ? users.find(u => u.id === session.userId) : undefined;
    if (!session || !user || user.status === 'verrouille' || user.status === 'suspendu') {
      clearSession();
      return null;
    }
    return { session, user };
  });
  const [currentUser, setCurrentUser] = useState<User>(() => restoredSession?.user ?? users[0] ?? initialUsers[0]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => restoredSession !== null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState<boolean>(false);
  const [onboardingSuccessMsg, setOnboardingSuccessMsg] = useState<string | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);

  // Notifications (succès, erreurs)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  const showToast = useCallback((type: ToastType, message: string, duration = 6000) => {
    setToasts(prev => [...prev.slice(-3), { id: newId('toast'), type, message, duration }]);
  }, []);

  // Erreurs d'enregistrement (stockage plein…) remontées par src/lib/storage.ts
  useEffect(() => {
    let lastShown = 0;
    const onStorageError = (e: Event) => {
      if (Date.now() - lastShown < 10_000) return; // évite d'empiler le même message
      lastShown = Date.now();
      showToast('error', (e as CustomEvent<string>).detail, 0);
    };
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError);
  }, [showToast]);

  /** Ajoute une entrée au journal d'audit. */
  const addAuditLog = (entry: {
    action: string;
    category: AuditLog['category'];
    details: string;
    actor?: Pick<User, 'id' | 'name' | 'roleTitle'>;
  }) => {
    const actor = entry.actor ?? currentUser;
    setLogs(prev => {
      const base = {
        id: newId('log'),
        timestamp: nowStamp(),
        userId: actor.id,
        userName: actor.name,
        userRole: actor.roleTitle,
        action: entry.action,
        category: entry.category,
        details: entry.details,
        // En mode serveur, l'adresse IP, l'horodatage et la chaîne sont recalculés par le serveur.
        ip: API_MODE ? '' : 'Poste local',
        prevHash: prev[0]?.hash || AUDIT_GENESIS,
      };
      const log: AuditLog = { ...base, hash: auditChainHash(base.prevHash, base) };
      // On conserve les 2 000 entrées les plus récentes pour ne pas saturer le stockage du navigateur.
      return [log, ...prev.slice(0, 1999)];
    });
  };

  // Conversion unique des mots de passe en clair (données de démonstration) en empreintes chiffrées.
  useEffect(() => {
    if (API_MODE) return; // en mode serveur, les mots de passe sont gérés par le serveur
    let cancelled = false;
    migratePlaintextPasswords(users, !DEMO_MODE)
      .then(migrated => {
        if (!migrated || cancelled) return;
        // On ne remplace que les comptes encore en clair, pour ne rien écraser entre-temps.
        const byId = new Map(migrated.map(u => [u.id, u]));
        setUsers(prev => prev.map(u => (u.password && !u.passwordHash ? byId.get(u.id) ?? u : u)));
      })
      .catch(err => console.warn('[auth] Migration des mots de passe impossible :', err));
    return () => { cancelled = true; };
  }, [users, setUsers]);

  // Garde l'utilisateur connecté synchronisé avec l'annuaire (rôle modifié, compte verrouillé…).
  useEffect(() => {
    if (!isAuthenticated) return;
    const fresh = users.find(u => u.id === currentUser.id);
    if (!fresh) {
      endSession("Votre compte n'existe plus dans l'annuaire. Session fermée.");
    } else if (fresh.status === 'verrouille' || fresh.status === 'suspendu') {
      endSession('Votre compte a été verrouillé. Contactez la Direction Générale.');
    } else if (fresh !== currentUser) {
      setCurrentUser(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, isAuthenticated]);

  // Mode serveur : session expirée côté serveur, et messages de synchronisation.
  useEffect(() => {
    if (!API_MODE) return;
    const onExpired = () => endSession('Votre session a expiré. Reconnectez-vous.');
    const onNotice = (e: Event) => {
      const { type, message } = (e as CustomEvent<{ type: ToastType; message: string }>).detail;
      showToast(type, message);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener(SYNC_NOTICE_EVENT, onNotice);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(SYNC_NOTICE_EVENT, onNotice);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Déconnexion automatique après inactivité (mode local ; en mode serveur, c'est le serveur qui l'applique).
  useEffect(() => {
    if (!isAuthenticated || API_MODE) return;
    let lastTouch = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouch > 15_000) { // au plus une écriture toutes les 15 s
        lastTouch = now;
        touchSession();
      }
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
    const check = window.setInterval(() => {
      if (!loadSession()) {
        endSession('Votre session a expiré après une période d\'inactivité. Reconnectez-vous.');
      }
    }, 30_000);
    return () => {
      events.forEach(ev => window.removeEventListener(ev, onActivity));
      window.clearInterval(check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser.id]);

  const handleLogin = (user: User, method: 'credentials' | 'demo') => {
    const lastLogin = nowStamp();
    const loggedIn: User = { ...user, failedAccessAttempts: 0, lastLogin };
    // Mise à jour ciblée : on ne réécrit pas les autres champs (empreinte du mot de passe…).
    setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, failedAccessAttempts: 0, lastLogin, lockedUntil: undefined } : u)));
    setCurrentUser(loggedIn);
    setIsAuthenticated(true);
    setOnboardingSuccessMsg(null);
    setSessionNotice(null);
    const now = Date.now();
    saveSession({ userId: user.id, orgId: currentOrg.id, startedAt: now, lastActivityAt: now });

    addAuditLog({
      actor: user,
      action: method === 'demo' ? 'Connexion Démo Rapide (1 clic)' : 'Connexion Certifiée (Identifiants)',
      category: 'auth',
      details: `Authentification réussie pour ${user.name} (${user.role.toUpperCase()}).`,
    });
  };

  /** Ferme la session (déconnexion volontaire ou automatique). */
  const endSession = (notice: string | null) => {
    if (API_MODE) {
      // Le serveur journalise lui-même les connexions et déconnexions.
      onServerLogout?.(notice);
      return;
    }
    const departingUser = currentUser;
    clearSession();
    setIsAuthenticated(false);
    setActiveGuestInvitation(null);
    setSessionNotice(notice);
    addAuditLog({
      actor: departingUser,
      action: notice ? 'Clôture Automatique de Session' : 'Clôture de Session (Déconnexion)',
      category: 'auth',
      details: notice
        ? `Session de ${departingUser.name} fermée automatiquement : ${notice}`
        : `Session de ${departingUser.name} fermée avec succès.`,
    });
  };

  const handleLogout = () => endSession(null);

  /** Mot de passe erroné : compteur + verrouillage au-delà du seuil + alerte sécurité. */
  const handleFailedLogin = (user: User) => {
    const attempts = (user.failedAccessAttempts || 0) + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS;
    // Compte DG : blocage temporaire de 15 min (sinon n'importe qui pourrait bloquer la Direction).
    const temporary = lock && user.role === 'dg';
    setUsers(prev => prev.map(u => {
      if (u.id !== user.id) return u;
      if (temporary) return { ...u, failedAccessAttempts: 0, lockedUntil: Date.now() + TEMP_LOCK_MS };
      return { ...u, failedAccessAttempts: attempts, status: lock ? 'verrouille' : u.status };
    }));
    addAuditLog({
      actor: user,
      action: lock ? (temporary ? 'BLOCAGE TEMPORAIRE COMPTE DG (15 MIN)' : 'VERROUILLAGE COMPTE (MOTS DE PASSE ERRONÉS)') : 'Échec de Connexion',
      category: 'security',
      details: `Mot de passe erroné pour ${user.name} (tentative ${attempts}/${MAX_FAILED_ATTEMPTS}).${lock ? (temporary ? ' Blocage de 15 minutes.' : ' Compte verrouillé.') : ''}`,
    });
    if (lock) {
      setAlerts(prev => [
        {
          id: newId('sec'),
          timestamp: nowStamp(),
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          userEntityName: user.departmentName || user.roleTitle,
          targetEntityId: 'auth',
          targetEntityName: 'Écran de connexion',
          attemptCount: attempts,
          status: temporary ? 'alerte_emise' : 'compte_verrouille',
          severity: 'critique',
          ipAddress: 'Poste local',
          reason: temporary
            ? `${attempts} mots de passe erronés sur le compte DG : blocage temporaire de 15 minutes.`
            : `${attempts} mots de passe erronés consécutifs : compte verrouillé automatiquement.`,
        },
        ...prev
      ]);
    }
  };

  const handlePasswordChanged = (userId: string, passwordHash: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const { password: _legacy, ...rest } = u;
      return { ...rest, passwordHash, mustChangePassword: false };
    }));
    const user = users.find(u => u.id === userId);
    if (user) {
      addAuditLog({
        actor: user,
        action: 'Changement de Mot de Passe',
        category: 'security',
        details: `${user.name} a défini un nouveau mot de passe personnel.`,
      });
    }
  };

  /** Mode démo : bascule d'utilisateur pour tester les droits (journalisé). */
  const handleDemoSwitchUser = (user: User) => {
    if (!DEMO_MODE || user.id === currentUser.id) return;
    if (user.status === 'verrouille' || user.status === 'suspendu') {
      showToast('error', `Le compte de ${user.name} est verrouillé.`);
      return;
    }
    const now = Date.now();
    saveSession({ userId: user.id, orgId: currentOrg.id, startedAt: now, lastActivityAt: now });
    setCurrentUser(user);
    addAuditLog({
      actor: user,
      action: 'Bascule Utilisateur (Mode Démo)',
      category: 'auth',
      details: `Session basculée de ${currentUser.name} vers ${user.name} en mode démonstration.`,
    });
  };

  // RÈGLE STRICTE PREMIÈRE UTILISATION : INITIALISATION DE L'ORGANISATION & CONNECTIVITÉ OBLIGATOIRE DES AGENTS VIA LOGIN
  const handleCompleteOnboarding = (data: {
    organization: Organization;
    entities: HierarchicalEntity[];
    users: User[];
  }) => {
    // L'assistant remplace l'annuaire et l'organigramme actuels : on demande confirmation.
    if (
      users.length > 0 &&
      !window.confirm(
        `Créer « ${data.organization.name} » remplacera l'annuaire actuel (${users.length} comptes) et l'organigramme.\n\n` +
        'Conseil : exportez d\'abord une sauvegarde (menu utilisateur → Sauvegarde des données).\n\nContinuer ?'
      )
    ) {
      return;
    }
    setOrganizations(prev => [data.organization, ...prev.filter(o => o.id !== data.organization.id)]);
    setCurrentOrg(data.organization);
    setEntities(data.entities);
    setUsers(data.users);
    
    // Création de la configuration de paie standard pour la nouvelle organisation
    setPayrollConfigs(prev => ({
      ...prev,
      [data.organization.id]: createStandardPayrollSystem(data.organization.id, data.organization.name)
    }));

    // Oblige une connectivité de tous les agents de cette organisation à pouvoir se connecter via un login
    clearSession();
    setIsAuthenticated(false);
    setShowOnboardingWizard(false);
    setOnboardingSuccessMsg(
      `L'organisation "${data.organization.name}" a été initialisée avec succès ! Tous les agents (${data.users.length}) et la Direction Générale doivent désormais se connecter via leur LOGIN sécurisé.`
    );

    addAuditLog({
      actor: { id: 'system', name: data.organization.managerName || 'Direction Générale', roleTitle: 'Directeur Général (DG)' },
      action: 'Initialisation Organisation (Première Utilisation)',
      category: 'admin',
      details: `Déploiement complet de l'organisation "${data.organization.name}" (${data.organization.registrationNumber || 'RDC'}), ${data.entities.length} entités hiérarchiques et ${data.users.length} collaborateurs pré-enrôlés pour connexion obligatoire.`,
    });
  };

  // RÈGLE STRICTE 6 : GESTION DE LA DÉLÉGATION DE VISA DE DOCUMENTS POUR LES AGENTS
  const handleToggleDelegation = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const nextVal = !target.canApproveServiceDocuments;

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, canApproveServiceDocuments: nextVal } : u));

    addAuditLog({
      action: nextVal ? 'Octroi Délégation Visa Service (Règle 6)' : 'Révocation Délégation Visa Service (Règle 6)',
      category: 'security',
      details: nextVal 
        ? `Délégation d'approbation et visa de documents accordée à l'agent ${target.name} pour les dossiers de son service.`
        : `Délégation d'approbation révoquée pour l'agent ${target.name}. Statut repassé en exécution exclusive.`,
    });
  };

  // MASSIFICATION DES COLLABORATEURS & CONTRATS RH VIA CSV
  const handleImportUsersAndContracts = (newUsers: User[], newContracts: EmployeeContract[], auditNote: string) => {
    setUsers(prev => [...newUsers, ...prev]);
    setContracts(prev => [...newContracts, ...prev]);
    addAuditLog({
      action: 'Massification CSV Employés & Contrats RH',
      category: 'admin',
      details: auditNote,
    });
  };

  // MASSIFICATION DES HISTORIQUES DE PAIE & ARCHIVES VIA CSV
  const handleImportPayrollHistory = (newRun: PayrollRunPeriod, newPayslipDocs: DocumentItem[], auditNote: string) => {
    setDocuments(prev => [...newPayslipDocs, ...prev]);
    addAuditLog({
      action: 'Massification CSV Historique Paie',
      category: 'admin',
      details: auditNote,
    });
  };

  // État des configurations de Paie & RH RDC par organisation
  const [payrollConfigs, setPayrollConfigs] = usePersistentState<Record<string, PayrollSystemConfig>>('payrollConfigs', 
    initialPayrollConfigs || {
      'org-1': createStandardPayrollSystem('org-1', 'RHEMA BUSINESS')
    }
  );

  // =========================================================================
  // MODULE LOGISTIQUE : ÉQUIPEMENTS VSAT ET ÉNERGIE SOLAIRE (RDC)
  // =========================================================================
  const [logisticsCatalog, setLogisticsCatalog] = usePersistentState<LogisticsItem[]>('logistics.catalog', initialLogisticsCatalog);
  const [purchaseOrders, setPurchaseOrders] = usePersistentState<PurchaseOrderItem[]>('logistics.purchaseOrders', initialPurchaseOrders);
  const [deliveryNotes, setDeliveryNotes] = usePersistentState<DeliveryNoteItem[]>('logistics.deliveryNotes', initialDeliveryNotes);
  const [shipments, setShipments] = usePersistentState<ShipmentTracking[]>('logistics.shipments', initialShipments);
  const [proformas, setProformas] = usePersistentState<ProformaInvoiceItem[]>('logistics.proformas', initialProformas);
  const [netInvoices, setNetInvoices] = usePersistentState<NetToPayInvoiceItem[]>('logistics.netInvoices', initialNetToPayInvoices);

  // GESTION DES 6 HUBS PROVINCIAUX & STOCKS DÉCENTRALISÉS
  const [hubs, setHubs] = usePersistentState<LogisticsHub[]>('logistics.hubs', initialHubs);
  const [stocks, setStocks] = usePersistentState<HubStockItem[]>('logistics.stocks', initialHubStocks);
  const [stockMovements, setStockMovements] = usePersistentState<StockMovementItem[]>('logistics.stockMovements', initialStockMovements);

  const handleAddHub = (newHub: LogisticsHub) => {
    setHubs(prev => [newHub, ...prev]);
    addAuditLog({
      action: 'Création Hub Provincial',
      category: 'admin',
      details: `Raccordement du Hub ${newHub.name} (${newHub.province}) au réseau logistique national.`,
    });
  };

  // =========================================================================
  // CIRCUIT DE VALIDATION : actions sur les documents (shared/workflow.mjs)
  // =========================================================================
  const nowShort = () => `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString('fr-FR').slice(0, 5)}`;

  /** Applique une action du circuit à un document et déclenche les suites (logistique, tâches). */
  const applyDocumentAction = (docId: string, action: DocumentAction): DocumentItem | null => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) {
      showToast('error', 'Document introuvable.');
      return null;
    }
    try {
      let next: DocumentItem = doc;
      let message = '';
      let auditAction = '';
      switch (action.type) {
        case 'submit':
        case 'resubmit': {
          if (doc.authorId !== currentUser.id && currentUser.role !== 'dg') throw new Error("Seul l'émetteur peut soumettre ce document.");
          if (action.type === 'submit' && doc.status !== 'brouillon') throw new Error('Ce document est déjà dans le circuit.');
          if (action.type === 'resubmit' && doc.status !== 'rejete') throw new Error("Seul un document rejeté peut être corrigé et renvoyé.");
          const merged: DocumentItem = { ...doc, ...(action.type === 'resubmit' ? action.updates : {}) };
          const author = users.find(u => u.id === doc.authorId) || currentUser;
          next = submitDocument(merged, buildDocumentChain(merged, author, entities, users), currentUser);
          message = `Document transmis : en attente de ${waitingFor(currentStep(next.workflow))}.`;
          auditAction = action.type === 'submit' ? 'Soumission au circuit de validation' : 'Document corrigé et renvoyé';
          break;
        }
        case 'approve': {
          let working = doc;
          if (!working.workflow) {
            // Ancien document sans circuit : validation unique par un responsable habilité.
            const legacy = canUserApproveDocument(currentUser, doc, entities);
            if (!legacy.allowed) throw new Error(legacy.reason || "Vous n'êtes pas habilité à valider ce document.");
            working = {
              ...doc,
              workflow: {
                cycle: 1,
                submittedAt: new Date().toISOString(),
                steps: [{
                  id: newId('etp'), kind: 'signature', approverRole: currentUser.role, approverUserId: currentUser.id,
                  expectedHolderName: currentUser.name, label: `Validation — ${currentUser.name}`, status: 'en_attente',
                }],
                history: [],
              },
            };
          }
          const step = currentStep(working.workflow);
          const sig = action.signature;
          const hash = sig?.certificateHash || contentHashSync({ doc: { ...working, workflow: undefined }, step: step?.id, signer: currentUser.id, at: new Date().toISOString() });
          next = decideDocument(working, currentUser, {
            decision: 'approve',
            comment: action.comment,
            signatureHash: hash,
            signature: step?.kind === 'signature'
              ? (sig
                ? { signedBy: sig.signedBy, signedAt: sig.signedAt, role: sig.role, certificateHash: sig.certificateHash, signatureImage: sig.signatureImage, signatureType: sig.signatureType, legalConsent: sig.legalConsent, verificationAudit: sig.verificationAudit }
                : { signedBy: currentUser.name, signedAt: new Date().toISOString(), role: currentUser.roleTitle, certificateHash: hash })
              : undefined,
          });
          const nextStep = currentStep(next.workflow);
          message = nextStep
            ? `${step?.kind === 'signature' ? 'Signé' : 'Visé'} : le document passe à ${waitingFor(nextStep)}.`
            : `Circuit terminé : document ${next.status === 'signe' ? 'signé' : 'approuvé'}.`;
          auditAction = step?.kind === 'signature' ? 'Signature Électronique' : 'Visa Document';
          break;
        }
        case 'reject': {
          next = decideDocument(doc, currentUser, { decision: 'reject', comment: action.comment });
          message = "Document rejeté : l'émetteur est invité à le corriger.";
          auditAction = 'Rejet Document';
          break;
        }
        case 'delete': {
          if (!canDeleteDocument(currentUser, doc)) throw new Error('Seul un brouillon peut être supprimé, par son émetteur.');
          setDocuments(prev => prev.filter(d => d.id !== docId));
          addAuditLog({ action: 'Suppression Brouillon', category: 'document', details: `Brouillon ${doc.referenceNumber} (${doc.title}) supprimé.` });
          showToast('info', 'Brouillon supprimé.');
          return null;
        }
      }
      setDocuments(prev => prev.map(d => (d.id === docId ? next : d)));
      addAuditLog({
        action: auditAction,
        category: auditAction.startsWith('Signature') ? 'security' : 'document',
        details: `${doc.referenceNumber} — ${doc.title}${action.type === 'reject' ? ` — motif : ${action.comment}` : ''}${'comment' in action && action.type === 'approve' && action.comment ? ` — ${action.comment}` : ''}`,
      });
      showToast('success', message);
      return next;
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : String(e));
      return null;
    }
  };

  /** Publication d'un nouveau document (déjà construit avec son circuit par l'écran). */
  const handleCreateDocument = (doc: DocumentItem) => {
    setDocuments(prev => [doc, ...prev]);
    addAuditLog({
      action: doc.status === 'brouillon' ? 'Brouillon Document' : 'Publication Document',
      category: 'document',
      details: `${doc.referenceNumber} — ${doc.title} (${documentType(doc.subtype).label})`,
    });
    showToast('success', doc.status === 'brouillon'
      ? 'Brouillon enregistré : il reste privé tant que vous ne le soumettez pas.'
      : `Document publié : en attente de ${waitingFor(currentStep(doc.workflow))}.`);
  };

  // =========================================================================
  // TÂCHES : actions (exécution, validation en chaîne)
  // =========================================================================
  const handleCreateTask = (task: TaskItem) => {
    setTasks(prev => [task, ...prev]);
    addAuditLog({
      action: 'Création Tâche',
      category: 'task',
      details: `${task.reference || task.id} — ${task.title} (${task.assignedIntervenants.map(i => `${i.userName} : ${i.roleType}`).join(', ')})`,
    });
  };

  const applyTaskAction = (taskId: string, action: TaskAction) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const stamp = new Date().toISOString();
    const withHistory = (t: TaskItem, label: string, kind: string, comment?: string): TaskItem => ({
      ...t,
      updatedAt: stamp,
      history: [...(t.history || []), historyEntry(currentUser, kind, label, comment)],
    });
    try {
      let next: TaskItem = task;
      let message = '';
      const editor = canEditTask(currentUser, task, entities);
      const executor = canExecuteTask(currentUser, task);
      switch (action.type) {
        case 'start':
          if (!executor && !editor) throw new Error("Cette tâche ne vous est pas assignée.");
          next = withHistory({ ...task, status: 'en_cours', startDate: task.startDate || stamp.split('T')[0] }, 'Tâche démarrée', 'demarrage');
          message = 'Tâche démarrée.';
          break;
        case 'toggle_step': {
          const step = task.steps.find(s => s.id === action.stepId);
          if (!step || !canTickTaskStep(currentUser, task, step)) throw new Error("Cette étape ne vous est pas attribuée.");
          const steps = task.steps.map(s => (s.id !== action.stepId ? s : {
            ...s,
            completed: !s.completed,
            completedBy: !s.completed ? currentUser.name : undefined,
            completedAt: !s.completed ? stamp : undefined,
          }));
          next = withHistory({ ...task, steps, status: task.status === 'a_faire' ? 'en_cours' : task.status },
            `${step.completed ? 'Étape rouverte' : 'Étape terminée'} : ${step.label}`, 'etape');
          break;
        }
        case 'log_hours':
          if (!executor && !editor) throw new Error("Seuls les intervenants saisissent du temps.");
          if (!(action.hours > 0 && action.hours <= 24)) throw new Error('Indiquez une durée entre 0,25 et 24 heures.');
          next = withHistory({ ...task, spentHours: Math.round(((task.spentHours || 0) + action.hours) * 100) / 100, status: task.status === 'a_faire' ? 'en_cours' : task.status },
            `${action.hours} h saisie(s)`, 'temps', action.note);
          message = 'Temps enregistré.';
          break;
        case 'comment':
          if (!action.text.trim()) return;
          next = {
            ...task,
            updatedAt: stamp,
            comments: [...(task.comments || []), { id: newId('com'), authorId: currentUser.id, authorName: currentUser.name, at: stamp, text: action.text.trim() }],
          };
          break;
        case 'submit': {
          if (!executor && !editor) throw new Error("Seuls les intervenants peuvent soumettre la tâche.");
          if (task.steps.some(s => !s.completed)) throw new Error('Terminez toutes les étapes avant de soumettre la tâche à validation.');
          const steps = buildTaskApprovalChain(task, entities, users);
          next = withHistory({
            ...task,
            status: 'en_attente_approbation',
            approval: { cycle: (task.approval?.cycle || 0) + 1, steps },
          }, 'Soumise à validation', 'soumission', action.comment);
          message = `Tâche soumise : en attente de ${waitingFor(steps[0])}.`;
          break;
        }
        case 'approve':
        case 'reject': {
          if (!canValidateTaskNow(currentUser, task)) throw new Error("Cette validation ne vous revient pas (ou pas encore).");
          const step = currentStep(task.approval);
          if (!step || !task.approval) throw new Error("Aucune validation en attente.");
          if (action.type === 'reject' && !action.comment.trim()) throw new Error('Le motif du renvoi est obligatoire.');
          const hash = step.kind === 'signature' && action.type === 'approve'
            ? contentHashSync({ task: { ...task, history: undefined, comments: undefined }, signer: currentUser.id, at: stamp })
            : undefined;
          const steps = task.approval.steps.map(s => (s.id !== step.id ? s : {
            ...s,
            status: action.type === 'approve' ? 'approuve' as const : 'rejete' as const,
            actorId: currentUser.id,
            actorName: currentUser.name,
            actorRole: currentUser.role,
            at: stamp,
            ...(action.comment ? { comment: action.comment.trim() } : {}),
            ...(hash ? { signatureHash: hash } : {}),
          }));
          if (action.type === 'reject') {
            next = withHistory({
              ...task,
              status: 'en_cours',
              approval: { ...task.approval, steps },
              lastRejection: { reason: action.comment.trim(), by: currentUser.name, at: stamp },
            }, `Renvoyée en correction par ${currentUser.name}`, 'rejet', action.comment);
            message = "Tâche renvoyée à l'exécutant.";
          } else {
            const done = steps.every(s => s.status === 'approuve');
            next = withHistory({
              ...task,
              approval: { ...task.approval, steps },
              ...(done ? {
                status: 'validee_terminee' as const,
                completedAt: stamp,
                ...(hash ? { signature: { signedBy: currentUser.name, role: currentUser.roleTitle, timestamp: stamp, hash } } : {}),
              } : {}),
            }, `${hash ? 'Signée' : 'Validée'} — ${step.label}`, 'validation', action.comment);
            const nxt = currentStep({ steps });
            message = done ? 'Tâche validée et clôturée.' : `Validé : en attente de ${waitingFor(nxt)}.`;
          }
          break;
        }
        case 'block':
          if (!executor && !editor) throw new Error("Seuls les intervenants peuvent signaler un blocage.");
          if (!action.reason.trim()) throw new Error('Précisez la cause du blocage.');
          next = withHistory({ ...task, status: 'bloquee', blockedReason: action.reason.trim() }, 'Tâche bloquée', 'blocage', action.reason);
          message = 'Blocage signalé à la hiérarchie.';
          break;
        case 'unblock':
          if (!executor && !editor) throw new Error("Action réservée aux intervenants.");
          next = withHistory({ ...task, status: 'en_cours', blockedReason: undefined }, 'Blocage levé', 'deblocage');
          break;
        case 'cancel':
          if (!editor) throw new Error("Seul le créateur ou la hiérarchie peut annuler la tâche.");
          next = withHistory({ ...task, status: 'annulee' }, 'Tâche annulée', 'annulation', action.reason);
          message = 'Tâche annulée.';
          break;
        case 'delete':
          if (!canDeleteTask(currentUser, task)) throw new Error('Seul le créateur peut supprimer la tâche.');
          setTasks(prev => prev.filter(t => t.id !== taskId));
          addAuditLog({ action: 'Suppression Tâche', category: 'task', details: `${task.reference || task.id} — ${task.title}` });
          return;
      }
      setTasks(prev => prev.map(t => (t.id === taskId ? next : t)));
      if (['submit', 'approve', 'reject', 'cancel', 'block'].includes(action.type)) {
        addAuditLog({
          action: { submit: 'Soumission Tâche', approve: 'Validation Tâche', reject: 'Renvoi Tâche', cancel: 'Annulation Tâche', block: 'Blocage Tâche' }[action.type as 'submit'] || 'Tâche',
          category: 'task',
          details: `${task.reference || task.id} — ${task.title}${'comment' in action && action.comment ? ` — ${action.comment}` : ''}${'reason' in action && action.reason ? ` — ${action.reason}` : ''}`,
        });
      }
      if (message) showToast('success', message);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : String(e));
    }
  };

  /** Demande de congé depuis l'espace employé : document « demande_conge » soumis au circuit. */
  const handleSubmitLeaveRequest = (req: { type: string; start: string; end: string; reason: string }) => {
    const doc = createDocument({
      title: `Demande de congé — ${req.type} du ${req.start} au ${req.end}`,
      subtype: 'demande_conge',
      description: `${req.type}. Période : du ${req.start} au ${req.end}.\nMotif : ${req.reason}`,
      author: currentUser,
      organizationId: currentOrg.id,
      entities,
      users,
      existingDocuments: documents,
      audience: 'perimetre',
      targetUserId: currentUser.id,
      targetUserName: currentUser.name,
      source: { module: 'espace_employe', kind: 'conge', refId: currentUser.id },
    });
    handleCreateDocument(doc);
  };

  // =========================================================================
  // LOGISTIQUE : chaque bon passe par le circuit, puis génère ses tâches
  // =========================================================================
  const logisticsTask = (input: {
    title: string;
    description: string;
    kind: string;
    refId: string;
    refNumber: string;
    executor: User;
    steps: string[];
    dueDate?: string;
    site?: string;
    linkedDocumentIds?: string[];
    priority?: TaskItem['priority'];
  }): TaskItem => {
    const entity = anchorEntity(input.executor, entities);
    // Exécutant + son supérieur direct comme responsable (il suit et valide la tâche).
    const people = [intervenant(input.executor, 'executant', entities)];
    const supervisor = directManagerUser(input.executor, entities, users);
    if (supervisor) people.push(intervenant(supervisor, 'responsable', entities));
    return createTask({
      title: input.title,
      type: 'logistique',
      description: input.description,
      creator: currentUser,
      organizationId: currentOrg.id,
      entity,
      intervenants: people,
      steps: input.steps.map(label => ({ label, assignedTo: input.executor })),
      priority: input.priority || 'haute',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: input.dueDate || new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0],
      site: input.site,
      linkedDocumentIds: input.linkedDocumentIds,
      source: { module: 'logistique', kind: input.kind, refId: input.refId, refNumber: input.refNumber },
      existingTasks: tasks,
    });
  };

  /**
   * Fait avancer les tâches générées pour un objet logistique quand l'événement a lieu
   * (réception, signature du BL, jalon d'expédition, encaissement).
   * - tickLabel : coche l'étape correspondante ;
   * - closeLabel : coche toutes les étapes et SOUMET la tâche à validation (pas de clôture sans visa).
   * Seules les tâches que l'utilisateur peut exécuter ou piloter sont modifiées.
   */
  const advanceSourceTasks = (kind: string, refId: string, opts: { tickLabel?: string; closeLabel?: string }) => {
    const stamp = new Date().toISOString();
    setTasks(prev => prev.map(t => {
      if (t.source?.kind !== kind || t.source.refId !== refId || !['a_faire', 'en_cours', 'bloquee'].includes(t.status)) return t;
      if (!canExecuteTask(currentUser, t) && !canEditTask(currentUser, t, entities)) return t;
      if (opts.closeLabel) {
        const done: TaskItem = {
          ...t,
          steps: t.steps.map(s => (s.completed ? s : { ...s, completed: true, completedBy: currentUser.name, completedAt: stamp })),
        };
        return {
          ...done,
          status: 'en_attente_approbation',
          blockedReason: undefined,
          approval: { cycle: (t.approval?.cycle || 0) + 1, steps: buildTaskApprovalChain(done, entities, users) },
          updatedAt: stamp,
          history: [...(t.history || []), historyEntry(currentUser, 'soumission', `${opts.closeLabel} — tâche soumise à validation`)],
        };
      }
      const label = (opts.tickLabel || '').toLowerCase();
      return {
        ...t,
        status: t.status === 'a_faire' ? 'en_cours' : t.status,
        updatedAt: stamp,
        steps: t.steps.map(s => (s.completed || !s.label.toLowerCase().includes(label) ? s : { ...s, completed: true, completedBy: currentUser.name, completedAt: stamp })),
        history: [...(t.history || []), historyEntry(currentUser, 'etape', `Étape terminée : ${opts.tickLabel}`)],
      };
    }));
  };

  const findUser = (id?: string) => (id ? users.find(u => u.id === id) : undefined);

  /** Effet d'un mouvement validé sur les stocks des hubs. */
  const applyMovementToStock = (mvt: StockMovementItem) => {
    mvt.items.forEach(item => {
      if (mvt.type === 'entree_fournisseur' && mvt.destinationHubId) {
        setStocks(prev => {
          const existing = prev.find(s => s.hubId === mvt.destinationHubId && s.catalogItemId === item.catalogItemId);
          if (existing) {
            const newQty = existing.quantityAvailable + item.quantity;
            return prev.map(s => s.id === existing.id ? {
              ...s,
              quantityAvailable: newQty,
              totalValueUSD: newQty * s.unitPriceUSD,
              serialNumbers: [...s.serialNumbers, ...item.serialNumbers],
              status: newQty <= s.minAlertThreshold ? 'alerte_basse' : 'normal'
            } : s);
          }
          const newStock: HubStockItem = {
            id: newId('stk'),
            hubId: mvt.destinationHubId!,
            catalogItemId: item.catalogItemId,
            sku: item.sku,
            name: item.name,
            category: 'vsat',
            quantityAvailable: item.quantity,
            quantityReserved: 0,
            quantityInTransit: 0,
            minAlertThreshold: 2,
            unitPriceUSD: item.unitPriceUSD,
            totalValueUSD: item.quantity * item.unitPriceUSD,
            locationRack: 'Travée Réception',
            serialNumbers: item.serialNumbers,
            lastAuditDate: new Date().toISOString().split('T')[0],
            status: 'normal'
          };
          return [newStock, ...prev];
        });
      } else if ((mvt.type === 'sortie_deploiement' || mvt.type === 'transfert_inter_hub') && mvt.sourceHubId) {
        setStocks(prev => prev.map(s => {
          if (s.hubId === mvt.sourceHubId && s.catalogItemId === item.catalogItemId) {
            const newQty = Math.max(0, s.quantityAvailable - item.quantity);
            return {
              ...s,
              quantityAvailable: newQty,
              totalValueUSD: newQty * s.unitPriceUSD,
              serialNumbers: s.serialNumbers.filter(sn => !item.serialNumbers.includes(sn)),
              status: newQty === 0 ? 'rupture' : newQty <= s.minAlertThreshold ? 'alerte_basse' : 'normal'
            };
          }
          if (mvt.type === 'transfert_inter_hub' && s.hubId === mvt.destinationHubId && s.catalogItemId === item.catalogItemId) {
            return { ...s, quantityInTransit: s.quantityInTransit + item.quantity };
          }
          return s;
        }));
      }
    });
  };

  /** Mouvement entièrement validé : stock mis à jour, transfert mis en route avec sa tâche de réception. */
  const finalizeMovement = (mvt: StockMovementItem, approverName: string) => {
    const isTransfer = mvt.type === 'transfert_inter_hub';
    const validated: StockMovementItem = {
      ...mvt,
      status: isTransfer ? 'en_transit' : 'valide',
      approvedByManagerName: approverName,
      approvedAt: nowShort(),
    };
    setStockMovements(prev => prev.map(m => (m.id === mvt.id ? validated : m)));
    applyMovementToStock(validated);
    if (isTransfer) {
      const hub = hubs.find(h => h.id === mvt.destinationHubId);
      const receiver = findUser(hub?.managerId) || findUser(mvt.operatorId) || currentUser;
      setTasks(prev => [logisticsTask({
        title: `Réceptionner le transfert ${mvt.movementNumber} au ${mvt.destinationHubName || 'hub de destination'}`,
        description: `Transfert validé depuis ${mvt.sourceHubName || 'le hub source'}. Articles : ${mvt.items.map(i => `${i.quantity} × ${i.name}`).join(', ')}.`,
        kind: 'mouvement',
        refId: mvt.id,
        refNumber: mvt.movementNumber,
        executor: receiver,
        steps: ['Contrôler le colisage et les scellés à l\'arrivée', 'Scanner les numéros de série reçus', 'Confirmer la réception dans le module Hubs'],
        site: mvt.destinationHubName,
        linkedDocumentIds: [`doc-${mvt.id}`],
      }), ...prev]);
    }
  };

  /** Bon de commande validé : tâche d'exécution pour son émetteur. */
  const startOrderExecution = (order: PurchaseOrderItem, docId: string) => {
    const executor = findUser(order.createdByAgentId) || currentUser;
    setTasks(prev => [logisticsTask({
      title: `Exécuter le bon de commande ${order.orderNumber} — ${order.supplierName}`,
      description: `Bon de commande validé (${order.totalTTC_USD.toLocaleString('fr-FR')} USD TTC). Livraison attendue à ${order.destinationSite}.`,
      kind: 'bon_commande',
      refId: order.id,
      refNumber: order.orderNumber,
      executor,
      steps: ['Transmettre le bon de commande signé au fournisseur', 'Confirmer la date de livraison avec le fournisseur', 'Réceptionner et contrôler les numéros de série', "Établir le bon d'entrée en stock"],
      dueDate: order.deliveryDueDate,
      site: order.destinationSite,
      linkedDocumentIds: [docId],
    }), ...prev]);
  };

  /** Facture validée : tâche de suivi de l'encaissement pour son émetteur. */
  const startInvoiceFollowUp = (inv: NetToPayInvoiceItem, docId: string) => {
    const executor = findUser(inv.preparedByAgentId) || currentUser;
    setTasks(prev => [logisticsTask({
      title: `Suivre l'encaissement de la facture ${inv.invoiceNumber} — ${inv.clientName}`,
      description: `Facture signée : net à payer ${inv.netToPayUSD.toLocaleString('fr-FR')} USD, échéance ${inv.dueDate}.`,
      kind: 'facture',
      refId: inv.id,
      refNumber: inv.invoiceNumber,
      executor,
      steps: ['Transmettre la facture signée au client', "Relancer le client à l'échéance", 'Enregistrer le règlement reçu'],
      dueDate: inv.dueDate,
      linkedDocumentIds: [docId],
      priority: 'normale',
    }), ...prev]);
  };

  /** Crée le document d'un objet logistique et le soumet à son circuit. */
  const publishLogisticsDocument = (input: {
    id: string; title: string; subtype: DocumentItem['subtype']; referenceNumber: string; description: string;
    amount?: number; kind: string; refId: string; signatureHash?: string;
  }) => createDocument({
    id: input.id,
    title: input.title,
    subtype: input.subtype,
    description: input.description,
    author: currentUser,
    organizationId: currentOrg.id,
    entities,
    users,
    referenceNumber: input.referenceNumber,
    amount: input.amount,
    currency: 'USD',
    audience: 'perimetre',
    source: { module: 'logistique', kind: input.kind, refId: input.refId, refNumber: input.referenceNumber },
    autoSignIfAlone: true,
    signatureHash: input.signatureHash,
  });

  const logisticsCreatedToast = (doc: DocumentItem, what: string) => {
    const step = currentStep(doc.workflow);
    showToast(step ? 'info' : 'success', step
      ? `${what} créé et soumis : en attente de ${waitingFor(step)}.`
      : `${what} créé et validé.`);
  };

  const handleAddMovement = (mvt: StockMovementItem) => {
    const subtype: DocumentItem['subtype'] = mvt.type === 'entree_fournisseur' ? 'bon_entree_stock'
      : mvt.type === 'sortie_deploiement' ? 'bon_sortie_stock'
      : mvt.type === 'transfert_inter_hub' ? 'ordre_transfert' : 'bon_reception';
    const doc = publishLogisticsDocument({
      id: `doc-${mvt.id}`,
      title: `${documentType(subtype).label} : ${mvt.movementNumber}`,
      subtype,
      referenceNumber: mvt.movementNumber,
      description: `Opération logistique ${mvt.movementNumber}${mvt.sourceHubName ? ` — depuis ${mvt.sourceHubName}` : ''}${mvt.destinationHubName ? ` — vers ${mvt.destinationHubName}` : ''}${mvt.destinationClientSite ? ` — site ${mvt.destinationClientSite}` : ''}.\nArticles : ${mvt.items.map(i => `${i.quantity} × ${i.name} (S/N : ${i.serialNumbers.join(', ')})`).join(' ; ')}.${mvt.notes ? `\nNotes : ${mvt.notes}` : ''}`,
      amount: mvt.totalValueUSD,
      kind: 'mouvement',
      refId: mvt.id,
      signatureHash: mvt.electronicSealHash,
    });
    const validated = ['signe', 'approuve'].includes(doc.status);
    // Le stock ne bouge qu'une fois le bon validé.
    const stored: StockMovementItem = { ...mvt, status: 'en_attente_visa', approvedByManagerName: undefined, approvedAt: undefined };
    setStockMovements(prev => [stored, ...prev]);
    setDocuments(prev => [doc, ...prev]);
    if (validated) finalizeMovement(stored, currentUser.name);
    addAuditLog({
      action: `Mouvement de Stock (${mvt.type})`,
      category: 'document',
      details: `${mvt.movementNumber} — ${validated ? 'validé' : `soumis à ${waitingFor(currentStep(doc.workflow))}`} (${mvt.totalValueUSD.toLocaleString('fr-FR')} USD).`,
    });
    logisticsCreatedToast(doc, 'Bon de mouvement');
  };

  const handleApproveMovement = (mvtId: string) => {
    const doc = documents.find(d => d.id === `doc-${mvtId}`);
    if (doc?.workflow) {
      applyDocumentAction(doc.id, { type: 'approve' });
      return;
    }
    // Ancien mouvement sans circuit.
    if (!isLogisticsManager(currentUser)) {
      showToast('error', 'Le visa des mouvements est réservé aux responsables de la logistique.');
      return;
    }
    setStockMovements(prev => prev.map(m => m.id === mvtId ? {
      ...m,
      status: m.type === 'transfert_inter_hub' ? 'en_transit' : 'valide',
      approvedByManagerName: currentUser.name,
      approvedAt: nowShort()
    } : m));
  };

  const handleReceiveTransfer = (mvtId: string) => {
    const mvt = stockMovements.find(m => m.id === mvtId);
    if (!mvt || !mvt.destinationHubId) return;
    if (mvt.status !== 'en_transit') {
      showToast('error', "Ce transfert n'est pas encore validé : il ne peut pas être réceptionné.");
      return;
    }

    setStockMovements(prev => prev.map(m => m.id === mvtId ? {
      ...m,
      status: 'receptionne',
      notes: `${m.notes} — Réceptionné et scanné conforme par ${currentUser.name}.`
    } : m));

    mvt.items.forEach(item => {
      setStocks(prev => {
        const existing = prev.find(s => s.hubId === mvt.destinationHubId && s.catalogItemId === item.catalogItemId);
        if (existing) {
          const newAvail = existing.quantityAvailable + item.quantity;
          const newTransit = Math.max(0, existing.quantityInTransit - item.quantity);
          return prev.map(s => s.id === existing.id ? {
            ...s,
            quantityAvailable: newAvail,
            quantityInTransit: newTransit,
            totalValueUSD: newAvail * s.unitPriceUSD,
            serialNumbers: [...s.serialNumbers, ...item.serialNumbers],
            status: newAvail <= s.minAlertThreshold ? 'alerte_basse' : 'normal'
          } : s);
        }
        const newStock: HubStockItem = {
          id: newId('stk'),
          hubId: mvt.destinationHubId!,
          catalogItemId: item.catalogItemId,
          sku: item.sku,
          name: item.name,
          category: 'vsat',
          quantityAvailable: item.quantity,
          quantityReserved: 0,
          quantityInTransit: 0,
          minAlertThreshold: 2,
          unitPriceUSD: item.unitPriceUSD,
          totalValueUSD: item.quantity * item.unitPriceUSD,
          locationRack: 'Travée Réception',
          serialNumbers: item.serialNumbers,
          lastAuditDate: new Date().toISOString().split('T')[0],
          status: 'normal'
        };
        return [newStock, ...prev];
      });
    });
    advanceSourceTasks('mouvement', mvtId, { closeLabel: `Réception confirmée par ${currentUser.name}` });
    addAuditLog({ action: 'Réception Transfert Inter-Hubs', category: 'task', details: `${mvt.movementNumber} réceptionné au ${mvt.destinationHubName}.` });
  };

  const handleCreateOrder = (order: PurchaseOrderItem) => {
    const doc = publishLogisticsDocument({
      id: `doc-${order.id}`,
      title: `Bon de commande ${order.orderNumber} — ${order.supplierName}`,
      subtype: 'bon_commande_client',
      referenceNumber: order.orderNumber,
      description: `Commande ${order.category.toUpperCase()} pour ${order.destinationSite}, livraison attendue le ${order.deliveryDueDate}.\nArticles : ${order.items.map(i => `${i.quantity} × ${i.designation}`).join(' ; ')}.\nConditions : ${order.paymentTerms}.${order.notes ? `\nNotes : ${order.notes}` : ''}`,
      amount: order.totalTTC_USD,
      kind: 'bon_commande',
      refId: order.id,
    });
    const validated = ['signe', 'approuve'].includes(doc.status);
    const stored: PurchaseOrderItem = {
      ...order,
      status: validated ? 'approuve' : 'en_attente_approbation',
      approvedByManagerId: validated ? currentUser.id : undefined,
      approvedByManagerName: validated ? currentUser.name : undefined,
      approvedAt: validated ? nowShort() : undefined,
    };
    setPurchaseOrders(prev => [stored, ...prev]);
    setDocuments(prev => [doc, ...prev]);
    if (validated) startOrderExecution(stored, doc.id);
    addAuditLog({
      action: 'Émission Bon de Commande (BC)',
      category: 'document',
      details: `${order.orderNumber} (${order.totalTTC_USD.toLocaleString('fr-FR')} USD TTC) pour ${order.destinationSite}.`,
    });
    logisticsCreatedToast(doc, 'Bon de commande');
  };

  const handleApproveOrder = (orderId: string) => {
    const doc = documents.find(d => d.id === `doc-${orderId}`);
    if (doc?.workflow) {
      applyDocumentAction(doc.id, { type: 'approve' });
      return;
    }
    if (!isLogisticsManager(currentUser)) {
      showToast('error', 'Le visa des bons de commande est réservé aux responsables.');
      return;
    }
    setPurchaseOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      status: 'approuve',
      approvedByManagerId: currentUser.id,
      approvedByManagerName: currentUser.name,
      approvedAt: nowShort()
    } : o));
    addAuditLog({
      action: 'Approbation / Visa Bon de Commande',
      category: 'document',
      details: `Visa hiérarchique apposé sur le Bon de Commande #${orderId} par ${currentUser.name}.`,
    });
  };

  const handleCreateDeliveryNote = (bl: DeliveryNoteItem) => {
    const doc = publishLogisticsDocument({
      id: `doc-${bl.id}`,
      title: `Bon de livraison ${bl.deliveryNumber} — ${bl.transporterName}`,
      subtype: 'bon_livraison',
      referenceNumber: bl.deliveryNumber,
      description: `Livraison vers ${bl.destinationSite}${bl.purchaseOrderNumber ? ` (BC ${bl.purchaseOrderNumber})` : ''}.\nArticles : ${bl.items.map(i => `${i.deliveredQty}/${i.orderedQty} × ${i.designation} — ${i.condition}`).join(' ; ')}.`,
      kind: 'bon_livraison',
      refId: bl.id,
    });
    setDeliveryNotes(prev => [bl, ...prev]);
    setDocuments(prev => [doc, ...prev]);
    if (!bl.isRecipientSigned) {
      setTasks(prev => [logisticsTask({
        title: `Faire signer le bon de livraison ${bl.deliveryNumber} par le destinataire`,
        description: `Livraison vers ${bl.destinationSite} par ${bl.transporterName}. Destinataire : ${bl.recipientName || 'à préciser'}.`,
        kind: 'bon_livraison',
        refId: bl.id,
        refNumber: bl.deliveryNumber,
        executor: findUser(bl.preparedByAgentId) || currentUser,
        steps: ['Remettre le matériel et le bon de livraison au destinataire', 'Recueillir la signature du destinataire'],
        site: bl.destinationSite,
        linkedDocumentIds: [doc.id],
      }), ...prev]);
    }
    addAuditLog({
      action: 'Enregistrement Bon de Livraison (BL)',
      category: 'document',
      details: `${bl.deliveryNumber} (${bl.destinationSite}) — numéros de série pointés.`,
    });
    logisticsCreatedToast(doc, 'Bon de livraison');
  };

  const handleSignDeliveryNote = (blId: string, recipientName: string) => {
    setDeliveryNotes(prev => prev.map(bl => bl.id === blId ? {
      ...bl,
      isRecipientSigned: true,
      recipientName,
      recipientSignatureDate: new Date().toISOString().split('T')[0],
      status: 'livre_conforme'
    } : bl));
    advanceSourceTasks('bon_livraison', blId, { closeLabel: `Bon de livraison signé par ${recipientName}` });
  };

  const handleUpdateShipmentStep = (shipmentId: string, newStep: ShipmentWorkflowStep) => {
    setShipments(prev => prev.map(s => s.id === shipmentId ? {
      ...s,
      currentStatus: newStep.status,
      workflowSteps: [...s.workflowSteps, newStep]
    } : s));
    if (newStep.status === 'livre_sur_site') {
      advanceSourceTasks('expedition', shipmentId, { closeLabel: `Livré sur site (${newStep.location})` });
    } else {
      advanceSourceTasks('expedition', shipmentId, { tickLabel: SHIPMENT_STEP_LABELS[newStep.status] });
    }
    addAuditLog({
      action: 'Mise à Jour Jalon Fret Logistique',
      category: 'task',
      details: `Nouveau jalon pour l'expédition #${shipmentId} : ${newStep.label} (${newStep.location})`,
    });
  };

  const handleCreateShipment = (shipment: ShipmentTracking) => {
    setShipments(prev => [shipment, ...prev]);
    const executor = findUser(shipment.assignedAgentId) || currentUser;
    setTasks(prev => [logisticsTask({
      title: `Suivre l'expédition ${shipment.trackingNumber} jusqu'à ${shipment.destinationFinal}`,
      description: `${shipment.title} — fret ${shipment.freightType}, transporteur ${shipment.carrierName}. Livraison estimée le ${shipment.estimatedDeliveryDate}.`,
      kind: 'expedition',
      refId: shipment.id,
      refNumber: shipment.trackingNumber,
      executor,
      steps: Object.values(SHIPMENT_STEP_LABELS),
      dueDate: shipment.estimatedDeliveryDate,
      site: shipment.destinationFinal,
    }), ...prev]);
    addAuditLog({
      action: 'Création Expédition Fret',
      category: 'task',
      details: `Nouvelle expédition ${shipment.trackingNumber} (${shipment.freightType.toUpperCase()}) vers ${shipment.destinationFinal}, suivie par ${executor.name}.`,
    });
  };

  const handleCreateProforma = (proforma: ProformaInvoiceItem) => {
    const doc = publishLogisticsDocument({
      id: `doc-${proforma.id}`,
      title: `Facture proforma ${proforma.proformaNumber} — ${proforma.clientOrSupplierName}`,
      subtype: 'devis',
      referenceNumber: proforma.proformaNumber,
      description: `Proforma pour ${proforma.projectOrSite}, valable jusqu'au ${proforma.validityDate}. Délai : ${proforma.deliveryLeadTime}.`,
      amount: proforma.totalTTC_USD,
      kind: 'proforma',
      refId: proforma.id,
    });
    setProformas(prev => [proforma, ...prev]);
    setDocuments(prev => [doc, ...prev]);
    addAuditLog({
      action: 'Émission Facture Proforma',
      category: 'document',
      details: `${proforma.proformaNumber} (${proforma.totalTTC_USD.toLocaleString('fr-FR')} USD TTC) pour ${proforma.clientOrSupplierName}.`,
    });
    logisticsCreatedToast(doc, 'Proforma');
  };

  /** Facture : document « facture client » soumis au circuit (plus de signature automatique). */
  const publishInvoice = (invoice: NetToPayInvoiceItem) => {
    const doc = publishLogisticsDocument({
      id: `doc-${invoice.id}`,
      title: `Facture ${invoice.invoiceNumber} — ${invoice.clientName}`,
      subtype: 'facture_client',
      referenceNumber: invoice.invoiceNumber,
      description: `Facture net à payer pour ${invoice.clientName} : ${invoice.netToPayUSD.toLocaleString('fr-FR')} USD (≈ ${invoice.netToPayCDF.toLocaleString('fr-FR')} CDF), échéance ${invoice.dueDate}.`,
      amount: invoice.netToPayUSD,
      kind: 'facture',
      refId: invoice.id,
      signatureHash: invoice.electronicSealHash,
    });
    setDocuments(prev => [doc, ...prev]);
    if (['signe', 'approuve'].includes(doc.status)) startInvoiceFollowUp(invoice, doc.id);
    logisticsCreatedToast(doc, 'Facture');
  };

  const handleConvertProforma = (proformaId: string, target: 'order' | 'invoice') => {
    const pro = proformas.find(p => p.id === proformaId);
    if (!pro) return;

    if (target === 'invoice') {
      const newInvoice: NetToPayInvoiceItem = {
        id: newId('fac'),
        invoiceNumber: `FAC-2026-VSAT-${String(netInvoices.length + 1).padStart(3, '0')}`,
        proformaReference: pro.proformaNumber,
        organizationId: currentOrg.id,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0],
        clientName: pro.clientOrSupplierName,
        clientTaxId: 'RCCM: CD/KN/RCCM/20-B-001 | IdNat: 01-83-N44100 | NIF: A1100223Z',
        clientAddress: 'Kinshasa / Lubumbashi - RD CONGO',
        category: pro.category,
        items: pro.items.map(it => ({
          designation: it.designation,
          specs: it.specs,
          quantity: it.quantity,
          unitPriceUSD: it.unitPriceUSD,
          totalUSD: it.totalUSD
        })),
        subtotalHT_USD: pro.subtotalHT_USD,
        vatRate: pro.vatRate,
        vatAmount_USD: pro.vatAmount_USD,
        advancePaymentDeduction_USD: 0,
        withholdingTaxDeduction_USD: 0,
        otherDeductions_USD: 0,
        netToPayUSD: pro.totalTTC_USD,
        netToPayCDF: pro.totalTTC_USD * 2850,
        currencyRate: 2850,
        bankDetails: invoiceBankDetails(currentOrg),
        paymentStatus: 'en_attente',
        paidAmountUSD: 0,
        remainingBalanceUSD: pro.totalTTC_USD,
        paymentRecords: [],
        electronicSealHash: '',
        preparedByAgentId: currentUser.id,
        preparedByAgentName: currentUser.name,
        serviceName: currentUser.departmentName || 'Service Facturation',
        isOfficialDocumentEmitted: true
      };
      newInvoice.electronicSealHash = contentHashSync({ ...newInvoice, electronicSealHash: undefined });
      setNetInvoices(prev => [newInvoice, ...prev]);
      setProformas(prev => prev.map(p => p.id === proformaId ? { ...p, status: 'acceptee_convertie', convertedToInvoiceId: newInvoice.id } : p));
      publishInvoice(newInvoice);
    }

    addAuditLog({
      action: 'Conversion Facture Proforma',
      category: 'document',
      details: `Facture Proforma ${pro.proformaNumber} convertie en facture définitive Net à Payer.`,
    });
  };

  const handleCreateNetInvoice = (invoice: NetToPayInvoiceItem) => {
    setNetInvoices(prev => [invoice, ...prev]);
    publishInvoice(invoice);
    addAuditLog({
      action: 'Émission Facture Net à Payer',
      category: 'document',
      details: `Facture ${invoice.invoiceNumber} (${invoice.netToPayUSD.toLocaleString('fr-FR')} USD net) émise pour ${invoice.clientName}.`,
    });
  };

  const handleRegisterPayment = (invoiceId: string, amountUSD: number, ref: string, method: string) => {
    const inv = netInvoices.find(i => i.id === invoiceId);
    setNetInvoices(prev => prev.map(inv => {
      if (inv.id !== invoiceId) return inv;
      const newPaid = inv.paidAmountUSD + amountUSD;
      const newRemaining = Math.max(0, inv.netToPayUSD - newPaid);
      const newStatus = newRemaining === 0 ? 'payee_net' : 'partiellement_payee';
      return {
        ...inv,
        paidAmountUSD: newPaid,
        remainingBalanceUSD: newRemaining,
        paymentStatus: newStatus,
        paymentRecords: [
          ...inv.paymentRecords,
          {
            id: newId('pay'),
            date: new Date().toISOString().split('T')[0],
            amountUSD,
            amountCDF: amountUSD * inv.currencyRate,
            paymentMethod: method as any,
            reference: ref,
            registeredByAgent: currentUser.name
          }
        ]
      };
    }));
    if (inv && inv.paidAmountUSD + amountUSD >= inv.netToPayUSD) {
      advanceSourceTasks('facture', invoiceId, { closeLabel: `Facture soldée (réf. ${ref})` });
    }
    addAuditLog({
      action: 'Règlement Facture Net à Payer',
      category: 'document',
      details: `Encaissement de ${amountUSD.toLocaleString('fr-FR')} USD sur la facture ${inv?.invoiceNumber || invoiceId} (réf. ${ref}).`,
    });
  };

  /**
   * Le DOCUMENT fait foi : l'état des objets logistiques (bon de commande, mouvement de stock, facture)
   * est aligné sur le circuit de leur document. Exécuté par le personnel logistique (seul habilité à
   * modifier les données logistiques) : juste après son propre visa, ou à sa prochaine connexion si le
   * dernier visa a été donné par quelqu'un d'autre (Finance, DG…).
   */
  useEffect(() => {
    if (!canAccessLogistics(currentUser)) return;
    const docOf = (refId: string) => documents.find(d => d.id === `doc-${refId}` && d.workflow);
    const isDone = (d?: DocumentItem) => !!d && ['signe', 'approuve'].includes(d.status);
    const lastActor = (d: DocumentItem) => [...(d.workflow?.steps || [])].reverse().find(st => st.status === 'approuve')?.actorName || currentUser.name;
    const hasTask = (kind: string, refId: string) => tasks.some(t => t.source?.kind === kind && t.source.refId === refId);

    // Bons de commande
    const orderUpdates = new Map<string, Partial<PurchaseOrderItem>>();
    purchaseOrders.forEach(o => {
      const d = docOf(o.id);
      if (!d) return;
      if (o.status === 'en_attente_approbation' && isDone(d)) {
        orderUpdates.set(o.id, { status: 'approuve', approvedByManagerName: lastActor(d), approvedAt: nowShort(), signatureHash: d.electronicSignature?.certificateHash });
        if (!hasTask('bon_commande', o.id)) startOrderExecution(o, d.id);
      } else if (o.status === 'en_attente_approbation' && d.status === 'rejete') {
        orderUpdates.set(o.id, { status: 'brouillon', notes: `${o.notes ? `${o.notes} — ` : ''}Rejeté : ${d.workflow?.rejection?.reason || ''}` });
      } else if (o.status === 'brouillon' && d.status === 'en_revue') {
        orderUpdates.set(o.id, { status: 'en_attente_approbation' });
      }
    });
    if (orderUpdates.size) setPurchaseOrders(prev => prev.map(o => (orderUpdates.has(o.id) ? { ...o, ...orderUpdates.get(o.id) } : o)));

    // Mouvements de stock (le stock ne bouge qu'ici ou à la création d'un bon déjà validé)
    stockMovements.forEach(m => {
      const d = docOf(m.id);
      if (!d) return;
      if (m.status === 'en_attente_visa' && isDone(d)) finalizeMovement(m, lastActor(d));
      else if (m.status === 'en_attente_visa' && d.status === 'rejete') {
        setStockMovements(prev => prev.map(x => (x.id === m.id ? { ...x, status: 'rejete', notes: `${x.notes} — Rejeté : ${d.workflow?.rejection?.reason || ''}` } : x)));
      } else if (m.status === 'rejete' && d.status === 'en_revue') {
        setStockMovements(prev => prev.map(x => (x.id === m.id ? { ...x, status: 'en_attente_visa' } : x)));
      }
    });

    // Factures signées : tâche de suivi de l'encaissement
    netInvoices.forEach(inv => {
      const d = docOf(inv.id);
      if (isDone(d) && inv.paymentStatus !== 'payee_net' && !hasTask('facture', inv.id)) startInvoiceFollowUp(inv, d!.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, currentUser.id]);

  /** Ce qui attend l'utilisateur connecté : visas de documents, tâches à faire et à valider. */
  const pendingCounts = {
    documents: documents.filter(d => canActOnDocument(currentUser, d)).length,
    tasks: tasks.filter(t =>
      canValidateTaskNow(currentUser, t) ||
      (!!taskRoleOf(currentUser, t) && taskRoleOf(currentUser, t) !== 'validateur' && ['a_faire', 'en_cours', 'bloquee'].includes(t.status)),
    ).length,
  };

  // Accueil : à chaque connexion (ou changement d'utilisateur en démo), résumé de ce qui l'attend.
  useEffect(() => {
    if (!isAuthenticated) return;
    const toValidate = tasks.filter(t => canValidateTaskNow(currentUser, t)).length;
    const parts = [
      pendingCounts.documents ? `${pendingCounts.documents} document(s) à viser` : '',
      toValidate ? `${toValidate} tâche(s) à valider` : '',
      pendingCounts.tasks - toValidate > 0 ? `${pendingCounts.tasks - toValidate} tâche(s) en cours` : '',
    ].filter(Boolean);
    showToast('info', parts.length
      ? `Bonjour ${currentUser.name} : ${parts.join(', ')}.`
      : `Bonjour ${currentUser.name} : rien ne vous attend pour le moment.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id, isAuthenticated]);

  const [currentTab, setCurrentTab] = useState<ActiveTab>('workspace');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Changement d'utilisateur : retour à l'espace employé si l'onglet ouvert ne lui est pas autorisé.
  useEffect(() => {
    if (!canUserAccessTab(currentUser, currentTab)) setCurrentTab('workspace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id, currentUser.role]);

  // =========================================================================
  // GESTION DES INVITATIONS INTER-ENTITÉS & CLÉS 10 CHIFFRES
  // =========================================================================
  const [invitations, setInvitations] = usePersistentState<EntityInvitation[]>('invitations', initialEntityInvitations);
  const [invitationNotifications, setInvitationNotifications] = usePersistentState<EntityInvitationNotification[]>('invitationNotifications', initialInvitationNotifications);
  const [activeGuestInvitation, setActiveGuestInvitation] = useState<EntityInvitation | null>(null);

  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showConnectKeyModal, setShowConnectKeyModal] = useState<boolean>(false);
  const [showInvitationsManagerModal, setShowInvitationsManagerModal] = useState<boolean>(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);

  const handleSendInvitation = (invitation: EntityInvitation, notification: EntityInvitationNotification) => {
    setInvitations(prev => [invitation, ...prev]);
    setInvitationNotifications(prev => [notification, ...prev]);
    addAuditLog({
      action: 'Émission Invitation Inter-Entités',
      category: 'security',
      details: `Invitation ${invitation.invitationCode} émise pour ${invitation.invitedAgentName} (${invitation.invitedAgentMatricule}) avec clé 10 chiffres ${invitation.authKey10Digits}. Validité : ${invitation.validityDurationHours}h vers "${invitation.hostEntityName}".`,
    });
  };

  const handleConnectWithKey = (invitation: EntityInvitation) => {
    setActiveGuestInvitation(invitation);
    setInvitations(prev => prev.map(inv => inv.id === invitation.id ? { ...inv, status: 'en_session', connectedAt: new Date().toISOString() } : inv));
    addAuditLog({
      action: 'Connexion Inter-Entités par Clé Unique',
      category: 'auth',
      details: `Session invité activée pour ${currentUser.name} sur l'entité "${invitation.hostEntityName}" via clé 10 chiffres ${invitation.authKey10Digits}.`,
    });
  };

  const handleExitGuestSession = () => {
    if (activeGuestInvitation) {
      addAuditLog({
        action: 'Clôture Session Invité',
        category: 'auth',
        details: `L'agent ${currentUser.name} a quitté sa session invité sur l'entité "${activeGuestInvitation.hostEntityName}".`,
      });
      setInvitations(prev => prev.map(inv => inv.id === activeGuestInvitation.id ? { ...inv, status: 'terminee' } : inv));
      setActiveGuestInvitation(null);
    }
  };

  const handleRevokeInvitation = (invitationId: string) => {
    setInvitations(prev => prev.map(inv => inv.id === invitationId ? { ...inv, status: 'revoquee' } : inv));
    if (activeGuestInvitation?.id === invitationId) {
      setActiveGuestInvitation(null);
    }
  };

  const handleExtendInvitation = (invitationId: string, hoursToAdd: number) => {
    setInvitations(prev => prev.map(inv => {
      if (inv.id !== invitationId) return inv;
      const currentExpiry = new Date(inv.expiresAt).getTime();
      const newExpiry = new Date(currentExpiry + hoursToAdd * 3600 * 1000).toISOString();
      return {
        ...inv,
        expiresAt: newExpiry,
        validityDurationHours: inv.validityDurationHours + hoursToAdd,
        status: 'active'
      };
    }));
  };

  const handleMarkNotificationAsRead = (notifId: string) => {
    setInvitationNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
  };

  const handleMarkAllNotificationsAsRead = () => {
    setInvitationNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // Modales d'administration
  const [showOrgIdentityModal, setShowOrgIdentityModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Déclenchement d'un test de tentative d'intrusion
  /**
   * Exercice de sécurité : crée une alerte de TEST clairement identifiée.
   * Ne modifie JAMAIS un compte réel (aucun compteur d'échecs, aucun verrouillage).
   */
  const handleTriggerTestBreach = () => {
    if (currentUser.role !== 'dg') {
      showToast('error', 'Seule la Direction Générale peut lancer un exercice de sécurité.');
      return;
    }
    const testAlert: SecurityAlert = {
      id: newId('sec-test'),
      timestamp: nowStamp(),
      userId: 'exercice',
      userName: 'Exercice de sécurité (fictif)',
      userRole: 'agent',
      userEntityName: 'Aucun compte réel',
      targetEntityId: 'exercice',
      targetEntityName: 'Exercice — Département Administration & Finances',
      attemptCount: 1,
      status: 'alerte_emise',
      severity: 'haute',
      ipAddress: 'Exercice',
      reason: '[EXERCICE] Alerte de test déclenchée par la Direction Générale. Aucun compte n\'a été modifié.',
    };
    setAlerts(prev => [testAlert, ...prev]);
    addAuditLog({
      action: 'Exercice de Sécurité',
      category: 'security',
      details: 'Alerte de test créée pour vérifier le circuit d\'alerte. Aucun compte réel modifié.',
    });
    showToast('info', 'Alerte de test créée. Aucun compte réel n\'a été modifié.');
  };

  // Mise à jour de l'identité de l'entreprise
  const handleSaveOrgIdentity = (updated: Organization) => {
    if (currentUser.role !== 'dg') {
      showToast('error', "Seule la Direction Générale peut modifier l'identité de l'organisation.");
      return;
    }
    setCurrentOrg(updated);
    setOrganizations(prev => prev.map(o => o.id === updated.id ? updated : o));
    setShowOrgIdentityModal(false);
    showToast('success', 'Identité de l\'organisation enregistrée.');

    addAuditLog({
      action: 'Mise à jour Identité Entreprise',
      category: 'admin',
      details: `Modification de la dénomination et identifiants légaux de ${updated.name}`,
    });
  };

  // Affichage du système de Login sécurisé
  if (!isAuthenticated) {
    return (
      <>
        <LoginView
          organization={currentOrg}
          organizations={organizations}
          onSelectOrg={(org) => setCurrentOrg(org)}
          users={users}
          onLogin={handleLogin}
          onFailedAttempt={handleFailedLogin}
          onPasswordChanged={handlePasswordChanged}
          onOpenOnboarding={() => setShowOnboardingWizard(true)}
          onboardingSuccessMsg={onboardingSuccessMsg}
          sessionNotice={sessionNotice}
        />
        <OrganizationOnboardingWizard
          isOpen={showOnboardingWizard}
          onClose={() => setShowOnboardingWizard(false)}
          onCompleteOnboarding={handleCompleteOnboarding}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="app-fond min-h-screen text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar
        organizations={organizations}
        currentOrg={currentOrg}
        onSelectOrg={(org) => {
          setCurrentOrg(org);
        }}
        users={users}
        currentUser={currentUser}
        // Changement d'utilisateur sans mot de passe : réservé au mode démonstration.
        onSelectUser={DEMO_MODE ? handleDemoSwitchUser : undefined}
        securityAlerts={alerts}
        unreadNotificationsCount={invitationNotifications.filter(n => {
          const uMat = (currentUser.matricule || currentUser.employeeCode || '').toUpperCase().trim();
          return ((n.recipientMatricule || '').toUpperCase().trim() === uMat || n.recipientUserId === currentUser.id) && !n.isRead;
        }).length}
        onOpenNotifications={() => setShowNotificationsModal(true)}
        onOpenConnectKey={() => setShowConnectKeyModal(true)}
        onOpenInviteAgent={() => setShowInviteModal(true)}
        isEntityManagerUser={isEntityManager(currentUser, entities)}
        onOpenSecurity={() => setCurrentTab('security')}
        onOpenWorkspace={() => setCurrentTab('workspace')}
        onLogout={handleLogout}
        onOpenOrgIdentity={() => {
          setShowOrgIdentityModal(true);
        }}
        onOpenNewAccount={currentUser.role === 'dg' && !API_MODE ? () => setShowOnboardingWizard(true) : undefined}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenBackup={() => setShowBackupModal(true)}
        onToggleMobileNav={() => setIsMobileNavOpen(open => !open)}
        isMobileNavOpen={isMobileNavOpen}
      />

      {/* BANNIÈRE DE SESSION INVITÉ INTER-ENTITÉS ACTIVE */}
      {activeGuestInvitation && (
        <ActiveGuestSessionBanner
          guestInvitation={activeGuestInvitation}
          currentUser={currentUser}
          onExitGuestSession={handleExitGuestSession}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          currentUser={currentUser}
          unreadAlertsCount={alerts.filter(a => a.status !== 'resolue').length}
          pendingCounts={pendingCounts}
          isMobileOpen={isMobileNavOpen}
          onMobileClose={() => setIsMobileNavOpen(false)}
        />

        <main id="main-content" className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 overflow-y-auto">
          <ErrorBoundary scope="section" resetKey={currentTab}>
          <Suspense fallback={<ModuleLoading />}>
          {!canUserAccessTab(currentUser, currentTab) ? (
            <AccessDenied onBack={() => setCurrentTab('workspace')} />
          ) : (
          <>
          {currentTab === 'workspace' && (
            <EmployeeWorkspaceView
              currentUser={currentUser}
              currentOrg={currentOrg}
              entities={entities}
              users={users}
              tasks={tasks}
              documents={documents}
              contracts={contracts}
              onTaskAction={applyTaskAction}
              onCreateTask={handleCreateTask}
              onSubmitLeaveRequest={handleSubmitLeaveRequest}
              onOpenTab={tab => setCurrentTab(tab)}
              onSelectUser={DEMO_MODE ? handleDemoSwitchUser : undefined}
              onOpenLogistics={() => setCurrentTab('logistics')}
              onOpenConnectKey={() => setShowConnectKeyModal(true)}
              onOpenInviteAgent={() => setShowInviteModal(true)}
              onOpenInvitationsManager={() => setShowInvitationsManagerModal(true)}
            />
          )}

          {currentTab === 'hierarchy' && (
            <HierarchyView
              organization={currentOrg}
              entities={entities}
              currentUser={currentUser}
              users={users}
              onOpenInvitationsManager={() => setShowInvitationsManagerModal(true)}
              onOpenInviteAgent={() => setShowInviteModal(true)}
              activeInvitationsCount={invitations.filter(i => i.status === 'active').length}
              onOpenOrgIdentity={() => {
                setShowOrgIdentityModal(true);
              }}
              onAddEntity={newEnt => {
                const entWithId = { ...newEnt, id: newId('ent') };
                setEntities(prev => [...prev, entWithId]);
                addAuditLog({
                  action: 'Création Entité Hiérarchique',
                  category: 'hierarchy',
                  details: `Ajout de l'entité ${entWithId.name} (${entWithId.level.toUpperCase()})`,
                });
              }}
              onDeleteEntity={id => {
                const target = entities.find(e => e.id === id);
                setEntities(prev => prev.filter(e => e.id !== id));
                if (target) {
                  addAuditLog({
                    action: 'Suppression Entité',
                    category: 'hierarchy',
                    details: `Suppression de l'entité ${target.name} (${target.code})`,
                  });
                }
              }}
            />
          )}

          {/* MODULE INVITATIONS & CLÉS D'AUTHENTIFICATION INTER-ENTITÉS (10 CHIFFRES) */}
          {currentTab === 'invitations' && (
            <EntityInvitationsView
              currentUser={currentUser}
              entities={entities}
              users={users}
              invitations={invitations}
              notifications={invitationNotifications}
              onOpenInviteModal={() => setShowInviteModal(true)}
              onOpenConnectModal={() => setShowConnectKeyModal(true)}
              onOpenNotificationsModal={() => setShowNotificationsModal(true)}
              onRevokeInvitation={handleRevokeInvitation}
              onExtendInvitation={handleExtendInvitation}
              onConnectWithKey={(key) => {
                const found = invitations.find(i => i.authKey10Digits.replace(/\D/g, '') === key.replace(/\D/g, ''));
                if (found) handleConnectWithKey(found);
              }}
              onLogAction={(act, det, cat) => {
                addAuditLog({
                  action: act,
                  category: cat as AuditLog['category'],
                  details: det,
                });
              }}
            />
          )}

          {currentTab === 'documents' && (
            <DocumentsView
              documents={documents}
              organization={currentOrg}
              currentUser={currentUser}
              entities={entities}
              users={users}
              onCreateDocument={handleCreateDocument}
              onDocumentAction={applyDocumentAction}
            />
          )}

          {currentTab === 'workflows' && (
            <WorkflowsView
              tasks={tasks}
              currentUser={currentUser}
              entities={entities}
              users={users}
              documents={documents}
              organization={currentOrg}
              onCreateTask={handleCreateTask}
              onTaskAction={applyTaskAction}
            />
          )}

          {currentTab === 'logistics' && (
            !canAccessLogistics(currentUser) ? (
              <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-xl mx-auto my-12 text-center space-y-4 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 mx-auto flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white">Accès Restreint au Module Logistique</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Le module logistique et la gestion des stocks des Hubs provinciaux sont strictement réservés à la <strong>Direction Générale (DG)</strong> et aux <strong>responsables habilités du Département Logistique</strong>.
                </p>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
                  Votre profil actuel : <strong>{currentUser.name}</strong> ({currentUser.roleTitle || currentUser.role}) — {currentUser.departmentName || 'Service Opérationnel'}
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setCurrentTab('workspace')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    Retour à mon Espace Collaborateur
                  </button>
                </div>
              </div>
            ) : (
              <LogisticsModuleView
                currentUser={currentUser}
                organization={currentOrg}
                entities={entities}
                catalog={logisticsCatalog}
                orders={purchaseOrders}
                deliveryNotes={deliveryNotes}
                shipments={shipments}
                proformas={proformas}
                invoices={netInvoices}
                hubs={hubs}
                stocks={stocks}
                movements={stockMovements}
                onAddHub={handleAddHub}
                onAddMovement={handleAddMovement}
                onApproveMovement={handleApproveMovement}
                onReceiveTransfer={handleReceiveTransfer}
                onCreateOrder={handleCreateOrder}
                onApproveOrder={handleApproveOrder}
                onCreateDeliveryNote={handleCreateDeliveryNote}
                onSignDeliveryNote={handleSignDeliveryNote}
                onUpdateShipmentStep={handleUpdateShipmentStep}
                onCreateShipment={handleCreateShipment}
                onCreateProforma={handleCreateProforma}
                onConvertProforma={handleConvertProforma}
                onCreateNetInvoice={handleCreateNetInvoice}
                onRegisterPayment={handleRegisterPayment}
                approvalState={refId => {
                  const linked = documents.find(d => d.id === `doc-${refId}`);
                  if (!linked?.workflow) return undefined;
                  return { canAct: canActOnDocument(currentUser, linked), waiting: waitingFor(currentStep(linked.workflow)) };
                }}
                onLogAction={(action, details, category) => {
                  addAuditLog({
                    action,
                    category: category as AuditLog['category'],
                    details,
                  });
                }}
              />
            )
          )}

          {/* MODULE DE MASSIFICATION CSV & IMPORT RH / PAIE */}
          {currentTab === 'bulk_import' && (
            <BulkImportView
              currentUser={currentUser}
              currentOrg={currentOrg}
              entities={entities}
              users={users}
              contracts={contracts}
              onImportUsersAndContracts={handleImportUsersAndContracts}
              onImportPayrollHistory={handleImportPayrollHistory}
              onLogAction={(action, details, category) => {
                addAuditLog({
                  action,
                  category: category as AuditLog['category'],
                  details,
                });
              }}
              onAddDocument={(doc) => setDocuments(prev => [doc, ...prev])}
            />
          )}

          {/* MODULE DE POINTAGE & HORODATAGE 28 JOURS OUVRABLES (+ HEURES SUP) */}
          {currentTab === 'attendance_dispatch' && (
            <BulkImportView
              currentUser={currentUser}
              currentOrg={currentOrg}
              entities={entities}
              users={users}
              contracts={contracts}
              onImportUsersAndContracts={handleImportUsersAndContracts}
              onImportPayrollHistory={handleImportPayrollHistory}
              onLogAction={(action, details, category) => {
                addAuditLog({
                  action,
                  category: category as AuditLog['category'],
                  details,
                });
              }}
              onAddDocument={(doc) => setDocuments(prev => [doc, ...prev])}
            />
          )}

          {currentTab === 'security' && (
            <SecurityView
              alerts={alerts}
              currentUser={currentUser}
              users={users}
              organization={currentOrg}
              onLockUser={id => {
                setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'verrouille' } : u));
                const target = users.find(u => u.id === id);
                addAuditLog({
                  action: 'Verrouillage Forcé Utilisateur',
                  category: 'security',
                  details: `Compte collaborateur ${target?.name || id} verrouillé manuellement par la DG`,
                });
              }}
              onUnlockUser={id => {
                setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'actif', failedAccessAttempts: 0 } : u));
                const target = users.find(u => u.id === id);
                addAuditLog({
                  action: 'Déverrouillage Utilisateur',
                  category: 'security',
                  details: `Compte collaborateur ${target?.name || id} réactivé et compteurs remis à zéro`,
                });
              }}
              onResolveAlert={id => {
                setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolue' } : a));
                addAuditLog({
                  action: 'Résolution Alerte Sécurité',
                  category: 'security',
                  details: `Alerte #${id} marquée résolue après revue de conformité`,
                });
              }}
              onTriggerTestBreach={handleTriggerTestBreach}
            />
          )}

          {currentTab === 'agents' && (
            <AgentCrudView
              users={users}
              currentUser={currentUser}
              entities={entities}
              organization={currentOrg}
              onToggleDelegation={handleToggleDelegation}
              onCreateUser={newUser => {
                // Mot de passe provisoire : affiché une seule fois au créateur, à changer à la 1re connexion.
                const tempPassword = DEMO_MODE ? DEMO_PASSWORD : generateTemporaryPassword();
                const createdUser: User = {
                  ...newUser,
                  id: newId('usr'),
                  password: tempPassword,
                  mustChangePassword: !DEMO_MODE,
                  failedAccessAttempts: 0,
                  status: 'actif'
                };
                setUsers(prev => [...prev, createdUser]);
                addAuditLog({
                  action: 'Création Compte Collaborateur',
                  category: 'admin',
                  details: `Création du compte ${createdUser.name} (${createdUser.roleTitle})`,
                });
                showToast(
                  'success',
                  `Compte créé pour ${createdUser.name}. Identifiant : ${createdUser.email} — mot de passe ${DEMO_MODE ? 'de démonstration' : 'provisoire'} : ${tempPassword}. Notez-le : il ne sera plus affiché.`,
                  0
                );
              }}
              onRevokeUser={id => {
                const target = users.find(u => u.id === id);
                if (target?.id === currentUser.id) {
                  showToast('error', 'Vous ne pouvez pas révoquer votre propre compte.');
                  return;
                }
                setUsers(prev => prev.filter(u => u.id !== id));
                if (target) {
                  addAuditLog({
                    action: 'Révocation Compte Collaborateur',
                    category: 'admin',
                    details: `Révocation définitive des accès de ${target.name} (${target.email})`,
                  });
                }
              }}
              onToggleUserStatus={id => {
                const target = users.find(u => u.id === id);
                if (!target) return;
                if (target.id === currentUser.id) {
                  showToast('error', 'Vous ne pouvez pas suspendre votre propre compte.');
                  return;
                }
                const nextStatus: User['status'] = target.status === 'actif' ? 'suspendu' : 'actif';
                // Réactivation : on remet aussi à zéro le compteur d'échecs de connexion.
                setUsers(prev => prev.map(u =>
                  u.id === id
                    ? { ...u, status: nextStatus, failedAccessAttempts: nextStatus === 'actif' ? 0 : u.failedAccessAttempts }
                    : u
                ));
                addAuditLog({
                  action: 'Changement Statut Compte',
                  category: 'admin',
                  details: `Passage du statut de ${target.name} à : ${nextStatus.toUpperCase()}`,
                });
              }}
            />
          )}

          {currentTab === 'audit' && (
            <AuditView logs={logs} organizationName={currentOrg?.name} />
          )}

          {currentTab === 'laravel' && (
            <LaravelIntegrationView />
          )}
          </>
          )}
          </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1 : IDENTITÉ & LOGO DE L'ORGANISATION (RÉSERVÉ AU DG)               */}
      {/* ========================================================================= */}
      {showOrgIdentityModal && (
        <OrganizationIdentityModal
          organization={currentOrg}
          canEdit={currentUser.role === 'dg'}
          onClose={() => setShowOrgIdentityModal(false)}
          onSave={handleSaveOrgIdentity}
        />
      )}


      {/* ========================================================================= */}
      {/* MODAL 3 : GUIDE DE RÉGLEMENTATION ET SÉCURITÉ CONFORME RDC                */}
      {/* ========================================================================= */}
      {showHelpModal && (
        <RegulationGuideModal onClose={() => setShowHelpModal(false)} />
      )}

      {/* MODALE D'INVITATION D'AGENT PAR MATRICULE AVEC CLÉ 10 CHIFFRES */}
      {showInviteModal && (
        <InviteAgentModal
          currentUser={currentUser}
          entities={entities}
          users={users}
          onClose={() => setShowInviteModal(false)}
          onSendInvitation={handleSendInvitation}
          onLogAction={(act, det, cat) => {
            addAuditLog({
              action: act,
              category: cat as AuditLog['category'],
              details: det,
            });
          }}
        />
      )}

      {/* MODALE DE CONNEXION VIA CLÉ UNIQUE 10 CHIFFRES */}
      {showConnectKeyModal && (
        <ConnectViaKeyModal
          currentUser={currentUser}
          invitations={invitations}
          entities={entities}
          onClose={() => setShowConnectKeyModal(false)}
          onConnectToEntity={handleConnectWithKey}
          onLogAction={(act, det, cat) => {
            addAuditLog({
              action: act,
              category: cat as AuditLog['category'],
              details: det,
            });
          }}
        />
      )}

      {/* MODALE DE GESTION DES INVITATIONS & CLÉS POUR LES RESPONSABLES */}
      {showInvitationsManagerModal && (
        <EntityInvitationsManagerModal
          currentUser={currentUser}
          entities={entities}
          users={users}
          invitations={invitations}
          onClose={() => setShowInvitationsManagerModal(false)}
          onOpenInviteModal={() => setShowInviteModal(true)}
          onOpenConnectModal={() => setShowConnectKeyModal(true)}
          onRevokeInvitation={handleRevokeInvitation}
          onExtendInvitation={handleExtendInvitation}
          onLogAction={(act, det, cat) => {
            addAuditLog({
              action: act,
              category: cat as AuditLog['category'],
              details: det,
            });
          }}
        />
      )}

      {/* MODALE / TIROIR DES NOTIFICATIONS D'INVITATION REÇUES */}
      {showNotificationsModal && (
        <NotificationsDrawerModal
          currentUser={currentUser}
          notifications={invitationNotifications}
          onClose={() => setShowNotificationsModal(false)}
          onConnectWithKey={(key) => {
            const found = invitations.find(i => i.authKey10Digits.replace(/\D/g, '') === key.replace(/\D/g, ''));
            if (found) handleConnectWithKey(found);
          }}
          onMarkAsRead={handleMarkNotificationAsRead}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        />
      )}

      {/* ASSISTANT INITIAL DE CRÉATION D'ORGANISATION (ONBOARDING) */}
      <OrganizationOnboardingWizard
        isOpen={showOnboardingWizard}
        onClose={() => setShowOnboardingWizard(false)}
        onCompleteOnboarding={handleCompleteOnboarding}
      />

      <DataBackupModal
        isOpen={showBackupModal}
        canManage={currentUser.role === 'dg'}
        onClose={() => setShowBackupModal(false)}
        onAudit={(action, details) => addAuditLog({ action, category: 'admin', details })}
      />

      {API_MODE && <SyncIndicator />}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

/** Indicateur affiché pendant le chargement d'un module. */
function ModuleLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-3" role="status">
      <span className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-indigo-400 animate-spin" />
      Chargement du module…
    </div>
  );
}

/** Écran affiché quand l'utilisateur n'a pas les droits sur un module. */
function AccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-md mx-auto mt-16 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h2 className="font-bold text-white">Accès non autorisé</h2>
      <p className="text-sm text-slate-400">
        Ce module est réservé à d'autres fonctions de l'organigramme. Contactez votre responsable si vous pensez devoir y accéder.
      </p>
      <button onClick={onBack} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold">
        Retour à mon espace
      </button>
    </div>
  );
}
