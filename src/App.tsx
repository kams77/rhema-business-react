// src/App.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { usePersistentState } from './hooks/usePersistentState';
import { newId, nowStamp } from './utils/id';
import { DEMO_MODE, DEMO_PASSWORD } from './config';
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
import { canAccessLogistics, canViewHubActivities } from './utils/rbac';
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
import { EntityInvitationsView } from './components/EntityInvitationsView';
import { 
  createStandardPayrollSystem, 
  initialPayrollConfigs 
} from './data/standardPayroll';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { EmployeeWorkspaceView } from './components/EmployeeWorkspaceView';
import { HierarchyView } from './components/HierarchyView';
import { DocumentsView } from './components/DocumentsView';
import { WorkflowsView } from './components/WorkflowsView';
import { PayrollSystemView } from './components/PayrollSystemView';
import { SecurityView } from './components/SecurityView';
import { AgentCrudView } from './components/AgentCrudView';
import { AuditView } from './components/AuditView';
import { OrganizationOnboardingWizard } from './components/OrganizationOnboardingWizard';
import { BulkImportView } from './components/BulkImportView';
import { LogisticsModuleView } from './components/LogisticsModuleView';
import { 
  Building2, 
  ShieldAlert, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  X, 
  Check, 
  Copy, 
  Plus, 
  Landmark, 
  Shield, 
  BookOpen, 
  Layers,
  Fingerprint,
  Scale,
  FileCode2,
  Terminal,
  FileCheck2,
  Cpu,
  RefreshCw,
  Truck,
  KeyRound
} from 'lucide-react';

type ActiveTab = 
  | 'workspace' 
  | 'hierarchy' 
  | 'invitations'
  | 'documents' 
  | 'workflows' 
  | 'logistics'
  | 'payroll' 
  | 'bulk_import'
  | 'attendance_dispatch'
  | 'security' 
  | 'agents' 
  | 'audit' 
  | 'laravel';

export default function App() {
  const [organizations, setOrganizations] = usePersistentState<Organization[]>('organizations', initialOrganizations);
  const [currentOrg, setCurrentOrg] = usePersistentState<Organization>('currentOrg', initialOrganizations[0]);
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
      ...prev
    ]);
  };

  // Conversion unique des mots de passe en clair (données de démonstration) en empreintes chiffrées.
  useEffect(() => {
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

  // Déconnexion automatique après inactivité.
  useEffect(() => {
    if (!isAuthenticated) return;
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

    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: data.organization.managerName || 'Direction Générale',
        userRole: 'Directeur Général (DG)',
        action: 'Initialisation Organisation (Première Utilisation)',
        category: 'admin',
        details: `Déploiement complet de l'organisation "${data.organization.name}" (${data.organization.registrationNumber || 'RDC'}), ${data.entities.length} entités hiérarchiques et ${data.users.length} collaborateurs pré-enrôlés pour connexion obligatoire.`,
        ip: '127.0.0.1',
        hash: `sha256-onboarding-${Date.now()}`
      },
      ...prev
    ]);
  };

  // RÈGLE STRICTE 6 : GESTION DE LA DÉLÉGATION DE VISA DE DOCUMENTS POUR LES AGENTS
  const handleToggleDelegation = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const nextVal = !target.canApproveServiceDocuments;

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, canApproveServiceDocuments: nextVal } : u));

    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: nextVal ? 'Octroi Délégation Visa Service (Règle 6)' : 'Révocation Délégation Visa Service (Règle 6)',
        category: 'security',
        details: nextVal 
          ? `Délégation d'approbation et visa de documents accordée à l'agent ${target.name} pour les dossiers de son service.`
          : `Délégation d'approbation révoquée pour l'agent ${target.name}. Statut repassé en exécution exclusive.`,
        ip: '127.0.0.1',
        hash: `sha256-delegation-${Date.now()}`
      },
      ...prev
    ]);
  };

  // MASSIFICATION DES COLLABORATEURS & CONTRATS RH VIA CSV
  const handleImportUsersAndContracts = (newUsers: User[], newContracts: EmployeeContract[], auditNote: string) => {
    setUsers(prev => [...newUsers, ...prev]);
    setContracts(prev => [...newContracts, ...prev]);
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Massification CSV Employés & Contrats RH',
        category: 'admin',
        details: auditNote,
        ip: '127.0.0.1',
        hash: `sha256-bulk-users-${Date.now()}`
      },
      ...prev
    ]);
  };

  // MASSIFICATION DES HISTORIQUES DE PAIE & ARCHIVES VIA CSV
  const handleImportPayrollHistory = (newRun: PayrollRunPeriod, newPayslipDocs: DocumentItem[], auditNote: string) => {
    setDocuments(prev => [...newPayslipDocs, ...prev]);
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Massification CSV Historique Paie',
        category: 'admin',
        details: auditNote,
        ip: '127.0.0.1',
        hash: `sha256-bulk-payroll-${Date.now()}`
      },
      ...prev
    ]);
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
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Création Hub Provincial',
        category: 'admin',
        details: `Raccordement du Hub ${newHub.name} (${newHub.province}) au réseau logistique national.`,
        ip: '127.0.0.1',
        hash: `sha256-hub-${Date.now()}`
      },
      ...prev
    ]);
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

    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: `Mouvement de Stock (${mvt.type})`,
        category: 'document',
        details: `Émission du document ${mvt.movementNumber} pour un montant de $${mvt.totalValueUSD.toLocaleString()} USD.`,
        ip: '127.0.0.1',
        hash: mvt.electronicSealHash
      },
      ...prev
    ]);
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
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Émission Bon de Commande (BC)',
        category: 'document',
        details: `Création du Bon de Commande ${order.orderNumber} ($${order.totalTTC_USD.toLocaleString()} TTC) pour ${order.destinationSite}.`,
        ip: '127.0.0.1',
        hash: `sha256-bc-${Date.now()}`
      },
      ...prev
    ]);
  };

  const handleApproveOrder = (orderId: string) => {
    setPurchaseOrders(prev => prev.map(o => o.id === orderId ? {
      ...o,
      status: 'approuve',
      approvedByManagerId: currentUser.id,
      approvedByManagerName: currentUser.name,
      approvedAt: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString().slice(0, 5)}`
    } : o));
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Approbation / Visa Bon de Commande',
        category: 'document',
        details: `Visa hiérarchique apposé sur le Bon de Commande #${orderId} par ${currentUser.name}.`,
        ip: '127.0.0.1',
        hash: `sha256-appr-bc-${Date.now()}`
      },
      ...prev
    ]);
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
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Enregistrement Bon de Livraison (BL)',
        category: 'document',
        details: `Réception et pointage des numéros de série pour le BL ${bl.deliveryNumber} (${bl.destinationSite}).`,
        ip: '127.0.0.1',
        hash: `sha256-bl-${Date.now()}`
      },
      ...prev
    ]);
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
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Mise à Jour Jalon Fret Logistique',
        category: 'task',
        details: `Nouveau jalon pour l'expédition #${shipmentId} : ${newStep.label} (${newStep.location})`,
        ip: '127.0.0.1',
        hash: `sha256-ship-${Date.now()}`
      },
      ...prev
    ]);
  };

  const handleCreateShipment = (shipment: ShipmentTracking) => {
    setShipments(prev => [shipment, ...prev]);
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Création Expédition Fret',
        category: 'task',
        details: `Nouvelle expédition ${shipment.trackingNumber} (${shipment.freightType.toUpperCase()}) vers ${shipment.destinationFinal}.`,
        ip: '127.0.0.1',
        hash: `sha256-new-ship-${Date.now()}`
      },
      ...prev
    ]);
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
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Émission Facture Proforma',
        category: 'document',
        details: `Proforma ${proforma.proformaNumber} ($${proforma.totalTTC_USD.toLocaleString()} TTC) émise pour ${proforma.clientOrSupplierName}.`,
        ip: '127.0.0.1',
        hash: `sha256-pro-${Date.now()}`
      },
      ...prev
    ]);
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

    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Conversion Facture Proforma',
        category: 'document',
        details: `Facture Proforma ${pro.proformaNumber} convertie en facture définitive Net à Payer.`,
        ip: '127.0.0.1',
        hash: `sha256-conv-${Date.now()}`
      },
      ...prev
    ]);
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
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Émission Facture Net à Payer',
        category: 'document',
        details: `Facture ${invoice.invoiceNumber} ($${invoice.netToPayUSD.toLocaleString()} Net) émise pour ${invoice.clientName}.`,
        ip: '127.0.0.1',
        hash: `sha256-fac-net-${Date.now()}`
      },
      ...prev
    ]);
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
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Règlement Facture Net à Payer',
        category: 'document',
        details: `Encaissement de $${amountUSD.toLocaleString()} USD sur la facture #${invoiceId} (Réf : ${ref}).`,
        ip: '127.0.0.1',
        hash: `sha256-reg-pay-${Date.now()}`
      },
      ...prev
    ]);
  };

  const [currentTab, setCurrentTab] = useState<ActiveTab>('workspace');

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
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Émission Invitation Inter-Entités',
        category: 'security',
        details: `Invitation ${invitation.invitationCode} émise pour ${invitation.invitedAgentName} (${invitation.invitedAgentMatricule}) avec clé 10 chiffres ${invitation.authKey10Digits}. Validité : ${invitation.validityDurationHours}h vers "${invitation.hostEntityName}".`,
        ip: '192.168.1.100',
        hash: `sha256-inv-${Date.now()}`
      },
      ...prev
    ]);
  };

  const handleConnectWithKey = (invitation: EntityInvitation) => {
    setActiveGuestInvitation(invitation);
    setInvitations(prev => prev.map(inv => inv.id === invitation.id ? { ...inv, status: 'en_session', connectedAt: new Date().toISOString() } : inv));
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Connexion Inter-Entités par Clé Unique',
        category: 'auth',
        details: `Session invité activée pour ${currentUser.name} sur l'entité "${invitation.hostEntityName}" via clé 10 chiffres ${invitation.authKey10Digits}.`,
        ip: '192.168.1.100',
        hash: `sha256-conn-${Date.now()}`
      },
      ...prev
    ]);
  };

  const handleExitGuestSession = () => {
    if (activeGuestInvitation) {
      setLogs(prev => [
        {
          id: newId('log'),
          timestamp: nowStamp(),
          userName: currentUser.name,
          userRole: currentUser.roleTitle,
          action: 'Clôture Session Invité',
          category: 'auth',
          details: `L'agent ${currentUser.name} a quitté sa session invité sur l'entité "${activeGuestInvitation.hostEntityName}".`,
          ip: '192.168.1.100',
          hash: `sha256-exit-${Date.now()}`
        },
        ...prev
      ]);
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
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpActiveTab, setHelpActiveTab] = useState<'rdc_payroll' | 'rbac' | 'security' | 'workflows'>('rdc_payroll');
  const [copiedCodeSnippet, setCopiedCodeSnippet] = useState<string | null>(null);

  // Formulaire d'édition de l'identité de l'entreprise
  const [orgEditForm, setOrgEditForm] = useState({
    name: currentOrg.name,
    type: currentOrg.type,
    registrationNumber: currentOrg.registrationNumber || 'RCCM/20-A-01120',
    headquarters: currentOrg.headquarters || 'N°1B, Avenue Bangala, Q/Salongo C/Kintambo, Kinshasa - RD CONGO',
    email: currentOrg.email || 'contact@rhemabusiness.com',
    phone: currentOrg.phone || '+243 81 279 1228',
    managerName: currentOrg.managerName || 'Junior Monya',
    managerRole: currentOrg.managerRole || 'Directeur Général (DG)',
    description: currentOrg.description || 'RHEMA BUSINESS - Télécoms, VSAT, Réseaux et Intégration Technologique en RDC.',
    logoUrl: currentOrg.logo || '',
  });

  // Formulaire de nouvelle organisation
  const [newOrgForm, setNewOrgForm] = useState({
    name: '',
    type: 'entreprise' as const,
    registrationNumber: 'RCCM/24-B-',
    headquarters: 'Kinshasa, RD CONGO',
    email: 'direction@entreprise.cd',
    phone: '+243 99 000 0000',
    managerName: 'Directeur Général',
    description: 'Nouvelle entité organisationnelle.',
  });

  // Gestion de la sauvegarde de la politique salariale
  const handleUpdatePayrollConfig = (updatedConfig: PayrollSystemConfig, auditNote?: string) => {
    setPayrollConfigs(prev => ({
      ...prev,
      [currentOrg.id]: updatedConfig
    }));
    if (auditNote) {
      setLogs(prev => [
        {
          id: newId('log'),
          timestamp: nowStamp(),
          userName: currentUser.name,
          userRole: currentUser.roleTitle,
          action: 'Mise à jour Paie RH',
          category: 'admin',
          details: auditNote,
          ip: '127.0.0.1',
          hash: `sha256-pay-${Date.now()}`
        },
        ...prev
      ]);
    }
  };

  // Réinitialisation au barème officiel RDC
  const handleResetPayrollToStandard = () => {
    const standard = createStandardPayrollSystem(currentOrg.id, currentOrg.name);
    setPayrollConfigs(prev => ({
      ...prev,
      [currentOrg.id]: standard
    }));
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Réinitialisation Barème RDC',
        category: 'admin',
        details: `Barème officiel de paie RDC réinitialisé pour ${currentOrg.name}`,
        ip: '127.0.0.1',
        hash: `sha256-reset-${Date.now()}`
      },
      ...prev
    ]);
  };

  // Déclenchement d'un test de tentative d'intrusion
  const handleTriggerTestBreach = () => {
    const testAgents = users.filter(u => u.role === 'agent' || u.role === 'chef_service');
    const targetAgent = testAgents[Math.floor(Math.random() * testAgents.length)] || users[users.length - 1];
    const breachCount = (targetAgent.failedAccessAttempts || 0) + 1;
    const shouldLock = breachCount >= 2;

    const newAlert: SecurityAlert = {
      id: newId('sec'),
      timestamp: nowStamp(),
      userId: targetAgent.id,
      userName: targetAgent.name,
      userRole: targetAgent.role,
      userEntityName: targetAgent.roleTitle,
      targetEntityId: 'dept-daf',
      targetEntityName: 'Département Administration & Finances (DAF - Coffre Fort RH)',
      attemptCount: breachCount,
      status: shouldLock ? 'compte_verrouille' : 'alerte_emise',
      severity: shouldLock ? 'critique' : 'haute',
      ipAddress: `192.168.1.${Math.floor(Math.random() * 150) + 100}`,
      reason: `Tentative d'accès illicite aux livres de paie & comptes confidentiels (Tentative #${breachCount}).`,
    };

    setAlerts(prev => [newAlert, ...prev]);

    // Mettre à jour l'utilisateur si récidive
    setUsers(prev => prev.map(u => {
      if (u.id === targetAgent.id) {
        return {
          ...u,
          failedAccessAttempts: breachCount,
          status: shouldLock ? 'verrouille' : u.status
        };
      }
      return u;
    }));

    // Inscription au journal d'audit
    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: targetAgent.name,
        userRole: targetAgent.roleTitle,
        action: shouldLock ? 'VERROUILLAGE SÉCURITÉ RÉCIDIVE' : 'ALERTE INTRUSION DÉTECTÉE',
        category: 'security',
        details: `Tentative illégitime d'accès au périmètre DAF depuis ${newAlert.ipAddress}. Statut: ${shouldLock ? 'Compte bloqué & Alerte DG' : 'Avertissement émis'}.`,
        ip: newAlert.ipAddress,
        hash: `sha256-breach-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      },
      ...prev
    ]);
  };

  // Mise à jour de l'identité de l'entreprise
  const handleSaveOrgIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Organization = {
      ...currentOrg,
      name: orgEditForm.name,
      type: orgEditForm.type,
      registrationNumber: orgEditForm.registrationNumber,
      headquarters: orgEditForm.headquarters,
      email: orgEditForm.email,
      phone: orgEditForm.phone,
      managerName: orgEditForm.managerName,
      managerRole: orgEditForm.managerRole,
      description: orgEditForm.description,
      logo: orgEditForm.logoUrl || undefined,
    };

    setCurrentOrg(updated);
    setOrganizations(prev => prev.map(o => o.id === updated.id ? updated : o));
    setShowOrgIdentityModal(false);

    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Mise à jour Identité Entreprise',
        category: 'admin',
        details: `Modification de la dénomination et identifiants légaux de ${updated.name}`,
        ip: '127.0.0.1',
        hash: `sha256-org-${Date.now()}`
      },
      ...prev
    ]);
  };

  // Création d'une nouvelle organisation
  const handleCreateOrganization = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgForm.name.trim()) return;

    const newOrgId = newId('org');
    const newOrg: Organization = {
      id: newOrgId,
      name: newOrgForm.name.trim(),
      type: newOrgForm.type,
      registrationNumber: newOrgForm.registrationNumber.trim(),
      headquarters: newOrgForm.headquarters.trim(),
      email: newOrgForm.email.trim(),
      phone: newOrgForm.phone.trim(),
      managerName: newOrgForm.managerName.trim(),
      managerRole: 'Directeur Général',
      hasDepartements: true,
      hasDirections: true,
      hasDivisions: true,
      hasServices: true,
      description: newOrgForm.description.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    setOrganizations(prev => [...prev, newOrg]);
    setCurrentOrg(newOrg);

    // Initialiser le système de paie pour cette nouvelle organisation
    setPayrollConfigs(prev => ({
      ...prev,
      [newOrgId]: createStandardPayrollSystem(newOrgId, newOrg.name)
    }));

    setShowNewOrgModal(false);
    setNewOrgForm({
      name: '',
      type: 'entreprise',
      registrationNumber: 'RCCM/24-B-',
      headquarters: 'Kinshasa, RD CONGO',
      email: 'direction@entreprise.cd',
      phone: '+243 99 000 0000',
      managerName: 'Directeur Général',
      description: 'Nouvelle entité organisationnelle.',
    });

    setLogs(prev => [
      {
        id: newId('log'),
        timestamp: nowStamp(),
        userName: currentUser.name,
        userRole: currentUser.roleTitle,
        action: 'Création Organisation',
        category: 'admin',
        details: `Création de l'entité juridique ${newOrg.name} (${newOrg.registrationNumber})`,
        ip: '127.0.0.1',
        hash: `sha256-neworg-${Date.now()}`
      },
      ...prev
    ]);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeSnippet(id);
    setTimeout(() => setCopiedCodeSnippet(null), 2500);
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
          setOrgEditForm({
            name: org.name,
            type: org.type,
            registrationNumber: org.registrationNumber || 'RCCM/20-A-01120',
            headquarters: org.headquarters || 'Kinshasa - RD CONGO',
            email: org.email || 'contact@rhemabusiness.com',
            phone: org.phone || '+243 81 279 1228',
            managerName: org.managerName || 'Junior Monya',
            managerRole: org.managerRole || 'Directeur Général',
            description: org.description || '',
            logoUrl: org.logo || '',
          });
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
          setOrgEditForm({
            name: currentOrg.name,
            type: currentOrg.type,
            registrationNumber: currentOrg.registrationNumber || 'RCCM/20-A-01120',
            headquarters: currentOrg.headquarters || 'Kinshasa - RD CONGO',
            email: currentOrg.email || 'contact@rhemabusiness.com',
            phone: currentOrg.phone || '+243 81 279 1228',
            managerName: currentOrg.managerName || 'Junior Monya',
            managerRole: currentOrg.managerRole || 'Directeur Général',
            description: currentOrg.description || '',
            logoUrl: currentOrg.logo || '',
          });
          setShowOrgIdentityModal(true);
        }}
        onOpenNewAccount={currentUser.role === 'dg' ? () => setShowOnboardingWizard(true) : undefined}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenBackup={() => setShowBackupModal(true)}
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
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
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
                setOrgEditForm({
                  name: currentOrg.name,
                  type: currentOrg.type,
                  registrationNumber: currentOrg.registrationNumber || 'RCCM/20-A-01120',
                  headquarters: currentOrg.headquarters || 'Kinshasa - RD CONGO',
                  email: currentOrg.email || 'contact@rhemabusiness.com',
                  phone: currentOrg.phone || '+243 81 279 1228',
                  managerName: currentOrg.managerName || 'Junior Monya',
                  managerRole: currentOrg.managerRole || 'Directeur Général',
                  description: currentOrg.description || '',
                  logoUrl: currentOrg.logo || '',
                });
                setShowOrgIdentityModal(true);
              }}
              onAddEntity={newEnt => {
                const entWithId = { ...newEnt, id: newId('ent') };
                setEntities(prev => [...prev, entWithId]);
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action: 'Création Entité Hiérarchique',
                    category: 'hierarchy',
                    details: `Ajout de l'entité ${entWithId.name} (${entWithId.level.toUpperCase()})`,
                    ip: '127.0.0.1',
                    hash: `sha256-ent-${Date.now()}`
                  },
                  ...prev
                ]);
              }}
              onDeleteEntity={id => {
                const target = entities.find(e => e.id === id);
                setEntities(prev => prev.filter(e => e.id !== id));
                if (target) {
                  setLogs(prev => [
                    {
                      id: newId('log'),
                      timestamp: nowStamp(),
                      userName: currentUser.name,
                      userRole: currentUser.roleTitle,
                      action: 'Suppression Entité',
                      category: 'hierarchy',
                      details: `Suppression de l'entité ${target.name} (${target.code})`,
                      ip: '127.0.0.1',
                      hash: `sha256-del-ent-${Date.now()}`
                    },
                    ...prev
                  ]);
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
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action: act,
                    category: cat as any,
                    details: det,
                    ip: '192.168.1.100',
                    hash: `sha256-inv-log-${Date.now()}`
                  },
                  ...prev
                ]);
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
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action: 'Publication Document',
                    category: 'document',
                    details: `Publication du document certifié ${docWithId.title} (${docWithId.referenceNumber})`,
                    ip: '127.0.0.1',
                    hash: `sha256-doc-${Date.now()}`
                  },
                  ...prev
                ]);
              }}
              onUpdateDocument={(docId, updates) => {
                setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updates } : d));
              }}
              onDeleteDocument={(docId) => {
                setDocuments(prev => prev.filter(d => d.id !== docId));
              }}
              onLogAction={(action, details, category) => {
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action,
                    category: category as any,
                    details,
                    ip: '127.0.0.1',
                    hash: `sha256-doc-${Date.now()}`
                  },
                  ...prev
                ]);
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
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action: 'Création Tâche Workflow',
                    category: 'task',
                    details: `Ouverture du jalon/tâche ${createdTask.title} (${createdTask.priority})`,
                    ip: '127.0.0.1',
                    hash: `sha256-task-${Date.now()}`
                  },
                  ...prev
                ]);
              }}
              onUpdateDocument={(docId, updates) => {
                setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...updates } : d));
              }}
              onLogAction={(action, details, category) => {
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action,
                    category: category as any,
                    details,
                    ip: '127.0.0.1',
                    hash: `sha256-wf-${Date.now()}`
                  },
                  ...prev
                ]);
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
                  setLogs(prev => [
                    {
                      id: newId('log'),
                      timestamp: nowStamp(),
                      userName: currentUser.name,
                      userRole: currentUser.roleTitle,
                      action,
                      category: category as any,
                      details,
                      ip: '127.0.0.1',
                      hash: `sha256-logist-${Date.now()}`
                    },
                    ...prev
                  ]);
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
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action,
                    category: category as any,
                    details,
                    ip: '127.0.0.1',
                    hash: `sha256-pay-${Date.now()}`
                  },
                  ...prev
                ]);
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
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action,
                    category: category as any,
                    details,
                    ip: '127.0.0.1',
                    hash: `sha256-import-${Date.now()}`
                  },
                  ...prev
                ]);
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
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action,
                    category: category as any,
                    details,
                    ip: '127.0.0.1',
                    hash: `sha256-att-${Date.now()}`
                  },
                  ...prev
                ]);
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
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action: 'Verrouillage Forcé Utilisateur',
                    category: 'security',
                    details: `Compte collaborateur ${target?.name || id} verrouillé manuellement par la DG`,
                    ip: '127.0.0.1',
                    hash: `sha256-lock-${Date.now()}`
                  },
                  ...prev
                ]);
              }}
              onUnlockUser={id => {
                setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'actif', failedAccessAttempts: 0 } : u));
                const target = users.find(u => u.id === id);
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action: 'Déverrouillage Utilisateur',
                    category: 'security',
                    details: `Compte collaborateur ${target?.name || id} réactivé et compteurs remis à zéro`,
                    ip: '127.0.0.1',
                    hash: `sha256-unlock-${Date.now()}`
                  },
                  ...prev
                ]);
              }}
              onResolveAlert={id => {
                setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolue' } : a));
                setLogs(prev => [
                  {
                    id: newId('log'),
                    timestamp: nowStamp(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action: 'Résolution Alerte Sécurité',
                    category: 'security',
                    details: `Alerte #${id} marquée résolue après revue de conformité`,
                    ip: '127.0.0.1',
                    hash: `sha256-res-${Date.now()}`
                  },
                  ...prev
                ]);
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
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <FileCode2 className="w-5 h-5 text-indigo-400" />
                      Architecture Backend Laravel 11/12 & Eloquent
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Code complet prêt à l'emploi : modèles Eloquent, relations, politiques de sécurité (Policies) et migrations SQL PostgreSQL.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" /> PHP 8.3+ / Laravel 11
                  </div>
                </div>

                <div className="mt-6 space-y-6">
                  {/* Commande artisan */}
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                      <span>1. Génération des Modèles & Migrations :</span>
                      <button
                        onClick={() => copyToClipboard('php artisan make:model HierarchicalEntity -mcr\nphp artisan make:model Organization -mcr\nphp artisan make:model DocumentItem -mcr\nphp artisan make:model PayrollRun -mcr\nphp artisan make:policy HierarchicalAccessPolicy', 'artisan')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        {copiedCodeSnippet === 'artisan' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCodeSnippet === 'artisan' ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                    <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
{`php artisan make:model HierarchicalEntity -mcr
php artisan make:model Organization -mcr
php artisan make:model DocumentItem -mcr
php artisan make:model PayrollRun -mcr
php artisan make:policy HierarchicalAccessPolicy`}
                    </pre>
                  </div>

                  {/* Modèle HierarchicalEntity */}
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                      <span>2. Modèle Eloquent Récursif (HierarchicalEntity.php) :</span>
                      <button
                        onClick={() => copyToClipboard(`namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;

class HierarchicalEntity extends Model
{
    protected $fillable = [
        'organization_id',
        'parent_id',
        'name',
        'code',
        'level', // departement, direction, division, service
        'manager_id',
        'agent_count'
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(HierarchicalEntity::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(HierarchicalEntity::class, 'parent_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}`, 'model')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        {copiedCodeSnippet === 'model' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCodeSnippet === 'model' ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                    <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;

class HierarchicalEntity extends Model
{
    protected $fillable = [
        'organization_id',
        'parent_id',
        'name',
        'code',
        'level', // departement, direction, division, service
        'manager_id',
        'agent_count'
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(HierarchicalEntity::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(HierarchicalEntity::class, 'parent_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}`}
                    </pre>
                  </div>

                  {/* Policy RBAC */}
                  <div>
                    <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
                      <span>3. Policy de Cloisonnement Strict (DocumentPolicy.php) :</span>
                      <button
                        onClick={() => copyToClipboard(`namespace App\\Policies;

use App\\Models\\User;
use App\\Models\\DocumentItem;

class DocumentPolicy
{
    /**
     * Le DG a une vision transversale intégrale.
     * Pour les autres, accès uniquement si le document appartient à leur périmètre hiérarchique.
     */
    public function view(User $user, DocumentItem $document): bool
    {
        if ($user->role === 'dg') {
            return true;
        }

        // Bulletin de paie strictement confidentiel
        if ($document->is_confidential_payslip) {
            return $document->target_user_id === $user->id || $user->direction_id === 'dir-rh';
        }

        // Cloisonnement de service
        return $user->service_id === $document->target_entity_id 
            || $user->direction_id === $document->target_entity_id
            || $user->departement_id === $document->target_entity_id;
    }
}`, 'policy')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        {copiedCodeSnippet === 'policy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCodeSnippet === 'policy' ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                    <pre className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`namespace App\\Policies;

use App\\Models\\User;
use App\\Models\\DocumentItem;

class DocumentPolicy
{
    public function view(User $user, DocumentItem $document): bool
    {
        if ($user->role === 'dg') {
            return true;
        }

        if ($document->is_confidential_payslip) {
            return $document->target_user_id === $user->id || $user->direction_id === 'dir-rh';
        }

        return $user->service_id === $document->target_entity_id 
            || $user->direction_id === $document->target_entity_id
            || $user->departement_id === $document->target_entity_id;
    }
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1 : IDENTITÉ & LOGO DE L'ORGANISATION (RÉSERVÉ AU DG)               */}
      {/* ========================================================================= */}
      {showOrgIdentityModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Identité & Logo Officiels (DG)</h3>
                  <p className="text-xs text-slate-400">Paramétrage scellé pour les fiches officielles, devis et en-têtes</p>
                </div>
              </div>
              <button
                onClick={() => setShowOrgIdentityModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrgIdentity} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Raison Sociale / Nom Officiel *</label>
                  <input
                    type="text"
                    required
                    value={orgEditForm.name}
                    onChange={e => setOrgEditForm({ ...orgEditForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Type d'Organisation</label>
                  <select
                    value={orgEditForm.type}
                    onChange={e => setOrgEditForm({ ...orgEditForm, type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="entreprise">Entreprise Commerciale (SA / SARL)</option>
                    <option value="etablissement">Établissement Public</option>
                    <option value="ong">ONG / Association</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">N° RCCM / Enregistrement *</label>
                  <input
                    type="text"
                    required
                    value={orgEditForm.registrationNumber}
                    onChange={e => setOrgEditForm({ ...orgEditForm, registrationNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Siège Social & Adresse Légale</label>
                  <input
                    type="text"
                    value={orgEditForm.headquarters}
                    onChange={e => setOrgEditForm({ ...orgEditForm, headquarters: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Email de Contact Officiel</label>
                  <input
                    type="email"
                    value={orgEditForm.email}
                    onChange={e => setOrgEditForm({ ...orgEditForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Téléphone Opérationnel</label>
                  <input
                    type="text"
                    value={orgEditForm.phone}
                    onChange={e => setOrgEditForm({ ...orgEditForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Nom du Dirigeant / DG</label>
                  <input
                    type="text"
                    value={orgEditForm.managerName}
                    onChange={e => setOrgEditForm({ ...orgEditForm, managerName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">URL du Logo (ou vide pour badge RB)</label>
                  <input
                    type="url"
                    placeholder="https://.../logo.png"
                    value={orgEditForm.logoUrl}
                    onChange={e => setOrgEditForm({ ...orgEditForm, logoUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Description / Objet Social</label>
                  <textarea
                    rows={2}
                    value={orgEditForm.description}
                    onChange={e => setOrgEditForm({ ...orgEditForm, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOrgIdentityModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer l'Identité</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2 : CRÉER UNE NOUVELLE ORGANISATION                                 */}
      {/* ========================================================================= */}
      {showNewOrgModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Créer une Nouvelle Organisation</h3>
              </div>
              <button
                onClick={() => setShowNewOrgModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrganization} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nom de l'Organisation / Filiale *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: RHEMA KATANGA SARL"
                  value={newOrgForm.name}
                  onChange={e => setNewOrgForm({ ...newOrgForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">N° RCCM / Enregistrement</label>
                  <input
                    type="text"
                    required
                    value={newOrgForm.registrationNumber}
                    onChange={e => setNewOrgForm({ ...newOrgForm, registrationNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Type</label>
                  <select
                    value={newOrgForm.type}
                    onChange={e => setNewOrgForm({ ...newOrgForm, type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="entreprise">Entreprise</option>
                    <option value="etablissement">Établissement Public</option>
                    <option value="ong">ONG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Siège Administratif</label>
                <input
                  type="text"
                  value={newOrgForm.headquarters}
                  onChange={e => setNewOrgForm({ ...newOrgForm, headquarters: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Email</label>
                  <input
                    type="email"
                    value={newOrgForm.email}
                    onChange={e => setNewOrgForm({ ...newOrgForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={newOrgForm.phone}
                    onChange={e => setNewOrgForm({ ...newOrgForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-[11px] leading-relaxed">
                Le système de paie conforme RDC (CNSS 5%/13%, INPP 3%, ONEM 0.2%, IPR progressif en devises USD et CDF) sera automatiquement configuré pour cette entité.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewOrgModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer & Basculer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3 : GUIDE DE RÉGLEMENTATION ET SÉCURITÉ CONFORME RDC                */}
      {/* ========================================================================= */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Guide des Normes & Logique Hiérarchique RHEMA BUSINESS</h3>
                  <p className="text-xs text-slate-400">Documentation technique et conformité au Code du Travail de la RD CONGO</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Onglets d'aide */}
            <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
              {[
                { id: 'rdc_payroll', label: 'Paie & Fiscalité RDC', icon: Scale },
                { id: 'rbac', label: 'Cloisonnement RBAC', icon: Layers },
                { id: 'security', label: 'Anti-Intrusion & Récidive', icon: ShieldAlert },
                { id: 'workflows', label: 'Workflows & Hash SHA-256', icon: FileCheck2 },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setHelpActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      helpActiveTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Contenu onglet */}
            <div className="text-xs leading-relaxed text-slate-300 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {helpActiveTab === 'rdc_payroll' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                      <Scale className="w-4 h-4" /> Devises Légales & Taux de Change
                    </h4>
                    <p>
                      Conformément à la réglementation de la Banque Centrale du Congo (BCC), les calculs salariaux s'effectuent strictement en <strong>USD ($)</strong> ou en <strong>Francs Congolais (CDF)</strong> au taux de référence officiel (ex: 2 850 CDF = 1 USD).
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-indigo-400">Cotisations Sociales Salarié & Employeur :</h4>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                      <li><strong>CNSS Salariale (5%) :</strong> Branche des pensions de vieillesse et retraite légale.</li>
                      <li><strong>CNSS Patronale (13%) :</strong> 5% pensions + 4% risques professionnels + 4% prestations familiales.</li>
                      <li><strong>INPP Patronal (3%) :</strong> Institut National de Préparation Professionnelle (formation continue).</li>
                      <li><strong>ONEM Patronal (0.2%) :</strong> Office National de l'Emploi pour la régulation du marché du travail.</li>
                    </ul>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-amber-400">Barème Progressif IPR (Impôt Professionnel sur les Rémunérations) :</h4>
                    <p className="text-slate-400">Tranches d'imposition sur le salaire net imposable avec abattement par charge de famille (enfants) :</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">0 à 200 $ : <strong>3%</strong></div>
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">200 à 600 $ : <strong>10%</strong></div>
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">600 à 1 500 $ : <strong>20%</strong></div>
                      <div className="bg-slate-900 p-2 rounded border border-slate-800">1 500 à 3 000 $ : <strong>30%</strong></div>
                      <div className="bg-slate-900 p-2 rounded border border-slate-800 col-span-2 sm:col-span-1">&gt; 3 000 $ : <strong>40%</strong></div>
                    </div>
                  </div>
                </div>
              )}

              {helpActiveTab === 'rbac' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-purple-400">1. Direction Générale (DG / PDG)</h4>
                    <p>Habilitation globale sans aucune restriction sur l'ensemble des départements, bilans comptables, fiches de paie et alertes de sécurité.</p>
                  </div>
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-blue-400">2. Chefs de Départements & Directeurs</h4>
                    <p>Administration déconcentrée : ils ont autorité exclusive sur leurs divisions et services subordonnés (ex: le DAF ne peut pas modifier les ordres techniques du DOP).</p>
                  </div>
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-cyan-400">3. Chefs de Services & Agents Opérationnels</h4>
                    <p>Accès strictement confiné à leur cellule de rattachement. Les documents des autres services apparaissent floutés ou bloqués.</p>
                  </div>
                </div>
              )}

              {helpActiveTab === 'security' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-red-950/20 rounded-xl border border-red-500/30 space-y-2 text-red-200">
                    <h4 className="font-bold text-red-400 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" /> Politique Anti-Intrusion & Blocage Récidive
                    </h4>
                    <p>
                      Dès qu'un collaborateur essaie d'ouvrir un document hors de son périmètre d'habilitation (par exemple un agent réseau essayant de lire les journaux de paie DAF) :
                    </p>
                    <ol className="list-decimal pl-5 space-y-1 text-slate-300">
                      <li><strong>1ère tentative :</strong> Émission instantanée d'une Alerte de Sécurité au tableau de bord DG et horodatage de l'adresse IP.</li>
                      <li><strong>2ème tentative (Récidive) :</strong> Verrouillage immédiat du compte de l'opérateur, suspension des sessions et convocation disciplinaire programmée.</li>
                    </ol>
                  </div>
                </div>
              )}

              {helpActiveTab === 'workflows' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <h4 className="font-bold text-cyan-400">Traçabilité Cryptographique SHA-256</h4>
                    <p>
                      Chaque validation de tâche, visa de dépense ou approbation de bon de commande génère un sceau d'intégrité non falsifiable calculé à partir de la clé publique de l'agent signataire, de l'adresse IP et de l'horodatage précis.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Fermer le Guide
              </button>
            </div>
          </div>
        </div>
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
            setLogs(prev => [
              {
                id: newId('log'),
                timestamp: nowStamp(),
                userName: currentUser.name,
                userRole: currentUser.roleTitle,
                action: act,
                category: cat as any,
                details: det,
                ip: '192.168.1.100',
                hash: `sha256-inv-log-${Date.now()}`
              },
              ...prev
            ]);
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
            setLogs(prev => [
              {
                id: newId('log'),
                timestamp: nowStamp(),
                userName: currentUser.name,
                userRole: currentUser.roleTitle,
                action: act,
                category: cat as any,
                details: det,
                ip: '192.168.1.100',
                hash: `sha256-conn-log-${Date.now()}`
              },
              ...prev
            ]);
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
            setLogs(prev => [
              {
                id: newId('log'),
                timestamp: nowStamp(),
                userName: currentUser.name,
                userRole: currentUser.roleTitle,
                action: act,
                category: cat as any,
                details: det,
                ip: '192.168.1.100',
                hash: `sha256-mgr-log-${Date.now()}`
              },
              ...prev
            ]);
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

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
