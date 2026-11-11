// src/data/initialData.ts
import type { 
  Organization, 
  HierarchicalEntity, 
  User, 
  DocumentItem, 
  TaskItem, 
  AuditLog, 
  SecurityAlert
} from '../types';

// =========================================================================
// 1. ORGANISATION OFFICIELLE RHEMA BUSINESS (RDC)
// =========================================================================
export const initialOrganizations: Organization[] = [
  {
    id: 'org-1',
    name: 'RHEMA BUSINESS RDC',
    code: 'RB-RDC',
    type: 'entreprise',
    registrationNumber: 'RCCM/20-A-01120',
    rccm: 'CD/KNG/RCCM/20-A-01120',
    idNat: '01-83-N45201L',
    numImpot: 'A1934892Z',
    headquarters: 'N°1B, Avenue Bangala, Q/Salongo C/Kintambo, Kinshasa - RD CONGO',
    email: 'contact@rhemabusiness.com',
    phone: '+243 81 279 1228',
    managerName: 'Junior Monya',
    managerRole: 'Directeur Général (DG)',
    directorGeneral: 'Junior Monya',
    managerEmail: 'juniormonya536@gmail.com',
    hasDepartements: true,
    hasDirections: true,
    hasDivisions: true,
    hasServices: true,
    description: 'RHEMA BUSINESS - Télécoms, VSAT, Réseaux, Fibre Optique et Intégration Technologique en République Démocratique du Congo.',
    createdAt: '2020-01-15',
  }
];

// =========================================================================
// 2. ARBORESCENCE HIÉRARCHIQUE DES 4 NIVEAUX
// =========================================================================
export const initialEntities: HierarchicalEntity[] = [
  // --- NIVEAU 1 : DÉPARTEMENTS ---
  {
    id: 'dept-daf',
    name: 'Département Administration Générale & Finances (DAF)',
    code: 'DEPT-DAF',
    level: 'departement',
    organizationId: 'org-1',
    managerName: 'M. Ibrahima Sarr',
    managerEmail: 'daf@rhemabusiness.com',
    managerRole: 'chef_departement',
    description: 'Supervision globale des flux financiers, de la gestion comptable, du capital humain et du coffre-fort d\'entreprise.',
    agentCount: 28,
  },
  {
    id: 'dept-ops',
    name: 'Département Opérations Télécoms & Supply Chain (DOP)',
    code: 'DEPT-OPS',
    level: 'departement',
    organizationId: 'org-1',
    managerName: 'M. Alain Boni',
    managerEmail: 'operations@rhemabusiness.com',
    managerRole: 'chef_departement',
    description: 'Ingénierie satellite VSAT, déploiement des faisceaux hertziens, logistique minière et maintenance terrain.',
    agentCount: 42,
  },

  // --- NIVEAU 2 : DIRECTIONS ---
  {
    id: 'dir-rh',
    name: 'Direction des Ressources Humaines & Affaires Sociales (DRH)',
    code: 'DIR-RH',
    level: 'direction',
    parentId: 'dept-daf',
    organizationId: 'org-1',
    managerName: 'M. Jean-Paul Kouassi',
    managerEmail: 'drh@rhemabusiness.com',
    managerRole: 'directeur',
    description: 'Recrutement, politique salariale RDC, administration du personnel, déclarations CNSS et conformité légale.',
    agentCount: 12,
  },
  {
    id: 'dir-finance',
    name: 'Direction Comptabilité & Trésorerie',
    code: 'DIR-FIN',
    level: 'direction',
    parentId: 'dept-daf',
    organizationId: 'org-1',
    managerName: 'Mme Sophie Traoré',
    managerEmail: 'finance@rhemabusiness.com',
    managerRole: 'directeur',
    description: 'Comptabilité générale en devises USD/CDF, gestion de la trésorerie bancaire, fiscalité et états financiers.',
    agentCount: 16,
  },
  {
    id: 'dir-vsat',
    name: 'Direction Déploiement Réseaux & VSAT Minier',
    code: 'DIR-VSAT',
    level: 'direction',
    parentId: 'dept-ops',
    organizationId: 'org-1',
    managerName: 'M. Marc Essomba',
    managerEmail: 'm.essomba@rhemabusiness.com',
    managerRole: 'directeur',
    description: 'Installation et télégestion des antennes VSAT Ku/C-Band sur les sites miniers (Katanga, Lualaba, Kinshasa).',
    agentCount: 26,
  },
  {
    id: 'dir-log',
    name: 'Direction Logistique & Gestion des Stocks',
    code: 'DIR-LOG',
    level: 'direction',
    parentId: 'dept-ops',
    organizationId: 'org-1',
    managerName: 'M. Thomas Owona',
    managerEmail: 't.owona@rhemabusiness.com',
    managerRole: 'directeur',
    description: 'Entreposage des baies, modems satellites, câbles coaxiaux et transit douanier aéroport N\'djili.',
    agentCount: 16,
  },

  // --- NIVEAU 3 : DIVISIONS ---
  {
    id: 'div-paie',
    name: 'Division Rémunération, Charges Sociales & IPR',
    code: 'DIV-PAIE',
    level: 'division',
    parentId: 'dir-rh',
    organizationId: 'org-1',
    managerName: 'Mme Fatou Camara',
    managerEmail: 'f.camara@rhemabusiness.com',
    managerRole: 'chef_division',
    description: 'Calcul de la paie, abattements familiaux, cotisations CNSS/INPP/ONEM et télédéclarations DGI.',
    agentCount: 6,
  },
  {
    id: 'div-compta',
    name: 'Division Comptabilité Fournisseurs & Rapprochement',
    code: 'DIV-CPTA',
    level: 'division',
    parentId: 'dir-finance',
    organizationId: 'org-1',
    managerName: 'M. Serge Mbemba',
    managerEmail: 's.mbemba@rhemabusiness.com',
    managerRole: 'chef_division',
    description: 'Facturation clients grands comptes, lettrage comptable et suivi des comptes Rawbank / EquityBCDC.',
    agentCount: 8,
  },
  {
    id: 'div-antennes',
    name: 'Division Antennes & Stations Terriennes',
    code: 'DIV-ANT',
    level: 'division',
    parentId: 'dir-vsat',
    organizationId: 'org-1',
    managerName: 'M. Roger Tagne',
    managerEmail: 'r.tagne@rhemabusiness.com',
    managerRole: 'chef_division',
    description: 'Pointage satellite, étalonnage des BUC/LNB et monitoring de la disponibilité de bande passante.',
    agentCount: 14,
  },

  // --- NIVEAU 4 : SERVICES ---
  {
    id: 'srv-paie',
    name: 'Service Traitement des Bulletins & Heures Sup',
    code: 'SRV-PAIE',
    level: 'service',
    parentId: 'div-paie',
    organizationId: 'org-1',
    managerName: 'M. Eric Mba',
    managerEmail: 'paie@rhemabusiness.com',
    managerRole: 'chef_service',
    description: 'Saisie des pointages, fiches de paie mensuelles et attestations de solde de tout compte.',
    agentCount: 3,
  },
  {
    id: 'srv-facturation',
    name: 'Service Facturation & Recouvrement Télécoms',
    code: 'SRV-FACT',
    level: 'service',
    parentId: 'div-compta',
    organizationId: 'org-1',
    managerName: 'Mme Aminata Sow',
    managerEmail: 'facturation@rhemabusiness.com',
    managerRole: 'chef_service',
    description: 'Émission des factures certifiées, suivi des paiements télécoms et bons d\'expédition.',
    agentCount: 4,
  },
  {
    id: 'srv-vsat-field',
    name: 'Service Déploiement Terrain & Liaisons VSAT',
    code: 'SRV-VSAT',
    level: 'service',
    parentId: 'div-antennes',
    organizationId: 'org-1',
    managerName: 'M. Fabrice Mukendi',
    managerEmail: 'vsat@rhemabusiness.com',
    managerRole: 'chef_service',
    description: 'Missions d\'installation sur sites miniers (Kolwezi, Tenke Fungurume, Lubumbashi) et téléassistance.',
    agentCount: 9,
  },
  {
    id: 'srv-hubs',
    name: 'Service Hubs Provinciaux & Approvisionnements',
    code: 'SRV-HUB',
    level: 'service',
    parentId: 'dir-log',
    organizationId: 'org-1',
    managerName: 'M. Dieudonné Bofata',
    managerEmail: 'hubs.log@rhemabusiness.com',
    managerRole: 'chef_service',
    description: 'Réception, stockage, transferts inter-hubs et approvisionnement des sites.',
    agentCount: 6,
  }
];

// =========================================================================
// 3. EFFECTIFS & COLLABORATEURS VÉRIFIABLES (AVEC MOTS DE PASSE & RÔLES)
// =========================================================================
export const initialUsers: User[] = [
  // --- DIRECTION GÉNÉRALE ---
  {
    id: 'user-dg',
    name: 'Dr. Amadou Diallo',
    email: 'dg@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-001-DG',
    employeeCode: 'RH-2026-001',
    role: 'dg',
    roleTitle: 'Président Directeur Général (PDG / DG)',
    departmentName: 'Direction Générale',
    organizationId: 'org-1',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 81 279 1228',
    lastLogin: 'Aujourd\'hui à 08:00'
  },
  {
    id: 'user-dga',
    name: 'Mme Clarisse Nguema',
    email: 'dga@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-002-DGA',
    employeeCode: 'RH-2026-002',
    role: 'dg',
    roleTitle: 'Directrice Générale Adjointe (DGA)',
    departmentName: 'Direction Générale',
    organizationId: 'org-1',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 82 100 2001',
    lastLogin: 'Hier à 16:30'
  },

  // --- DÉPARTEMENT DAF & FINANCE ---
  {
    id: 'user-chef-daf',
    name: 'M. Ibrahima Sarr',
    email: 'daf@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-003-DAF',
    employeeCode: 'RH-2026-003',
    role: 'chef_departement',
    roleTitle: 'Chef Département Administratif & Financier (DAF)',
    departmentName: 'Département Administration & Finances',
    organizationId: 'org-1',
    departementId: 'dept-daf',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 81 333 4455',
    lastLogin: 'Aujourd\'hui à 07:45'
  },
  {
    id: 'user-drh',
    name: 'M. Jean-Paul Kouassi',
    email: 'drh@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-004-DRH',
    employeeCode: 'RH-2026-004',
    role: 'directeur',
    roleTitle: 'Directeur des Ressources Humaines (DRH)',
    departmentName: 'Direction des Ressources Humaines',
    organizationId: 'org-1',
    departementId: 'dept-daf',
    directionId: 'dir-rh',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 84 555 6677',
    lastLogin: 'Aujourd\'hui à 08:15'
  },
  {
    id: 'user-dir-fin',
    name: 'Mme Sophie Traoré',
    email: 'finance@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-005-FIN',
    employeeCode: 'RH-2026-005',
    role: 'directeur',
    roleTitle: 'Directrice Financière & Comptable',
    departmentName: 'Direction Comptabilité & Trésorerie',
    organizationId: 'org-1',
    departementId: 'dept-daf',
    directionId: 'dir-finance',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 85 999 8811',
    lastLogin: 'Hier à 18:00'
  },
  {
    id: 'user-agent-compta',
    name: 'Patricia Mwamba',
    email: 'p.mwamba@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-010-CPTA',
    employeeCode: 'RH-2026-010',
    role: 'agent',
    roleTitle: 'Comptable Trésorerie & Déclarations IPR',
    departmentName: 'Direction Comptabilité & Trésorerie',
    organizationId: 'org-1',
    departementId: 'dept-daf',
    directionId: 'dir-finance',
    divisionId: 'div-compta',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: false,
    phone: '+243 81 777 2233',
    lastLogin: 'Aujourd\'hui à 08:10'
  },

  // --- RESSOURCES HUMAINES & PAIE ---
  {
    id: 'user-chef-paie',
    name: 'M. Eric Mba',
    email: 'paie@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-006-PAIE',
    employeeCode: 'RH-2026-006',
    role: 'chef_service',
    roleTitle: 'Chef Service Traitement de la Paie',
    departmentName: 'Service Traitement des Bulletins & Heures',
    organizationId: 'org-1',
    departementId: 'dept-daf',
    directionId: 'dir-rh',
    divisionId: 'div-paie',
    serviceId: 'srv-paie',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 82 444 1122',
    lastLogin: 'Aujourd\'hui à 07:55'
  },
  {
    id: 'user-agent-paie',
    name: 'Moussa Diop',
    email: 'moussa.diop@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-011-PAIE',
    employeeCode: 'RH-2026-011',
    role: 'agent',
    roleTitle: 'Gestionnaire Paie & Cotisations CNSS',
    departmentName: 'Service Traitement des Bulletins & Heures',
    organizationId: 'org-1',
    departementId: 'dept-daf',
    directionId: 'dir-rh',
    divisionId: 'div-paie',
    serviceId: 'srv-paie',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: false,
    phone: '+243 89 222 3344',
    lastLogin: 'Aujourd\'hui à 08:20'
  },

  // --- OPÉRATIONS TÉLÉCOMS & VSAT ---
  {
    id: 'user-chef-ops',
    name: 'M. Alain Boni',
    email: 'operations@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-007-OPS',
    employeeCode: 'RH-2026-007',
    role: 'chef_departement',
    roleTitle: 'Chef Département Opérations Télécoms (DOP)',
    departmentName: 'Département Opérations Télécoms',
    organizationId: 'org-1',
    departementId: 'dept-ops',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 81 888 9900',
    lastLogin: 'Aujourd\'hui à 06:40'
  },
  {
    id: 'user-dir-log',
    name: 'M. Thomas Owona',
    email: 't.owona@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-014-LOG',
    employeeCode: 'RH-2026-014',
    role: 'directeur',
    roleTitle: 'Directeur Logistique & Gestion des Stocks',
    departmentName: 'Direction Logistique & Gestion des Stocks',
    organizationId: 'org-1',
    departementId: 'dept-ops',
    directionId: 'dir-log',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 81 555 1200',
    lastLogin: 'Aujourd\'hui à 08:10'
  },
  {
    id: 'user-chef-log',
    name: 'M. Dieudonné Bofata',
    email: 'hubs.log@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-015-HUB',
    employeeCode: 'RH-2026-015',
    role: 'chef_service',
    roleTitle: 'Chef Service Hubs Provinciaux & Approvisionnements',
    departmentName: 'Direction Logistique & Gestion des Stocks',
    organizationId: 'org-1',
    departementId: 'dept-ops',
    directionId: 'dir-log',
    serviceId: 'srv-hubs',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 82 333 4455',
    lastLogin: 'Aujourd\'hui à 08:25'
  },
  {
    id: 'user-chef-vsat',
    name: 'M. Fabrice Mukendi',
    email: 'vsat@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-008-VSAT',
    employeeCode: 'RH-2026-008',
    role: 'chef_service',
    roleTitle: 'Chef Service Déploiement VSAT Minier',
    departmentName: 'Service Déploiement Terrain & Liaisons VSAT',
    organizationId: 'org-1',
    departementId: 'dept-ops',
    directionId: 'dir-vsat',
    divisionId: 'div-antennes',
    serviceId: 'srv-vsat-field',
    status: 'actif',
    failedAccessAttempts: 1,
    canCreateSubAgents: true,
    phone: '+243 81 222 9988',
    lastLogin: 'Aujourd\'hui à 07:15'
  },
  {
    id: 'user-agent-tech',
    name: 'Christian Kalala',
    email: 'c.kalala@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-012-TECH',
    employeeCode: 'RH-2026-012',
    role: 'agent',
    roleTitle: 'Ingénieur Déploiement VSAT & Stations Terriennes',
    departmentName: 'Service Déploiement Terrain & Liaisons VSAT',
    organizationId: 'org-1',
    departementId: 'dept-ops',
    directionId: 'dir-vsat',
    divisionId: 'div-antennes',
    serviceId: 'srv-vsat-field',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: false,
    phone: '+243 82 777 5544',
    lastLogin: 'Hier à 19:10'
  },
  {
    id: 'user-agent-field',
    name: 'Marc Tshimanga',
    email: 'm.tshimanga@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-013-CAB',
    employeeCode: 'RH-2026-013',
    role: 'agent',
    roleTitle: 'Technicien Réseau & Câblage Fibre Optique',
    departmentName: 'Service Déploiement Terrain & Liaisons VSAT',
    organizationId: 'org-1',
    departementId: 'dept-ops',
    directionId: 'dir-vsat',
    divisionId: 'div-antennes',
    serviceId: 'srv-vsat-field',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: false,
    phone: '+243 81 666 4433',
    lastLogin: 'Il y a 3 jours'
  },

  // --- SERVICE HUBS & APPROVISIONNEMENTS (agent exécutant logistique) ---
  {
    id: 'user-agent-mag',
    name: 'Grâce Mbuyi',
    email: 'g.mbuyi@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-016-MAG',
    employeeCode: 'RH-2026-016',
    role: 'agent',
    roleTitle: 'Magasinière & Agent d\'Approvisionnement',
    departmentName: 'Service Hubs Provinciaux & Approvisionnements',
    organizationId: 'org-1',
    departementId: 'dept-ops',
    directionId: 'dir-log',
    serviceId: 'srv-hubs',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: false,
    phone: '+243 81 444 2211',
    lastLogin: 'Aujourd\'hui à 07:50'
  },

  // --- SERVICE FACTURATION ---
  {
    id: 'user-chef-fact',
    name: 'Mme Aminata Sow',
    email: 'facturation@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-009-FACT',
    employeeCode: 'RH-2026-009',
    role: 'chef_service',
    roleTitle: 'Chef Service Facturation & Recouvrement',
    departmentName: 'Service Facturation & Recouvrement',
    organizationId: 'org-1',
    departementId: 'dept-daf',
    directionId: 'dir-finance',
    divisionId: 'div-compta',
    serviceId: 'srv-facturation',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
    phone: '+243 84 111 2299',
    lastLogin: 'Hier à 17:15'
  },

  // --- COMPTE DÉMONSTRATION SÉCURITÉ / ACCÈS BLOQUÉ ---
  {
    id: 'user-locked-agent',
    name: 'Patient Kabongo',
    email: 'p.kabongo@rhemabusiness.com',
    password: 'rhema2026',
    matricule: 'MAT-099-LOCK',
    employeeCode: 'RH-2026-099',
    role: 'agent',
    roleTitle: 'Agent Terrain Kolwezi (Compte Verrouillé)',
    departmentName: 'Service Déploiement Terrain & Liaisons VSAT',
    organizationId: 'org-1',
    departementId: 'dept-ops',
    directionId: 'dir-vsat',
    divisionId: 'div-antennes',
    serviceId: 'srv-vsat-field',
    status: 'verrouille',
    failedAccessAttempts: 2,
    canCreateSubAgents: false,
    phone: '+243 81 000 9999',
    lastLogin: 'Compte suspendu par le système anti-intrusion'
  }
];

// =========================================================================
// 4. CONTRATS DE TRAVAIL OFFICIELS RDC (EN USD & CDF)
// =========================================================================
export const initialDocuments: DocumentItem[] = [
  {
    id: 'doc-nf-tenke',
    title: 'Note de frais — mission de déploiement VSAT à Tenke Fungurume',
    referenceNumber: 'NF-2026-001',
    category: 'financier_comptable',
    subtype: 'note_frais',
    organizationId: 'org-1',
    authorId: 'user-agent-tech',
    authorName: 'Christian Kalala',
    authorRole: 'agent',
    authorEntity: 'Service Déploiement Terrain & Liaisons VSAT',
    originEntityId: 'srv-vsat-field',
    originEntityName: 'Service Déploiement Terrain & Liaisons VSAT',
    targetEntityId: 'srv-vsat-field',
    targetEntityName: 'Service Déploiement Terrain & Liaisons VSAT',
    createdAt: '2026-10-07',
    status: 'en_revue',
    size: '—',
    fileType: 'PDF',
    amount: 450,
    currency: 'USD',
    description: "Frais de mission du 6 au 8 octobre 2026 : transport Lubumbashi–Tenke (180 USD), hébergement 2 nuits (220 USD), restauration (50 USD). Justificatifs remis au chef de service.",
    workflow: {
      cycle: 1,
      submittedAt: '2026-10-07T17:30:00.000Z',
      steps: [
        { id: 'etp-demo-1', kind: 'visa', approverRole: 'chef_service', entityId: 'srv-vsat-field', entityName: 'Service Déploiement Terrain & Liaisons VSAT', expectedHolderName: 'M. Fabrice Mukendi', label: 'Chef de service — Service Déploiement Terrain & Liaisons VSAT', status: 'en_attente' },
        { id: 'etp-demo-2', kind: 'signature', approverRole: 'directeur', entityId: 'dir-finance', entityName: 'Direction Comptabilité & Trésorerie', expectedHolderName: 'Mme Sophie Traoré', label: 'Directeur — Direction Comptabilité & Trésorerie', status: 'en_attente' }
      ],
      history: [
        { id: 'hist-demo-1', at: '2026-10-07T17:30:00.000Z', actorId: 'user-agent-tech', actorName: 'Christian Kalala', action: 'soumission', label: 'Soumis au circuit de validation' }
      ]
    },
    allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
    permissions: {
      viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
      editRoles: ['agent'],
      validateRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service'],
      signRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service']
    }
  },
  {
    id: 'doc-1',
    title: 'Facture Client FC-2026-089 - Tenke Fungurume Mining (TFM)',
    referenceNumber: 'FC-2026-089',
    category: 'financier_comptable',
    subtype: 'facture_client',
    organizationId: 'org-1',
    authorId: 'user-chef-fact',
    authorName: 'Mme Aminata Sow',
    authorRole: 'chef_service',
    authorEntity: 'Service Facturation & Recouvrement',
    createdAt: '2026-09-15',
    status: 'signe',
    size: '1.8 Mo',
    fileType: 'PDF',
    amount: 48500,
    currency: 'USD',
    description: 'Facturation prestation bande passante satellitaire VSAT dédiée C-Band 50 Mbps Q3 2026.',
    electronicSignature: {
      signedBy: 'Dr. Amadou Diallo (DG)',
      signedAt: '2026-09-16 11:20:00',
      role: 'Directeur Général',
      certificateHash: 'SHA256:7f83b1657ff1fc53b92c451da74d39f284b',
    },
    allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
    permissions: {
      viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
      editRoles: ['dg'],
      validateRoles: ['dg'],
      signRoles: ['dg']
    }
  },
  {
    id: 'doc-2',
    title: 'Bilan Comptable Annuel Certifié & Déclarations DGI 2025',
    referenceNumber: 'BILAN-2025-CERTIF',
    category: 'financier_comptable',
    subtype: 'bilan_comptable',
    organizationId: 'org-1',
    authorId: 'user-dir-fin',
    authorName: 'Mme Sophie Traoré',
    authorRole: 'directeur',
    authorEntity: 'Direction Comptabilité & Trésorerie',
    createdAt: '2026-09-12',
    status: 'signe',
    size: '4.2 Mo',
    fileType: 'PDF',
    amount: 1450000,
    currency: 'USD',
    description: 'États financiers certifiés par le collège des commissaires aux comptes pour l\'assemblée générale.',
    electronicSignature: {
      signedBy: 'Mme Sophie Traoré (Directrice Financière)',
      signedAt: '2026-09-12 15:30:00',
      role: 'Directrice Financière',
      certificateHash: 'SHA256:e3b0c44298fc1c149afbf4c8996fb92427ae41e',
    },
    allowedRoles: ['dg', 'chef_departement', 'directeur'],
    permissions: {
      viewRoles: ['dg', 'chef_departement', 'directeur'],
      editRoles: ['dg'],
      validateRoles: ['dg'],
      signRoles: ['dg']
    }
  },
  {
    id: 'doc-3',
    title: 'Note de Frais Mission Kolwezi - Déploiement Télécoms',
    referenceNumber: 'NDF-2026-042',
    category: 'financier_comptable',
    subtype: 'devis',
    organizationId: 'org-1',
    authorId: 'user-chef-ops',
    authorName: 'M. Alain Boni',
    authorRole: 'chef_departement',
    authorEntity: 'Département Opérations Télécoms (DOP)',
    createdAt: '2026-09-18',
    status: 'en_revue',
    size: '950 Ko',
    fileType: 'PDF',
    amount: 3400,
    currency: 'USD',
    description: 'Billet d\'avion CAA Kinshasa-Kolwezi, hôtel et indemnités journalières de mission d\'audit.',
    allowedRoles: ['dg', 'chef_departement', 'directeur'],
    permissions: {
      viewRoles: ['dg', 'chef_departement', 'directeur'],
      editRoles: ['dg'],
      validateRoles: ['dg'],
      signRoles: ['dg']
    }
  },
  {
    id: 'doc-4',
    title: 'Bon de Commande Fournisseur BCF-8821 - Équipements Satellites Comtech',
    referenceNumber: 'BCF-8821',
    category: 'chaine_logistique_commerciale',
    subtype: 'bon_commande_client',
    organizationId: 'org-1',
    authorId: 'user-chef-vsat',
    authorName: 'M. Fabrice Mukendi',
    authorRole: 'chef_service',
    authorEntity: 'Service Déploiement Terrain & Liaisons VSAT',
    createdAt: '2026-09-20',
    status: 'en_revue',
    size: '2.1 Mo',
    fileType: 'PDF',
    amount: 32500,
    currency: 'USD',
    description: 'Acquisition de 4 modems satellites Comtech EF Data CDM-625A et 2 BUC 40W C-Band.',
    allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
    permissions: {
      viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
      editRoles: ['dg'],
      validateRoles: ['dg'],
      signRoles: ['dg']
    }
  },
  {
    id: 'doc-5',
    title: 'Ordre de Fabrication OF-4402 - Baies de Brassage Datacenter Gombe',
    referenceNumber: 'OF-4402',
    category: 'chaine_logistique_commerciale',
    subtype: 'bon_livraison',
    organizationId: 'org-1',
    authorId: 'user-chef-ops',
    authorName: 'M. Alain Boni',
    authorRole: 'chef_departement',
    authorEntity: 'Département Opérations Télécoms (DOP)',
    createdAt: '2026-09-22',
    status: 'en_revue',
    size: '3.4 Mo',
    fileType: 'PDF',
    amount: 18900,
    currency: 'USD',
    description: 'Assemblage, câblage en atelier certifié ISO 9001 et tests de réflectométrie optique.',
    allowedRoles: ['dg', 'chef_departement', 'directeur'],
    permissions: {
      viewRoles: ['dg', 'chef_departement', 'directeur'],
      editRoles: ['dg'],
      validateRoles: ['dg'],
      signRoles: ['dg']
    }
  },
];

// =========================================================================
// 10. TÂCHES OPÉRATIONNELLES & JALONS WORKFLOW
// =========================================================================
export const initialTasks: TaskItem[] = [
  {
    id: 'tsk-1',
    title: "Approbation Demande d'Achat DA-2026-118 - Licences Oracle & SAP",
    type: 'approbation',
    description: "Vérifier la concordance budgétaire avec le prévisionnel DAF avant signature du bon de commande.",
    organizationId: 'org-1',
    creatorId: 'user-chef-daf',
    creatorName: 'M. Ibrahima Sarr',
    creatorRole: 'chef_departement',
    assignedEntityId: 'dept-daf',
    assignedEntityName: 'Département Administration Générale & Finances (DAF)',
    assignedIntervenants: [
      {
        userId: 'user-dg',
        userName: 'Dr. Amadou Diallo',
        userRole: 'dg',
        userRoleTitle: 'Directeur Général',
        roleType: 'validateur'
      },
      {
        userId: 'user-dir-fin',
        userName: 'Mme Sophie Traoré',
        userRole: 'directeur',
        userRoleTitle: 'Directrice Financière',
        roleType: 'responsable'
      }
    ],
    priority: 'haute',
    status: 'en_attente_approbation',
    dueDate: '2026-10-05',
    createdAt: '2026-09-24',
    steps: [
      { id: 's1', label: 'Vérification prévisionnel comptable DAF', completed: true },
      { id: 's2', label: 'Contrôle des habilitations licences Oracle', completed: false },
      { id: 's3', label: 'Signature électronique DG', completed: false }
    ],
    signatureRequired: true
  },
  {
    id: 'tsk-2',
    title: "Lancement Ordre de Fabrication OF-4402 - Baies de Brassage Réseau",
    type: 'production',
    description: "Assemblage, câblage et tests d'isolation en salle blanche selon la norme ISO 9001.",
    organizationId: 'org-1',
    creatorId: 'user-chef-ops',
    creatorName: 'M. Alain Boni',
    creatorRole: 'chef_departement',
    assignedEntityId: 'dept-ops',
    assignedEntityName: 'Département Opérations Télécoms (DOP)',
    assignedIntervenants: [
      {
        userId: 'user-chef-vsat',
        userName: 'M. Fabrice Mukendi',
        userRole: 'chef_service',
        userRoleTitle: 'Chef Service VSAT',
        roleType: 'responsable'
      },
      {
        userId: 'user-agent-field',
        userName: 'Marc Tshimanga',
        userRole: 'agent',
        userRoleTitle: 'Technicien Câblage',
        roleType: 'executant'
      }
    ],
    priority: 'critique',
    status: 'en_cours',
    dueDate: '2026-09-30',
    createdAt: '2026-09-22',
    steps: [
      { id: 's1', label: 'Inspection visuelle et isolation diélectrique', completed: true },
      { id: 's2', label: 'Rapport de conformité usine', completed: false }
    ],
    signatureRequired: true
  },
  {
    id: 'tsk-3',
    title: "Alignement Paraboles VSAT Station Kolwezi & Test Rapport C/N",
    type: 'jalons',
    description: "Revue technique du rapport d'alignement Ku-Band et signature du PV de recette client minier.",
    organizationId: 'org-1',
    creatorId: 'user-chef-vsat',
    creatorName: 'M. Fabrice Mukendi',
    creatorRole: 'chef_service',
    assignedEntityId: 'srv-vsat-field',
    assignedEntityName: 'Service Déploiement Terrain & Liaisons VSAT',
    assignedIntervenants: [
      {
        userId: 'user-agent-tech',
        userName: 'Christian Kalala',
        userRole: 'agent',
        userRoleTitle: 'Ingénieur VSAT',
        roleType: 'executant'
      }
    ],
    priority: 'haute',
    status: 'termine',
    dueDate: '2026-09-26',
    createdAt: '2026-09-20',
    steps: [
      { id: 's1', label: 'Pointage satellite Eutelsat 7B', completed: true },
      { id: 's2', label: 'Mesure rapport Signal/Bruit C/N > 14dB', completed: true },
      { id: 's3', label: 'Signature PV de recette client TFM', completed: true }
    ],
    signatureRequired: false
  },
  {
    id: 'tsk-4',
    reference: 'TSK-2026-004',
    title: 'Installer la station VSAT du site minier de Tenke Fungurume',
    type: 'deploiement',
    description: "Installation complète d'une station Ku-Band (parabole 2,4 m, modem iDirect) pour la liaison du camp de base. Contact sur site : M. Ilunga (chef de camp).",
    organizationId: 'org-1',
    creatorId: 'user-chef-vsat',
    creatorName: 'M. Fabrice Mukendi',
    creatorRole: 'chef_service',
    assignedEntityId: 'srv-vsat-field',
    assignedEntityName: 'Service Déploiement Terrain & Liaisons VSAT',
    assignedIntervenants: [
      { userId: 'user-agent-tech', userName: 'Christian Kalala', userRole: 'agent', userRoleTitle: 'Ingénieur Déploiement VSAT', roleType: 'executant' },
      { userId: 'user-agent-field', userName: 'Marc Tshimanga', userRole: 'agent', userRoleTitle: 'Technicien Réseau & Câblage', roleType: 'contributeur' },
      { userId: 'user-chef-vsat', userName: 'M. Fabrice Mukendi', userRole: 'chef_service', userRoleTitle: 'Chef Service Déploiement VSAT', roleType: 'validateur' }
    ],
    priority: 'haute',
    status: 'en_cours',
    startDate: '2026-10-06',
    dueDate: '2026-10-14',
    createdAt: '2026-10-05',
    estimatedHours: 24,
    spentHours: 6,
    site: 'Site minier Tenke Fungurume (Lualaba)',
    deliverable: 'Station opérationnelle et PV de réception signé par le client',
    acceptanceCriteria: 'C/N ≥ 13,5 dB pendant 30 min ; photos de l\'installation ; numéros de série relevés',
    tags: ['VSAT', 'Tenke', 'client minier'],
    steps: [
      { id: 's1', label: 'Préparer le kit et vérifier les numéros de série', completed: true, completedBy: 'Christian Kalala', assignedToUserId: 'user-agent-tech', assignedToUserName: 'Christian Kalala' },
      { id: 's2', label: 'Poser la parabole et tirer le câble coaxial', completed: false, assignedToUserId: 'user-agent-field', assignedToUserName: 'Marc Tshimanga' },
      { id: 's3', label: 'Aligner et mesurer le rapport C/N', completed: false, assignedToUserId: 'user-agent-tech', assignedToUserName: 'Christian Kalala' },
      { id: 's4', label: 'Faire signer le PV de réception par le client', completed: false, assignedToUserId: 'user-agent-tech', assignedToUserName: 'Christian Kalala' }
    ],
    signatureRequired: true,
    comments: [
      { id: 'c1', authorId: 'user-chef-vsat', authorName: 'M. Fabrice Mukendi', at: '2026-10-06T08:10:00.000Z', text: 'Prévoir les EPI : accès au site seulement avec casque et badge du client.' }
    ],
    history: [
      { id: 'h1', at: '2026-10-05T16:00:00.000Z', actorId: 'user-chef-vsat', actorName: 'M. Fabrice Mukendi', action: 'creation', label: 'Tâche créée et assignée' },
      { id: 'h2', at: '2026-10-06T07:45:00.000Z', actorId: 'user-agent-tech', actorName: 'Christian Kalala', action: 'etape', label: 'Étape terminée : Préparer le kit et vérifier les numéros de série' }
    ]
  },
  {
    id: 'tsk-5',
    reference: 'TSK-2026-005',
    title: "Inventaire tournant du Hub N'sele (modems et LNB)",
    type: 'logistique',
    description: 'Comptage physique des modems iDirect et des LNB, rapprochement avec le stock théorique et relevé des écarts.',
    organizationId: 'org-1',
    creatorId: 'user-chef-log',
    creatorName: 'M. Dieudonné Bofata',
    creatorRole: 'chef_service',
    assignedEntityId: 'srv-hubs',
    assignedEntityName: 'Service Hubs Provinciaux & Approvisionnements',
    assignedIntervenants: [
      { userId: 'user-agent-mag', userName: 'Grâce Mbuyi', userRole: 'agent', userRoleTitle: 'Magasinière', roleType: 'executant' }
    ],
    priority: 'normale',
    status: 'a_faire',
    startDate: '2026-10-08',
    dueDate: '2026-10-10',
    createdAt: '2026-10-07',
    estimatedHours: 6,
    spentHours: 0,
    site: "Hub N'sele — Kinshasa",
    deliverable: "Fiche d'inventaire signée et liste des écarts",
    acceptanceCriteria: 'Écart toléré : 0 pour les équipements sérialisés',
    steps: [
      { id: 's1', label: 'Compter les modems iDirect par travée', completed: false, assignedToUserId: 'user-agent-mag', assignedToUserName: 'Grâce Mbuyi' },
      { id: 's2', label: 'Scanner les numéros de série', completed: false, assignedToUserId: 'user-agent-mag', assignedToUserName: 'Grâce Mbuyi' },
      { id: 's3', label: 'Relever les écarts avec le stock théorique', completed: false, assignedToUserId: 'user-agent-mag', assignedToUserName: 'Grâce Mbuyi' }
    ],
    signatureRequired: false,
    comments: [],
    history: [
      { id: 'h1', at: '2026-10-07T15:00:00.000Z', actorId: 'user-chef-log', actorName: 'M. Dieudonné Bofata', action: 'creation', label: 'Tâche créée et assignée' }
    ]
  }
];

// =========================================================================
// 11. ALERTES DE SÉCURITÉ EN DIRECT
// =========================================================================
export const initialSecurityAlerts: SecurityAlert[] = [
  {
    id: 'sec-1',
    timestamp: '08:42:15',
    userId: 'user-locked-agent',
    userName: 'Patient Kabongo',
    userRole: 'agent',
    userEntityName: 'Service Déploiement Terrain & Liaisons VSAT',
    targetEntityId: 'dept-daf',
    targetEntityName: 'Département Administration & Finances (DAF - Coffre Fort)',
    attemptCount: 2,
    status: 'compte_verrouille',
    severity: 'critique',
    ipAddress: '192.168.1.108',
    reason: 'Récidive : Tentative d\'accès direct aux dossiers comptables et fiches de paie confidentielles.',
  },
  {
    id: 'sec-2',
    timestamp: '07:15:30',
    userId: 'user-chef-vsat',
    userName: 'M. Fabrice Mukendi',
    userRole: 'chef_service',
    userEntityName: 'Service Déploiement Terrain & Liaisons VSAT',
    targetEntityId: 'dir-rh',
    targetEntityName: 'Direction des Ressources Humaines (DRH)',
    attemptCount: 1,
    status: 'alerte_emise',
    severity: 'haute',
    ipAddress: '192.168.1.115',
    reason: 'Recherche de fiches de paie hors périmètre habilité.',
  }
];

// =========================================================================
// 12. JOURNAL D'AUDIT IMMUABLE SHA-256
// =========================================================================
export const initialAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '08:00:00',
    userName: 'Dr. Amadou Diallo',
    userRole: 'Président Directeur Général (PDG / DG)',
    action: 'Connexion certifiée DG',
    category: 'auth',
    details: 'Session active avec privilège super-administrateur sur terminal local Kinshasa.',
    ip: '127.0.0.1',
    hash: 'sha256-rb-init-89210e34c9'
  },
  {
    id: 'log-2',
    timestamp: '08:15:22',
    userName: 'M. Jean-Paul Kouassi',
    userRole: 'Directeur des Ressources Humaines (DRH)',
    action: 'Validation Cotisations Sociales',
    category: 'document',
    details: 'Scellement du bordereau trimestriel CNSS / INPP / ONEM T3 2026.',
    ip: '192.168.1.104',
    hash: 'sha256-doc-decl-t3-4410291a'
  },
  {
    id: 'log-3',
    timestamp: '08:42:15',
    userName: 'Patient Kabongo',
    userRole: 'Agent Terrain Kolwezi',
    action: 'VERROUILLAGE SÉCURITÉ RÉCIDIVE',
    category: 'security',
    details: 'Blocage automatique: tentative répétée d\'accès aux livres comptables DAF. Compte suspendu.',
    ip: '192.168.1.108',
    hash: 'sha256-sec-lock-99214b77'
  }
];
