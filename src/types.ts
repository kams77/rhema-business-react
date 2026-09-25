export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  userName: string;
  userRole: string;
  action: string;
  category: 'auth' | 'document' | 'task' | 'security' | 'hierarchy' | 'admin';
  details: string;
  ip: string;
  hash: string;
}

export type OrganizationType = 'entreprise' | 'etablissement' | 'ong';
export type EntityLevel = 'departement' | 'direction' | 'division' | 'service';

export type UserRole = 
  | 'dg' 
  | 'chef_departement' 
  | 'directeur' 
  | 'chef_division' 
  | 'chef_service' 
  | 'agent';




export interface HierarchicalEntity {
  id: string;
  name: string;
  code: string;
  level: EntityLevel;
  parentId?: string;
  organizationId: string;
  managerName?: string;
  managerEmail?: string;
  managerRole?: UserRole;
  description?: string;
  agentCount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  organizationId: string;
  departementId?: string;
  directionId?: string;
  divisionId?: string;
  serviceId?: string;
  avatar?: string;
  status: 'actif' | 'verrouille' | 'suspendu' | 'convoque';
  failedAccessAttempts: number;
  lastLogin?: string;
  phone?: string;
  canCreateSubAgents: boolean;
}

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  registrationNumber: string;
  headquarters: string;
  email: string;
  phone: string;
  logo?: string;
  managerName?: string;
  managerRole?: string;
  managerEmail?: string;
  hasDepartements: boolean;
  hasDirections: boolean;
  hasDivisions: boolean;
  hasServices: boolean;
  description: string;
  createdAt: string;
}

export type DocumentCategory = 
  | 'financier_comptable'
  | 'chaine_logistique_commerciale'
  | 'ressources_humaines';

export type DocumentSubtype = 
  | 'facture_client' | 'facture_fournisseur' | 'avoir' | 'bilan_comptable'
  | 'devis' | 'bon_commande_client' | 'bon_livraison' | 'bon_reception'
  | 'contrat_travail' | 'bulletin_de_paie' | 'fiche_poste' | 'feuille_de_temps';

export interface DocumentItem {
  id: string;
  title: string;
  referenceNumber: string;
  category: DocumentCategory;
  subtype: DocumentSubtype;
  organizationId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorEntity: string;
  createdAt: string;
  status: 'brouillon' | 'en_revue' | 'approuve' | 'signe' | 'rejete';
  size: string;
  fileType: string;
  targetEntityId?: string;
  targetEntityName?: string;
  targetUserId?: string;
  isConfidentialPayslip?: boolean;
  amount?: number;
  currency?: string;
  electronicSignature?: {
    signedBy: string;
    signedAt: string;
    role: string;
    certificateHash: string;
    stampUrl?: string;
  };
  allowedRoles: UserRole[];
  permissions: {
    viewRoles: UserRole[];
    editRoles: UserRole[];
    validateRoles: UserRole[];
    signRoles: UserRole[];
  };
  description?: string;
}

export type TaskType = 'approbation' | 'production' | 'suivi_client' | 'projet';

export interface TaskIntervenant {
  userId: string;
  userName: string;
  userRole: UserRole;
  userRoleTitle: string;
  entityName?: string;
  roleType: 'responsable' | 'executant' | 'contributeur' | 'validateur';
}

export interface TaskItem {
  id: string;
  title: string;
  type: TaskType;
  description: string;
  organizationId: string;
  creatorId: string;
  creatorName: string;
  creatorRole: UserRole;
  assignedEntityId: string;
  assignedEntityName: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedIntervenants: TaskIntervenant[];
  priority: 'basse' | 'normale' | 'haute' | 'critique';
  status: 'a_faire' | 'en_cours' | 'en_attente_approbation' | 'validee_terminee' | 'bloquee';
  dueDate: string;
  createdAt: string;
  steps: {
    id: string;
    label: string;
    completed: boolean;
    completedBy?: string;
    completedAt?: string;
    assignedToUserId?: string;
    assignedToUserName?: string;
  }[];
  signatureRequired: boolean;
  signature?: {
    signedBy: string;
    role: string;
    timestamp: string;
    hash: string;
  };
}

export type NavigationTab = 
  | 'workspace'
  | 'hierarchy' 
  | 'documents' 
  | 'workflows' 
  | 'payroll'
  | 'security' 
  | 'agents' 
  | 'audit';

export interface SecurityAlert {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userEntityName: string;
  targetEntityId: string;
  targetEntityName: string;
  attemptCount: number;
  status: 'alerte_emise' | 'compte_verrouille' | 'convocation_programmee' | 'resolue';
  severity: 'moyenne' | 'haute' | 'critique';
  ipAddress: string;
  reason: string;
}

// -------------------------------------------------------------
// MODULE PAIE & RH RDC AVANCÉ (CONFORME RDC CDF / USD & CAHIER DE CHARGES)
// -------------------------------------------------------------

export interface EmployeeContract {
  id: string;
  userId: string;
  employeeCode: string;
  matricule: string;
  contractType: 'CDI' | 'CDD' | 'Stage' | 'Consultant' | 'Journalier';
  startDate: string;
  endDate?: string;
  baseSalary: number;
  salaryCurrency: 'USD' | 'CDF';
  categoryPro: string; // Ex: Cadre Dirigeant, Agent de Maîtrise, Exécution
  echelon: string;
  cnssNumber: string;
  inppRegistered: boolean;
  onemRegistered: boolean;
  bankName: string;
  bankAccountNumber: string;
  mobileMoneyNumber?: string;
  paymentMode: 'virement' | 'mobile_money' | 'cheque' | 'especes';
  dependentsCount: number;
  maritalStatus: 'celibataire' | 'marie' | 'divorce' | 'veuf';
  active: boolean;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: 'conge_annuel' | 'maladie' | 'maternite' | 'circonstance' | 'sans_solde';
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  status: 'en_attente' | 'approuve' | 'rejete';
  approvedBy?: string;
  approvedAt?: string;
  certificateUrl?: string;
}

export interface SalaryAdvanceRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  currency: 'USD' | 'CDF';
  requestDate: string;
  repaymentMonth: string; // Ex: 2026-10
  reason: string;
  status: 'en_attente' | 'valide_rh' | 'paye' | 'rejete';
  deductedFromPayroll: boolean;
}

export interface PayrollRunPeriod {
  id: string;
  month: string; // Ex: 2026-09
  title: string; // Ex: Paie Septembre 2026
  currency: 'USD' | 'CDF';
  exchangeRateUSD_CDF: number; // Taux de change officiel BCC (ex: 2850 CDF = 1 USD)
  status: 'brouillon' | 'en_validation' | 'cloture' | 'archive';
  totalGross: number;
  totalNet: number;
  totalEmployerCharges: number;
  totalEmployees: number;
  validatedByDG?: string;
  validatedAt?: string;
  closureHash?: string;
}

export interface PayslipRecord {
  id: string;
  payrollRunId: string;
  userId: string;
  employeeName: string;
  matricule: string;
  department: string;
  period: string; // 09/2026
  baseSalary: number;
  currency: 'USD' | 'CDF';
  exchangeRate: number;
  seniorityBonus: number;
  overtimeHours: number;
  overtimePay: number;
  allowances: { name: string; amount: number; isTaxable: boolean }[];
  grossSalary: number;
  
  // Cotisations RDC
  cnssEmployee: number; // 5% CNSS
  iprTax: number; // IPR (Impôt Professionnel sur les Rémunérations)
  salaryAdvanceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  
  netToPay: number;
  
  // Charges patronales RDC
  cnssEmployer: number; // 13% CNSS (9% pensions + 4% prestations/risques)
  inppEmployer: number; // INPP (3% employeur)
  onemEmployer: number; // ONEM (0.2%)
  totalEmployerCost: number;
  
  status: 'emis' | 'signe_electronique' | 'paye';
  signatureHash?: string;
  signedAt?: string;
}