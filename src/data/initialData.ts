// src/data/initialData.ts
import type { Organization, HierarchicalEntity, User, DocumentItem, TaskItem, AuditLog, SecurityAlert } from '../types';

// 1. ORGANISATION OFFICIELLE RHEMA BUSINESS
export const initialOrganizations: Organization[] = [
  {
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
];

// 2. ARBORESCENCE COMPLÈTE DES ENTITÉS
export const initialEntities: HierarchicalEntity[] = [
  // Département DAF
  {
    id: 'dept-daf',
    name: 'Département Administration Générale & Finances (DAF)',
    code: 'DEPT-DAF',
    level: 'departement',
    organizationId: 'org-1',
    managerName: 'M. Ibrahima Sarr',
    managerEmail: 'i.sarr@rhemabusiness.com',
    managerRole: 'chef_departement',
    description: 'Supervision globale des flux financiers, de la gestion comptable et du capital humain.',
    agentCount: 34,
  },
  // Direction RH sous DAF
  {
    id: 'dir-rh',
    name: 'Direction des Ressources Humaines (DRH)',
    code: 'DIR-RH',
    level: 'direction',
    parentId: 'dept-daf',
    organizationId: 'org-1',
    managerName: 'M. Jean-Paul Kouassi',
    managerEmail: 'jp.kouassi@rhemabusiness.com',
    managerRole: 'directeur',
    description: 'Recrutement, gestion des carrières, administration du personnel et conformité sociale.',
    agentCount: 14,
  },
  // Division Paie sous Direction RH
  {
    id: 'div-paie',
    name: 'Division Rémunération & Affaires Sociales',
    code: 'DIV-PAIE',
    level: 'division',
    parentId: 'dir-rh',
    organizationId: 'org-1',
    managerName: 'Mme Fatou Camara',
    managerEmail: 'f.camara@rhemabusiness.com',
    managerRole: 'chef_division',
    description: 'Traitement de la masse salariale, avantages sociaux, déclarations fiscales et CNSS.',
    agentCount: 6,
  },
  // Service Paie sous Division Paie
  {
    id: 'srv-paie',
    name: 'Service Traitement des Bulletins & Heures',
    code: 'SRV-PAIE',
    level: 'service',
    parentId: 'div-paie',
    organizationId: 'org-1',
    managerName: 'M. Eric Mba',
    managerEmail: 'e.mba@rhemabusiness.com',
    managerRole: 'chef_service',
    description: 'Production mensuelle des bulletins de paie, validation des congés et primes des agents.',
    agentCount: 3,
  },
  // Direction Finance sous DAF
  {
    id: 'dir-finance',
    name: 'Direction Comptabilité & Trésorerie',
    code: 'DIR-FIN',
    level: 'direction',
    parentId: 'dept-daf',
    organizationId: 'org-1',
    managerName: 'Mme Sophie Traoré',
    managerEmail: 's.traore@rhemabusiness.com',
    managerRole: 'directeur',
    description: 'Comptabilité générale, trésorerie, bilan fiscal et audits financiers.',
    agentCount: 16,
  },
  // Division Compta sous Direction Finance
  {
    id: 'div-compta',
    name: 'Division Comptabilité Fournisseurs & Clients',
    code: 'DIV-CPTA',
    level: 'division',
    parentId: 'dir-finance',
    organizationId: 'org-1',
    managerName: 'M. Thomas Owona',
    managerEmail: 't.owona@rhemabusiness.com',
    managerRole: 'chef_division',
    description: 'Lettrage des comptes, rapprochements bancaires et émission des factures.',
    agentCount: 8,
  },
  // Service Facturation sous Division Compta
  {
    id: 'srv-facturation',
    name: 'Service Facturation & Recouvrement',
    code: 'SRV-FACT',
    level: 'service',
    parentId: 'div-compta',
    organizationId: 'org-1',
    managerName: 'Mme Aminata Sow',
    managerEmail: 'a.sow@rhemabusiness.com',
    managerRole: 'chef_service',
    description: 'Facturation clients, suivi des paiements et relance des factures impayées.',
    agentCount: 4,
  },
  // Département Opérations (DOP)
  {
    id: 'dept-ops',
    name: 'Département Opérations & Supply Chain (DOP)',
    code: 'DEPT-OPS',
    level: 'departement',
    organizationId: 'org-1',
    managerName: 'M. Alain Boni',
    managerEmail: 'a.boni@rhemabusiness.com',
    managerRole: 'chef_departement',
    description: 'Gestion de la chaîne logistique, des approvisionnements et de la production industrielle.',
    agentCount: 45,
  },
  // Direction Logistique sous DOP
  {
    id: 'dir-log',
    name: 'Direction Logistique & Gestion des Stocks',
    code: 'DIR-LOG',
    level: 'direction',
    parentId: 'dept-ops',
    organizationId: 'org-1',
    managerName: 'M. Marc Essomba',
    managerEmail: 'm.essomba@rhemabusiness.com',
    managerRole: 'directeur',
    description: 'Entreposage, transit douanier, expédition et approvisionnement des sites distants.',
    agentCount: 22,
  },
];

// 3. EFFECTIFS & COLLABORATEURS
export const initialUsers: User[] = [
  {
    id: 'user-dg',
    name: 'Dr. Amadou Diallo',
    email: 'dg@rhemabusiness.com',
    role: 'dg',
    roleTitle: 'Président Directeur Général (PDG / DG)',
    organizationId: 'org-1',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
  },
  {
    id: 'user-chef-daf',
    name: 'M. Ibrahima Sarr',
    email: 'i.sarr@rhemabusiness.com',
    role: 'chef_departement',
    roleTitle: 'Chef Département Administratif & Financier (DAF)',
    organizationId: 'org-1',
    departementId: 'dept-daf',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
  },
  {
    id: 'user-dir-fin',
    name: 'Mme Sophie Traoré',
    email: 's.traore@rhemabusiness.com',
    role: 'directeur',
    roleTitle: 'Directrice Financière & Comptable',
    organizationId: 'org-1',
    directionId: 'dir-finance',
    departementId: 'dept-daf',
    status: 'actif',
    failedAccessAttempts: 0,
    canCreateSubAgents: true,
  }
];

// 4. LES 8 DOCUMENTS OFFICIELS CERTIFIÉS
export const initialDocuments: DocumentItem[] = [
  {
    id: 'doc-1',
    title: 'Facture Client FC-2026-089 - TotalEnergies Cameroun',
    referenceNumber: 'FC-2026-089',
    category: 'financier_comptable',
    subtype: 'facture_client',
    organizationId: 'org-1',
    authorId: 'usr-aminata',
    authorName: 'Mme Aminata Sow',
    authorRole: 'chef_service',
    authorEntity: 'Service Facturation & Recouvrement',
    createdAt: '2026-09-15',
    status: 'signe',
    size: '1.8 Mo',
    fileType: 'PDF',
    amount: 14500000,
    currency: 'FCFA',
    description: 'Facturation prestation infogérance datacenter et maintenance applicative Q3 2026.',
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
    title: 'Bilan Comptable Annuel Certifié & Compte de Résultat 2025',
    referenceNumber: 'BILAN-2025-CERTIF',
    category: 'financier_comptable',
    subtype: 'bilan_comptable',
    organizationId: 'org-1',
    authorId: 'usr-sophie',
    authorName: 'Mme Sophie Traoré',
    authorRole: 'directeur',
    authorEntity: 'Direction Comptabilité & Trésorerie',
    createdAt: '2026-09-12',
    status: 'signe',
    size: '4.2 Mo',
    fileType: 'PDF',
    amount: 850000000,
    currency: 'FCFA',
    description: "Etats financiers certifiés par le commissaire aux comptes pour l'assemblée générale ordinaire.",
    electronicSignature: {
      signedBy: 'Mme Sophie Traoré (Directrice)',
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
    title: 'Note de Frais Mission Abidjan - M. Alain Boni',
    referenceNumber: 'NDF-2026-042',
    category: 'financier_comptable',
    subtype: 'devis',
    organizationId: 'org-1',
    authorId: 'usr-boni',
    authorName: 'M. Alain Boni',
    authorRole: 'chef_departement',
    authorEntity: 'Département Opérations & Supply Chain',
    createdAt: '2026-09-18',
    status: 'en_revue',
    size: '950 Ko',
    fileType: 'PDF',
    amount: 875000,
    currency: 'FCFA',
    description: "Billet d'avion, hébergement et indemnités journalières pour audit du terminal logistique d'Abidjan.",
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
    title: 'BON DE COMMANDE FOURNISSEUR BCF-8821 - SERVEURS DELL POWEREDGE',
    referenceNumber: 'BCF-8821',
    category: 'chaine_logistique_commerciale',
    subtype: 'bon_commande_client',
    organizationId: 'org-1',
    authorId: 'usr-roger',
    authorName: 'M. Roger Tagne',
    authorRole: 'chef_service',
    authorEntity: 'Service Magasin & Expéditions',
    createdAt: '2026-09-09 14:10',
    status: 'approuve',
    size: '1.5 Mo',
    fileType: 'PDF',
    amount: 28400000,
    currency: 'FCFA',
    description: "Commande de 4 serveurs rack haute densité pour extension de capacité infrastructure cloud.",
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
    title: 'Inventaire Physique Général Stocks T3 2026',
    referenceNumber: 'INV-T3-2026',
    category: 'chaine_logistique_commerciale',
    subtype: 'bon_reception',
    organizationId: 'org-1',
    authorId: 'usr-marc',
    authorName: 'M. Marc Essomba',
    authorRole: 'directeur',
    authorEntity: 'Direction Logistique & Gestion des Stocks',
    createdAt: '2026-09-05',
    status: 'signe',
    size: '3.1 Mo',
    fileType: 'PDF',
    amount: 112000000,
    currency: 'FCFA',
    description: "Rapprochement inventaire physique des antennes et équipements VSAT avec le progiciel ERP.",
    electronicSignature: {
      signedBy: 'M. Marc Essomba (Directeur)',
      signedAt: '2026-09-06 09:15:00',
      role: 'Directeur Logistique',
      certificateHash: 'SHA256:d84f9104a39b2184c7e8a9310bf83',
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
    id: 'doc-6',
    title: 'Bulletin de Paie - M. Eric Mba (Août 2026)',
    referenceNumber: 'PAY-2026-08-0041',
    category: 'ressources_humaines',
    subtype: 'bulletin_de_paie',
    organizationId: 'org-1',
    authorId: 'usr-fatou',
    authorName: 'Mme Fatou Camara',
    authorRole: 'chef_division',
    authorEntity: 'Division Rémunération & Affaires Sociales',
    createdAt: '2026-08-31',
    status: 'signe',
    size: '640 Ko',
    fileType: 'PDF',
    amount: 1650000,
    currency: 'FCFA',
    isConfidentialPayslip: true,
    description: "Bulletin de rémunération mensuelle et cotisations sociales CNSS & IPR.",
    allowedRoles: ['dg', 'directeur'],
    permissions: {
      viewRoles: ['dg', 'directeur'],
      editRoles: ['dg'],
      validateRoles: ['dg'],
      signRoles: ['dg']
    }
  },
  {
    id: 'doc-7',
    title: 'Contrat Cadre Fournisseur - Liaison Fibre Optique Inter-Sites',
    referenceNumber: 'CTR-2026-019',
    category: 'chaine_logistique_commerciale',
    subtype: 'contrat_travail',
    organizationId: 'org-1',
    authorId: 'usr-dg',
    authorName: 'Dr. Amadou Diallo',
    authorRole: 'dg',
    authorEntity: 'Direction Générale',
    createdAt: '2026-09-01',
    status: 'signe',
    size: '5.2 Mo',
    fileType: 'PDF',
    amount: 45000000,
    currency: 'FCFA',
    description: "Accord-cadre pluriannuel de raccordement réseau haut débit et transit IP sécurisé.",
    allowedRoles: ['dg', 'chef_departement'],
    permissions: {
      viewRoles: ['dg', 'chef_departement'],
      editRoles: ['dg'],
      validateRoles: ['dg'],
      signRoles: ['dg']
    }
  },
  {
    id: 'doc-8',
    title: 'Déclaration Trimestrielle CNSS & Prélèvement IPR Q2 2026',
    referenceNumber: 'DECL-CNSS-Q2',
    category: 'ressources_humaines',
    subtype: 'fiche_poste',
    organizationId: 'org-1',
    authorId: 'usr-jp',
    authorName: 'M. Jean-Paul Kouassi',
    authorRole: 'directeur',
    authorEntity: 'Direction des Ressources Humaines',
    createdAt: '2026-07-15',
    status: 'signe',
    size: '1.1 Mo',
    fileType: 'PDF',
    amount: 18450000,
    currency: 'FCFA',
    description: "Bordereau fiscal certifié et quittance de règlement des cotisations sociales d'entreprise.",
    allowedRoles: ['dg', 'directeur'],
    permissions: {
      viewRoles: ['dg', 'directeur'],
      editRoles: ['dg'],
      validateRoles: ['dg'],
      signRoles: ['dg']
    }
  }
];

// 5. TÂCHES OPÉRATIONNELLES
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
      }
    ],
    priority: 'haute',
    status: 'en_attente_approbation',
    dueDate: '2026-10-05',
    createdAt: '2026-09-24',
    steps: [
      { id: 's1', label: 'Vérification prévisionnel budgétaire', completed: true },
      { id: 's2', label: 'Signature électronique DG', completed: false }
    ],
    signatureRequired: true
  }
];

// 6. ALERTES DE SÉCURITÉ
export const initialSecurityAlerts: SecurityAlert[] = [];

// 7. JOURNAL D'AUDIT
export const initialAuditLogs: AuditLog[] = [
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
];