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
  /** Identité visuelle des documents : en-tête, pied de page, slogan, couleur. */
  branding?: OrganizationBranding;
}

/**
 * Identité visuelle imprimée sur les documents officiels et les PDF.
 * Les images sont des « data URL » PNG ou JPEG ré-encodées dans le navigateur
 * (aucun lien externe : rien n'est chargé depuis un autre site).
 */
export interface OrganizationBranding {
  /** Slogan ou activité, affiché sous le nom dans l'en-tête automatique. */
  slogan?: string;
  /** Couleur principale (#RRGGBB) du bandeau d'en-tête. */
  color?: string;
  /** Papier à en-tête complet (image bannière) : remplace l'en-tête automatique. */
  headerImage?: string;
  /** Pied de page complet (image bannière). */
  footerImage?: string;
  /** Texte du pied de page (adresse, contacts, mentions légales…), 3 lignes au plus. */
  footerText?: string;
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
  | 'administratif_general'
  | 'financier_comptable'
  | 'chaine_logistique_commerciale'
  /** Congés et absences (seul type de document du personnel conservé). */
  | 'ressources_humaines';

/** Types de documents : leur circuit et leur règle de montant sont définis dans shared/workflow.mjs. */
export type DocumentSubtype = 
  | 'note_service' | 'communique' | 'rapport_activite' | 'proces_verbal'
  | 'demande_achat' | 'note_frais'
  | 'facture_client' | 'facture_fournisseur' | 'avoir' | 'bilan_comptable'
  | 'devis' | 'bon_commande_client' | 'bon_livraison' | 'bon_reception'
  | 'bon_entree_stock' | 'bon_sortie_stock' | 'ordre_transfert' | 'contrat_commercial'
  | 'demande_conge';

/** Étape d'un circuit de validation (document ou tâche). */
export interface ApprovalStep {
  id: string;
  /** « visa » : approbation ; « signature » : signature électronique finale. */
  kind: 'visa' | 'signature';
  approverRole: UserRole;
  /** Entité dirigée par le valideur attendu (ex. le service pour un chef de service). */
  entityId?: string;
  entityName?: string;
  /** Personne désignée nommément (valideur d'une tâche, signature de l'émetteur). */
  approverUserId?: string;
  expectedHolderName?: string;
  label: string;
  status: 'en_attente' | 'approuve' | 'rejete';
  actorId?: string;
  actorName?: string;
  actorRole?: UserRole;
  at?: string;
  comment?: string;
  signatureHash?: string;
}

export interface WorkflowHistoryEntry {
  id: string;
  at: string;
  actorId?: string;
  actorName: string;
  action: string;
  label: string;
  comment?: string;
}

export interface DocumentWorkflow {
  cycle: number;
  submittedAt?: string;
  steps: ApprovalStep[];
  history: WorkflowHistoryEntry[];
  rejection?: { reason: string; by: string; byId?: string; at: string; stepLabel?: string };
}

/** Origine d'un document ou d'une tâche créé automatiquement par un module. */
export interface ItemSource {
  module: 'logistique' | 'espace_employe' | 'taches' | 'documents';
  kind: string;
  refId: string;
  refNumber?: string;
}

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
  targetUserName?: string;
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
  /** Entité de l'émetteur (point de départ du circuit). */
  originEntityId?: string;
  originEntityName?: string;
  /** Circuit de validation (étapes, historique, rejet). */
  workflow?: DocumentWorkflow;
  /** Document émis automatiquement par un module (logistique, espace employé…). */
  source?: ItemSource;
  allowedRoles: UserRole[];
  permissions: {
    viewRoles: UserRole[];
    editRoles: UserRole[];
    validateRoles: UserRole[];
    signRoles: UserRole[];
  };
  description?: string;
}

export type TaskType =
  | 'approbation' | 'production' | 'suivi_client' | 'projet' | 'jalons' | 'suivi' | 'deploiement' | 'audit'
  | 'logistique' | 'administratif' | 'maintenance' | 'formation';

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  at: string;
  text: string;
}

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
  status: 'a_faire' | 'en_cours' | 'en_attente_approbation' | 'validee_terminee' | 'bloquee' | 'termine' | 'annulee';
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
    dueDate?: string;
  }[];
  signatureRequired: boolean;
  signature?: {
    signedBy: string;
    role: string;
    timestamp: string;
    hash: string;
  };
  // --- Champs étendus -------------------------------------------------------
  /** Référence lisible (ex. TSK-2026-014). */
  reference?: string;
  startDate?: string;
  /** Charge prévue et temps passé, en heures. */
  estimatedHours?: number;
  spentHours?: number;
  /** Lieu d'exécution (site client, hub, bureau…). */
  site?: string;
  /** Livrable attendu et critères pour accepter la tâche. */
  deliverable?: string;
  acceptanceCriteria?: string;
  tags?: string[];
  linkedDocumentIds?: string[];
  source?: ItemSource;
  comments?: TaskComment[];
  history?: WorkflowHistoryEntry[];
  /** Circuit de validation de la tâche (valideurs dans l'ordre). */
  approval?: { cycle: number; steps: ApprovalStep[] };
  blockedReason?: string;
  lastRejection?: { reason: string; by: string; at: string };
  completedAt?: string;
  updatedAt?: string;
}

export type NavigationTab = 
  | 'workspace'
  | 'hierarchy' 
  | 'documents' 
  | 'workflows' 
  | 'security' 
  | 'agents' 
  | 'bulk_import'
  | 'pointage'
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
// POINTAGE AUTOMATIQUE (présence des agents)
// -------------------------------------------------------------

/**
 * Journée de présence d'un agent. Les heures sont posées par le serveur (horloge du serveur) :
 * arrivée à la première connexion du jour, départ à la déconnexion ou, à défaut,
 * à la dernière activité constatée (départ « automatique »).
 */
export interface AttendanceDay {
  id: string;
  userId: string;
  userName: string;
  /** Jour local (AAAA-MM-JJ, fuseau du serveur). */
  date: string;
  /** Horodatages ISO (UTC). */
  arrivalAt: string;
  departureAt?: string;
  /** Départ déduit de la dernière activité (pas de déconnexion ce jour-là). */
  departureAuto?: boolean;
  breaks: { start: string; end?: string }[];
  lastSeenAt: string;
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
  /** Stock total du réseau (calculé à partir du journal des mouvements). */
  stockAvailable: number;
  defaultSupplier?: string;
  /** Seuil d'alerte par Site : strictement en dessous, l'article passe en « stock bas ». */
  minAlertThreshold?: number;
  notes?: string;
  /** Article retiré du catalogue (il reste visible dans l'historique). */
  archived?: boolean;
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
  status: 'actif' | 'maintenance' | 'saturation' | 'inactif';
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

/**
 * Type de mouvement : un type des paramètres du module (stock_initial, entree_fournisseur,
 * sortie_vente…, voir shared/stock.mjs), « transfert_inter_hub », ou un ancien type.
 */
export type StockMovementType = string;

/** Type de mouvement paramétrable : sens +1 (entrée) ou −1 (sortie). */
export interface StockMovementTypeSetting {
  id: string;
  label: string;
  sign: 1 | -1;
  active: boolean;
  builtin?: boolean;
}

/** Paramètres du module Stocks & Hubs (feuille PARAMETRES du classeur). */
export interface StockSettings {
  movementTypes: StockMovementTypeSetting[];
  /** Libellé des 3 catégories d'articles. */
  categoryLabels: Record<string, string>;
  /** Délai (jours) au-delà duquel un transfert non reçu passe en alerte. */
  transitAlertDays: number;
  currency: string;
  ledgerVersion?: number;
}

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
  status: 'en_attente_visa' | 'valide' | 'en_transit' | 'receptionne' | 'rejete' | 'annule';
  approvedByManagerName?: string;
  approvedAt?: string;
  electronicSealHash: string;
  notes: string;
  /** Sens et libellé du type au moment de la saisie (+1 entrée, −1 sortie). */
  sign?: 1 | -1;
  typeLabel?: string;
  /** Client, fournisseur ou projet concerné. */
  counterparty?: string;
  /** Mouvement antérieur au journal, déjà compris dans le stock repris. */
  openingIncluded?: 'all' | 'source';
  // --- Transferts ---
  /** Mise en transit (bon validé). */
  sentAt?: string;
  carrier?: string;
  shippingRef?: string;
  receivedAt?: string;
  receivedByName?: string;
  /** Quantité reçue par article, si elle diffère de la quantité envoyée. */
  receivedQuantities?: Record<string, number>;
  cancelledAt?: string;
  cancelledByName?: string;
  cancelReason?: string;
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
