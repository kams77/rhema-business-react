// src/lib/workflow.ts — accès typé au circuit de validation commun (shared/workflow.mjs)
// et fabriques de documents / tâches utilisées par les modules.
import * as wf from '../../shared/workflow.mjs';
import { holdsPosition } from '../../shared/access.mjs';
import type {
  ApprovalStep,
  DocumentCategory,
  DocumentItem,
  DocumentSubtype,
  HierarchicalEntity,
  TaskIntervenant,
  TaskItem,
  User,
  UserRole,
  WorkflowHistoryEntry,
} from '../types';
import { newId } from '../utils/id';
import type { SignatureData } from '../components/ElectronicSignatureModal';

export type AmountRule = 'aucun' | 'facultatif' | 'requis';

export interface DocumentTypeInfo {
  label: string;
  category: DocumentCategory;
  amount: AmountRule;
  chain: string[];
  dgAbove?: number;
  finalKind?: 'signature' | 'visa';
  confidential?: boolean;
  hint?: string;
}

const W = wf as unknown as {
  ROLE_LABELS: Record<UserRole, string>;
  DOCUMENT_CATEGORIES: Record<DocumentCategory, string>;
  DOCUMENT_TYPES: Record<DocumentSubtype, DocumentTypeInfo>;
  documentType: (s: string) => DocumentTypeInfo;
  documentTypesFor: (c: DocumentCategory) => (DocumentTypeInfo & { value: DocumentSubtype })[];
  userAnchorEntityId: (u?: User) => string | undefined;
  entityAncestry: (id: string | undefined, e: HierarchicalEntity[]) => HierarchicalEntity[];
  buildDocumentChain: (doc: Partial<DocumentItem>, author: User, e: HierarchicalEntity[], u?: User[]) => ApprovalStep[];
  resolveChain: (levels: string[], author: User, e: HierarchicalEntity[], u?: User[], finalKind?: 'signature' | 'visa') => ApprovalStep[];
  currentStep: (w?: { steps: ApprovalStep[] }) => ApprovalStep | undefined;
  canActOnDocument: (u: User, d: DocumentItem) => boolean;
  submitDocument: (d: DocumentItem, steps: ApprovalStep[], actor: User, at?: string) => DocumentItem;
  draftDocument: (d: DocumentItem, steps: ApprovalStep[], actor: User, at?: string) => DocumentItem;
  decideDocument: (d: DocumentItem, actor: User, o: { decision: 'approve' | 'reject'; comment?: string; signature?: DocumentItem['electronicSignature']; signatureHash?: string; at?: string }) => DocumentItem;
  workflowSummary: (d: DocumentItem) => { total: number; done: number; current?: ApprovalStep; rejected?: ApprovalStep };
  canDeleteDocument: (u: User, d: DocumentItem) => boolean;
  taskRoleOf: (u: User, t: TaskItem) => TaskIntervenant['roleType'] | undefined;
  canSeeTask: (u: User, t: TaskItem, e: HierarchicalEntity[]) => boolean;
  canEditTask: (u: User, t: TaskItem, e: HierarchicalEntity[]) => boolean;
  canExecuteTask: (u: User, t: TaskItem) => boolean;
  canValidateTaskNow: (u: User, t: TaskItem) => boolean;
  canTickTaskStep: (u: User, t: TaskItem, s: TaskItem['steps'][number]) => boolean;
  buildTaskApprovalChain: (t: TaskItem, e: HierarchicalEntity[], u: User[]) => ApprovalStep[];
  canDeleteTask: (u: User, t: TaskItem) => boolean;
};

export const ROLE_LABELS = W.ROLE_LABELS;
export const DOCUMENT_CATEGORIES = W.DOCUMENT_CATEGORIES;
export const DOCUMENT_TYPES = W.DOCUMENT_TYPES;
export const documentType = W.documentType;
export const documentTypesFor = W.documentTypesFor;
export const userAnchorEntityId = W.userAnchorEntityId;
export const entityAncestry = W.entityAncestry;
export const buildDocumentChain = W.buildDocumentChain;
export const currentStep = W.currentStep;
export const canActOnDocument = W.canActOnDocument;
export const decideDocument = W.decideDocument;
export const submitDocument = W.submitDocument;
export const draftDocument = W.draftDocument;
export const workflowSummary = W.workflowSummary;
export const canDeleteDocument = W.canDeleteDocument;
export const taskRoleOf = W.taskRoleOf;
export const canSeeTask = W.canSeeTask;
export const canEditTask = W.canEditTask;
export const canExecuteTask = W.canExecuteTask;
export const canValidateTaskNow = W.canValidateTaskNow;
export const canTickTaskStep = W.canTickTaskStep;
export const buildTaskApprovalChain = W.buildTaskApprovalChain;
export const canDeleteTask = W.canDeleteTask;

const ALL_ROLES: UserRole[] = ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'];

/** Supérieur hiérarchique direct (N+1) : premier responsable en poste au-dessus de l'utilisateur. */
export function directManager(user: User, entities: HierarchicalEntity[], users: User[]): { name: string; label: string } | undefined {
  if (user.role === 'dg') return undefined;
  const steps = W.resolveChain(['service', 'division', 'direction', 'departement', 'dg'], user, entities, users);
  const first = steps.find(s => !s.approverUserId);
  if (!first) return undefined;
  return { name: first.expectedHolderName || first.label, label: first.label };
}

/** Compte du supérieur hiérarchique direct (N+1), s'il est en poste. */
export function directManagerUser(user: User, entities: HierarchicalEntity[], users: User[]): User | undefined {
  if (user.role === 'dg') return undefined;
  const step = W.resolveChain(['service', 'division', 'direction', 'departement', 'dg'], user, entities, users).find(s => !s.approverUserId);
  if (!step) return undefined;
  return users.find(u => u.id !== user.id && holdsPosition(u as never, step.approverRole, step.entityId));
}

/** Nom de l'entité de rattachement d'un utilisateur. */
export function anchorEntity(user: User, entities: HierarchicalEntity[]): HierarchicalEntity | undefined {
  const id = W.userAnchorEntityId(user);
  return id ? entities.find(e => e.id === id) : undefined;
}

/** Référence lisible d'un document : PRÉFIXE-AAAA-NNN. */
export function nextReference(prefix: string, existing: { referenceNumber?: string; reference?: string }[]): string {
  const year = new Date().getFullYear();
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max = existing.reduce((m, d) => {
    const match = re.exec(d.referenceNumber || d.reference || '');
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(3, '0')}`;
}

export const REFERENCE_PREFIX: Partial<Record<DocumentSubtype, string>> = {
  note_service: 'NS', communique: 'COM', rapport_activite: 'RAP', proces_verbal: 'PV',
  demande_achat: 'DA', note_frais: 'NF', facture_client: 'FAC', facture_fournisseur: 'FF', avoir: 'AV',
  bilan_comptable: 'BIL', devis: 'PRO', bon_commande_client: 'BC', bon_livraison: 'BL', bon_reception: 'BR',
  bon_entree_stock: 'BES', bon_sortie_stock: 'BSS', ordre_transfert: 'OTIH', contrat_commercial: 'CTC',
  demande_conge: 'CONG', fiche_poste: 'FP', feuille_de_temps: 'FT', contrat_travail: 'CT',
  declaration_sociale: 'DCL', bulletin_de_paie: 'BP',
};

interface NewDocumentInput {
  title: string;
  subtype: DocumentSubtype;
  description: string;
  author: User;
  organizationId: string;
  entities: HierarchicalEntity[];
  users: User[];
  referenceNumber?: string;
  existingDocuments?: DocumentItem[];
  targetEntityId?: string;
  targetUserId?: string;
  targetUserName?: string;
  amount?: number;
  currency?: string;
  /** 'public' : toute l'entreprise ; 'perimetre' : l'entité cible ; 'direction' : cadres dirigeants. */
  audience?: 'public' | 'perimetre' | 'direction';
  source?: DocumentItem['source'];
  id?: string;
  /** false = brouillon (circuit prévu, non lancé). */
  submit?: boolean;
  /** Signer immédiatement si l'émetteur est seul dans son circuit (documents générés par un module). */
  autoSignIfAlone?: boolean;
  signatureHash?: string;
}

/** Crée un document et son circuit de validation (brouillon ou soumis). */
export function createDocument(input: NewDocumentInput): DocumentItem {
  const type = documentType(input.subtype);
  const target = input.targetEntityId ? input.entities.find(e => e.id === input.targetEntityId) : undefined;
  const origin = anchorEntity(input.author, input.entities);
  const allowed: UserRole[] = type.confidential || input.audience === 'direction'
    ? ['dg', 'chef_departement', 'directeur']
    : ALL_ROLES;
  const amount = type.amount === 'aucun' ? undefined : input.amount;
  const base: DocumentItem = {
    id: input.id || newId('doc'),
    title: input.title.trim(),
    referenceNumber: input.referenceNumber || nextReference(REFERENCE_PREFIX[input.subtype] || 'DOC', input.existingDocuments || []),
    category: type.category,
    subtype: input.subtype,
    organizationId: input.organizationId,
    authorId: input.author.id,
    authorName: input.author.name,
    authorRole: input.author.role,
    authorEntity: input.author.departmentName || input.author.roleTitle,
    originEntityId: origin?.id,
    originEntityName: origin?.name,
    createdAt: new Date().toISOString().split('T')[0],
    status: 'brouillon',
    size: '—',
    fileType: 'PDF',
    amount: typeof amount === 'number' && !Number.isNaN(amount) ? amount : undefined,
    currency: typeof amount === 'number' && !Number.isNaN(amount) ? (input.currency || 'USD') : undefined,
    targetEntityId: input.audience === 'public' ? undefined : (target?.id || (input.audience === 'perimetre' ? origin?.id : undefined)),
    targetEntityName: input.audience === 'public' ? undefined : (target?.name || (input.audience === 'perimetre' ? origin?.name : undefined)),
    targetUserId: input.targetUserId,
    targetUserName: input.targetUserName,
    isConfidentialPayslip: input.subtype === 'bulletin_de_paie' || undefined,
    description: input.description.trim(),
    source: input.source,
    allowedRoles: allowed,
    permissions: { viewRoles: allowed, editRoles: [input.author.role], validateRoles: ALL_ROLES, signRoles: ALL_ROLES },
  };
  const steps = buildDocumentChain(base, input.author, input.entities, input.users);
  if (input.submit === false) return draftDocument(base, steps, input.author);
  let doc = submitDocument(base, steps, input.author);
  const step = currentStep(doc.workflow);
  if (input.autoSignIfAlone && step && step.approverUserId === input.author.id) {
    doc = decideDocument(doc, input.author, {
      decision: 'approve',
      signatureHash: input.signatureHash,
      signature: input.signatureHash ? {
        signedBy: input.author.name,
        signedAt: new Date().toISOString(),
        role: input.author.roleTitle,
        certificateHash: input.signatureHash,
      } : undefined,
    });
  }
  return doc;
}

/** Titulaire attendu de l'étape en cours (texte pour les écrans). */
export function waitingFor(step?: ApprovalStep): string {
  if (!step) return '';
  return step.expectedHolderName ? `${step.expectedHolderName} (${step.label})` : step.label;
}

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

export function intervenant(user: User, roleType: TaskIntervenant['roleType'], entities: HierarchicalEntity[]): TaskIntervenant {
  return {
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    userRoleTitle: user.roleTitle,
    entityName: anchorEntity(user, entities)?.name || user.departmentName,
    roleType,
  };
}

export function historyEntry(actor: User | undefined, action: string, label: string, comment?: string): WorkflowHistoryEntry {
  return {
    id: newId('hist'),
    at: new Date().toISOString(),
    actorId: actor?.id,
    actorName: actor?.name || 'Système',
    action,
    label,
    ...(comment ? { comment } : {}),
  };
}

interface NewTaskInput {
  title: string;
  type: TaskItem['type'];
  description: string;
  creator: User;
  organizationId: string;
  entity: HierarchicalEntity | undefined;
  intervenants: TaskIntervenant[];
  steps: { label: string; assignedTo?: User; dueDate?: string }[];
  priority?: TaskItem['priority'];
  startDate?: string;
  dueDate: string;
  estimatedHours?: number;
  site?: string;
  deliverable?: string;
  acceptanceCriteria?: string;
  tags?: string[];
  linkedDocumentIds?: string[];
  signatureRequired?: boolean;
  source?: TaskItem['source'];
  existingTasks: TaskItem[];
}

export function createTask(input: NewTaskInput): TaskItem {
  const executor = input.intervenants.find(i => i.roleType === 'executant');
  return {
    id: newId('task'),
    reference: nextReference('TSK', input.existingTasks),
    title: input.title.trim(),
    type: input.type,
    description: input.description.trim(),
    organizationId: input.organizationId,
    creatorId: input.creator.id,
    creatorName: input.creator.name,
    creatorRole: input.creator.role,
    assignedEntityId: input.entity?.id || '',
    assignedEntityName: input.entity?.name || '',
    assignedAgentId: executor?.userId,
    assignedAgentName: executor?.userName,
    assignedIntervenants: input.intervenants,
    priority: input.priority || 'normale',
    status: 'a_faire',
    startDate: input.startDate,
    dueDate: input.dueDate,
    createdAt: new Date().toISOString().split('T')[0],
    estimatedHours: input.estimatedHours,
    spentHours: 0,
    site: input.site,
    deliverable: input.deliverable,
    acceptanceCriteria: input.acceptanceCriteria,
    tags: input.tags,
    linkedDocumentIds: input.linkedDocumentIds,
    source: input.source,
    steps: input.steps.map((s, i) => ({
      id: `${newId('st')}-${i}`,
      label: s.label,
      completed: false,
      assignedToUserId: s.assignedTo?.id,
      assignedToUserName: s.assignedTo?.name,
      dueDate: s.dueDate,
    })),
    signatureRequired: !!input.signatureRequired,
    comments: [],
    history: [historyEntry(input.creator, 'creation', input.source ? `Tâche créée automatiquement (${input.source.module})` : 'Tâche créée et assignée')],
    updatedAt: new Date().toISOString(),
  };
}

/** Avancement d'une tâche en %, d'après ses étapes. */
export const taskProgress = (t: TaskItem) => (t.steps.length ? Math.round((t.steps.filter(s => s.completed).length / t.steps.length) * 100) : (t.status === 'validee_terminee' || t.status === 'termine' ? 100 : 0));

/** Tâche en retard (échéance dépassée et non terminée). */
export function isTaskLate(t: TaskItem, today = new Date().toISOString().split('T')[0]): boolean {
  return !!t.dueDate && t.dueDate < today && !['validee_terminee', 'termine', 'annulee'].includes(t.status);
}

export const TASK_STATUS_LABELS: Record<TaskItem['status'], string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  en_attente_approbation: 'En validation',
  validee_terminee: 'Validée',
  termine: 'Terminée',
  bloquee: 'Bloquée',
  annulee: 'Annulée',
};

export const TASK_TYPE_LABELS: Record<TaskItem['type'], string> = {
  approbation: 'Approbation',
  production: 'Production',
  suivi_client: 'Suivi client',
  projet: 'Projet',
  jalons: 'Jalon projet',
  suivi: 'Suivi',
  deploiement: 'Déploiement terrain',
  audit: 'Audit / contrôle',
  logistique: 'Logistique',
  administratif: 'Administratif',
  maintenance: 'Maintenance',
  formation: 'Formation',
};

export const PRIORITY_LABELS: Record<TaskItem['priority'], string> = {
  basse: 'Basse', normale: 'Normale', haute: 'Haute', critique: 'Critique',
};

// ---------------------------------------------------------------------------
// Actions proposées par les écrans (appliquées par App.tsx)
// ---------------------------------------------------------------------------

export type DocumentAction =
  | { type: 'submit' }
  | { type: 'resubmit'; updates?: Partial<DocumentItem> }
  | { type: 'approve'; comment?: string; signature?: SignatureData }
  | { type: 'reject'; comment: string }
  | { type: 'delete' };

export type TaskAction =
  | { type: 'start' }
  | { type: 'toggle_step'; stepId: string }
  | { type: 'log_hours'; hours: number; note?: string }
  | { type: 'comment'; text: string }
  | { type: 'submit'; comment?: string }
  | { type: 'approve'; comment?: string }
  | { type: 'reject'; comment: string }
  | { type: 'block'; reason: string }
  | { type: 'unblock' }
  | { type: 'cancel'; reason?: string }
  | { type: 'delete' };

/** Libellés des jalons d'une expédition (tâche de suivi générée automatiquement). */
export const SHIPMENT_STEP_LABELS: Record<'depart_fournisseur' | 'fret_en_transit' | 'arrivee_douane' | 'dedouanement_dgda' | 'transit_national' | 'livre_sur_site', string> = {
  depart_fournisseur: 'Départ fournisseur confirmé',
  fret_en_transit: 'Fret en transit',
  arrivee_douane: 'Arrivée en douane',
  dedouanement_dgda: 'Dédouanement DGDA',
  transit_national: 'Transit national vers le site',
  livre_sur_site: 'Livré sur site',
};
