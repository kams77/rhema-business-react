// src/components/EmployeeWorkspaceView.tsx
import React, { useState, useEffect } from 'react';
import type { User, Organization, HierarchicalEntity, TaskItem, DocumentItem } from '../types';
import { 
  CheckCircle2, 
  Clock, 
  Coffee, 
  LogOut, 
  Plus, 
  Users, 
  FileText, 
  MessageSquare, 
  Shield, 
  Download,
  Calendar,
  Send,
  AlertCircle,
  Briefcase,
  Award,
  ChevronRight,
  ShieldCheck,
  Eye,
  Check,
  X
} from 'lucide-react';

interface EmployeeWorkspaceViewProps {
  currentUser: User;
  currentOrg?: Organization;
  entities?: HierarchicalEntity[];
  users?: User[];
  tasks?: TaskItem[];
  documents?: DocumentItem[];
  onSelectUser?: (user: User) => void;
}

export const EmployeeWorkspaceView: React.FC<EmployeeWorkspaceViewProps> = ({
  currentUser,
  currentOrg,
  entities = [],
  users = [],
  tasks = [],
  documents = [],
  onSelectUser = () => {},
}) => {
  // Chronomètre de travail en direct (démarre à 01:20:10)
  const [seconds, setSeconds] = useState<number>(4810);
  const [workStatus, setWorkStatus] = useState<'working' | 'coffee_break'>('working');
  const [breakSeconds, setBreakSeconds] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'tasks' | 'attendance' | 'documents' | 'transmissions' | 'profile'>('tasks');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [showNotification, setShowNotification] = useState<boolean>(true);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState<boolean>(false);
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

  // État interactif des tâches opérationnelles
  const [taskList, setTaskList] = useState([
    {
      id: 'tsk-1',
      title: "Approbation Demande d'Achat DA-2026-118 - Licences Oracle & SAP",
      priority: 'HAUTE',
      status: 'En cours de traitement',
      description: "Vérifier la concordance budgétaire avec le prévisionnel DAF avant signature du bon de commande.",
      completed: false,
      dueDate: '2026-10-05',
      steps: [
        { id: 's1', label: 'Vérification prévisionnel comptable DAF', done: true },
        { id: 's2', label: 'Contrôle des habilitations licences Oracle', done: false },
        { id: 's3', label: 'Signature électronique DG', done: false }
      ],
      intervenants: [
        { initials: 'MS', name: 'Mme Sophie Traoré', role: 'Resp.', bg: 'bg-blue-600', roleBadge: 'bg-indigo-100 text-indigo-700' },
        { initials: 'MI', name: 'M. Ibrahima Sarr', role: 'Valid.', bg: 'bg-sky-600', roleBadge: 'bg-emerald-100 text-emerald-700' },
      ]
    },
    {
      id: 'tsk-2',
      title: "Lancement Ordre de Fabrication OF-4402 - Baies de Brassage Réseau",
      priority: 'CRITIQUE',
      status: 'En cours de traitement',
      description: "Assemblage, câblage et tests d'isolation en salle blanche selon la norme ISO 9001.",
      completed: false,
      dueDate: '2026-09-30',
      steps: [
        { id: 's1', label: 'Inspection visuelle et isolation diélectrique', done: true },
        { id: 's2', label: 'Rapport de conformité usine', done: false }
      ],
      intervenants: [
        { initials: 'AK', name: 'Aïcha Kone', role: 'Exéc.', bg: 'bg-sky-500', roleBadge: 'bg-amber-100 text-amber-700' },
        { initials: 'MR', name: 'M. Roger Tagne', role: 'Resp.', bg: 'bg-blue-600', roleBadge: 'bg-indigo-100 text-indigo-700' },
      ]
    },
    {
      id: 'tsk-3',
      title: "Alignement Paraboles VSAT Station Kolwezi & Test C/N",
      priority: 'HAUTE',
      status: 'En cours de traitement',
      description: "Revue technique du rapport d'alignement Ku-Band et signature du PV de recette client.",
      completed: true,
      dueDate: '2026-09-24',
      steps: [
        { id: 's1', label: 'Mesure rapport signal/bruit (>13.5 dB)', done: true },
        { id: 's2', label: 'Émargement PV de réception', done: true }
      ],
      intervenants: [
        { initials: 'FM', name: 'M. Fabrice Mukendi', role: 'Chef Srv.', bg: 'bg-emerald-600', roleBadge: 'bg-emerald-100 text-emerald-700' },
      ]
    }
  ]);

  // Nouvelle tâche (formulaire)
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'NORMALE' | 'HAUTE' | 'CRITIQUE'>('HAUTE');
  const [newTaskDueDate, setNewTaskDueDate] = useState('2026-10-15');

  // Main courante / Transmissions
  const [consignes, setConsignes] = useState([
    {
      id: 'c-1',
      auteur: 'M. Ibrahima Sarr (DAF)',
      date: 'Aujourd’hui à 08:30',
      message: 'Rappel : Tous les bons de commande du trimestre T3 doivent être signés électroniquement avant ce vendredi 17h.',
      priorite: 'urgente'
    },
    {
      id: 'c-2',
      auteur: 'Jean-Paul Kouassi (DRH)',
      date: 'Hier à 16:15',
      message: 'Les fiches d’évaluation de mi-parcours sont disponibles dans votre espace documentaire. Merci de les valider.',
      priorite: 'normale'
    }
  ]);
  const [nouveauMessage, setNouveauMessage] = useState('');

  // Demande de congé
  const [demandeConge, setDemandeConge] = useState({ type: 'Congé annuel légal (OHADA)', debut: '2026-10-01', fin: '2026-10-15', motif: '' });
  const [congeSucces, setCongeSucces] = useState(false);

  // Chronomètres
  useEffect(() => {
    let timer: any = null;
    if (workStatus === 'working') {
      timer = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      timer = setInterval(() => {
        setBreakSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [workStatus]);

  const formatHours = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Bascule de statut d'une tâche
  const toggleTaskStep = (taskId: string, stepId: string) => {
    setTaskList(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const newSteps = t.steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s);
        const allDone = newSteps.every(s => s.done);
        return {
          ...t,
          steps: newSteps,
          completed: allDone,
          status: allDone ? 'Validée & Clôturée' : 'En cours de traitement'
        };
      })
    );
  };

  // Ajout de tâche
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const created = {
      id: `tsk-${Date.now()}`,
      title: newTaskTitle,
      priority: newTaskPriority,
      status: 'En cours de traitement',
      description: newTaskDesc || 'Tâche opérationnelle initiée depuis l’Espace Employé.',
      completed: false,
      dueDate: newTaskDueDate,
      steps: [
        { id: 's1', label: 'Traitement opérationnel initial', done: false },
        { id: 's2', label: 'Visa hiérarchique de validation', done: false }
      ],
      intervenants: [
        { initials: currentUser.name.charAt(0), name: currentUser.name, role: 'Initié', bg: 'bg-indigo-600', roleBadge: 'bg-sky-100 text-sky-800' }
      ]
    };

    setTaskList(prev => [created, ...prev]);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowNewTaskModal(false);
  };

  // Envoi de consigne
  const envoyerConsigne = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nouveauMessage.trim()) return;
    setConsignes(prev => [
      {
        id: `c-${Date.now()}`,
        auteur: `${currentUser.name} (${currentUser.roleTitle})`,
        date: 'À l’instant',
        message: nouveauMessage,
        priorite: 'normale'
      },
      ...prev
    ]);
    setNouveauMessage('');
  };

  const soumettreConge = (e: React.FormEvent) => {
    e.preventDefault();
    setCongeSucces(true);
    setTimeout(() => setCongeSucces(false), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. BANDEAU VERT : Pointage Automatique Conforme */}
      {showNotification && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/80 text-emerald-950 flex items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold flex items-center gap-2 flex-wrap">
                <span>Pointage Automatique Conforme</span>
                <span className="px-2 py-0.5 bg-emerald-200/90 text-emerald-900 text-[10px] rounded uppercase font-bold tracking-wider">
                  Horodatage Inviolable
                </span>
              </div>
              <div className="text-[11px] text-emerald-900 mt-0.5 truncate">
                Pointage d'arrivée prélevé et certifié automatiquement à 08:15:00 pour l'agent {currentUser.name}. Compteur de travail initialisé.
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowNotification(false)}
            className="text-emerald-700 hover:text-emerald-950 p-1 text-xs shrink-0 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. CARTE BLANCHE DU PROFIL EMPLOYÉ */}
      <div className="bg-white rounded-3xl border border-sky-200 shadow-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Identité de l'agent */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-blue-500/20 shrink-0">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">
                  {currentUser.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  {currentUser.roleTitle}
                </span>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Matricule: EMP-R-DG
                </span>
              </div>

              <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-700">Service :</span> 
                <span className="text-sky-700 font-semibold">Direction Opérationnelle</span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-700">Pointage Arrivée :</span>
                <span className="text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  08:15:00
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-700">N+1 :</span>
                <span className="text-slate-600 font-medium">{currentUser.name}</span>
              </p>
            </div>
          </div>

          {/* Module Horloge & Bouton Pause Café */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-sky-50 to-blue-50/80 border border-sky-200 p-3.5 rounded-2xl flex-wrap">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-600" />
                <span>Temps de travail actif</span>
              </div>
              <div className="text-xl font-mono font-bold text-sky-950 tracking-tight mt-0.5">
                {formatHours(seconds)}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                <span className={`w-2 h-2 rounded-full ${workStatus === 'working' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span className="font-semibold text-slate-700">
                  {workStatus === 'working' ? 'En poste (Pointage prélevé)' : `Pause Café (${formatHours(breakSeconds)})`}
                </span>
              </div>
            </div>

            <div className="h-10 w-px bg-sky-200 mx-1 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWorkStatus(workStatus === 'working' ? 'coffee_break' : 'working')}
                className={`px-3.5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-md transition active:scale-95 ${
                  workStatus === 'coffee_break'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                }`}
              >
                <Coffee className="w-4 h-4 text-amber-100" />
                <span>
                  {workStatus === 'working'
                    ? 'Pause Café (Interrompre le compteur)'
                    : 'Reprendre le travail'}
                </span>
              </button>

              <button
                onClick={() => setShowAccountModal(true)}
                className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Changer de Compte</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation des 5 sous-modules */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-sky-100 overflow-x-auto">
          {[
            { id: 'tasks', label: `Mes Tâches Opérationnelles (${taskList.length})`, icon: <CheckCircle2 className="w-4 h-4" /> },
            { id: 'attendance', label: 'Pointage & Présences (2)', icon: <Clock className="w-4 h-4" /> },
            { id: 'documents', label: 'Mes Documents & Fiches (8)', icon: <FileText className="w-4 h-4" /> },
            { id: 'transmissions', label: 'Transmissions Hiérarchiques & Consignes', icon: <MessageSquare className="w-4 h-4" /> },
            { id: 'profile', label: 'Fiche de Poste & Habilitations', icon: <Shield className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-sky-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SOUS-MODULE 1 : MES TÂCHES OPÉRATIONNELLES */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-sky-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Feuille de Route & Tâches à Traiter</h3>
                <p className="text-[11px] text-slate-500">Mettez à jour vos avancements et transmettez vos fiches finalisées.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-[11px]">
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    taskFilter === 'all' ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                >
                  Toutes ({taskList.length})
                </button>
                <button
                  onClick={() => setTaskFilter('pending')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    taskFilter === 'pending' ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                >
                  En cours
                </button>
                <button
                  onClick={() => setTaskFilter('completed')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    taskFilter === 'completed' ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-600'
                  }`}
                >
                  Terminées
                </button>
              </div>

              <button
                onClick={() => setShowNewTaskModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle Tâche</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taskList
              .filter(t => taskFilter === 'all' || (taskFilter === 'pending' && !t.completed) || (taskFilter === 'completed' && t.completed))
              .map(t => (
                <div
                  key={t.id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm transition flex flex-col justify-between ${
                    t.completed ? 'border-emerald-200 bg-emerald-50/10' : 'border-sky-200'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        t.priority === 'CRITIQUE'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        PRIORITÉ {t.priority}
                      </span>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        t.completed ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    <h4 className={`text-sm font-bold text-slate-900 mb-1 leading-snug ${t.completed ? 'line-through text-slate-500' : ''}`}>
                      {t.title}
                    </h4>
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">{t.description}</p>

                    {/* Jalons d'émargement */}
                    <div className="space-y-1.5 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Jalons & Visas :</div>
                      {t.steps.map(step => (
                        <div
                          key={step.id}
                          onClick={() => toggleTaskStep(t.id, step.id)}
                          className="flex items-center justify-between text-xs cursor-pointer p-1 rounded hover:bg-slate-200/50"
                        >
                          <span className={`flex items-center gap-1.5 ${step.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] ${step.done ? 'bg-emerald-600 text-white' : 'border border-slate-400'}`}>
                              {step.done ? '✓' : ''}
                            </span>
                            {step.label}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{step.done ? 'Validé' : 'À faire'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Personnes assignées */}
                    <div className="pt-2 border-t border-sky-100">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-sky-600" />
                          <span>Personnes assignées ({t.intervenants.length})</span>
                        </span>
                        <span className="text-[9px] text-sky-700 font-semibold bg-sky-50 px-1.5 py-0.5 rounded uppercase">
                          Échéance : {t.dueDate}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {t.intervenants.map(inter => (
                          <div
                            key={inter.name}
                            className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs"
                          >
                            <div className={`w-5 h-5 rounded ${inter.bg} text-white text-[9px] font-bold flex items-center justify-center`}>
                              {inter.initials}
                            </div>
                            <span className="font-semibold text-slate-800 text-[11px]">{inter.name}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${inter.roleBadge}`}>
                              {inter.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* SOUS-MODULE 2 : POINTAGE & PRÉSENCES */}
      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" /> Registre Officiel de Présence (Semaine en cours)
            </h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Prélèvement Arrivée</th>
                  <th className="py-2.5">Départ</th>
                  <th className="py-2.5">Temps Effectif</th>
                  <th className="py-2.5">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3 font-semibold">Aujourd'hui</td>
                  <td className="py-3 font-mono text-emerald-700 font-bold">08:15:00</td>
                  <td className="py-3 text-slate-400">En poste</td>
                  <td className="py-3 font-mono font-bold">{formatHours(seconds)}</td>
                  <td className="py-3">
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      Certifié IP
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-semibold">Hier</td>
                  <td className="py-3 font-mono text-slate-600">08:10:22</td>
                  <td className="py-3 font-mono text-slate-600">17:05:40</td>
                  <td className="py-3 font-mono">08h 15m</td>
                  <td className="py-3">
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">
                      Complet
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Formulaire Demande de Congé / Régularisation */}
          <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" /> Demande d'Absence ou Congé
            </h3>

            {congeSucces && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 font-bold">
                ✓ Votre demande a été transmise à la Direction RH !
              </div>
            )}

            <form onSubmit={soumettreConge} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Type de demande</label>
                <select
                  value={demandeConge.type}
                  onChange={e => setDemandeConge({ ...demandeConge, type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                >
                  <option>Congé annuel légal (OHADA)</option>
                  <option>Mission de terrain / Déplacement VSAT</option>
                  <option>Permission exceptionnelle / Famille</option>
                  <option>Arrêt maladie / Justificatif médical</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Date Début</label>
                  <input
                    type="date"
                    required
                    value={demandeConge.debut}
                    onChange={e => setDemandeConge({ ...demandeConge, debut: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Date Fin</label>
                  <input
                    type="date"
                    required
                    value={demandeConge.fin}
                    onChange={e => setDemandeConge({ ...demandeConge, fin: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Motif explicatif</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Précisez l'objet de votre demande..."
                  value={demandeConge.motif}
                  onChange={e => setDemandeConge({ ...demandeConge, motif: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition shadow-sm"
              >
                Transmettre pour visa hiérarchique
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SOUS-MODULE 3 : MES DOCUMENTS & FICHES RH */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" /> Coffre-Fort Numérique & Bulletins Personnels
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Bulletin de Paie - Septembre 2026</h4>
                  <p className="text-[11px] text-slate-500">Net : 1 450 USD • Émis par DRH</p>
                </div>
                <button
                  onClick={() => setViewingDoc({ title: 'Bulletin de Paie - Septembre 2026', ref: 'PAY-2026-09', amount: '1 450 USD' })}
                  className="p-2 bg-white rounded-lg border text-sky-700 hover:bg-sky-50 font-bold text-xs shadow-sm"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Contrat de Travail Cadre (CDI)</h4>
                  <p className="text-[11px] text-slate-500">Signé le 15/01/2020 • RCCM RDC</p>
                </div>
                <button
                  onClick={() => setViewingDoc({ title: 'Contrat de Travail Cadre (CDI)', ref: 'CONTRAT-CDI-001', amount: 'Réf légale OHADA' })}
                  className="p-2 bg-white rounded-lg border text-sky-700 hover:bg-sky-50 font-bold text-xs shadow-sm"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Ordre de Mission Kolwezi</h4>
                  <p className="text-[11px] text-slate-500">Prise en charge VSAT station</p>
                </div>
                <button
                  onClick={() => setViewingDoc({ title: 'Ordre de Mission Kolwezi', ref: 'OM-2026-44', amount: 'Prise en charge validée' })}
                  className="p-2 bg-white rounded-lg border text-sky-700 hover:bg-sky-50 font-bold text-xs shadow-sm"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SOUS-MODULE 4 : TRANSMISSIONS & CONSIGNES */}
      {activeTab === 'transmissions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-600" /> Main Courante de Service & Consignes d'Équipe
            </h3>

            <div className="space-y-3">
              {consignes.map(c => (
                <div key={c.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{c.auteur}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{c.date}</span>
                  </div>
                  <p className="text-xs text-slate-600">{c.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Laisser une consigne</h3>
            <form onSubmit={envoyerConsigne} className="space-y-3 text-xs">
              <textarea
                rows={4}
                value={nouveauMessage}
                onChange={e => setNouveauMessage(e.target.value)}
                placeholder="Rédigez une note de relève pour l'équipe..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" /> Publier la transmission
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SOUS-MODULE 5 : FICHE DE POSTE & HABILITATIONS */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-sky-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" /> Accréditation & Matrice de Pouvoirs Légaux
              </h3>
              <p className="text-xs text-slate-500">Périmètre d'engagement et autorisations certifiées au sein de RHEMA BUSINESS</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-300">
              Habilitation Niveau 1 (Direction)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-blue-600" /> Autorité d'Approbation Financière
              </h4>
              <p className="text-slate-600">• Pouvoir de signature des devis jusqu'à : <strong>Illimité (Direction Générale)</strong></p>
              <p className="text-slate-600">• Ordonnancement des règlements bancaires : <strong>Autorisé</strong></p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-indigo-600" /> Délégation RH & Recrutement
              </h4>
              <p className="text-slate-600">• Signature des contrats de travail : <strong>Titulaire</strong></p>
              <p className="text-slate-600">• Pouvoir disciplinaire et sanctions : <strong>Président de commission</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1 : CHANGER DE COMPTE */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Changer d'utilisateur</h3>
              <button onClick={() => setShowAccountModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-1">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    onSelectUser(u);
                    setShowAccountModal(false);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-sky-50 text-xs flex items-center justify-between border border-transparent hover:border-sky-200"
                >
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

      {/* MODAL 2 : NOUVELLE TÂCHE */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-600" /> Créer une Tâche Opérationnelle
              </h3>
              <button onClick={() => setShowNewTaskModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Titre de la tâche *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Raccordement Liaison VSAT Lubumbashi"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Détails des instructions..."
                  value={newTaskDesc}
                  onChange={e => setNewTaskDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Priorité</label>
                  <select
                    value={newTaskPriority}
                    onChange={e => setNewTaskPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  >
                    <option value="NORMALE">Normale</option>
                    <option value="HAUTE">Haute</option>
                    <option value="CRITIQUE">Critique</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Échéance</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl text-slate-600 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow"
                >
                  Créer la tâche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3 : VISUALISATION DOCUMENT */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" /> {viewingDoc.title}
              </h3>
              <button onClick={() => setViewingDoc(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <p>Référence : <strong>{viewingDoc.ref}</strong></p>
              <p>Montant / Valeur : <strong>{viewingDoc.amount}</strong></p>
              <p>Statut : <span className="text-emerald-700 font-bold">Document Certifié RHEMA BUSINESS</span></p>
              <p className="text-slate-500 text-[11px]">Horodaté et scellé sous le RCCM/20-A-01120 Kinshasa RD CONGO.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold"
              >
                Imprimer / Exporter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};