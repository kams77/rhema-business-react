// src/components/EmployeeWorkspaceView.tsx — Espace employé.
// Un AGENT exécutant ne voit que ce qui le concerne : ses tâches, ses documents et demandes,
// les documents validés de son service. Les tableaux de bord RH / effectifs sont réservés aux responsables.
import React, { useState, useEffect, useMemo } from 'react';
import type { User, Organization, HierarchicalEntity, TaskItem, DocumentItem, EmployeeContract } from '../types';
import {
  CheckCircle2,
  Clock,
  Coffee,
  LogOut,
  Plus,
  FileText,
  MessageSquare,
  Shield,
  Calendar,
  Send,
  AlertTriangle,
  Briefcase,
  ShieldCheck,
  Eye,
  Check,
  BarChart3,
  Truck,
  KeyRound,
  TrendingUp,
  Sun,
  Stamp,
  Ban,
  RotateCcw,
  Info,
} from 'lucide-react';
import { WorkspaceDashboard } from './WorkspaceDashboard';
import { RhemaOfficialDocument } from './RhemaOfficialDocument';
import { DepartmentTasksProgressChart } from './DepartmentTasksProgressChart';
import { TaskCard } from './tasks/TaskCard';
import { TaskCreateModal } from './tasks/TaskCreateModal';
import { ApprovalChips } from './workflow/ApprovalTimeline';
import { initialContracts } from '../data/initialData';
import { canAccessLogistics, canUserViewDocument, isLogisticsManager } from '../utils/rbac';
import { isEntityManager } from '../utils/invitationUtils';
import type { ActiveTab } from './Sidebar';
import {
  ROLE_LABELS,
  anchorEntity,
  canActOnDocument,
  canSeeTask,
  canValidateTaskNow,
  currentStep,
  directManager,
  documentType,
  isTaskLate,
  taskRoleOf,
  waitingFor,
} from '../lib/workflow';
import type { TaskAction } from '../lib/workflow';

type WorkspaceTab = 'day' | 'tasks' | 'documents' | 'attendance' | 'transmissions' | 'profile' | 'dashboard' | 'task_analytics';

interface EmployeeWorkspaceViewProps {
  currentUser: User;
  currentOrg?: Organization;
  entities?: HierarchicalEntity[];
  users?: User[];
  tasks?: TaskItem[];
  documents?: DocumentItem[];
  contracts?: EmployeeContract[];
  onTaskAction?: (taskId: string, action: TaskAction) => void;
  onCreateTask?: (task: TaskItem) => void;
  onSubmitLeaveRequest?: (req: { type: string; start: string; end: string; reason: string }) => void;
  onOpenTab?: (tab: ActiveTab) => void;
  onSelectUser?: (user: User) => void;
  onOpenLogistics?: () => void;
  onOpenConnectKey?: () => void;
  onOpenInviteAgent?: () => void;
  onOpenInvitationsManager?: () => void;
}

const DOC_STATUS: Record<DocumentItem['status'], { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  en_revue: { label: 'En circuit', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  approuve: { label: 'Approuvé', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  signe: { label: 'Validé & signé', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  rejete: { label: 'Rejeté', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
};

const FALLBACK_ORG: Organization = {
  id: 'org-1',
  name: 'RHEMA BUSINESS RDC',
  type: 'entreprise',
  registrationNumber: '',
  headquarters: 'Kinshasa - RD CONGO',
  email: 'contact@rhemabusiness.com',
  phone: '+243 81 279 1228',
  description: 'RHEMA BUSINESS RDC',
  managerName: '',
  hasDepartements: true,
  hasDirections: true,
  hasDivisions: true,
  hasServices: true,
  createdAt: '2020-01-01',
};

/** Habilitations réelles selon le rôle (fiche de poste). */
function habilitations(user: User, logistics: boolean): { title: string; items: { label: string; value: string }[] }[] {
  const role = user.role;
  const manager = role !== 'agent';
  const scope = {
    dg: "Toute l'entreprise",
    chef_departement: 'Votre département et ses entités',
    directeur: 'Votre direction, ses divisions et services',
    chef_division: 'Votre division et ses services',
    chef_service: 'Votre service',
    agent: 'Votre service (exécution)',
  }[role];
  return [
    {
      title: 'Tâches',
      items: [
        { label: 'Exécuter les tâches qui vous sont assignées', value: 'Oui' },
        { label: 'Créer et assigner des tâches', value: manager ? `Oui — ${scope}` : 'Tâches personnelles uniquement' },
        { label: 'Valider les tâches', value: manager ? 'Oui, à votre tour dans le circuit' : 'Non' },
      ],
    },
    {
      title: 'Documents',
      items: [
        { label: 'Publier', value: manager ? 'Tous les types de votre niveau' : 'Rapports, PV, demandes (achat, frais, congé), bons logistiques' },
        { label: 'Viser / signer', value: manager ? `Les documents de votre périmètre (${scope}), à votre tour` : (user.canApproveServiceDocuments ? 'Visa délégué pour votre service (pas la signature finale)' : 'Non (sans délégation du chef de service)') },
        { label: 'Consulter', value: manager ? `Documents validés et circuits de votre périmètre` : 'Vos documents, ceux qui vous sont destinés et les documents validés de votre service' },
      ],
    },
    {
      title: 'Modules',
      items: [
        { label: 'Logistique & hubs', value: logistics ? (isLogisticsManager(user) ? 'Accès responsable (visas)' : 'Accès exécutant (préparation des bons)') : 'Non' },
        { label: 'Gestion des agents', value: manager ? 'Agents de rang inférieur de votre périmètre' : 'Non' },
        { label: 'Sécurité & audit', value: ['dg', 'chef_departement', 'directeur'].includes(role) ? 'Oui' : 'Non' },
      ],
    },
  ];
}

export const EmployeeWorkspaceView: React.FC<EmployeeWorkspaceViewProps> = ({
  currentUser,
  currentOrg,
  entities = [],
  users = [],
  tasks = [],
  documents = [],
  contracts = initialContracts,
  onTaskAction = () => {},
  onCreateTask,
  onSubmitLeaveRequest,
  onOpenTab,
  onSelectUser,
  onOpenLogistics,
  onOpenConnectKey,
  onOpenInviteAgent,
}) => {
  const isAgent = currentUser.role === 'agent';
  const org = currentOrg || FALLBACK_ORG;
  const myEntity = anchorEntity(currentUser, entities);
  const manager = useMemo(() => directManager(currentUser, entities, users), [currentUser, entities, users]);
  const today = new Date().toISOString().split('T')[0];

  // Chronomètre de travail en direct
  const [seconds, setSeconds] = useState<number>(4810);
  const [workStatus, setWorkStatus] = useState<'working' | 'coffee_break'>('working');
  const [breakSeconds, setBreakSeconds] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('day');
  const [taskFilter, setTaskFilter] = useState<'open' | 'late' | 'validation' | 'done'>('open');
  const [docFilter, setDocFilter] = useState<'all' | 'mine' | 'for_me' | 'service'>('all');
  const [showNotification, setShowNotification] = useState<boolean>(true);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState<boolean>(false);
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);

  // --- Ce que l'utilisateur voit (mêmes règles que le serveur) --------------------
  const myTasks = useMemo(() => tasks.filter(t => !!taskRoleOf(currentUser, t)), [tasks, currentUser]);
  const openTasks = myTasks.filter(t => ['a_faire', 'en_cours', 'bloquee'].includes(t.status));
  const lateTasks = myTasks.filter(t => isTaskLate(t));
  const blockedTasks = myTasks.filter(t => t.status === 'bloquee');
  const inValidation = myTasks.filter(t => t.status === 'en_attente_approbation');
  const toFix = myTasks.filter(t => t.status === 'en_cours' && !!t.lastRejection);
  const doneTasks = myTasks.filter(t => t.status === 'validee_terminee' || t.status === 'termine');
  const tasksToValidate = useMemo(() => tasks.filter(t => canSeeTask(currentUser, t, entities) && canValidateTaskNow(currentUser, t)), [tasks, currentUser, entities]);

  const visibleDocs = useMemo(
    () => documents.filter(doc => canUserViewDocument(currentUser, doc, entities).allowed),
    [documents, currentUser, entities],
  );
  const myDocs = visibleDocs.filter(d => d.authorId === currentUser.id);
  const myPending = myDocs.filter(d => d.status === 'en_revue' || d.status === 'rejete' || d.status === 'brouillon');
  const forMe = visibleDocs.filter(d => d.targetUserId === currentUser.id && d.authorId !== currentUser.id);
  const serviceDocs = visibleDocs.filter(d => d.authorId !== currentUser.id && d.targetUserId !== currentUser.id && (d.status === 'signe' || d.status === 'approuve'));
  const docsToAct = visibleDocs.filter(d => canActOnDocument(currentUser, d));
  const myLeaves = myDocs.filter(d => d.subtype === 'demande_conge');

  const docsShown = docFilter === 'mine' ? myDocs : docFilter === 'for_me' ? forMe : docFilter === 'service' ? serviceDocs : visibleDocs;
  const tasksShown = (taskFilter === 'open' ? openTasks : taskFilter === 'late' ? lateTasks : taskFilter === 'validation' ? inValidation : doneTasks)
    .slice()
    .sort((a, b) => Number(isTaskLate(b)) - Number(isTaskLate(a)) || (a.dueDate || '').localeCompare(b.dueDate || ''));

  // Main courante / Transmissions
  const [consignes, setConsignes] = useState([
    { id: 'c-1', auteur: 'M. Ibrahima Sarr (DAF)', date: 'Aujourd’hui à 08:30', message: 'Rappel : tous les bons de commande du trimestre doivent être visés avant vendredi 17h.' },
    { id: 'c-2', auteur: 'Jean-Paul Kouassi (DRH)', date: 'Hier à 16:15', message: 'Les fiches d’évaluation de mi-parcours sont disponibles dans votre espace documentaire.' },
  ]);
  const [nouveauMessage, setNouveauMessage] = useState('');

  // Demande de congé (document « demande de congé » soumis au circuit)
  const [demandeConge, setDemandeConge] = useState({ type: 'Congé annuel', debut: today, fin: today, motif: '' });
  const [congeErreur, setCongeErreur] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      if (workStatus === 'working') setSeconds(prev => prev + 1);
      else setBreakSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [workStatus]);

  const formatHours = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const envoyerConsigne = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nouveauMessage.trim()) return;
    setConsignes(prev => [{ id: `c-${Date.now()}`, auteur: `${currentUser.name} (${currentUser.roleTitle})`, date: 'À l’instant', message: nouveauMessage }, ...prev]);
    setNouveauMessage('');
  };

  const soumettreConge = (e: React.FormEvent) => {
    e.preventDefault();
    setCongeErreur('');
    if (demandeConge.fin < demandeConge.debut) return setCongeErreur('La date de fin doit suivre la date de début.');
    if (!demandeConge.motif.trim()) return setCongeErreur('Précisez le motif.');
    onSubmitLeaveRequest?.({ type: demandeConge.type, start: demandeConge.debut, end: demandeConge.fin, reason: demandeConge.motif.trim() });
    setDemandeConge(d => ({ ...d, motif: '' }));
  };

  const tabs: { id: WorkspaceTab; label: string; icon: React.ReactNode; count?: number; hidden?: boolean }[] = [
    { id: 'day', label: 'Ma journée', icon: <Sun className="w-4 h-4" /> },
    { id: 'tasks', label: 'Mes tâches', icon: <CheckCircle2 className="w-4 h-4" />, count: openTasks.length },
    { id: 'documents', label: 'Mes documents', icon: <FileText className="w-4 h-4" />, count: myPending.length || undefined },
    { id: 'attendance', label: 'Pointage & congés', icon: <Clock className="w-4 h-4" /> },
    { id: 'transmissions', label: 'Consignes', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'profile', label: 'Ma fiche & habilitations', icon: <Shield className="w-4 h-4" /> },
    { id: 'dashboard', label: 'Tableau de bord RH', icon: <BarChart3 className="w-4 h-4" />, hidden: isAgent },
    { id: 'task_analytics', label: 'Progression des équipes', icon: <TrendingUp className="w-4 h-4" />, hidden: isAgent },
  ];

  const kpi = (label: string, value: number, cls: string, onClick?: () => void, icon?: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-2xl border border-sky-200 p-4 shadow-sm text-left hover:shadow-md transition"
    >
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">{label}{icon}</div>
      <div className={`text-2xl font-black font-mono mt-1 ${cls}`}>{value}</div>
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {showNotification && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/80 text-emerald-950 flex items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold">Pointage d'arrivée enregistré</div>
              <div className="text-[11px] text-emerald-900 mt-0.5 truncate">Arrivée certifiée à 08:15:00 pour {currentUser.name}. Compteur de travail démarré.</div>
            </div>
          </div>
          <button onClick={() => setShowNotification(false)} className="text-emerald-700 hover:text-emerald-950 p-1 text-xs shrink-0 font-bold" aria-label="Fermer">✕</button>
        </div>
      )}

      {/* PROFIL */}
      <div className="bg-white rounded-3xl border border-sky-200 shadow-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-blue-500/20 shrink-0">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">{currentUser.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">{currentUser.roleTitle}</span>
                {(currentUser.matricule || currentUser.employeeCode) && (
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Matricule : {currentUser.matricule || currentUser.employeeCode}</span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-x-2 gap-y-1 flex-wrap">
                <span className="font-semibold text-slate-700">Entité :</span>
                <span className="text-sky-700 font-semibold">{myEntity?.name || currentUser.departmentName || 'Direction Générale'}</span>
                {manager && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="font-semibold text-slate-700">N+1 :</span>
                    <span className="text-slate-600 font-medium">{manager.name}</span>
                  </>
                )}
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-700">Profil :</span>
                <span className="text-slate-600">{isAgent ? 'Agent exécutant' : ROLE_LABELS[currentUser.role]}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-gradient-to-r from-sky-50 to-blue-50/80 border border-sky-200 p-3.5 rounded-2xl flex-wrap">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3 text-sky-600" /> Temps de travail</div>
              <div className="text-xl font-mono font-bold text-sky-950 tracking-tight mt-0.5">{formatHours(seconds)}</div>
              <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                <span className={`w-2 h-2 rounded-full ${workStatus === 'working' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span className="font-semibold text-slate-700">{workStatus === 'working' ? 'En poste' : `En pause (${formatHours(breakSeconds)})`}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setWorkStatus(workStatus === 'working' ? 'coffee_break' : 'working')}
                className={`px-3.5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-md transition active:scale-95 ${workStatus === 'coffee_break' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'}`}
              >
                <Coffee className="w-4 h-4 text-amber-100" />
                <span>{workStatus === 'working' ? 'Pause' : 'Reprendre'}</span>
              </button>
              {onSelectUser && (
                <button onClick={() => setShowAccountModal(true)} className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
                  <LogOut className="w-3.5 h-3.5 text-slate-500" /> Changer de compte
                </button>
              )}
              {onOpenConnectKey && (
                <button onClick={onOpenConnectKey} className="px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5" title="Se connecter à une entité invitée avec votre clé à 10 chiffres">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Clé inter-entités
                </button>
              )}
              {onOpenInviteAgent && isEntityManager(currentUser, entities) && (
                <button onClick={onOpenInviteAgent} className="px-3 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" /> Inviter un agent
                </button>
              )}
              {onOpenLogistics && canAccessLogistics(currentUser) && (
                <button onClick={onOpenLogistics} className="px-3 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-300 text-amber-800 text-xs font-bold flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-600" /> Logistique
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-sky-100 overflow-x-auto">
          {tabs.filter(t => !t.hidden).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-sky-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count ? <span className={`text-[10px] px-1.5 rounded-full ${activeTab === tab.id ? 'bg-white/25' : 'bg-sky-100 text-sky-800'}`}>{tab.count}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* MA JOURNÉE */}
      {activeTab === 'day' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {kpi('Tâches ouvertes', openTasks.length, 'text-sky-700', () => { setTaskFilter('open'); setActiveTab('tasks'); })}
            {kpi('En retard', lateTasks.length, lateTasks.length ? 'text-rose-600' : 'text-slate-400', () => { setTaskFilter('late'); setActiveTab('tasks'); }, <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />)}
            {kpi('À corriger', toFix.length, toFix.length ? 'text-amber-600' : 'text-slate-400', () => { setTaskFilter('open'); setActiveTab('tasks'); }, <RotateCcw className="w-3.5 h-3.5 text-amber-500" />)}
            {kpi('En validation', inValidation.length, 'text-indigo-700', () => { setTaskFilter('validation'); setActiveTab('tasks'); })}
            {kpi('Mes demandes en cours', myPending.length, 'text-slate-700', () => { setDocFilter('mine'); setActiveTab('documents'); })}
          </div>

          {(docsToAct.length > 0 || tasksToValidate.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-amber-900 text-xs">
                <Stamp className="w-5 h-5 text-amber-600" />
                <span>
                  <strong>À votre visa :</strong> {docsToAct.length} document(s){tasksToValidate.length ? ` et ${tasksToValidate.length} tâche(s)` : ''}.
                  {isAgent && ' (délégation de votre chef de service)'}
                </span>
              </div>
              <div className="flex gap-2">
                {docsToAct.length > 0 && <button onClick={() => onOpenTab?.('documents')} className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold">Documents</button>}
                {tasksToValidate.length > 0 && <button onClick={() => onOpenTab?.('workflows')} className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold">Tâches</button>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-sky-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-sky-600" /> Mes priorités</h3>
                <button onClick={() => setActiveTab('tasks')} className="text-[11px] font-semibold text-sky-700 hover:underline">Toutes mes tâches →</button>
              </div>
              {openTasks.length === 0 ? (
                <p className="text-xs text-slate-500 p-4 text-center">Aucune tâche ouverte. Les tâches qui vous sont assignées apparaîtront ici dès leur création.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {openTasks
                    .slice()
                    .sort((a, b) => Number(isTaskLate(b)) - Number(isTaskLate(a)) || (a.dueDate || '').localeCompare(b.dueDate || ''))
                    .slice(0, 6)
                    .map(t => {
                      const next = t.steps.find(s => !s.completed && (!s.assignedToUserId || s.assignedToUserId === currentUser.id));
                      return (
                        <li key={t.id} className="py-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{t.title}</div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {next ? `Prochaine étape : ${next.label}` : 'Toutes vos étapes sont faites — à soumettre'}
                              {t.site ? ` · ${t.site}` : ''}
                            </div>
                            {t.status === 'bloquee' && <div className="text-[11px] text-rose-600 flex items-center gap-1"><Ban className="w-3 h-3" /> Bloquée : {t.blockedReason}</div>}
                            {t.lastRejection && t.status === 'en_cours' && <div className="text-[11px] text-amber-700">À corriger : {t.lastRejection.reason}</div>}
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-[11px] font-mono font-bold ${isTaskLate(t) ? 'text-rose-600' : 'text-slate-600'}`}>{t.dueDate}</div>
                            <button onClick={() => { setTaskFilter('open'); setActiveTab('tasks'); }} className="text-[11px] font-semibold text-sky-700 hover:underline">Ouvrir</button>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>

            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-sky-200 p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Send className="w-4 h-4 text-sky-600" /> Mes demandes en cours</h3>
                {myPending.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucune demande en cours.</p>
                ) : (
                  <ul className="space-y-2">
                    {myPending.slice(0, 5).map(d => (
                      <li key={d.id} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800 truncate">{d.title}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${DOC_STATUS[d.status].cls}`}>{DOC_STATUS[d.status].label}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {d.status === 'en_revue' ? `En attente de ${waitingFor(currentStep(d.workflow))}`
                            : d.status === 'rejete' ? `Rejeté : ${d.workflow?.rejection?.reason || ''}`
                            : 'Brouillon non soumis'}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-sky-200 p-5 shadow-sm space-y-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Info className="w-4 h-4 text-sky-600" /> Ce que vous voyez</h3>
                <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
                  {isAgent ? (
                    <>
                      <li>Les tâches qui vous sont assignées, dès leur création.</li>
                      <li>Vos documents et demandes, à chaque étape de leur circuit.</li>
                      <li>Les documents de votre service <strong>une fois validés</strong>.</li>
                      <li>Pas les brouillons ni les circuits en cours des autres, ni les données RH.</li>
                    </>
                  ) : (
                    <>
                      <li>Les tâches et documents de votre périmètre hiérarchique.</li>
                      <li>Les circuits en cours où vous intervenez, à votre tour.</li>
                      <li>Les brouillons restent privés à leur émetteur.</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MES TÂCHES */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-sky-200">
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-[11px] overflow-x-auto">
              {([
                ['open', `À réaliser (${openTasks.length})`],
                ['late', `En retard (${lateTasks.length})`],
                ['validation', `En validation (${inValidation.length})`],
                ['done', `Terminées (${doneTasks.length})`],
              ] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTaskFilter(id)} className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${taskFilter === id ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>
            {onCreateTask && (
              <button onClick={() => setShowNewTaskModal(true)} className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
                <Plus className="w-3.5 h-3.5" /> {isAgent ? 'Tâche personnelle' : 'Nouvelle tâche'}
              </button>
            )}
          </div>
          {blockedTasks.length > 0 && taskFilter === 'open' && (
            <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
              {blockedTasks.length} tâche(s) bloquée(s) : votre hiérarchie en est informée.
            </p>
          )}
          {tasksShown.length === 0 ? (
            <div className="bg-white rounded-2xl border border-sky-200 p-10 text-center text-xs text-slate-500">Aucune tâche dans cette liste.</div>
          ) : (
            <div className="space-y-4">
              {tasksShown.map(t => (
                <TaskCard key={t.id} task={t} currentUser={currentUser} entities={entities} documents={documents} organization={org} onAction={onTaskAction} onOpenDocument={setViewingDoc} dense />
              ))}
            </div>
          )}
        </div>
      )}

      {/* MES DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-600" /> Mes documents</h3>
              <p className="text-xs text-slate-500 mt-0.5">Vos pièces et demandes avec leur circuit, ce qui vous est destiné, et les documents validés de votre service.</p>
            </div>
            <button onClick={() => onOpenTab?.('documents')} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Nouveau document
            </button>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {([
              ['all', `Tout (${visibleDocs.length})`],
              ['mine', `Émis par moi (${myDocs.length})`],
              ['for_me', `Pour moi (${forMe.length})`],
              ['service', `Validés de mon périmètre (${serviceDocs.length})`],
            ] as const).map(([id, label]) => (
              <button key={id} onClick={() => setDocFilter(id)} className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap ${docFilter === id ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
          {docsShown.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              Aucun document dans cette liste.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docsShown.map(doc => {
                const isPayslip = doc.subtype === 'bulletin_de_paie' || doc.isConfidentialPayslip;
                return (
                  <div key={doc.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-200 truncate">{documentType(doc.subtype).label}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${DOC_STATUS[doc.status].cls}`}>{DOC_STATUS[doc.status].label}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">{doc.title}</h4>
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">{doc.referenceNumber} · {doc.createdAt}</p>
                      </div>
                      {typeof doc.amount === 'number' && doc.amount > 0 && (
                        <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{isPayslip ? 'Net' : 'Montant'}</span>
                          <span className="font-mono font-black text-sm text-emerald-700">{doc.amount.toLocaleString('fr-FR')} {doc.currency || 'USD'}</span>
                        </div>
                      )}
                      {doc.workflow && doc.authorId === currentUser.id && <ApprovalChips steps={doc.workflow.steps} />}
                      {doc.status === 'rejete' && doc.workflow?.rejection && (
                        <p className="text-[11px] text-rose-700">Rejeté : « {doc.workflow.rejection.reason} »</p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 truncate"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> {doc.authorName}</span>
                      <button onClick={() => setViewingDoc(doc)} className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs shadow-sm">
                        <Eye className="w-3.5 h-3.5" /> Consulter
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* POINTAGE & CONGÉS */}
      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Clock className="w-4 h-4 text-sky-600" /> Registre de présence (semaine en cours)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <th className="py-2.5">Date</th><th className="py-2.5">Arrivée</th><th className="py-2.5">Départ</th><th className="py-2.5">Temps effectif</th><th className="py-2.5">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-3 font-semibold">Aujourd'hui</td>
                      <td className="py-3 font-mono text-emerald-700 font-bold">08:15:00</td>
                      <td className="py-3 text-slate-400">En poste</td>
                      <td className="py-3 font-mono font-bold">{formatHours(seconds)}</td>
                      <td className="py-3"><span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">Certifié</span></td>
                    </tr>
                    <tr>
                      <td className="py-3 font-semibold">Hier</td>
                      <td className="py-3 font-mono text-slate-600">08:10:22</td>
                      <td className="py-3 font-mono text-slate-600">17:05:40</td>
                      <td className="py-3 font-mono">08h 55m</td>
                      <td className="py-3"><span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">Complet</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Calendar className="w-4 h-4 text-sky-600" /> Mes demandes d'absence</h3>
              {myLeaves.length === 0 ? (
                <p className="text-xs text-slate-500">Aucune demande pour le moment.</p>
              ) : (
                <ul className="space-y-2">
                  {myLeaves.map(d => (
                    <li key={d.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-800">{d.title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${DOC_STATUS[d.status].cls}`}>{DOC_STATUS[d.status].label}</span>
                      </div>
                      {d.workflow && <ApprovalChips steps={d.workflow.steps} />}
                      {d.status === 'en_revue' && <p className="text-[11px] text-slate-500">En attente de {waitingFor(currentStep(d.workflow))}.</p>}
                      {d.status === 'rejete' && <p className="text-[11px] text-rose-700">Refusée : {d.workflow?.rejection?.reason}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-4 self-start">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Calendar className="w-4 h-4 text-sky-600" /> Demander un congé ou une absence</h3>
            <p className="text-[11px] text-slate-500">Votre demande suit le circuit : votre responsable direct, puis les Ressources Humaines.</p>
            {congeErreur && <div className="p-2.5 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200">{congeErreur}</div>}
            <form onSubmit={soumettreConge} className="space-y-3 text-xs">
              <label className="block text-slate-600 font-semibold">Type de demande
                <select value={demandeConge.type} onChange={e => setDemandeConge({ ...demandeConge, type: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 mt-1">
                  <option>Congé annuel</option>
                  <option>Mission de terrain</option>
                  <option>Permission exceptionnelle</option>
                  <option>Arrêt maladie</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-slate-600 font-semibold">Du
                  <input type="date" required value={demandeConge.debut} onChange={e => setDemandeConge({ ...demandeConge, debut: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 mt-1" />
                </label>
                <label className="block text-slate-600 font-semibold">Au
                  <input type="date" required value={demandeConge.fin} onChange={e => setDemandeConge({ ...demandeConge, fin: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 mt-1" />
                </label>
              </div>
              <label className="block text-slate-600 font-semibold">Motif
                <textarea rows={2} required value={demandeConge.motif} onChange={e => setDemandeConge({ ...demandeConge, motif: e.target.value })} placeholder="Précisez l'objet de votre demande…" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 mt-1" />
              </label>
              <button type="submit" disabled={!onSubmitLeaveRequest} className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold shadow-sm">
                Transmettre pour visa
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONSIGNES */}
      {activeTab === 'transmissions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-sky-600" /> Main courante de service</h3>
            <div className="space-y-3">
              {consignes.map(c => (
                <div key={c.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
                  <div className="flex justify-between items-center text-xs"><span className="font-bold text-slate-800">{c.auteur}</span><span className="text-slate-400 font-mono text-[11px]">{c.date}</span></div>
                  <p className="text-xs text-slate-600">{c.message}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Laisser une consigne</h3>
            <form onSubmit={envoyerConsigne} className="space-y-3 text-xs">
              <textarea rows={4} value={nouveauMessage} onChange={e => setNouveauMessage(e.target.value)} placeholder="Note de relève pour l'équipe…" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800" />
              <button type="submit" className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center gap-2"><Send className="w-3.5 h-3.5" /> Publier</button>
            </form>
          </div>
        </div>
      )}

      {/* FICHE & HABILITATIONS (réelles, selon le rôle) */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Fiche de poste & habilitations</h3>
              <p className="text-xs text-slate-500">{currentUser.roleTitle} — {myEntity?.name || currentUser.departmentName || org.name}</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300">
              {isAgent ? 'Agent exécutant' : ROLE_LABELS[currentUser.role]}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {habilitations(currentUser, canAccessLogistics(currentUser)).map(group => (
              <div key={group.title} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-blue-600" /> {group.title}</h4>
                {group.items.map(i => (
                  <div key={i.label}>
                    <div className="text-slate-500">{i.label}</div>
                    <div className="font-semibold text-slate-800">{i.value}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {manager && <p className="text-xs text-slate-600">Responsable direct (N+1) : <strong>{manager.name}</strong> — {manager.label}</p>}
        </div>
      )}

      {/* RESPONSABLES : TABLEAUX DE BORD */}
      {!isAgent && activeTab === 'dashboard' && (
        <div className="space-y-6">
          <DepartmentTasksProgressChart tasks={tasks} entities={entities} users={users} currentUser={currentUser} />
          <WorkspaceDashboard entities={entities} users={users} contracts={contracts} organization={currentOrg} currentUser={currentUser} onOpenLogistics={onOpenLogistics} />
        </div>
      )}
      {!isAgent && activeTab === 'task_analytics' && (
        <DepartmentTasksProgressChart tasks={tasks} entities={entities} users={users} currentUser={currentUser} />
      )}

      {/* CHANGER DE COMPTE (démonstration) */}
      {showAccountModal && onSelectUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Changer d'utilisateur</h3>
              <button onClick={() => setShowAccountModal(false)} className="text-slate-400 hover:text-slate-700" aria-label="Fermer">✕</button>
            </div>
            <div className="space-y-1">
              {users.map(u => (
                <button key={u.id} onClick={() => { onSelectUser(u); setShowAccountModal(false); }} className="w-full text-left p-2.5 rounded-xl hover:bg-sky-50 text-xs flex items-center justify-between border border-transparent hover:border-sky-200">
                  <div>
                    <div className="font-bold text-slate-900">{u.name}</div>
                    <div className="text-[11px] text-slate-500">{u.roleTitle}</div>
                  </div>
                  {u.id === currentUser.id && <Check className="w-4 h-4 text-sky-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showNewTaskModal && onCreateTask && (
        <TaskCreateModal
          currentUser={currentUser}
          entities={entities}
          users={users}
          documents={documents}
          tasks={tasks}
          organizationId={org.id}
          onCreate={onCreateTask}
          onClose={() => setShowNewTaskModal(false)}
        />
      )}

      {viewingDoc && (
        <RhemaOfficialDocument document={viewingDoc} organization={org} currentUser={currentUser} entities={entities} onClose={() => setViewingDoc(null)} />
      )}
    </div>
  );
};
