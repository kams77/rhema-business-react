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
  initialTasks 
} from './data/initialData';
import { 
  createStandardPayrollSystem, 
  initialPayrollConfigs 
} from './data/standardPayroll';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { EmployeeWorkspaceView } from './components/EmployeeWorkspaceView';
import { HierarchyView } from './components/HierarchyView';
import { DocumentsView } from './components/DocumentsView';
import { WorkflowsView } from './components/WorkflowsView';
import { PayrollSystemView } from './components/PayrollSystemView';
import { SecurityView } from './components/SecurityView';
import { AgentCrudView } from './components/AgentCrudView';
import { AuditView } from './components/AuditView';

type ActiveTab = 'workspace' | 'hierarchy' | 'documents' | 'workflows' | 'payroll' | 'security' | 'agents' | 'audit' | 'laravel';

export default function App() {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);
  const [currentOrg, setCurrentOrg] = useState<Organization>(initialOrganizations[0]);
  const [entities, setEntities] = useState<HierarchicalEntity[]>(initialEntities);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [currentUser, setCurrentUser] = useState<User>(initialUsers[0]);
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([
    {
      id: 'sec-1',
      timestamp: '08:42:15',
      userId: 'usr-agent-tech',
      userName: 'M. Fabrice Mukendi',
      userRole: 'chef_service',
      userEntityName: 'Service Déploiement VSAT',
      targetEntityId: 'dept-daf',
      targetEntityName: 'Département Administration & Finances (DAF)',
      attemptCount: 2,
      status: 'alerte_emise',
      severity: 'haute',
      ipAddress: '192.168.1.108',
      reason: 'Tentative d\'accès direct aux dossiers comptables confidentiels.',
    },
    {
      id: 'sec-2',
      timestamp: '07:15:30',
      userId: 'usr-guest',
      userName: 'Agent Exécutant Kolwezi',
      userRole: 'agent',
      userEntityName: 'Service Réseau',
      targetEntityId: 'dir-rh',
      targetEntityName: 'Direction des Ressources Humaines',
      attemptCount: 1,
      status: 'alerte_emise',
      severity: 'moyenne',
      ipAddress: '192.168.1.115',
      reason: 'Recherche de fiches de paie hors périmètre habilité.',
    }
  ]);
  const [logs, setLogs] = useState<AuditLog[]>([
    {
      id: 'log-1',
      timestamp: '08:00:00',
      userName: 'Dr. Amadou Diallo',
      userRole: 'Président Directeur Général (PDG / DG)',
      action: 'Connexion certifiée',
      category: 'auth',
      details: 'Session active sur terminal local RHEMA BUSINESS.',
      ip: '127.0.0.1',
      hash: 'sha256-rb-init-89210'
    }
  ]);

  // État des configurations de Paie & RH RDC par organisation
  const [payrollConfigs, setPayrollConfigs] = useState<Record<string, PayrollSystemConfig>>(
    initialPayrollConfigs || {
      'org-1': createStandardPayrollSystem('org-1', 'RHEMA BUSINESS')
    }
  );

  const [currentTab, setCurrentTab] = useState<ActiveTab>('workspace');

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
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        organizations={organizations}
        currentOrg={currentOrg}
        onSelectOrg={setCurrentOrg}
        users={users}
        currentUser={currentUser}
        onSelectUser={setCurrentUser}
        securityAlerts={alerts}
        onOpenSecurity={() => setCurrentTab('security')}
        onOpenWorkspace={() => setCurrentTab('workspace')}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          currentUser={currentUser}
          unreadAlertsCount={alerts.length}
        />

        <main className="flex-1 p-6 overflow-y-auto">
          {currentTab === 'workspace' && (
            <EmployeeWorkspaceView
              currentUser={currentUser}
              currentOrg={currentOrg}
              entities={entities}
              users={users}
              tasks={tasks}
              documents={documents}
            />
          )}

          {currentTab === 'hierarchy' && (
            <HierarchyView
              organization={currentOrg}
              entities={entities}
              currentUser={currentUser}
              users={users}
              onAddEntity={newEnt => setEntities(prev => [...prev, { ...newEnt, id: `ent-${Date.now()}` }])}
              onDeleteEntity={id => setEntities(prev => prev.filter(e => e.id !== id))}
            />
          )}

          {currentTab === 'documents' && (
            <DocumentsView
              documents={documents}
              organization={currentOrg}
              currentUser={currentUser}
              onAddDocument={newDoc => setDocuments(prev => [{ ...newDoc, id: `doc-${Date.now()}` }, ...prev])}
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
              onAddTask={newTask => setTasks(prev => [{ ...newTask, id: `task-${Date.now()}` }, ...prev])}
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
                    hash: `sha256-${Date.now()}`
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
              onLockUser={id => setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'verrouille' } : u))}
              onUnlockUser={id => setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'actif' } : u))}
              onResolveAlert={id => setAlerts(prev => prev.filter(a => a.id !== id))}
              onTriggerTestBreach={() => {}}
            />
          )}

          {currentTab === 'agents' && (
            <AgentCrudView
              users={users}
              currentUser={currentUser}
              entities={entities}
              onCreateUser={newUser => setUsers(prev => [...prev, { ...newUser, id: `usr-${Date.now()}`, failedAccessAttempts: 0 }])}
              onRevokeUser={id => setUsers(prev => prev.filter(u => u.id !== id))}
              onToggleUserStatus={id => setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'actif' ? 'suspendu' : 'actif' } : u))}
            />
          )}

          {currentTab === 'audit' && (
            <AuditView logs={logs} />
          )}

          {currentTab === 'laravel' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-4xl mx-auto space-y-4 shadow-xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-emerald-400">✓</span> Architecture Laravel 11/12 & Eloquent
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ce module contient l'arborescence des modèles Eloquent (<code>User</code>, <code>Organization</code>, <code>HierarchicalEntity</code>, <code>DocumentItem</code>, <code>TaskItem</code>) et les Policies de sécurité RBAC.
              </p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400">
                php artisan make:model HierarchicalEntity -mcr
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}