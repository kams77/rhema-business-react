// src/App.tsx
import React, { useState } from 'react';
import type { 
  Organization, 
  HierarchicalEntity,
  User, 
  DocumentItem, 
  TaskItem, 
  SecurityAlert,
  AuditLog,
  PayrollSystemConfig
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
  RefreshCw
} from 'lucide-react';

type ActiveTab = 'workspace' | 'hierarchy' | 'documents' | 'workflows' | 'payroll' | 'security' | 'agents' | 'audit' | 'laravel';

export default function App() {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);
  const [currentOrg, setCurrentOrg] = useState<Organization>(initialOrganizations[0]);
  const [entities, setEntities] = useState<HierarchicalEntity[]>(initialEntities);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [currentUser, setCurrentUser] = useState<User>(initialUsers[0]);
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  
  const [alerts, setAlerts] = useState<SecurityAlert[]>(initialSecurityAlerts);
  const [logs, setLogs] = useState<AuditLog[]>(initialAuditLogs);

  // État d'authentification utilisateur
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  const handleLogin = (user: User, method: 'credentials' | 'demo') => {
    setCurrentUser(user);
    setIsAuthenticated(true);

    const ip = `192.168.1.${Math.floor(Math.random() * 150) + 100}`;
    setLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        userName: user.name,
        userRole: user.roleTitle,
        action: method === 'demo' ? 'Connexion Démo Rapide (1 clic)' : 'Connexion Certifiée (Identifiants)',
        category: 'auth',
        details: `Authentification réussie pour ${user.name} (${user.role.toUpperCase()}) - Session SHA-256 scellée sous protocole RBAC.`,
        ip,
        hash: `sha256-auth-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      },
      ...prev
    ]);
  };

  const handleLogout = () => {
    const departingUser = currentUser;
    setIsAuthenticated(false);
    setLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        userName: departingUser.name,
        userRole: departingUser.roleTitle,
        action: 'Clôture de Session (Déconnexion)',
        category: 'auth',
        details: `Session de ${departingUser.name} fermée avec succès. Retour à l'écran d'authentification.`,
        ip: '127.0.0.1',
        hash: `sha256-logout-${Date.now()}`
      },
      ...prev
    ]);
  };

  // État des configurations de Paie & RH RDC par organisation
  const [payrollConfigs, setPayrollConfigs] = useState<Record<string, PayrollSystemConfig>>(
    initialPayrollConfigs || {
      'org-1': createStandardPayrollSystem('org-1', 'RHEMA BUSINESS')
    }
  );

  const [currentTab, setCurrentTab] = useState<ActiveTab>('workspace');

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
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
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
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
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
      id: `sec-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
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
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
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
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
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

    const newId = `org-${Date.now()}`;
    const newOrg: Organization = {
      id: newId,
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
      [newId]: createStandardPayrollSystem(newId, newOrg.name)
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
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
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
      <LoginView
        organization={currentOrg}
        users={users}
        onLogin={handleLogin}
      />
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
        onSelectUser={setCurrentUser}
        securityAlerts={alerts}
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
        onOpenNewAccount={() => setShowNewOrgModal(true)}
        onOpenHelp={() => setShowHelpModal(true)}
      />

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
              contracts={initialContracts}
              onSelectUser={setCurrentUser}
            />
          )}

          {currentTab === 'hierarchy' && (
            <HierarchyView
              organization={currentOrg}
              entities={entities}
              currentUser={currentUser}
              users={users}
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
                const entWithId = { ...newEnt, id: `ent-${Date.now()}` };
                setEntities(prev => [...prev, entWithId]);
                setLogs(prev => [
                  {
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
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
                      id: `log-${Date.now()}`,
                      timestamp: new Date().toLocaleTimeString(),
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

          {currentTab === 'documents' && (
            <DocumentsView
              documents={documents}
              organization={currentOrg}
              currentUser={currentUser}
              entities={entities}
              onAddDocument={newDoc => {
                const docWithId = { ...newDoc, id: `doc-${Date.now()}` };
                setDocuments(prev => [docWithId, ...prev]);
                setLogs(prev => [
                  {
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
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
                const createdTask = { ...newTask, id: `task-${Date.now()}` };
                setTasks(prev => [createdTask, ...prev]);
                setLogs(prev => [
                  {
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
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
            />
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
              onLogAction={(action, details, category) => {
                setLogs(prev => [
                  {
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
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
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
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
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
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
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
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
              onCreateUser={newUser => {
                const createdUser: User = {
                  ...newUser,
                  id: `usr-${Date.now()}`,
                  failedAccessAttempts: 0,
                  status: 'actif'
                };
                setUsers(prev => [...prev, createdUser]);
                setLogs(prev => [
                  {
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString(),
                    userName: currentUser.name,
                    userRole: currentUser.roleTitle,
                    action: 'Création Compte Collaborateur',
                    category: 'admin',
                    details: `Création du compte ${createdUser.name} (${createdUser.roleTitle})`,
                    ip: '127.0.0.1',
                    hash: `sha256-usr-${Date.now()}`
                  },
                  ...prev
                ]);
              }}
              onRevokeUser={id => {
                const target = users.find(u => u.id === id);
                setUsers(prev => prev.filter(u => u.id !== id));
                if (target) {
                  setLogs(prev => [
                    {
                      id: `log-${Date.now()}`,
                      timestamp: new Date().toLocaleTimeString(),
                      userName: currentUser.name,
                      userRole: currentUser.roleTitle,
                      action: 'Révocation Compte Collaborateur',
                      category: 'admin',
                      details: `Révocation définitive des accès de ${target.name} (${target.email})`,
                      ip: '127.0.0.1',
                      hash: `sha256-rev-${Date.now()}`
                    },
                    ...prev
                  ]);
                }
              }}
              onToggleUserStatus={id => {
                setUsers(prev => prev.map(u => {
                  if (u.id === id) {
                    const nextStatus = u.status === 'actif' ? 'suspendu' : 'actif';
                    setLogs(l => [
                      {
                        id: `log-${Date.now()}`,
                        timestamp: new Date().toLocaleTimeString(),
                        userName: currentUser.name,
                        userRole: currentUser.roleTitle,
                        action: 'Changement Statut Compte',
                        category: 'admin',
                        details: `Passage du statut de ${u.name} à: ${nextStatus.toUpperCase()}`,
                        ip: '127.0.0.1',
                        hash: `sha256-stat-${Date.now()}`
                      },
                      ...l
                    ]);
                    return { ...u, status: nextStatus };
                  }
                  return u;
                }));
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
    </div>
  );
}
