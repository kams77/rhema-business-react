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
  /** Empreinte SHA-256 chaînée : SHA-256(prevHash + contenu). */
  hash: string;
  /** Empreinte de l'entrée précédente (« GENESIS » pour la première). */
  prevHash?: string;
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
  /** @deprecated Mot de passe en clair des données de démonstration : converti en `passwordHash` au démarrage. */
  password?: string;
  /** Empreinte PBKDF2 du mot de passe (voir src/lib/auth.ts). */
  passwordHash?: string;
  /** Oblige l'utilisateur à choisir un nouveau mot de passe à sa prochaine connexion. */
  mustChangePassword?: boolean;
  matricule?: string;
  employeeCode?: string;
  role: UserRole;
  roleTitle: string;
  organizationId: string;
  departementId?: string;
  directionId?: string;
  divisionId?: string;
  serviceId?: string;
  departmentName?: string;
  avatar?: string;
  status: 'actif' | 'verrouille' | 'suspendu' | 'convoque';
  failedAccessAttempts: number;
  lastLogin?: string;
  phone?: string;
  canCreateSubAgents: boolean;
  canApproveServiceDocuments?: boolean;
  /** Accès à la paie accordé (true) ou retiré (false) explicitement par le DG. */
  canManagePayroll?: boolean;
  /** Blocage temporaire (comptes DG) : horodatage de fin, en millisecondes. */
  lockedUntil?: number;
}

export interface Organization {
  id: string;
  name: string;
  code?: string;
  type: OrganizationType;
  registrationNumber: string;
  rccm?: string;
  idNat?: string;
  numImpot?: string;
  directorGeneral?: string;
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
  /** Coordonnées bancaires officielles (renseignées par le DG), imprimées sur les factures. */
  bankAccounts?: OrganizationBankAccount[];
}

export interface OrganizationBankAccount {
  id: string;
  bankName: string;
  accountNumberUSD: string;
  accountNumberCDF: string;
  swiftBic: string;
  ibanOrRib: string;
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
  /** Bulletin de paie : données complètes calculées par le moteur de paie (pour réimpression). */
  payslipData?: import('./utils/exportUtils').PayslipExportData;
  fileType: string;
  targetEntityId?: string;
  targetEntityName?: string;
  targetUserId?: string;
  targetUserName?: string;
  isConfidentialPayslip?: boolean;
  amount?: number;
  currency?: string;
  electronicSignature?: {
    signedBy: string;
    signedAt: string;
    role: string;
    certificateHash: string;
    stampUrl?: string;
    signatureImage?: string;
    signatureType?: 'draw' | 'type' | 'certificate';
    legalConsent?: boolean;
    verificationAudit?: {
      sha256Checked: boolean;
      rbacChecked: boolean;
      timestampChecked: boolean;
      sealedAt: string;
      token: string;
    };
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

export type TaskType = 'approbation' | 'production' | 'suivi_client' | 'projet' | 'jalons' | 'suivi' | 'deploiement' | 'audit';

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
  status: 'a_faire' | 'en_cours' | 'en_attente_approbation' | 'validee_terminee' | 'bloquee' | 'termine';
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
  | 'bulk_import'
  | 'attendance_dispatch'
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
  bankAccountNumber?: string;
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

export interface OvertimeRecord {
  id: string;
  userId: string;
  userName: string;
  month: string;
  dayHours: number;
  nightHours: number;
  holidayHours: number;
  hourlyRate?: number;
  calculatedAmountUSD?: number;
  calculatedAmountCDF?: number;
  currency?: 'USD' | 'CDF';
  status: 'en_attente' | 'approuve' | 'rejete';
  reason?: string;
}

export interface DisciplinaryAction {
  id: string;
  userId: string;
  userName: string;
  type: 'avertissement' | 'blame' | 'mise_a_pied' | 'licenciement';
  title: string;
  date: string;
  reason: string;
  status: 'en_cours' | 'notifie' | 'clos';
  issuedBy?: string;
  legalArticleRef?: string;
}

export interface PayrollRunPeriod {
  id: string;
  month: string; // Ex: 2026-09
  title: string; // Ex: Paie Septembre 2026
  currency: 'USD' | 'CDF';
  exchangeRateUSD_CDF: number; // Taux de change officiel BCC (ex: 2850 CDF = 1 USD)
  status: 'brouillon' | 'parametre' | 'en_validation' | 'valide_drh' | 'virement_confirme' | 'cloture' | 'archive';
  totalGross: number;
  totalNet: number;
  totalEmployerCharges: number;
  totalEmployees: number;
  validatedByDRH?: string;
  validatedAtDRH?: string;
  bankTransferConfirmedBy?: string;
  bankTransferReference?: string;
  bankTransferConfirmedAt?: string;
  bankName?: string;
  payslipsAutoDispatched?: boolean;
  payslipsDispatchedAt?: string;
  dispatchedCount?: number;
  validatedByDG?: string;
  validatedAt?: string;
  closureHash?: string;
  hash?: string;
  /** Prime exceptionnelle versée à tous pour la période (devise de la période). */
  extraBonus?: number;
  /** Qui a réellement validé / confirmé chaque étape (identifiant du compte). */
  validatedByDRHUserId?: string;
  bankTransferConfirmedByUserId?: string;
}

export interface PayrollAllowance {
  id: string;
  name: string;
  code: string;
  type: 'fixe' | 'pourcentage';
  defaultValue: number;
  isTaxable: boolean;
  isSubjectToSocialContributions: boolean;
  isActive: boolean;
  category: 'transport' | 'logement' | 'responsabilite' | 'repas' | 'performance' | 'autre';
  description?: string;
}

export interface PayrollSocialContribution {
  id: string;
  name: string;
  code: string;
  employeeRate: number;
  employerRate: number;
  ceilingAmount?: number;
  isActive: boolean;
  description?: string;
}

export interface PayrollTaxBracket {
  id: string;
  min: number;
  max: number | null;
  rate: number;
}

export interface PayrollSystemConfig {
  id: string;
  organizationId: string;
  isStandardTemplate: boolean;
  systemName: string;
  currency: 'USD' | 'CDF';
  standardMonthlyHours: number;
  overtimeRates: {
    firstBracketRate: number;
    secondBracketRate: number;
    weekendHolidayRate: number;
  };
  payFrequency: 'mensuelle' | 'bimensuelle' | 'hebdomadaire';
  allowances: PayrollAllowance[];
  socialContributions: PayrollSocialContribution[];
  taxConfig: {
    taxName: string;
    type: 'progressif' | 'fixe';
    brackets: PayrollTaxBracket[];
    flatRate?: number;
    creditPerDependentChild: number;
    localDevelopmentTax: number;
  };
  seniorityBonusPerTwoYearsPercent: number;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  notes?: string;
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

// -------------------------------------------------------------
// MODULE POINTAGE & HORODATAGE 28 JOURS OUVRABLES RDC
// -------------------------------------------------------------

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  matricule: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  effectiveHours: number;
  overtimeDayHours: number;
  overtimeNightHours: number;
  overtimeHolidayHours: number;
  ipAddress: string;
  status: 'present' | 'retard' | 'mission' | 'conge' | 'absent';
  entityId: string;
  entityName: string;
  isCertified: boolean;
}

export interface Attendance28DaysCycleReport {
  id: string;
  cycleNumber: number;
  monthPeriod: string; // Ex: 09/2026
  workingDaysCompleted: number; // Ex: 28 jours ouvrables
  targetWorkingDays: number; // 28 jours ouvrables
  entityId: string;
  entityName: string;
  entityLevel: EntityLevel;
  managerId?: string;
  managerName: string;
  managerEmail: string;
  managerRole: UserRole;
  totalAgents: number;
  totalNormalHours: number;
  totalOvertimeHours: number;
  overtimeDayHours: number;
  overtimeNightHours: number;
  overtimeHolidayHours: number;
  autoDispatchedAt?: string;
  isAutoDispatched: boolean;
  status: 'en_cours' | 'cycle_28j_atteint' | 'transmis_responsable' | 'valide_drh';
  agentSummaries: {
    userId: string;
    userName: string;
    matricule: string;
    daysWorked: number;
    normalHours: number;
    overtimeHours: number;
    overtimeDay: number;
    overtimeNight: number;
    overtimeHoliday: number;
    estimatedOvertimeBonusUSD: number;
  }[];
  sha256Hash: string;
  signatureCert?: {
    signedBy: string;
    signedAt: string;
    role: string;
  };
}

// -------------------------------------------------------------
// MODULE LOGISTIQUE : ÉQUIPEMENTS VSAT & ÉNERGIE SOLAIRE (RDC)
// -------------------------------------------------------------

export type EquipmentCategory = 'vsat' | 'energie_solaire' | 'solaire' | 'hybride';

export interface LogisticsItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  subcategory: string;
  sku: string;
  brand: string;
  specs: string;
  unitPriceUSD: number;
  unit: 'piece' | 'kit' | 'metre' | 'lot' | 'rouleau';
  stockAvailable: number;
  defaultSupplier?: string;
}

export interface PurchaseOrderItem {
  id: string;
  orderNumber: string; // Ex: BC-VSAT-2026-001
  organizationId: string;
  date: string;
  deliveryDueDate: string;
  category: EquipmentCategory;
  supplierName: string;
  supplierContact: string;
  supplierEmail: string;
  supplierAddress: string;
  destinationSite: string; // Ex: "Site Minier Tenke Fungurume", "Hub N'sele Kinshasa"
  items: {
    itemId?: string;
    designation: string;
    category: EquipmentCategory;
    sku: string;
    specs: string;
    quantity: number;
    unitPriceUSD: number;
    totalUSD: number;
    notes?: string;
  }[];
  totalHT_USD: number;
  vatRate: number; // 0.16 (16% RDC)
  vatAmount_USD: number;
  totalTTC_USD: number;
  currency: 'USD' | 'CDF';
  exchangeRate: number; // Ex: 2850 CDF/USD
  paymentTerms: string;
  status: 'brouillon' | 'en_attente_approbation' | 'approuve' | 'commande_passee' | 'receptionne_partiel' | 'receptionne_conforme' | 'annule';
  // Exécutant : Agent de service
  createdByAgentId: string;
  createdByAgentName: string;
  createdByServiceId?: string;
  createdByServiceName: string;
  approvedByManagerId?: string;
  approvedByManagerName?: string;
  approvedAt?: string;
  signatureHash?: string;
  proformaReference?: string;
  notes?: string;
}

export interface DeliveryNoteItem {
  id: string;
  deliveryNumber: string; // Ex: BL-VSAT-2026-001
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  organizationId: string;
  date: string;
  transporterName: string;
  driverName?: string;
  vehiclePlateNumber?: string;
  sealNumber?: string; // N° de scellé conteneur / camion
  destinationSite: string;
  category: EquipmentCategory;
  items: {
    designation: string;
    sku: string;
    orderedQty: number;
    deliveredQty: number;
    serialNumbers: string[]; // N° de série scannés / vérifiés
    condition: 'conforme' | 'avarie_mineure' | 'non_conforme' | 'manquant';
    inspectionRemarks?: string;
  }[];
  status: 'en_preparation' | 'en_transit' | 'livre_conforme' | 'reserve_emettrice' | 'rejete';
  recipientName: string;
  recipientTitle: string;
  recipientSignatureDate?: string;
  isRecipientSigned: boolean;
  // Exécutant : Agent de service
  preparedByAgentId: string;
  preparedByAgentName: string;
  serviceName: string;
  technicalReceiptCertificate?: {
    isConform: boolean;
    testPassed: boolean;
    technicianNotes: string;
    testedAt: string;
    testedBy: string;
  };
  remarks?: string;
}

export interface AirWaybillDetails {
  awbNumber: string; // Ex: AWB-ET-071-8842109
  airline: string;
  flightNumber: string;
  originAirport: string; // Ex: Paris CDG / Dubai DWC
  transitAirport?: string; // Ex: Addis Ababa ADD
  destinationAirport: string; // Ex: Kinshasa FIH (N'djili)
  grossWeightKg: number;
  chargeableWeightKg: number;
  volumeM3: number;
  numberOfColis: number;
  // Lettre de frais aérien
  airFreightRatePerKg: number;
  fuelSurchargeUSD: number;
  securitySurchargeUSD: number;
  handlingAirportUSD: number;
  dgdaCustomsBondUSD: number;
  totalAirCostUSD: number;
}

export interface OceanBillOfLadingDetails {
  blNumber: string; // Ex: MEDU-8923014
  shippingLine: string;
  vesselName: string;
  voyageNumber: string;
  containerNumber: string;
  containerType: '20_standard' | '40_high_cube' | 'lcl_groupage';
  sealNumber: string;
  portOfLoading: string; // Ex: Anvers, Ningbo, Durban
  transshipmentPort?: string;
  portOfDischarge: string; // Ex: Port de Matadi (RDC)
  grossWeightTonnes: number;
  cbmVolume: number;
  // Lettre de frais maritime
  oceanFreightBaseUSD: number;
  bunkerAdjustmentBAF_USD: number;
  currencyAdjustmentCAF_USD: number;
  terminalHandlingTHC_MatadiUSD: number;
  lmcAgencyFeeUSD: number; // Lignes Maritimes Congolaises
  ogefremFeriFeeUSD: number; // Fiche FERI OGEFREM
  isFeriValidated: boolean;
  dgdaDutiesEstimateUSD: number;
  totalOceanCostUSD: number;
}

export interface InlandTransitDetails {
  corridor: string; // Ex: "Matadi -> Kinshasa (RN1)" ou "Kasumbalesa -> Kolwezi"
  transportCompany: string;
  truckPlate: string;
  escortRequired: boolean;
  checkpointStatus: string;
  dgdaExitSlipNumber?: string;
  estimatedArrivalSite: string;
}

export interface ShipmentWorkflowStep {
  id: string;
  status: 'depart_fournisseur' | 'fret_en_transit' | 'arrivee_douane' | 'dedouanement_dgda' | 'transit_national' | 'livre_sur_site';
  label: string;
  location: string;
  timestamp: string;
  executedByAgent: string;
  agentRole: string;
  comment: string;
  completed: boolean;
}

export interface ShipmentTracking {
  id: string;
  trackingNumber: string; // Ex: EXP-2026-VSAT-089
  title: string;
  freightType: 'aerien' | 'maritime' | 'routier_convoi';
  category: EquipmentCategory;
  relatedOrderNumber?: string;
  supplierOrigin: string;
  destinationFinal: string;
  carrierName: string;
  airWaybillDetails?: AirWaybillDetails;
  oceanBillOfLadingDetails?: OceanBillOfLadingDetails;
  inlandTransitDetails?: InlandTransitDetails;
  currentStatus: 'depart_fournisseur' | 'fret_en_transit' | 'arrivee_douane' | 'dedouanement_dgda' | 'transit_national' | 'livre_sur_site';
  estimatedDeliveryDate: string;
  actualDeliveryDate?: string;
  workflowSteps: ShipmentWorkflowStep[];
  totalLogisticsCostUSD: number;
  // Exécutant : Agent de service
  assignedAgentId: string;
  assignedAgentName: string;
  serviceName: string;
  qrTrackingCode: string;
}

export interface ProformaInvoiceItem {
  id: string;
  proformaNumber: string; // Ex: PRO-2026-VSAT-042
  organizationId: string;
  date: string;
  validityDate: string;
  clientOrSupplierName: string;
  clientType: 'client_externe' | 'fournisseur_appro' | 'projet_minier';
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  projectOrSite: string;
  category: EquipmentCategory;
  items: {
    designation: string;
    category: EquipmentCategory;
    specs: string;
    quantity: number;
    unitPriceUSD: number;
    totalUSD: number;
  }[];
  subtotalHT_USD: number;
  vatRate: number; // 0.16
  vatAmount_USD: number;
  discountRate?: number;
  discountAmount_USD?: number;
  totalTTC_USD: number;
  paymentTerms: string;
  deliveryLeadTime: string;
  status: 'brouillon' | 'soumise' | 'acceptee_convertie' | 'expiree' | 'rejetee';
  convertedToOrderId?: string;
  convertedToInvoiceId?: string;
  // Exécutant : Agent de service
  preparedByAgentId: string;
  preparedByAgentName: string;
  serviceName: string;
  notes: string;
}

export interface NetToPayInvoiceItem {
  id: string;
  invoiceNumber: string; // Ex: FAC-2026-VSAT-091
  proformaReference?: string;
  purchaseOrderReference?: string;
  deliveryNoteReference?: string;
  organizationId: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientTaxId?: string;
  clientAddress: string;
  category: EquipmentCategory;
  items: {
    designation: string;
    specs: string;
    quantity: number;
    unitPriceUSD: number;
    totalUSD: number;
  }[];
  subtotalHT_USD: number;
  vatRate: number; // 0.16
  vatAmount_USD: number;
  advancePaymentDeduction_USD: number; // Acompte déduit
  withholdingTaxDeduction_USD: number; // Retenue à la source
  otherDeductions_USD: number;
  netToPayUSD: number; // NET À PAYER USD
  netToPayCDF: number; // NET À PAYER CDF
  currencyRate: number; // Taux de conversion USD -> CDF (ex: 2850)
  bankDetails: {
    bankName: string;
    accountNumberUSD: string;
    accountNumberCDF: string;
    swiftBic: string;
    ibanOrRib: string;
  };
  paymentStatus: 'en_attente' | 'partiellement_payee' | 'payee_net' | 'en_retard' | 'annulee';
  paidAmountUSD: number;
  remainingBalanceUSD: number;
  paymentRecords: {
    id: string;
    date: string;
    amountUSD: number;
    amountCDF: number;
    paymentMethod: 'virement_rawbank' | 'virement_equity' | 'cheque' | 'lettre_de_credit';
    reference: string;
    registeredByAgent: string;
  }[];
  electronicSealHash: string;
  // Exécutant : Agent de service
  preparedByAgentId: string;
  preparedByAgentName: string;
  serviceName: string;
  isOfficialDocumentEmitted: boolean;
}

// =============================================================
// GESTION DES HUBS PROVINCIAUX & GESTION DES STOCKS MULTI-SITES
// =============================================================

export interface LogisticsHub {
  id: string;
  code: string;
  name: string;
  province: string;
  city: string;
  address: string;
  managerId?: string;
  managerName: string;
  managerContact: string;
  managerEmail: string;
  storageCapacityM3: number;
  currentOccupancyRate: number; // En %
  status: 'actif' | 'maintenance' | 'saturation';
  coverageZones: string[];
  securityLevel: string;
  createdAt: string;
}

export interface HubStockItem {
  id: string;
  hubId: string;
  catalogItemId: string;
  sku: string;
  name: string;
  category: EquipmentCategory;
  quantityAvailable: number;
  quantityReserved: number;
  quantityInTransit: number;
  minAlertThreshold: number;
  unitPriceUSD: number;
  totalValueUSD: number;
  locationRack: string;
  serialNumbers: string[];
  lastAuditDate: string;
  status: 'normal' | 'alerte_basse' | 'rupture' | 'surstock';
}

export type StockMovementType = 
  | 'entree_fournisseur' 
  | 'sortie_deploiement' 
  | 'transfert_inter_hub' 
  | 'reception_transfert' 
  | 'ajustement_inventaire';

export interface StockMovementItem {
  id: string;
  movementNumber: string; // Ex: MVT-HUB-2026-001
  type: StockMovementType;
  sourceHubId?: string;
  sourceHubName?: string;
  destinationHubId?: string;
  destinationHubName?: string;
  destinationClientSite?: string;
  items: {
    catalogItemId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPriceUSD: number;
    serialNumbers: string[];
  }[];
  totalValueUSD: number;
  referenceDocumentNumber: string;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  date: string;
  status: 'en_attente_visa' | 'valide' | 'en_transit' | 'receptionne' | 'rejete';
  approvedByManagerName?: string;
  approvedAt?: string;
  electronicSealHash: string;
  notes: string;
}

// =============================================================
// GESTION DES INVITATIONS INTER-ENTITÉS & CLÉ D'AUTHENTIFICATION 10 CHIFFRES
// =============================================================

export interface EntityInvitation {
  id: string;
  invitationCode: string; // Ex: "INV-2026-001"
  authKey10Digits: string; // Clé d'authentification Unique de 10 chiffres (ex: "8492017365")
  hostEntityId: string; // Entité vers laquelle l'agent est invité
  hostEntityName: string;
  hostEntityCode: string;
  inviterUserId: string;
  inviterUserName: string;
  inviterRoleTitle: string;
  invitedAgentMatricule: string;
  invitedAgentId?: string;
  invitedAgentName: string;
  invitedAgentEmail?: string;
  invitedAgentHomeEntity?: string;
  purpose: string; // Motif de l'invitation (Mission, audit, dépannage...)
  accessScope: 'lecture' | 'operant_delegue' | 'superviseur_temporaire';
  validityDurationHours: number; // Délai émis en heures (ex: 24, 48, 72, 168...)
  expiresAt: string; // Date/heure d'expiration émise par le responsable
  createdAt: string;
  status: 'active' | 'en_session' | 'terminee' | 'expiree' | 'revoquee';
  connectedAt?: string;
  lastAccessAt?: string;
  notes?: string;
}

export interface EntityInvitationNotification {
  id: string;
  recipientUserId: string;
  recipientMatricule: string;
  title: string;
  message: string;
  authKey10Digits: string; // Clé Unique de 10 chiffres
  hostEntityId: string;
  hostEntityName: string;
  inviterName: string;
  inviterRole: string;
  expiresAt: string;
  validityHours: number;
  purpose: string;
  isRead: boolean;
  createdAt: string;
  invitationId: string;
}
