// src/components/WorkflowsView.tsx
import React, { useState } from 'react';
import type { TaskItem, User, HierarchicalEntity, DocumentItem, Organization } from '../types';
import { 
  GitBranch, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserCheck, 
  ShieldCheck, 
  Calendar,
  Search,
  Check,
  X,
  FileText,
  Lock,
  RotateCcw,
  ExternalLink,
  Eye,
  Paperclip
} from 'lucide-react';
import { RhemaOfficialDocument } from './RhemaOfficialDocument';

interface WorkflowsViewProps {
  tasks?: TaskItem[];
  currentUser: User;
  entities?: HierarchicalEntity[];
  users?: User[];
  documents?: DocumentItem[];
  organization?: Organization;
  onToggleStep?: (taskId: string, stepId: string) => void;
  onAddTask?: (task: Omit<TaskItem, 'id'>) => void;
}

export type WorkflowFilter = 'all' | 'approbations' | 'production' | 'suivi' | 'jalons';

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({
  currentUser,
  entities = [],
  users = [],
  documents = [],
  organization = {
    id: 'org-1',
    name: 'RHEMA BUSINESS',
    type: 'entreprise',
    registrationNumber: 'RCCM/20-A-01120',
    headquarters: 'N°1B, Avenue Bangala, Q/Salongo C/Kintambo, Kinshasa - RD CONGO',
    email: 'contact@rhemabusiness.com',
    phone: '+243812791 228',
    managerName: 'Junior Monya',
    managerRole: 'Directeur Général (DG)',
    managerEmail: 'juniormonya536@gmail.com',
    hasDepartements: true,
    hasDirections: true,
    hasDivisions: true,
    hasServices: true,
    description: 'RHEMA BUSINESS - Télécoms, VSAT, Réseaux et Intégration Technologique en RDC.',
    createdAt: '2020-01-15',
  }
}) => {
  const [activeFilter, setActiveFilter] = useState<WorkflowFilter>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedViewingDoc, setSelectedViewingDoc] = useState<DocumentItem | null>(null);
  const [rejectModalTaskId, setRejectModalTaskId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Modèles prédéfinis de jalons
  const taskTemplates: Record<string, { category: 'approbations' | 'production' | 'suivi' | 'jalons'; steps: string[]; defaultTitle: string }> = {
    'approbation': {
      category: 'approbations',
      defaultTitle: "Demande d'Achat & Engagement de Dépense",
      steps: [
        'Vérification de concordance avec le budget prévisionnel DAF',
        'Contrôle des pièces justificatives et cotations fournisseurs',
        'Visa de conformité comptable & fiscale',
        'Signature électronique d\'approbation finale de la Direction Générale'
      ]
    },
    'production': {
      category: 'production',
      defaultTitle: "Ordre de Fabrication & Déploiement Matériel",
      steps: [
        'Préparation et assemblage des équipements en atelier certifié',
        'Contrôles électriques, tests d\'isolement et étalonnage selon ISO 9001',
        'Émargement du procès-verbal de recette usine avant expédition'
      ]
    },
    'suivi': {
      category: 'suivi',
      defaultTitle: "Suivi Compte Client & Relance Rapprochement",
      steps: [
        'Rapprochement bancaire et pointage du compte débiteur',
        'Transmission de la mise en demeure ou de l\'avis de crédit certifié',
        'Validation de la quittance de règlement par le chef de service'
      ]
    },
    'jalons': {
      category: 'jalons',
      defaultTitle: "Jalon Projet Audit & Intégration Réseau",
      steps: [
        'Revue des spécifications techniques préliminaires',
        'Validation de non-régression et essais de charge en conditions réelles',
        'Visa de livraison finale et scellement du dossier de recette'
      ]
    }
  };

  // Formulaire d'ajout complet
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('approbation');
  const [taskTitle, setTaskTitle] = useState(taskTemplates['approbation'].defaultTitle);
  const [targetEntityId, setTargetEntityId] = useState(entities[0]?.id || 'dept-daf');
  const [searchCollaborator, setSearchCollaborator] = useState('');
  const [collaboratorScope, setCollaboratorScope] = useState<'entity' | 'company'>('company');
  const [assignedRoles, setAssignedRoles] = useState<Record<string, 'Responsable' | 'Exécutant' | 'Validateur'>>({
    'u-1': 'Responsable'
  });
  const [priority, setPriority] = useState<'Normale' | 'Haute' | 'Critique'>('Haute');
  const [dueDate, setDueDate] = useState('2026-10-05');
  const [attachedDocId, setAttachedDocId] = useState(documents[0]?.id || '');
  const [instructions, setInstructions] = useState('Vérifier la conformité de chaque pièce avant la signature hiérarchique.');
  const [customSteps, setCustomSteps] = useState<string[]>(taskTemplates['approbation'].steps);
  const [newStepText, setNewStepText] = useState('');

  // Collaborateurs
  const allCollaborators = users.length > 0 ? users : [
    { id: 'u-1', name: 'Dr. Amadou Diallo', roleTitle: 'Président Directeur Général (PDG / DG)', role: 'dg', entityId: 'dept-daf' },
    { id: 'u-2', name: 'Mme Clarisse Nguema', roleTitle: 'Directrice Générale Adjointe (DGA)', role: 'dg', entityId: 'dept-daf' },
    { id: 'u-3', name: 'M. Ibrahima Sarr', roleTitle: 'Chef Département Administratif & Financier (DAF)', role: 'chef_departement', entityId: 'dept-daf' },
    { id: 'u-4', name: 'M. Alain Boni', roleTitle: 'Chef Département Opérations & Supply Chain (DOP)', role: 'chef_departement', entityId: 'dept-ops' },
    { id: 'u-5', name: 'M. Jean-Paul Kouassi', roleTitle: 'Directeur des Ressources Humaines (DRH)', role: 'directeur', entityId: 'dir-rh' },
    { id: 'u-6', name: 'Mme Sophie Traoré', roleTitle: 'Directrice Financière & Comptable', role: 'directeur', entityId: 'dir-finance' },
    { id: 'u-7', name: 'M. Moussa Diop', roleTitle: 'Gestionnaire Paie & Cotisations', role: 'agent', entityId: 'div-paie' },
  ];

  const availableCollaborators = allCollaborators.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchCollaborator.toLowerCase()) ||
                        u.roleTitle.toLowerCase().includes(searchCollaborator.toLowerCase());
    if (collaboratorScope === 'entity' && targetEntityId) {
      return matchSearch && (u as any).entityId === targetEntityId;
    }
    return matchSearch;
  });

  const handleTemplateChange = (key: string) => {
    setSelectedTemplateKey(key);
    const tmpl = taskTemplates[key];
    if (tmpl) {
      setTaskTitle(tmpl.defaultTitle);
      setCustomSteps([...tmpl.steps]);
    }
  };

  const toggleCollaborator = (userId: string) => {
    setAssignedRoles(prev => {
      const copy = { ...prev };
      if (copy[userId]) {
        delete copy[userId];
      } else {
        const count = Object.keys(copy).length;
        copy[userId] = count === 0 ? 'Responsable' : 'Exécutant';
      }
      return copy;
    });
  };

  const changeRoleForUser = (userId: string, newRole: 'Responsable' | 'Exécutant' | 'Validateur') => {
    setAssignedRoles(prev => ({
      ...prev,
      [userId]: newRole
    }));
  };

  const addCustomStep = () => {
    if (!newStepText.trim()) return;
    setCustomSteps(prev => [...prev, newStepText.trim()]);
    setNewStepText('');
  };

  const removeCustomStep = (index: number) => {
    setCustomSteps(prev => prev.filter((_, i) => i !== index));
  };

  // Liste des tâches de démonstration avec documents rattachés
  const [localTasks, setLocalTasks] = useState([
    {
      id: 'task-1',
      category: 'jalons',
      badgeCategory: 'Jalon Projet',
      badgeCategoryColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      priority: 'Normale',
      priorityColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      dueDate: '2026-09-10',
      statusText: 'Opération Validée & E-Signée',
      isSigned: true,
      title: 'Jalon Projet Déploiement ERP V4 - Migration Module Paie & RH',
      description: 'Validation de l\'interfaçage des fichiers DSN et contrôle des états récapitulatifs salariaux.',
      initiator: 'M. Jean-Paul Kouassi (Directeur)',
      assignedEntity: 'Service Traitement de la Paie',
      attachedDocId: 'doc-6',
      intervenants: [
        {
          initials: 'MD',
          name: 'Moussa Diop',
          roleTitle: 'Gestionnaire Paie & Cotisations',
          roleBadge: 'Exécutant',
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        },
        {
          initials: 'MJ',
          name: 'M. Jean-Paul Kouassi',
          roleTitle: 'Directeur des Ressources Humaines',
          roleBadge: 'Responsable',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
        }
      ],
      steps: [
        { id: 's1', label: 'Import des tables salariales et primes', completed: true, validatedBy: 'Moussa Diop (2026-09-03 15:00)' },
        { id: 's2', label: 'Test de double saisie comparative T2', completed: true, validatedBy: 'Moussa Diop (2026-09-06 10:30)' },
        { id: 's3', label: 'Validation de non-régression et E-Signature', completed: true, validatedBy: 'M. Eric Mba (2026-09-10 16:45)' }
      ],
      electronicSignature: {
        signedBy: 'M. Jean-Paul Kouassi (DRH) (Directeur des Ressources Humaines)',
        signedAt: '2026-09-10 17:15',
        hash: 'SHA256:d91c8cd9bfaeb2b1e4888809ecc10127e'
      }
    },
    {
      id: 'task-2',
      category: 'approbations',
      badgeCategory: 'Approbations (Achats)',
      badgeCategoryColor: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
      priority: 'Haute',
      priorityColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      dueDate: '2026-10-05',
      statusText: 'En cours d\'instruction',
      isSigned: false,
      title: 'Approbation Demande d\'Achat DA-2026-118 - Licences Oracle & SAP',
      description: 'Vérifier la concordance budgétaire avec le prévisionnel DAF avant signature du bon de commande.',
      initiator: 'M. Ibrahima Sarr (Chef DAF)',
      assignedEntity: 'Département Administration & Finances',
      attachedDocId: 'doc-4', // Rattaché au bon BCF-8821
      intervenants: [
        {
          initials: 'MS',
          name: 'Mme Sophie Traoré',
          roleTitle: 'Directrice Financière',
          roleBadge: 'Responsable',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
        },
        {
          initials: 'AD',
          name: 'Dr. Amadou Diallo',
          roleTitle: 'Directeur Général',
          roleBadge: 'Validateur',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
        }
      ],
      steps: [
        { id: 's1', label: 'Contrôle prévisionnel de trésorerie', completed: true, validatedBy: 'Mme Sophie Traoré (2026-09-20 11:00)' },
        { id: 's2', label: 'Revue juridique du contrat de maintenance', completed: false },
        { id: 's3', label: 'Visa final DG', completed: false }
      ],
      electronicSignature: null
    },
    {
      id: 'task-3',
      category: 'production',
      badgeCategory: 'Production & Maintenance',
      badgeCategoryColor: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
      priority: 'Critique',
      priorityColor: 'bg-red-500/20 text-red-400 border border-red-500/30',
      dueDate: '2026-09-30',
      statusText: 'En cours d\'instruction',
      isSigned: false,
      title: 'Lancement Ordre de Fabrication OF-4402 - Baies de Brassage Réseau',
      description: 'Assemblage, câblage et tests d\'isolation en salle blanche selon la norme ISO 9001.',
      initiator: 'M. Alain Boni (Chef DOP)',
      assignedEntity: 'Direction Logistique & Gestion des Stocks',
      attachedDocId: 'doc-5',
      intervenants: [
        {
          initials: 'AK',
          name: 'Aïcha Kone',
          roleTitle: 'Ingénieure Câblage',
          roleBadge: 'Exécutant',
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        },
        {
          initials: 'MR',
          name: 'M. Roger Tagne',
          roleTitle: 'Chef d\'Atelier Réseau',
          roleBadge: 'Responsable',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
        }
      ],
      steps: [
        { id: 's1', label: 'Préparation des faisceaux et connecteurs RJ45 Cat6A', completed: true, validatedBy: 'Aïcha Kone (2026-09-24 09:15)' },
        { id: 's2', label: 'Contrôle diélectrique et réflectométrie optique', completed: false },
        { id: 's3', label: 'Émargement du rapport de recette usine', completed: false }
      ],
      electronicSignature: null
    }
  ]);

  const filteredTasks = localTasks.filter(t => {
    if (activeFilter === 'all') return true;
    return t.category === activeFilter;
  });

  const handleToggleLocalStep = (taskId: string, stepId: string) => {
    setLocalTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        const updatedSteps = t.steps.map(s => {
          if (s.id !== stepId) return s;
          const nextState = !s.completed;
          return {
            ...s,
            completed: nextState,
            validatedBy: nextState ? `${currentUser.name} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : undefined
          };
        });

        const allDone = updatedSteps.every(s => s.completed);

        return {
          ...t,
          steps: updatedSteps,
          statusText: allDone && t.isSigned ? 'Opération Validée & E-Signée' : allDone ? 'Toutes étapes validées (En attente E-Signature)' : 'En cours d\'instruction'
        };
      })
    );
  };

  const handleSignTask = (taskId: string) => {
    const hashGenerated = `SHA256:d91c8cd9bfaeb2b${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    setLocalTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          isSigned: true,
          statusText: 'Opération Validée & E-Signée',
          electronicSignature: {
            signedBy: `${currentUser.name} (${currentUser.roleTitle})`,
            signedAt: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            hash: hashGenerated
          }
        };
      })
    );
  };

  const handleRejectTask = () => {
    if (!rejectModalTaskId) return;
    setLocalTasks(prev =>
      prev.map(t => {
        if (t.id !== rejectModalTaskId) return t;
        return {
          ...t,
          statusText: `Rejeté : ${rejectReason || 'Révision demandée par la direction'}`,
          isSigned: false
        };
      })
    );
    setRejectModalTaskId(null);
    setRejectReason('');
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedIds = Object.keys(assignedRoles);
    if (!taskTitle.trim() || assignedIds.length === 0) return;

    const assignedIntervenants = allCollaborators
      .filter(u => assignedIds.includes(u.id))
      .map(u => {
        const assignedRole = assignedRoles[u.id] || 'Exécutant';
        const roleColor = assignedRole === 'Responsable' 
          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
          : assignedRole === 'Validateur'
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30';

        return {
          initials: u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2),
          name: u.name,
          roleTitle: u.roleTitle,
          roleBadge: assignedRole,
          badgeColor: roleColor
        };
      });

    const matchedEnt = entities.find(e => e.id === targetEntityId);
    const tmpl = taskTemplates[selectedTemplateKey];

    const stepsArray = customSteps.map((lbl, idx) => ({
      id: `step-${Date.now()}-${idx}`,
      label: lbl,
      completed: false,
      validatedBy: undefined
    }));

    const categoryBadgeMap = {
      approbations: { label: 'Approbations (Achats)', color: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' },
      production: { label: 'Production & Maintenance', color: 'bg-sky-500/20 text-sky-400 border border-sky-500/30' },
      suivi: { label: 'Suivi Client & Relances', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
      jalons: { label: 'Jalon Projet', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
    };

    const taskCat = tmpl ? tmpl.category : 'approbations';

    const newTask = {
      id: `task-${Date.now()}`,
      category: taskCat,
      badgeCategory: categoryBadgeMap[taskCat].label,
      badgeCategoryColor: categoryBadgeMap[taskCat].color,
      priority,
      priorityColor: priority === 'Critique' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      dueDate,
      statusText: 'En cours d\'instruction',
      isSigned: false,
      title: taskTitle.trim(),
      description: instructions || 'Opération assignée dans le workflow.',
      initiator: `${currentUser.name} (${currentUser.roleTitle})`,
      assignedEntity: matchedEnt?.name || 'Direction Opérationnelle',
      attachedDocId: attachedDocId || undefined,
      intervenants: assignedIntervenants,
      steps: stepsArray,
      electronicSignature: null
    };

    setLocalTasks(prev => [newTask, ...prev]);
    setShowAddModal(false);
    setTaskTitle('');
    setAssignedRoles({ 'u-1': 'Responsable' });
    setInstructions('');
  };

  const assignedCount = Object.keys(assignedRoles).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. BANNIÈRE SUPÉRIEURE */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider border border-indigo-500/30">
              WORKFLOWS & HABILITATIONS
            </span>
            <span className="text-xs text-slate-400 font-medium">Délégation & Signature Électronique</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Attribution & Suivi des Tâches en Workflow
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Flux de travail hiérarchisés : Approbations, Ordres de fabrication, Suivis clients et Jalons projets. Le DG, chefs de départements et directeurs désignent les exécutants et valident les opérations avec horodatage certifié.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Créer une Tâche Workflow</span>
        </button>
      </div>

      {/* 2. ONGLETS DE FILTRAGE RÉEL */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: `Toutes (${localTasks.length})` },
          { id: 'approbations', label: 'Approbations (Achats, Notes de frais, Congés)' },
          { id: 'production', label: 'Production & Maintenance' },
          { id: 'suivi', label: 'Suivi Client & Relances' },
          { id: 'jalons', label: 'Jalons Projets' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as WorkflowFilter)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeFilter === tab.id
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. GRILLE DES CARTES DE TÂCHES */}
      <div className="space-y-5">
        {filteredTasks.map(task => {
          const completedCount = task.steps.filter(s => s.completed).length;
          const totalCount = task.steps.length;
          const isAllStepsDone = completedCount === totalCount;
          const attachedDoc = documents.find(d => d.id === task.attachedDocId);

          return (
            <div
              key={task.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-xl transition space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${task.badgeCategoryColor}`}>
                    {task.badgeCategory}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${task.priorityColor}`}>
                    {task.priority}
                  </span>
                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Échéance : {task.dueDate}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5 border ${
                    task.isSigned
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : isAllStepsDone
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {task.isSigned && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <span>{task.statusText}</span>
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  {task.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {task.description}
                </p>
              </div>

              {/* PIÈCE DOCUMENTAIRE RATTACHÉE (NOUVEAU) */}
              {attachedDoc && (
                <div className="p-3 bg-sky-950/20 border border-sky-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-600/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/30">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{attachedDoc.title}</span>
                        <span className="text-[10px] font-mono text-sky-300 bg-sky-900/60 px-1.5 py-0.5 rounded border border-sky-700">
                          {attachedDoc.referenceNumber}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {attachedDoc.amount ? `Montant certifié : ${attachedDoc.amount.toLocaleString()} ${attachedDoc.currency}` : attachedDoc.size}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedViewingDoc(attachedDoc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow transition shrink-0 self-start sm:self-center"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Consulter la Pièce Rattachée</span>
                  </button>
                </div>
              )}

              {/* Métadonnées : Initiateur et Entité */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-800/80">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    INITIATEUR HIÉRARCHIQUE
                  </span>
                  <p className="text-slate-200 font-semibold mt-0.5">{task.initiator}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    ENTITÉ AFFECTÉE
                  </span>
                  <p className="text-slate-200 font-semibold mt-0.5">{task.assignedEntity}</p>
                </div>
              </div>

              {/* Bloc Intervenants assignés */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                    Personnes assignées pour intervenir ({task.intervenants.length})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold">
                    Assignation Obligatoire
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {task.intervenants.map(inter => (
                    <div
                      key={inter.name}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {inter.initials}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white">{inter.name}</div>
                          <div className="text-[10px] text-slate-400">{inter.roleTitle}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${inter.badgeColor}`}>
                        {inter.roleBadge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Étapes du Workflow */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-slate-400">
                    ÉTAPES DU WORKFLOW OPÉRATIONNEL
                  </span>
                  <span className="font-mono font-bold text-slate-300">
                    {completedCount} / {totalCount} COMPLÉTÉES
                  </span>
                </div>

                <div className="space-y-1.5">
                  {task.steps.map(step => (
                    <div
                      key={step.id}
                      onClick={() => handleToggleLocalStep(task.id, step.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition cursor-pointer select-none ${
                        step.completed
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                          : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                          step.completed ? 'bg-emerald-600 text-white' : 'border border-slate-600'
                        }`}>
                          {step.completed && '✓'}
                        </div>
                        <span className={step.completed ? 'line-through text-slate-400' : 'font-medium'}>
                          {step.label}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono">
                        {step.validatedBy ? `Validé par ${step.validatedBy}` : 'Cliquer pour valider'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cadre E-Signature & Scellé Cryptographique */}
              {task.electronicSignature ? (
                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 space-y-1.5 text-xs">
                  <div className="font-bold flex items-center gap-1.5 text-amber-400">
                    <Lock className="w-3.5 h-3.5" />
                    <span>E-Signature & Validation Hiérarchique</span>
                  </div>
                  <p className="text-slate-200 text-[11px]">
                    Validé & signé par <strong>{task.electronicSignature.signedBy}</strong> le {task.electronicSignature.signedAt}
                  </p>
                  <p className="font-mono text-[10px] text-amber-400/90 truncate">
                    Scellé cryptographique : {task.electronicSignature.hash}
                  </p>
                </div>
              ) : (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400">
                    {isAllStepsDone
                      ? 'Toutes les étapes opérationnelles sont complétées. Prêt pour la signature finale.'
                      : 'Complétez chaque étape ci-dessus pour débloquer la signature de clôture.'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRejectModalTaskId(task.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs font-semibold transition"
                    >
                      Refuser / Révision
                    </button>

                    <button
                      disabled={!isAllStepsDone}
                      onClick={() => handleSignTask(task.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                        isAllStepsDone
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Apposer la Signature DG</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL DU DOCUMENT RATTACHÉ CONSULTABLE EN DIRECT */}
      {selectedViewingDoc && (
        <RhemaOfficialDocument
          document={selectedViewingDoc}
          organization={organization}
          onClose={() => setSelectedViewingDoc(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. MODALE CRÉER UNE TÂCHE EN WORKFLOW AVEC RATTACHEMENT DOCUMENTAIRE       */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-8">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm tracking-wide">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <span>Créer une Tâche en Workflow</span>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              {/* Type de Tâche */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Type de Tâche
                </label>
                <select
                  value={selectedTemplateKey}
                  onChange={e => handleTemplateChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="approbation">Tâche d'Approbation (Demande d'achat, note de frais, congé)</option>
                  <option value="production">Ordre de Fabrication & Production</option>
                  <option value="suivi">Suivi Client & Relance Commerciale</option>
                  <option value="jalons">Jalon Projet & Audit Qualité</option>
                </select>
              </div>

              {/* Intitulé */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Intitulé de la Tâche
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Validation Demande d'Achat Fournisseur..."
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Entité Destinataire */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Entité Destinataire (Service / Direction) <span className="text-red-400">*</span>
                </label>
                <select
                  value={targetEntityId}
                  onChange={e => setTargetEntityId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Sélectionner l'entité destinataire --</option>
                  {entities.map(ent => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} ({ent.level})
                    </option>
                  ))}
                </select>
              </div>

              {/* MODULE D'ASSIGNATION AVEC ROLES ET COMPTEUR */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-indigo-400" />
                      <span>Personnes qui doivent intervenir <span className="text-red-400">*</span></span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      L'assignation des personnes qui doivent intervenir est obligatoire.
                    </p>
                  </div>

                  <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold ${
                    assignedCount > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}>
                    {assignedCount > 0
                      ? `${assignedCount} personne(s) désignée(s)`
                      : '0 personne désignée (Obligatoire)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 text-[11px]">Sélectionner les personnes parmi l'organisation :</span>
                  <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setCollaboratorScope('entity')}
                      className={`px-2 py-0.5 rounded font-medium transition ${
                        collaboratorScope === 'entity' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      Entité ciblée
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollaboratorScope('company')}
                      className={`px-2 py-0.5 rounded font-medium transition ${
                        collaboratorScope === 'company' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      Toute l'entreprise
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un collaborateur par nom ou titre..."
                    value={searchCollaborator}
                    onChange={e => setSearchCollaborator(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {availableCollaborators.map(u => {
                    const isSelected = !!assignedRoles[u.id];
                    const currentRole = assignedRoles[u.id] || 'Exécutant';

                    return (
                      <div
                        key={u.id}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-indigo-950/30 border-indigo-500/40 text-white'
                            : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <div 
                          onClick={() => toggleCollaborator(u.id)}
                          className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-700 text-indigo-600 focus:ring-0 shrink-0"
                          />
                          <div className="w-6 h-6 rounded bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="truncate">
                            <div className="font-semibold text-[11px] leading-tight truncate">{u.name}</div>
                            <div className="text-[10px] text-slate-400 leading-tight truncate">{u.roleTitle}</div>
                          </div>
                        </div>

                        {isSelected ? (
                          <select
                            value={currentRole}
                            onChange={e => changeRoleForUser(u.id, e.target.value as any)}
                            className="bg-indigo-900/60 border border-indigo-500/40 text-indigo-200 text-[10px] rounded px-1.5 py-0.5 ml-2 font-semibold"
                          >
                            <option value="Responsable">Responsable</option>
                            <option value="Exécutant">Exécutant</option>
                            <option value="Validateur">Validateur</option>
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCollaborator(u.id)}
                            className="text-[10px] font-semibold text-slate-500 hover:text-indigo-300 ml-2"
                          >
                            + Assigner
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* JALONS PERSONNALISÉS */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold block">
                    Jalons d'Émargement ({customSteps.length})
                  </label>
                  <span className="text-[10px] text-indigo-400">Modifiables & ordonnés</span>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {customSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800 text-xs">
                      <span className="text-slate-300 font-medium truncate max-w-[340px]">
                        {idx + 1}. {step}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCustomStep(idx)}
                        className="text-slate-500 hover:text-red-400 p-0.5 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Ajouter une étape..."
                    value={newStepText}
                    onChange={e => setNewStepText(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomStep}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Deux colonnes : Priorité & Échéance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1.5">
                    Niveau de Priorité
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Normale">Normale</option>
                    <option value="Haute">Haute</option>
                    <option value="Critique">Critique</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1.5">
                    Date d'Échéance
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* RATTACHEMENT D'UN DOCUMENT (ENRICHI) */}
              <div className="bg-sky-950/20 p-3 rounded-xl border border-sky-500/30 space-y-1.5">
                <label className="text-sky-300 font-semibold block text-xs flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" /> Rattacher un Document Officiel (Facture, BCF, Contrat)
                </label>
                <select
                  value={attachedDocId}
                  onChange={e => setAttachedDocId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Aucun document lié --</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>
                      [{d.referenceNumber}] {d.title} ({d.amount ? `${d.amount.toLocaleString()} ${d.currency}` : d.subtype})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  Le document choisi sera directement consultable et vérifiable depuis la fiche de la tâche par les intervenants.
                </p>
              </div>

              {/* Description & Instructions */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Description & Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Détails des opérations à réaliser par l'agent..."
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Boutons d'action */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={assignedCount === 0}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg transition ${
                    assignedCount > 0
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Créer et Assigner la Tâche
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODALE REFUS / RÉVISION */}
      {rejectModalTaskId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-3">
            <h3 className="font-bold text-sm text-red-400">Motif de Révision ou de Rejet</h3>
            <textarea
              rows={3}
              placeholder="Précisez pourquoi le dossier est renvoyé..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalTaskId(null)}
                className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300"
              >
                Annuler
              </button>
              <button
                onClick={handleRejectTask}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold"
              >
                Confirmer le renvoi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};