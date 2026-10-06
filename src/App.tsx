// src/App.tsx
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { usePersistentState } from './hooks/usePersistentState';
import { newId, nowStamp } from './utils/id';
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
import { canAccessLogistics } from './utils/rbac';
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
const PayrollSystemView = lazy(() => import('./components/PayrollSystemView').then(m => ({ default: m.PayrollSystemView })));
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
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userId: actor.id,
        userName: actor.name,
        userRole: actor.roleTitle,
        action: entry.action,
        category: entry.category,
        details: entry.details,
        ip: 'Poste local',
        hash: newId('evt')
      },
      // On conserve les 2 000 entrées les plus récentes pour ne pas saturer le stockage du navigateur.
      ...prev.slice(0, 1999)
    ]);
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
    setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, failedAccessAttempts: 0, lastLogin } : u)));
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
    setUsers(prev => prev.map(u =>
      u.id === user.id ? { ...u, failedAccessAttempts: attempts, status: lock ? 'verrouille' : u.status } : u
    ));
    addAuditLog({
      actor: user,
      action: lock ? 'VERROUILLAGE COMPTE (MOTS DE PASSE ERRONÉS)' : 'Échec de Connexion',
      category: 'security',
      details: `Mot de passe erroné pour ${user.name} (tentative ${attempts}/${MAX_FAILED_ATTEMPTS}).${lock ? ' Compte verrouillé.' : ''}`,
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
          status: 'compte_verrouille',
          severity: 'critique',
          ipAddress: 'Poste local',
          reason: `${attempts} mots de passe erronés consécutifs : compte verrouillé automatiquement.`,
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

  const handleAddMovement = (mvt: StockMovementItem) => {
    setStockMovements(prev => [mvt, ...prev]);

    // Mettre à jour l'inventaire physique des Hubs selon le type de mouvement
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
          } else {
            const newStock: HubStockItem = {
              id: `stk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
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
          }
        });
      } else if (mvt.type === 'sortie_deploiement' && mvt.sourceHubId) {
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
          return s;
        }));
      } else if (mvt.type === 'transfert_inter_hub' && mvt.sourceHubId && mvt.destinationHubId) {
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
          if (s.hubId === mvt.destinationHubId && s.catalogItemId === item.catalogItemId) {
            return {
              ...s,
              quantityInTransit: s.quantityInTransit + item.quantity
            };
          }
          return s;
        }));
      }
    });

    // Génération automatique du Document d'Approbation scellé
    const docPrefix = mvt.type === 'entree_fournisseur' ? 'Bon d\'Entrée en Stock (BES)' : mvt.type === 'sortie_deploiement' ? 'Bon de Sortie & Mise en Service (BSS)' : 'Ordre de Transfert Inter-Hubs (OTIH)';
    const docItem: DocumentItem = {
      id: `doc-${mvt.id}`,
      title: `${docPrefix} : ${mvt.movementNumber}`,
      referenceNumber: mvt.movementNumber,
      category: 'chaine_logistique_commerciale',
      subtype: 'bon_livraison',
      organizationId: currentOrg.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorEntity: currentUser.departmentName || 'Service Logistique & Hubs',
      createdAt: mvt.date,
      status: 'signe',
      size: '230 KB',
      fileType: 'PDF',
      amount: mvt.totalValueUSD,
      currency: 'USD',
      description: `Opération logistique ${mvt.movementNumber}. Articles : ${mvt.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}. Scellé SHA-256.`,
      allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
      permissions: {
        viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
        editRoles: ['dg', 'chef_departement', 'directeur', 'chef_service', 'agent'],
        validateRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
        signRoles: ['dg', 'chef_departement', 'directeur', 'chef_service']
      },
      electronicSignature: {
        signedBy: currentUser.name,
        signedAt: new Date().toISOString(),
        role: currentUser.roleTitle,
        certificateHash: mvt.electronicSealHash
      }
    };
    setDocuments(prev => [docItem, ...prev]);

    addAuditLog({
      action: `Mouvement de Stock (${mvt.type})`,
      category: 'document',
      details: `Émission du document ${mvt.movementNumber} pour un montant de $${mvt.totalValueUSD.toLocaleString()} USD.`,
    });
  };

  const handleApproveMovement = (mvtId: string) => {
    setStockMovements(prev => prev.map(m => m.id === mvtId ? {
      ...m,
      status: m.type === 'transfert_inter_hub' ? 'en_transit' : 'valide',
      approvedByManagerName: currentUser.name,
      approvedAt: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString().slice(0, 5)}`
    } : m));
  };

  const handleReceiveTransfer = (mvtId: string) => {
    const mvt = stockMovements.find(m => m.id === mvtId);
    if (!mvt || !mvt.destinationHubId) return;

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
        } else {
          const newStock: HubStockItem = {
            id: `stk-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
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
        }
      });
    });
  };

  const handleCreateOrder = (order: PurchaseOrderItem) => {
    setPurchaseOrders(prev => [order, ...prev]);
    const docItem: DocumentItem = {
      id: `doc-${order.id}`,
      title: `Bon de Commande : ${order.orderNumber} - ${order.supplierName}`,
      referenceNumber: order.orderNumber,
      category: 'chaine_logistique_commerciale',
      subtype: 'bon_commande_client',
      organizationId: currentOrg.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorEntity: currentUser.departmentName || 'Service Logistique',
      createdAt: order.date,
      status: order.status === 'approuve' ? 'approuve' : 'en_revue',
      size: '240 KB',
      fileType: 'PDF',
      amount: order.totalTTC_USD,
      currency: 'USD',
      description: `Bon de commande ${order.category.toUpperCase()} pour ${order.destinationSite}. Émis par ${currentUser.name}.`,
      allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
      permissions: {
        viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
        editRoles: ['dg', 'chef_departement', 'directeur', 'chef_service', 'agent'],
        validateRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
        signRoles: ['dg', 'chef_departement', 'directeur', 'chef_service']
      }
    };
    setDocuments(prev => [docItem, ...prev]);
    addAuditLog({
      action: 'Émission Bon de Commande (BC)',
      category: 'document',
      details: `Création du Bon de Commande ${order.orderNumber} ($${order.totalTTC_USD.toLocaleString()} TTC) pour ${order.destinationSite}.`,
    });
  };

  const handleApproveOrder = (orderId: string) => {
    setPurchaseOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      status: 'approuve',
      approvedByManagerId: currentUser.id,
      approvedByManagerName: currentUser.name,
      approvedAt: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString().slice(0, 5)}`
    } : o));
    addAuditLog({
      action: 'Approbation / Visa Bon de Commande',
      category: 'document',
      details: `Visa hiérarchique apposé sur le Bon de Commande #${orderId} par ${currentUser.name}.`,
    });
  };

  const handleCreateDeliveryNote = (bl: DeliveryNoteItem) => {
    setDeliveryNotes(prev => [bl, ...prev]);
    const docItem: DocumentItem = {
      id: `doc-${bl.id}`,
      title: `Bon de Livraison : ${bl.deliveryNumber} - ${bl.transporterName}`,
      referenceNumber: bl.deliveryNumber,
      category: 'chaine_logistique_commerciale',
      subtype: 'bon_livraison',
      organizationId: currentOrg.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorEntity: currentUser.departmentName || 'Service Logistique',
      createdAt: bl.date,
      status: 'signe',
      size: '220 KB',
      fileType: 'PDF',
      amount: 0,
      currency: 'USD',
      description: `Bon de livraison et relevé de numéros de série (S/N) pour ${bl.destinationSite}.`,
      allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
      permissions: {
        viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
        editRoles: ['dg', 'chef_departement', 'directeur', 'chef_service', 'agent'],
        validateRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
        signRoles: ['dg', 'chef_departement', 'directeur', 'chef_service']
      }
    };
    setDocuments(prev => [docItem, ...prev]);
    addAuditLog({
      action: 'Enregistrement Bon de Livraison (BL)',
      category: 'document',
      details: `Réception et pointage des numéros de série pour le BL ${bl.deliveryNumber} (${bl.destinationSite}).`,
    });
  };

  const handleSignDeliveryNote = (blId: string, recipientName: string) => {
    setDeliveryNotes(prev => prev.map(bl => bl.id === blId ? {
      ...bl,
      isRecipientSigned: true,
      recipientName,
      status: 'livre_conforme'
    } : bl));
  };

  const handleUpdateShipmentStep = (shipmentId: string, newStep: ShipmentWorkflowStep) => {
    setShipments(prev => prev.map(s => s.id === shipmentId ? {
      ...s,
      currentStatus: newStep.status,
      workflowSteps: [...s.workflowSteps, newStep]
    } : s));
    addAuditLog({
      action: 'Mise à Jour Jalon Fret Logistique',
      category: 'task',
      details: `Nouveau jalon pour l'expédition #${shipmentId} : ${newStep.label} (${newStep.location})`,
    });
  };

  const handleCreateShipment = (shipment: ShipmentTracking) => {
    setShipments(prev => [shipment, ...prev]);
    addAuditLog({
      action: 'Création Expédition Fret',
      category: 'task',
      details: `Nouvelle expédition ${shipment.trackingNumber} (${shipment.freightType.toUpperCase()}) vers ${shipment.destinationFinal}.`,
    });
  };

  const handleCreateProforma = (proforma: ProformaInvoiceItem) => {
    setProformas(prev => [proforma, ...prev]);
    const docItem: DocumentItem = {
      id: `doc-${proforma.id}`,
      title: `Facture Proforma : ${proforma.proformaNumber} - ${proforma.clientOrSupplierName}`,
      referenceNumber: proforma.proformaNumber,
      category: 'chaine_logistique_commerciale',
      subtype: 'devis',
      organizationId: currentOrg.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorEntity: currentUser.departmentName || 'Service Facturation',
      createdAt: proforma.date,
      status: 'en_revue',
      size: '210 KB',
      fileType: 'PDF',
      amount: proforma.totalTTC_USD,
      currency: 'USD',
      description: `Devis Proforma pour ${proforma.projectOrSite}.`,
      allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
      permissions: {
        viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
        editRoles: ['dg', 'chef_departement', 'directeur', 'chef_service', 'agent'],
        validateRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
        signRoles: ['dg', 'chef_departement', 'directeur', 'chef_service']
      }
    };
    setDocuments(prev => [docItem, ...prev]);
    addAuditLog({
      action: 'Émission Facture Proforma',
      category: 'document',
      details: `Proforma ${proforma.proformaNumber} ($${proforma.totalTTC_USD.toLocaleString()} TTC) émise pour ${proforma.clientOrSupplierName}.`,
    });
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
        dueDate: '2026-11-20',
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
        bankDetails: {
          bankName: 'RAWBANK KINSHASA (Siège Gombe)',
          accountNumberUSD: '05100-01004419201-88 USD',
          accountNumberCDF: '05100-01004419201-99 CDF',
          swiftBic: 'RAWBCDZX',
          ibanOrRib: 'CD68 0510 0010 0441 9201 88'
        },
        paymentStatus: 'en_attente',
        paidAmountUSD: 0,
        remainingBalanceUSD: pro.totalTTC_USD,
        paymentRecords: [],
        electronicSealHash: `sha256-fac-conv-${Date.now()}`,
        preparedByAgentId: currentUser.id,
        preparedByAgentName: `${currentUser.name} (Agent de Service)`,
        serviceName: currentUser.departmentName || 'Service Facturation',
        isOfficialDocumentEmitted: true
      };
      setNetInvoices(prev => [newInvoice, ...prev]);
      setProformas(prev => prev.map(p => p.id === proformaId ? { ...p, status: 'acceptee_convertie', convertedToInvoiceId: newInvoice.id } : p));
    }

    addAuditLog({
      action: 'Conversion Facture Proforma',
      category: 'document',
      details: `Facture Proforma ${pro.proformaNumber} convertie en facture définitive Net à Payer.`,
    });
  };

  const handleCreateNetInvoice = (invoice: NetToPayInvoiceItem) => {
    setNetInvoices(prev => [invoice, ...prev]);
    const docItem: DocumentItem = {
      id: `doc-${invoice.id}`,
      title: `Facture Net à Payer : ${invoice.invoiceNumber} - ${invoice.clientName}`,
      referenceNumber: invoice.invoiceNumber,
      category: 'financier_comptable',
      subtype: 'facture_client',
      organizationId: currentOrg.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorEntity: currentUser.departmentName || 'Service Facturation',
      createdAt: invoice.date,
      status: 'signe',
      size: '250 KB',
      fileType: 'PDF',
      amount: invoice.netToPayUSD,
      currency: 'USD',
      description: `Facture Net à Payer pour ${invoice.clientName}. Net: $${invoice.netToPayUSD.toLocaleString()} USD (~${invoice.netToPayCDF.toLocaleString()} CDF).`,
      allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
      permissions: {
        viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
        editRoles: ['dg', 'chef_departement', 'directeur', 'chef_service', 'agent'],
        validateRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
        signRoles: ['dg', 'chef_departement', 'directeur', 'chef_service']
      }
    };
    setDocuments(prev => [docItem, ...prev]);
    addAuditLog({
      action: 'Émission Facture Net à Payer',
      category: 'document',
      details: `Facture ${invoice.invoiceNumber} ($${invoice.netToPayUSD.toLocaleString()} Net) émise pour ${invoice.clientName}.`,
    });
  };

  const handleRegisterPayment = (invoiceId: string, amountUSD: number, ref: string, method: string) => {
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
            registeredByAgent: `${currentUser.name} (Agent de Service)`
          }
        ]
      };
    }));
    addAuditLog({
      action: 'Règlement Facture Net à Payer',
      category: 'document',
      details: `Encaissement de $${amountUSD.toLocaleString()} USD sur la facture #${invoiceId} (Réf : ${ref}).`,
    });
  };

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

  // Gestion de la sauvegarde de la politique salariale
  const handleUpdatePayrollConfig = (updatedConfig: PayrollSystemConfig, auditNote?: string) => {
    setPayrollConfigs(prev => ({
      ...prev,
      [currentOrg.id]: updatedConfig
    }));
    if (auditNote) {
      addAuditLog({
        action: 'Mise à jour Paie RH',
        category: 'admin',
        details: auditNote,
      });
    }
  };

  // Réinitialisation au barème officiel RDC
  const handleResetPayrollToStandard = () => {
    const standard = createStandardPayrollSystem(currentOrg.id, currentOrg.name);
    setPayrollConfigs(prev => ({
      ...prev,
      [currentOrg.id]: standard
    }));
    addAuditLog({
      action: 'Réinitialisation Barème RDC',
      category: 'admin',
      details: `Barème officiel de paie RDC réinitialisé pour ${currentOrg.name}`,
    });
  };

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
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
              onAddDocument={newDoc => {
                const docWithId = { ...newDoc, id: newId('doc') };
                setDocuments(prev => [docWithId, ...prev]);
                addAuditLog({
                  action: 'Publication Document',
                  category: 'document',
                  details: `Publication du document certifié ${docWithId.title} (${docWithId.referenceNumber})`,
                });
              }}
              onUpdateDocument={(docId, updates) => {
                setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updates } : d));
              }}
              onDeleteDocument={(docId) => {
                setDocuments(prev => prev.filter(d => d.id !== docId));
              }}
              onLogAction={(action, details, category) => {
                addAuditLog({
                  action,
                  category: category as AuditLog['category'],
                  details,
                });
              }}
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
              onToggleStep={(taskId, stepId) => {
                setTasks(prev => prev.map(t => t.id === taskId ? {
                  ...t,
                  steps: t.steps.map(s => s.id === stepId ? { ...s, completed: !s.completed } : s)
                } : t));
              }}
              onAddTask={newTask => {
                const createdTask = { ...newTask, id: newId('task') };
                setTasks(prev => [createdTask, ...prev]);
                addAuditLog({
                  action: 'Création Tâche Workflow',
                  category: 'task',
                  details: `Ouverture du jalon/tâche ${createdTask.title} (${createdTask.priority})`,
                });
              }}
              onUpdateDocument={(docId, updates) => {
                setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updates } : d));
              }}
              onLogAction={(action, details, category) => {
                addAuditLog({
                  action,
                  category: category as AuditLog['category'],
                  details,
                });
              }}
            />
          )}

          {/* MODULE LOGISTIQUE : ÉQUIPEMENTS VSAT, ÉNERGIE SOLAIRE & HUBS */}
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

          {/* MODULE DE PAIE & RH RDC COMPLET */}
          {currentTab === 'payroll' && (
            <PayrollSystemView
              currentOrg={currentOrg}
              currentUser={currentUser}
              users={users}
              payrollConfig={payrollConfigs[currentOrg.id] || createStandardPayrollSystem(currentOrg.id, currentOrg.name)}
              onUpdatePayrollConfig={handleUpdatePayrollConfig}
              onResetToStandard={handleResetPayrollToStandard}
              contracts={contracts}
              onContractsChange={setContracts}
              onAddDocument={(doc) => setDocuments(prev => [doc, ...prev.filter(d => d.id !== doc.id)])}
              onLogAction={(action, details, category) => {
                addAuditLog({
                  action,
                  category: category as AuditLog['category'],
                  details,
                });
              }}
            />
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
            <AuditView logs={logs} />
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
