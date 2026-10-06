// src/components/WorkflowsView.tsx
import { contentHashSync, shortHash } from '../lib/integrity';
import React, { useState, useEffect } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
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
  Paperclip,
  Download,
  Kanban,
  List,
  AlertTriangle,
  ArrowRight,
  Stamp,
  UserPlus
} from 'lucide-react';
import { RhemaOfficialDocument } from './RhemaOfficialDocument';
import { exportApprovalSlipToPDF } from '../utils/exportUtils';

export interface WorkflowIntervenant {
  initials: string;
  name: string;
  roleTitle: string;
  roleBadge: 'Responsable' | 'Exécutant' | 'Validateur';
  badgeColor?: string;
}

export interface WorkflowStep {
  id: string;
  label: string;
  completed: boolean;
  validatedBy?: string;
  completedAt?: string;
}

export interface WorkflowTask {
  id: string;
  category: 'approbations' | 'production' | 'suivi' | 'jalons' | string;
  badgeCategory: string;
  badgeCategoryColor: string;
  priority: 'Normale' | 'Haute' | 'Critique';
  priorityColor: string;
  dueDate: string;
  statusText: string;
  statusColumn: 'a_faire' | 'en_cours' | 'en_attente_approbation' | 'valide' | 'rejete';
  isSigned: boolean;
  title: string;
  description: string;
  initiator: string;
  assignedEntity: string;
  attachedDocId?: string;
  intervenants: WorkflowIntervenant[];
  steps: WorkflowStep[];
  electronicSignature?: {
    signedBy: string;
    signedAt: string;
    hash: string;
  } | null;
}

interface WorkflowsViewProps {
  tasks?: TaskItem[];
  currentUser: User;
  entities?: HierarchicalEntity[];
  users?: User[];
  documents?: DocumentItem[];
  organization?: Organization;
  onToggleStep?: (taskId: string, stepId: string) => void;
  onAddTask?: (task: Omit<TaskItem, 'id'>) => void;
  onUpdateDocument?: (docId: string, updates: Partial<DocumentItem>) => void;
  onLogAction?: (action: string, details: string, category: 'admin' | 'document' | 'task' | 'security') => void;
}

export type WorkflowFilter = 'all' | 'my_approvals' | 'approbations' | 'production' | 'suivi' | 'jalons' | 'valide';
export type ViewMode = 'list' | 'kanban';

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({
  tasks = [],
  currentUser,
  entities = [],
  users = [],
  documents = [],
  organization = {
    id: 'org-1',
    name: 'RHEMA BUSINESS RDC',
    type: 'entreprise' as const,
    registrationNumber: '',
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
  },
  onUpdateDocument,
  onLogAction
}) => {
  const [activeFilter, setActiveFilter] = useState<WorkflowFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedViewingDoc, setSelectedViewingDoc] = useState<DocumentItem | null>(null);
  const [rejectModalTaskId, setRejectModalTaskId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
      defaultTitle: "Ordre de Fabrication & Déploiement VSAT",
      steps: [
        'Préparation et assemblage des modems et paraboles en atelier certifié',
        'Contrôles électriques, tests d\'isolement et étalonnage radioélectrique',
        'Émargement du procès-verbal de recette usine avant expédition sur site minier'
      ]
    },
    'suivi': {
      category: 'suivi',
      defaultTitle: "Suivi Compte Client & Relance Rapprochement",
      steps: [
        'Rapprochement bancaire et pointage du compte débiteur Rawbank / EquityBCDC',
        'Transmission de la mise en demeure ou de l\'avis de crédit certifié',
        'Validation de la quittance de règlement par le chef de service'
      ]
    },
    'jalons': {
      category: 'jalons',
      defaultTitle: "Jalon Projet Audit & Intégration Réseau Satellite",
      steps: [
        'Revue des spécifications techniques préliminaires sur site',
        'Validation de non-régression et essais de bande passante en conditions réelles',
        'Visa de livraison finale et scellement du dossier de recette'
      ]
    }
  };

  // État du formulaire d'ajout
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('approbation');
  const [taskTitle, setTaskTitle] = useState(taskTemplates['approbation'].defaultTitle);
  const [targetEntityId, setTargetEntityId] = useState(entities[0]?.id || 'dept-daf');
  const [searchCollaborator, setSearchCollaborator] = useState('');
  const [collaboratorScope, setCollaboratorScope] = useState<'entity' | 'company'>('company');
  const [assignedRoles, setAssignedRoles] = useState<Record<string, 'Responsable' | 'Exécutant' | 'Validateur'>>({
    'u-1': 'Validateur'
  });
  const [priority, setPriority] = useState<'Normale' | 'Haute' | 'Critique'>('Haute');
  const [dueDate, setDueDate] = useState('2026-10-15');
  const [attachedDocId, setAttachedDocId] = useState(documents[0]?.id || '');
  const [instructions, setInstructions] = useState('Vérifier la conformité de chaque pièce avant la signature hiérarchique.');
  const [customSteps, setCustomSteps] = useState<string[]>(taskTemplates['approbation'].steps);
  const [newStepText, setNewStepText] = useState('');

  // Collaborateurs
  const allCollaborators = users.length > 0 ? users : [
    { id: 'u-1', name: 'Dr. Amadou Diallo', roleTitle: 'Directeur Général (DG)', role: 'dg', entityId: 'dept-daf' },
    { id: 'u-2', name: 'Junior Monya', roleTitle: 'Directeur Général Adjoint (DGA)', role: 'dg', entityId: 'dept-daf' },
    { id: 'u-3', name: 'M. Ibrahima Sarr', roleTitle: 'Chef Département Administratif & Financier (DAF)', role: 'chef_departement', entityId: 'dept-daf' },
    { id: 'u-4', name: 'M. Alain Boni', roleTitle: 'Chef Département Opérations (DOP)', role: 'chef_departement', entityId: 'dept-ops' },
    { id: 'u-5', name: 'M. Jean-Paul Kouassi', roleTitle: 'Directeur des Ressources Humaines (DRH)', role: 'directeur', entityId: 'dir-rh' },
    { id: 'u-6', name: 'Mme Sophie Traoré', roleTitle: 'Directrice Financière & Comptable', role: 'directeur', entityId: 'dir-finance' },
    { id: 'u-7', name: 'Moussa Diop', roleTitle: 'Gestionnaire Paie & Cotisations', role: 'agent', entityId: 'div-paie' },
  ];

  const availableCollaborators = allCollaborators.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchCollaborator.toLowerCase()) ||
                        u.roleTitle.toLowerCase().includes(searchCollaborator.toLowerCase());
    if (collaboratorScope === 'entity' && targetEntityId) {
      return matchSearch && (u as any).entityId === targetEntityId;
    }
    return matchSearch;
  });

  // Liste interne des tâches
  const [localTasks, setLocalTasks] = usePersistentState<WorkflowTask[]>('workflows.tasks', [
    {
      id: 'task-1',
      category: 'jalons',
      badgeCategory: 'Jalon Projet',
      badgeCategoryColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      priority: 'Normale',
      priorityColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      dueDate: '2026-10-08',
      statusText: 'Opération Validée & E-Signée',
      statusColumn: 'valide',
      isSigned: true,
      title: 'Jalon Projet Déploiement ERP V4 - Migration Module Paie & RH RDC',
      description: 'Validation de l\'interfaçage des fichiers DSN et contrôle des états récapitulatifs salariaux et de la conformité CNSS/IPR.',
      initiator: 'M. Jean-Paul Kouassi (Directeur RH)',
      assignedEntity: 'Service Traitement de la Paie',
      attachedDocId: documents.find(d => d.subtype === 'bulletin_de_paie')?.id || 'doc-1',
      intervenants: [
        {
          initials: 'MD',
          name: 'Moussa Diop',
          roleTitle: 'Gestionnaire Paie & Cotisations',
          roleBadge: 'Exécutant',
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        },
        {
          initials: 'JK',
          name: 'M. Jean-Paul Kouassi',
          roleTitle: 'Directeur des Ressources Humaines',
          roleBadge: 'Validateur',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
        }
      ],
      steps: [
        { id: 's1', label: 'Import des tables salariales et primes RDC', completed: true, validatedBy: 'Moussa Diop (09:30)' },
        { id: 's2', label: 'Test de double saisie comparative cotisations CNSS / IPR', completed: true, validatedBy: 'Moussa Diop (11:15)' },
        { id: 's3', label: 'Validation de non-régression et E-Signature légale', completed: true, validatedBy: 'M. Jean-Paul Kouassi (16:45)' }
      ],
      electronicSignature: {
        signedBy: 'Dr. Amadou Diallo (Directeur Général)',
        signedAt: '2026-09-28 16:45',
        hash: ''
      }
    },
    {
      id: 'task-2',
      category: 'approbations',
      badgeCategory: 'Approbation Achats',
      badgeCategoryColor: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
      priority: 'Critique',
      priorityColor: 'bg-red-500/20 text-red-400 border border-red-500/30',
      dueDate: '2026-10-05',
      statusText: 'En attente Visa DG',
      statusColumn: 'en_attente_approbation',
      isSigned: false,
      title: 'Validation Commande Équipements VSAT C-Band pour Site Minier Tenke',
      description: 'Contrôle des devis comparatifs, avis de transport douane Ndjili et validation du décaissement Rawbank.',
      initiator: 'M. Alain Boni (Chef Département Opérations)',
      assignedEntity: 'Département Opérations & Supply Chain (DOP)',
      attachedDocId: documents.find(d => d.category === 'financier_comptable')?.id || 'doc-2',
      intervenants: [
        {
          initials: 'AB',
          name: 'M. Alain Boni',
          roleTitle: 'Chef Département Opérations',
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
        { id: 's1', label: 'Vérification concordance budgétaire prévisionnelle DAF', completed: true, validatedBy: 'Mme Sophie Traoré (10:00)' },
        { id: 's2', label: 'Contrôle des fiches techniques des modems satellites', completed: true, validatedBy: 'M. Alain Boni (14:20)' },
        { id: 's3', label: 'Visa de conformité fiscale & bon de commande final', completed: false },
        { id: 's4', label: 'Signature électronique d\'approbation finale de la DG', completed: false }
      ],
      electronicSignature: null
    },
    {
      id: 'task-3',
      category: 'production',
      badgeCategory: 'Production & Réseau',
      badgeCategoryColor: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
      priority: 'Haute',
      priorityColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      dueDate: '2026-10-12',
      statusText: 'En cours d\'instruction',
      statusColumn: 'en_cours',
      isSigned: false,
      title: 'Lancement Ordre de Fabrication OF-882 : Câblage Baies Réseau Gombe',
      description: 'Assemblage des baies, étiquetage des jarretières optiques et tests de perte d\'insertion.',
      initiator: 'M. Marc Essomba (Directeur Réseaux)',
      assignedEntity: 'Division Antennes & Stations Terriennes',
      intervenants: [
        {
          initials: 'ME',
          name: 'M. Marc Essomba',
          roleTitle: 'Directeur Réseaux',
          roleBadge: 'Responsable',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
        },
        {
          initials: 'MT',
          name: 'Marc Tshimanga',
          roleTitle: 'Technicien Câblage',
          roleBadge: 'Exécutant',
          badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        }
      ],
      steps: [
        { id: 's1', label: 'Préparation et calibrage des câbles coaxiaux', completed: true, validatedBy: 'Marc Tshimanga (08:30)' },
        { id: 's2', label: 'Tests de réflectométrie optique et vérification VSWR', completed: false },
        { id: 's3', label: 'Procès-verbal de recette en atelier', completed: false }
      ],
      electronicSignature: null
    },
    {
      id: 'task-4',
      category: 'suivi',
      badgeCategory: 'Suivi Client',
      badgeCategoryColor: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
      priority: 'Normale',
      priorityColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      dueDate: '2026-10-20',
      statusText: 'À initier',
      statusColumn: 'a_faire',
      isSigned: false,
      title: 'Rapprochement Compte Client Entreprise Minière KCC & Quittance',
      description: 'Pointage des factures VSAT trimestrielles et transmission de l\'état récapitulatif pour certification.',
      initiator: 'Mme Sophie Traoré (Directrice Financière)',
      assignedEntity: 'Division Facturation & Rapprochement',
      intervenants: [
        {
          initials: 'ST',
          name: 'Mme Sophie Traoré',
          roleTitle: 'Directrice Financière',
          roleBadge: 'Validateur',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
        }
      ],
      steps: [
        { id: 's1', label: 'Extraction des relevés bancaires Rawbank USD', completed: false },
        { id: 's2', label: 'Émission du décompte certifié et lettre d\'apurement', completed: false }
      ],
      electronicSignature: null
    }
  ]);

  // Détection des approbations requises pour l'utilisateur connecté
  const isUserValidatorForTask = (task: WorkflowTask) => {
    // Si DG : accès à toutes les approbations
    if (currentUser.role === 'dg') return true;
    // Si intervenant 'Validateur' ou 'Responsable'
    const isAssigned = task.intervenants.some(
      i => (i.roleBadge === 'Validateur' || i.roleBadge === 'Responsable') && 
           (i.name.toLowerCase().includes(currentUser.name.toLowerCase()) || currentUser.name.toLowerCase().includes(i.name.toLowerCase()))
    );
    // Si chef de service avec délégation de visa (Règle 6)
    if (currentUser.canApproveServiceDocuments && currentUser.serviceId) {
      return isAssigned || task.assignedEntity.toLowerCase().includes(currentUser.roleTitle.toLowerCase());
    }
    return isAssigned;
  };

  const pendingApprovalsCount = localTasks.filter(
    t => t.statusColumn === 'en_attente_approbation' && isUserValidatorForTask(t)
  ).length;

  // Filtrage des tâches
  const filteredTasks = localTasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.initiator.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.assignedEntity.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    if (activeFilter === 'my_approvals') {
      return t.statusColumn === 'en_attente_approbation' && isUserValidatorForTask(t);
    }
    if (activeFilter === 'valide') {
      return t.statusColumn === 'valide' || t.isSigned;
    }
    if (activeFilter === 'all') return true;
    return t.category === activeFilter;
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
        const nextCol = allDone 
          ? (t.isSigned ? 'valide' : 'en_attente_approbation')
          : (updatedSteps.some(s => s.completed) ? 'en_cours' : 'a_faire');

        return {
          ...t,
          steps: updatedSteps,
          statusColumn: nextCol,
          statusText: allDone && t.isSigned 
            ? 'Opération Validée & E-Signée' 
            : allDone 
            ? 'Toutes étapes validées (En attente Visa DG)' 
            : 'En cours d\'instruction'
        };
      })
    );
  };

  // Signature et visa officiel
  const handleSignTask = (taskId: string) => {
    const task = localTasks.find(t => t.id === taskId);
    const signedBy = `${currentUser.name} (${currentUser.roleTitle})`;
    const signedAt = new Date().toLocaleString('fr-FR');
    // Empreinte SHA-256 réelle : contenu de la tâche + validateur + date.
    const hashGenerated = contentHashSync({ task: task ? { ...task, electronicSignature: undefined } : taskId, signedBy, signerId: currentUser.id, signedAt });
    const signInfo = {
      signedBy,
      signedAt,
      hash: hashGenerated
    };

    setLocalTasks(prev =>
      prev.map(t => {
        if (t.id !== taskId) return t;
        // Si document rattaché, mise à jour du statut dans le coffre documentaire
        if (t.attachedDocId && onUpdateDocument) {
          onUpdateDocument(t.attachedDocId, {
            status: 'signe',
            electronicSignature: {
              signedBy: signInfo.signedBy,
              signedAt: signInfo.signedAt,
              role: currentUser.roleTitle,
              certificateHash: hashGenerated
            }
          });
        }
        return {
          ...t,
          isSigned: true,
          statusColumn: 'valide',
          statusText: 'Opération Validée & E-Signée',
          electronicSignature: signInfo
        };
      })
    );

    if (onLogAction) {
      onLogAction('Visa Électronique & Approbation', `Tâche #${taskId} validée par ${currentUser.name} (empreinte ${shortHash(hashGenerated)}).`, 'task');
    }
  };

  // Rejet avec motif
  const handleRejectTask = () => {
    if (!rejectModalTaskId) return;
    setLocalTasks(prev =>
      prev.map(t => {
        if (t.id !== rejectModalTaskId) return t;
        return {
          ...t,
          isSigned: false,
          statusColumn: 'rejete',
          statusText: `Rejeté : ${rejectReason || 'Révision demandée par la direction'}`
        };
      })
    );
    if (onLogAction) {
      onLogAction('Rejet Tâche Workflow', `Dossier #${rejectModalTaskId} renvoyé en révision : ${rejectReason}`, 'task');
    }
    setRejectModalTaskId(null);
    setRejectReason('');
  };

  // Changement de colonne Kanban
  const handleMoveKanbanColumn = (taskId: string, newCol: WorkflowTask['statusColumn']) => {
    setLocalTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const statusLabels = {
        a_faire: 'À instruire',
        en_cours: 'En cours d\'instruction',
        en_attente_approbation: 'En attente Visa DG',
        valide: 'Opération Validée & E-Signée',
        rejete: 'Rejeté / Révision'
      };
      return {
        ...t,
        statusColumn: newCol,
        statusText: statusLabels[newCol],
        isSigned: newCol === 'valide' ? true : t.isSigned
      };
    }));
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedIds = Object.keys(assignedRoles);
    if (!taskTitle.trim() || assignedIds.length === 0) return;

    const assignedIntervenants: WorkflowIntervenant[] = allCollaborators
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

    const stepsArray: WorkflowStep[] = customSteps.map((lbl, idx) => ({
      id: `step-${Date.now()}-${idx}`,
      label: lbl,
      completed: false,
      validatedBy: undefined
    }));

    const categoryBadgeMap: Record<string, { label: string; color: string }> = {
      approbations: { label: 'Approbations (Achats)', color: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' },
      production: { label: 'Production & Réseau VSAT', color: 'bg-sky-500/20 text-sky-400 border border-sky-500/30' },
      suivi: { label: 'Suivi Client & Rapprochement', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
      jalons: { label: 'Jalon Projet', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
    };

    const taskCat = tmpl ? tmpl.category : 'approbations';

    const newTask: WorkflowTask = {
      id: `task-${Date.now()}`,
      category: taskCat,
      badgeCategory: categoryBadgeMap[taskCat].label,
      badgeCategoryColor: categoryBadgeMap[taskCat].color,
      priority,
      priorityColor: priority === 'Critique' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      dueDate,
      statusText: 'À instruire',
      statusColumn: 'a_faire',
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
    setAssignedRoles({ 'u-1': 'Validateur' });
    setInstructions('');

    if (onLogAction) {
      onLogAction('Création Tâche Workflow', `Nouvelle tâche initiée : ${newTask.title}`, 'task');
    }
  };

  const assignedCount = Object.keys(assignedRoles).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. BANNIÈRE SUPÉRIEURE */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider border border-indigo-500/30 flex items-center gap-1.5">
              <Stamp className="w-3.5 h-3.5 text-indigo-400" />
              <span>CIRCUIT DE VISA & APPROBATIONS MULTI-NIVEAUX</span>
            </span>
            {pendingApprovalsCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>{pendingApprovalsCount} Visa(s) urgent(s) en attente</span>
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Workflow Décisionnel & Approbations d'Entreprise
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Circuit complet d'instruction des dépenses, ordres de fabrication VSAT et jalons stratégiques avec visas électroniques (empreinte SHA-256) et respect de la Règle 6 de délégation hiérarchique.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Bascule Vue Liste / Kanban */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Vue Chronologique & Liste Déroulante"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Liste</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Vue Tableau Kanban des Flux"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Créer une Tâche Workflow</span>
          </button>
        </div>
      </div>

      {/* 2. RECHERCHE ET ONGLETS DE FILTRAGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Toutes les Tâches ({localTasks.length})
          </button>

          <button
            onClick={() => setActiveFilter('my_approvals')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeFilter === 'my_approvals'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-rose-500/20'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Mes Visas Requis ({pendingApprovalsCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('approbations')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeFilter === 'approbations'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Achats & Engagements
          </button>

          <button
            onClick={() => setActiveFilter('production')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeFilter === 'production'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Production & VSAT
          </button>

          <button
            onClick={() => setActiveFilter('valide')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeFilter === 'valide'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Visées</span>
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher tâche, initiateur, entité..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. VUE KANBAN DES FLUX                                                    */}
      {/* ========================================================================= */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
          {[
            { id: 'a_faire', label: '1. À Initier / Nouveau', color: 'border-slate-700 bg-slate-900/50' },
            { id: 'en_cours', label: '2. En Cours d\'Instruction', color: 'border-blue-500/30 bg-blue-950/10' },
            { id: 'en_attente_approbation', label: '3. En Attente Visa DG', color: 'border-amber-500/30 bg-amber-950/10' },
            { id: 'valide', label: '4. Validé & E-Signé', color: 'border-emerald-500/30 bg-emerald-950/10' },
            { id: 'rejete', label: '5. Rejeté / Révision', color: 'border-red-500/30 bg-red-950/10' },
          ].map(col => {
            const colTasks = filteredTasks.filter(t => t.statusColumn === col.id);
            return (
              <div key={col.id} className={`rounded-2xl border p-3 space-y-3 min-h-[500px] flex flex-col ${col.color}`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300">{col.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh]">
                  {colTasks.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-slate-500 italic">
                      Aucune opération
                    </div>
                  ) : (
                    colTasks.map(t => {
                      const completedCount = t.steps.filter(s => s.completed).length;
                      const totalCount = t.steps.length;
                      const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                      const attachedDoc = documents.find(d => d.id === t.attachedDocId);

                      return (
                        <div
                          key={t.id}
                          className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-3.5 rounded-xl shadow space-y-2.5 transition text-xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.priorityColor}`}>
                              {t.priority}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {t.dueDate}
                            </span>
                          </div>

                          <h4 className="font-bold text-white text-xs leading-snug">
                            {t.title}
                          </h4>

                          <p className="text-[11px] text-slate-400 line-clamp-2">
                            {t.description}
                          </p>

                          {/* Barre de progression */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>Étapes : {completedCount}/{totalCount}</span>
                              <span className="font-mono font-bold text-indigo-400">{progressPct}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  t.isSigned ? 'bg-emerald-500' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Document attaché */}
                          {attachedDoc && (
                            <button
                              onClick={() => setSelectedViewingDoc(attachedDoc)}
                              className="w-full flex items-center justify-between p-1.5 rounded-lg bg-sky-950/30 border border-sky-500/20 text-[10px] text-sky-300 hover:bg-sky-900/30 transition"
                            >
                              <span className="truncate max-w-[130px] font-medium">{attachedDoc.title}</span>
                              <Eye className="w-3 h-3 text-sky-400 shrink-0" />
                            </button>
                          )}

                          {/* Actions rapides de changement de statut */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                            <button
                              onClick={() => exportApprovalSlipToPDF(t, organization)}
                              title="Télécharger le bordereau officiel de visa en PDF"
                              className="p-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition"
                            >
                              <Download className="w-3 h-3" />
                            </button>

                            <div className="flex items-center gap-1">
                              {col.id !== 'valide' && (
                                <button
                                  onClick={() => handleSignTask(t.id)}
                                  title="Apposer le visa et signer la tâche"
                                  className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Viser</span>
                                </button>
                              )}
                              {col.id === 'en_attente_approbation' && (
                                <button
                                  onClick={() => setRejectModalTaskId(t.id)}
                                  title="Renvoyer en révision"
                                  className="px-1.5 py-0.5 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-[10px]"
                                >
                                  Rejeter
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VUE LISTE CHRONOLOGIQUE DES CARTES                                     */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-5">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 space-y-2">
              <GitBranch className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-bold text-sm text-slate-300">Aucune tâche trouvée</p>
              <p className="text-xs text-slate-500">Modifiez vos filtres ou lancez un nouveau workflow d'approbation.</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const completedCount = task.steps.filter(s => s.completed).length;
              const totalCount = task.steps.length;
              const isAllStepsDone = completedCount === totalCount;
              const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
              const attachedDoc = documents.find(d => d.id === task.attachedDocId);
              const canSignNow = isUserValidatorForTask(task);

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

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Bouton de téléchargement du Bordereau de Visa PDF */}
                      <button
                        onClick={() => exportApprovalSlipToPDF(task, organization)}
                        title="Télécharger le bordereau officiel d'approbation et de visa hiérarchique au format PDF"
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Bordereau PDF</span>
                      </button>

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

                  {/* PIÈCE DOCUMENTAIRE RATTACHÉE */}
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

                  {/* Intervenants assignés */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-indigo-400" />
                        Personnes assignées pour intervenir ({task.intervenants.length})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold">
                        Circuit de Visa Hiérarchique
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

                  {/* Étapes du Workflow avec émargement */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-[11px] text-slate-400">
                        ÉTAPES DU WORKFLOW OPÉRATIONNEL ({progressPct}%)
                      </span>
                      <span className="font-mono font-bold text-slate-300">
                        {completedCount} / {totalCount} COMPLÉTÉES
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all duration-300 ${
                          task.isSigned ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
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
                            {step.validatedBy ? `Validé par ${step.validatedBy}` : 'Cliquer pour émarger'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cadre E-Signature & Scellé Cryptographique */}
                  {task.electronicSignature ? (
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 space-y-1.5 text-xs">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Visa électronique</span>
                      </div>
                      <p className="text-slate-200 text-[11px]">
                        Validé & signé par <strong>{task.electronicSignature.signedBy}</strong> le {task.electronicSignature.signedAt}
                      </p>
                      <p className="font-mono text-[10px] text-emerald-400/90 truncate">
                        Empreinte SHA-256 : {shortHash(task.electronicSignature.hash)}
                      </p>
                    </div>
                  ) : (
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-400">
                        {isAllStepsDone
                          ? 'Toutes les étapes opérationnelles sont complétées. Prêt pour l\'apposition du visa de clôture.'
                          : 'Émargez chaque étape ci-dessus pour débloquer la signature finale.'}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRejectModalTaskId(task.id)}
                          className="px-3 py-1.5 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs font-semibold transition"
                        >
                          Refuser / Révision
                        </button>

                        <button
                          disabled={!isAllStepsDone && !canSignNow}
                          onClick={() => handleSignTask(task.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                            isAllStepsDone || canSignNow
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Apposer le Visa & E-Signature</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL DU DOCUMENT RATTACHÉ CONSULTABLE EN DIRECT */}
      {selectedViewingDoc && (
        <RhemaOfficialDocument
          document={selectedViewingDoc}
          organization={organization}
          currentUser={currentUser}
          entities={entities}
          onClose={() => setSelectedViewingDoc(null)}
          onSignDocument={(docId) => {
            if (onUpdateDocument) {
              onUpdateDocument(docId, { status: 'signe' });
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. MODALE CRÉER UNE TÂCHE EN WORKFLOW AVEC RATTACHEMENT DOCUMENTAIRE       */}
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
                  <option value="production">Ordre de Fabrication & Production VSAT</option>
                  <option value="suivi">Suivi Client & Relance Commerciale</option>
                  <option value="jalons">Jalon Projet & Audit Qualité Réseau</option>
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
                      Définissez les intervenants habilités pour valider ce palier.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {assignedCount} sélectionné(s)
                  </span>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5">
                  {availableCollaborators.map(collab => {
                    const isAssigned = Boolean(assignedRoles[collab.id]);
                    const currentRole = assignedRoles[collab.id] || 'Exécutant';
                    return (
                      <div
                        key={collab.id}
                        className={`p-2 rounded-lg border flex items-center justify-between text-xs transition ${
                          isAssigned
                            ? 'bg-indigo-950/30 border-indigo-500/40 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className="flex items-center gap-2 cursor-pointer flex-1"
                          onClick={() => toggleCollaborator(collab.id)}
                        >
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] ${
                            isAssigned ? 'bg-indigo-600 text-white' : 'border border-slate-600'
                          }`}>
                            {isAssigned && '✓'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-[11px]">{collab.name}</div>
                            <div className="text-[10px] text-slate-400">{collab.roleTitle}</div>
                          </div>
                        </div>

                        {isAssigned && (
                          <div className="flex items-center gap-1">
                            {(['Responsable', 'Exécutant', 'Validateur'] as const).map(role => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => changeRoleForUser(collab.id, role)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                                  currentRole === role
                                    ? role === 'Responsable'
                                      ? 'bg-indigo-600 text-white'
                                      : role === 'Validateur'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-amber-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Date & Priorité */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Date d'Échéance
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Priorité
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Normale">Normale</option>
                    <option value="Haute">Haute</option>
                    <option value="Critique">Critique</option>
                  </select>
                </div>
              </div>

              {/* Pièce jointe documentaire */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Pièce Jointe Documentaire (Optionnelle)
                </label>
                <select
                  value={attachedDocId}
                  onChange={e => setAttachedDocId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Aucune pièce jointe --</option>
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.referenceNumber})
                    </option>
                  ))}
                </select>
              </div>

              {/* Instructions */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Description & Consignes
                </label>
                <textarea
                  rows={2}
                  placeholder="Détails des opérations à réaliser..."
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
