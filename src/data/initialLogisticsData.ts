// src/data/initialLogisticsData.ts
import type { 
  LogisticsItem, 
  PurchaseOrderItem, 
  DeliveryNoteItem, 
  ShipmentTracking, 
  ProformaInvoiceItem, 
  NetToPayInvoiceItem 
} from '../types';

// =========================================================================
// CATALOGUE OFFICIEL ÉQUIPEMENTS VSAT ET ÉNERGIE SOLAIRE RHEMA BUSINESS RDC
// =========================================================================
export const initialLogisticsCatalog: LogisticsItem[] = [
  // --- ÉQUIPEMENTS VSAT ---
  {
    id: 'item-vsat-1',
    name: 'Antenne Parabolique Ku-Band 1.8m Tx/Rx Motorisée/Fixe',
    category: 'vsat',
    subcategory: 'Antennes & Réflecteurs',
    sku: 'ANT-KU-180-PROD',
    brand: 'Prodelin / Skyware Global',
    specs: 'Réflecteur SMC renforcé fibre, Feedhorn Orthomode OMT, polarisation linéaire croisée, mât 3.5 pouces anti-tempête',
    unitPriceUSD: 2450,
    unit: 'kit',
    stockAvailable: 14,
    defaultSupplier: 'Gilat Satellite Networks Africa'
  },
  {
    id: 'item-vsat-2',
    name: 'Antenne Parabolique C-Band 2.4m Haute Précision',
    category: 'vsat',
    subcategory: 'Antennes & Réflecteurs',
    sku: 'ANT-CB-240-SKY',
    brand: 'Skyware Technologies',
    specs: 'Optique Cassegrain, structure acier galvanisé à chaud, résistant vents 200 km/h, optimisé liaisons minières Katanga',
    unitPriceUSD: 4100,
    unit: 'kit',
    stockAvailable: 6,
    defaultSupplier: 'Intelsat Supplies Ltd'
  },
  {
    id: 'item-vsat-3',
    name: 'Émetteur BUC Ku-Band 8W PLL Compact',
    category: 'vsat',
    subcategory: 'Émetteurs Radio (BUC)',
    sku: 'BUC-KU-08W-TERRA',
    brand: 'Terrasat IBUC 2 / Advantech',
    specs: 'Gamme 14.00 - 14.50 GHz, LO 13.05 GHz, connecteur F, télémétrie FSK intégrée, boîtier IP67 tropicalisé',
    unitPriceUSD: 1850,
    unit: 'piece',
    stockAvailable: 22,
    defaultSupplier: 'Terrasat Communications'
  },
  {
    id: 'item-vsat-4',
    name: 'Émetteur BUC Ku-Band 16W Haute Puissance Minier',
    category: 'vsat',
    subcategory: 'Émetteurs Radio (BUC)',
    sku: 'BUC-KU-16W-TERRA',
    brand: 'Terrasat IBUC G',
    specs: 'Technologie GaN haute efficacité thermique, 14.0 - 14.5 GHz, consommation 110W, support site isolé',
    unitPriceUSD: 3200,
    unit: 'piece',
    stockAvailable: 9,
    defaultSupplier: 'Terrasat Communications'
  },
  {
    id: 'item-vsat-5',
    name: 'Récepteur LNB Ku-Band PLL Faible Bruit (0.7 dB)',
    category: 'vsat',
    subcategory: 'Récepteurs Radio (LNB)',
    sku: 'LNB-KU-PLL-NORS',
    brand: 'Norsat 1000H Series',
    specs: 'Stabilité LO ±10 kHz, gain 60 dB typique, connecteur F 75 ohms, résistant aux interférences 5G',
    unitPriceUSD: 290,
    unit: 'piece',
    stockAvailable: 35,
    defaultSupplier: 'Norsat International'
  },
  {
    id: 'item-vsat-6',
    name: 'Modem Satellite Haut Débit iDirect iQ Desktop',
    category: 'vsat',
    subcategory: 'Modems Satellites',
    sku: 'MOD-IDIR-IQ-DESK',
    brand: 'ST Engineering iDirect',
    specs: 'DVB-S2X / Adaptive TDMA, débit entrant jusqu\'à 200 Mbps, 1 port LAN GigE, routage VLAN QoS 8 classes',
    unitPriceUSD: 1450,
    unit: 'piece',
    stockAvailable: 18,
    defaultSupplier: 'ST Engineering iDirect Europe'
  },
  {
    id: 'item-vsat-7',
    name: 'Bobine Câble Coaxial Blindé RG11 (305m)',
    category: 'vsat',
    subcategory: 'Câblage Coaxial & Connectique',
    sku: 'CAB-RG11-305M',
    brand: 'Belden / CommScope',
    specs: 'Quad-shield 75 ohms, conducteur cuivre massif 14 AWG, gaine PE extérieure anti-UV et anti-rongeurs',
    unitPriceUSD: 380,
    unit: 'rouleau',
    stockAvailable: 28,
    defaultSupplier: 'CommScope Global'
  },

  // --- ÉQUIPEMENTS ÉNERGIE SOLAIRE ---
  {
    id: 'item-sol-1',
    name: 'Panneau Solaire Monocristallin 550W Tier-1 Half-Cell',
    category: 'energie_solaire',
    subcategory: 'Panneaux Photovoltaïques',
    sku: 'SOL-PAN-550W-JIN',
    brand: 'Jinko Solar Tiger Pro / Longi',
    specs: 'Cellules 144 Half-cut MBB, rendement 21.3%, cadre aluminium anodisé 35mm, verre trempé 3.2mm anti-grêle',
    unitPriceUSD: 165,
    unit: 'piece',
    stockAvailable: 160,
    defaultSupplier: 'SunPower Africa / Jinko Official'
  },
  {
    id: 'item-sol-2',
    name: 'Onduleur Hybride Pur Sinus 5kVA / 48Vdc Victron',
    category: 'energie_solaire',
    subcategory: 'Onduleurs Hybrides',
    sku: 'OND-VIC-5KVA-48V',
    brand: 'Victron Energy MultiPlus-II',
    specs: 'Puissance continue 5000VA, chargeur de batterie 70A, commutateur de transfert ultra-rapide 50A (<20ms)',
    unitPriceUSD: 1720,
    unit: 'piece',
    stockAvailable: 12,
    defaultSupplier: 'Victron Energy Almere'
  },
  {
    id: 'item-sol-3',
    name: 'Onduleur Hybride Minier Triphasé 10kVA / 48V',
    category: 'energie_solaire',
    subcategory: 'Onduleurs Hybrides',
    sku: 'OND-GRO-10KVA-48V',
    brand: 'Growatt / Schneider Electric',
    specs: 'Double tracker MPPT intégré, sortie sinusoïdale pure 380V/220V, surveillance Wi-Fi/4G temps réel',
    unitPriceUSD: 2890,
    unit: 'piece',
    stockAvailable: 7,
    defaultSupplier: 'Schneider Electric RDC'
  },
  {
    id: 'item-sol-4',
    name: 'Batterie Lithium LiFePO4 48V 100Ah Rackable (4.8 kWh)',
    category: 'energie_solaire',
    subcategory: 'Stockage & Batteries Lithium',
    sku: 'BAT-LITH-48V100AH',
    brand: 'Pylontech US3000C / BYD',
    specs: '6000 cycles à 90% DoD, BMS intelligent intégré, communication CAN/RS485 pour onduleurs Victron & Growatt',
    unitPriceUSD: 1480,
    unit: 'piece',
    stockAvailable: 24,
    defaultSupplier: 'Pylontech Storage Energy'
  },
  {
    id: 'item-sol-5',
    name: 'Régulateur de Charge MPPT SmartSolar 250V / 100A',
    category: 'energie_solaire',
    subcategory: 'Régulateurs MPPT',
    sku: 'REG-MPPT-250-100',
    brand: 'Victron Energy SmartSolar',
    specs: 'Tension PV max 250V, courant de charge 100A, efficacité crête 99%, Bluetooth Smart intégré pour smartphone',
    unitPriceUSD: 780,
    unit: 'piece',
    stockAvailable: 15,
    defaultSupplier: 'Victron Energy Almere'
  },
  {
    id: 'item-sol-6',
    name: 'Coffret de Protection DC/AC Parafoudre Para-Tempête',
    category: 'energie_solaire',
    subcategory: 'Protection Électrique & Coffrets',
    sku: 'COF-PROT-DCAC-SCH',
    brand: 'Schneider Electric TeSys',
    specs: 'Disjoncteurs différentiels 40A Type B, parafoudre DC 1000V Type 2, sectionneur cadenassable étanche IP65',
    unitPriceUSD: 420,
    unit: 'kit',
    stockAvailable: 20,
    defaultSupplier: 'Schneider Electric RDC'
  },
  {
    id: 'item-sol-7',
    name: 'Couronne Câble Solaire 6mm² Double Isolation (100m)',
    category: 'energie_solaire',
    subcategory: 'Câblage Solaire',
    sku: 'CAB-SOL-6MM2-100M',
    brand: 'KBE Solar / Huber+Suhner',
    specs: 'Cuivre étamé classe 5, gaine réticulée sans halogène anti-UV et ozone, tenue thermique -40°C à +120°C',
    unitPriceUSD: 145,
    unit: 'rouleau',
    stockAvailable: 40,
    defaultSupplier: 'SunPower Africa'
  }
];

// =========================================================================
// 1. BONS DE COMMANDE (BC) : ÉQUIPEMENTS VSAT ET ÉNERGIE SOLAIRE
// =========================================================================
export const initialPurchaseOrders: PurchaseOrderItem[] = [
  {
    id: 'bc-2026-001',
    orderNumber: 'BC-VSAT-2026-001',
    organizationId: 'org-1',
    date: '2026-09-12',
    deliveryDueDate: '2026-10-05',
    category: 'vsat',
    supplierName: 'Gilat Satellite Networks Africa Ltd',
    supplierContact: 'M. David Stern (Directeur Ventes Export)',
    supplierEmail: 'export.africa@gilat.com',
    supplierAddress: '15 High-Tech Park, Petah Tikva / Hub Logistics Dubai DWC',
    destinationSite: 'Site Minier Tenke Fungurume (Lualaba - RDC)',
    items: [
      {
        itemId: 'item-vsat-1',
        designation: 'Antenne Parabolique Ku-Band 1.8m Prodelin avec Feedhorn OMT',
        category: 'vsat',
        sku: 'ANT-KU-180-PROD',
        specs: 'Réflecteur SMC renforcé, polarisation linéaire croisée, mât anti-tempête',
        quantity: 2,
        unitPriceUSD: 2450,
        totalUSD: 4900,
        notes: 'Pour liaison primaire secours mine de cuivre'
      },
      {
        itemId: 'item-vsat-3',
        designation: 'Émetteur BUC Ku-Band 8W PLL Compact Terrasat IBUC 2',
        category: 'vsat',
        sku: 'BUC-KU-08W-TERRA',
        specs: '14.00 - 14.50 GHz, LO 13.05 GHz, boîtier IP67 tropicalisé',
        quantity: 3,
        unitPriceUSD: 1850,
        totalUSD: 5550,
        notes: '2 actifs + 1 réserve froide sur site'
      },
      {
        itemId: 'item-vsat-5',
        designation: 'Récepteur LNB Ku-Band PLL Norsat 1000H (0.7 dB)',
        category: 'vsat',
        sku: 'LNB-KU-PLL-NORS',
        specs: 'Stabilité LO ±10 kHz, gain 60 dB typique',
        quantity: 4,
        unitPriceUSD: 290,
        totalUSD: 1160
      },
      {
        itemId: 'item-vsat-6',
        designation: 'Modem Satellite Haut Débit iDirect iQ Desktop',
        category: 'vsat',
        sku: 'MOD-IDIR-IQ-DESK',
        specs: 'DVB-S2X Adaptive TDMA, port GigE',
        quantity: 2,
        unitPriceUSD: 1450,
        totalUSD: 2900
      }
    ],
    totalHT_USD: 14510,
    vatRate: 0.16,
    vatAmount_USD: 2321.60,
    totalTTC_USD: 16831.60,
    currency: 'USD',
    exchangeRate: 2850,
    paymentTerms: '50% à la commande, 50% après recette technique et livraison à Kolwezi',
    status: 'commande_passee',
    createdByAgentId: 'user-agent-tech',
    createdByAgentName: 'Christian Kalala',
    createdByServiceId: 'srv-vsat-field',
    createdByServiceName: 'Service Déploiement Terrain & Liaisons VSAT',
    approvedByManagerId: 'user-chef-vsat',
    approvedByManagerName: 'M. Fabrice Mukendi',
    approvedAt: '2026-09-14 10:20',
    signatureHash: 'sha256-bc-vsat-99201-cf8812',
    proformaReference: 'PRO-2026-VSAT-018',
    notes: 'Commande prioritaire pour mise à niveau bande passante sur mine TFM.'
  },
  {
    id: 'bc-2026-002',
    orderNumber: 'BC-SOLAR-2026-002',
    organizationId: 'org-1',
    date: '2026-09-18',
    deliveryDueDate: '2026-10-12',
    category: 'energie_solaire',
    supplierName: 'Victron Energy & SunPower Africa RDC',
    supplierContact: 'M. Patrick Tshisekedi (Ingénieur Commercial)',
    supplierEmail: 'sales.drc@sunpower-africa.com',
    supplierAddress: 'Boulevard du 30 Juin, Immeuble BCDC, Kinshasa Gombe',
    destinationSite: 'Station Hub & Téléport N\'sele (Kinshasa - RD CONGO)',
    items: [
      {
        itemId: 'item-sol-1',
        designation: 'Panneau Solaire Monocristallin 550W Tier-1 Half-Cell Jinko',
        category: 'energie_solaire',
        sku: 'SOL-PAN-550W-JIN',
        specs: '144 Half-cut MBB, rendement 21.3%, cadre anodisé 35mm',
        quantity: 24,
        unitPriceUSD: 165,
        totalUSD: 3960,
        notes: 'Générateur solaire 13.2 kWc'
      },
      {
        itemId: 'item-sol-2',
        designation: 'Onduleur Hybride Pur Sinus 5kVA / 48V Victron MultiPlus-II',
        category: 'energie_solaire',
        sku: 'OND-VIC-5KVA-48V',
        specs: 'Puissance continue 5000VA, chargeur 70A, transfert <20ms',
        quantity: 2,
        unitPriceUSD: 1720,
        totalUSD: 3440,
        notes: 'Configuration parallèle redondante 10 kVA'
      },
      {
        itemId: 'item-sol-4',
        designation: 'Batterie Lithium LiFePO4 48V 100Ah Rackable Pylontech US3000C',
        category: 'energie_solaire',
        sku: 'BAT-LITH-48V100AH',
        specs: '6000 cycles, BMS intelligent, communication Victron CAN',
        quantity: 8,
        unitPriceUSD: 1480,
        totalUSD: 11840,
        notes: 'Autonomie 38.4 kWh pour continuité station terrienne 24h/24'
      },
      {
        itemId: 'item-sol-5',
        designation: 'Régulateur de Charge MPPT SmartSolar Victron 250/100',
        category: 'energie_solaire',
        sku: 'REG-MPPT-250-100',
        specs: 'Tension max 250V, courant 100A, Bluetooth',
        quantity: 2,
        unitPriceUSD: 780,
        totalUSD: 1560
      }
    ],
    totalHT_USD: 20800,
    vatRate: 0.16,
    vatAmount_USD: 3328.00,
    totalTTC_USD: 24128.00,
    currency: 'USD',
    exchangeRate: 2850,
    paymentTerms: 'Virement 100% Rawbank à 30 jours fin de mois avec caution',
    status: 'approuve',
    createdByAgentId: 'user-agent-field',
    createdByAgentName: 'Marc Tshimanga',
    createdByServiceId: 'srv-vsat-field',
    createdByServiceName: 'Service Déploiement Terrain & Liaisons VSAT',
    approvedByManagerId: 'user-chef-ops',
    approvedByManagerName: 'M. Alain Boni',
    approvedAt: '2026-09-20 15:40',
    signatureHash: 'sha256-bc-solar-77192-ee4401',
    proformaReference: 'PRO-2026-SOL-029',
    notes: 'Alimentation autonome sécurisée de la station terrienne de N\'sele pour parer aux délestages SNEL.'
  }
];

// =========================================================================
// 2. BONS DE LIVRAISON (BL) : ÉQUIPEMENTS VSAT ET ÉNERGIE SOLAIRE
// =========================================================================
export const initialDeliveryNotes: DeliveryNoteItem[] = [
  {
    id: 'bl-2026-001',
    deliveryNumber: 'BL-VSAT-2026-001',
    purchaseOrderId: 'bc-2026-001',
    purchaseOrderNumber: 'BC-VSAT-2026-001',
    organizationId: 'org-1',
    date: '2026-09-28',
    transporterName: 'AGL Logistics RDC (Ex-Bolloré Africa Transport)',
    driverName: 'Justin Mwamba Kanku',
    vehiclePlateNumber: 'KN-9021-BB / Remorque CD-4412',
    sealNumber: 'SEAL-AGL-88201',
    destinationSite: 'Base Technique Rhema Kolwezi - Dépôt Minier Manika',
    category: 'vsat',
    items: [
      {
        designation: 'Antenne Parabolique Ku-Band 1.8m Prodelin',
        sku: 'ANT-KU-180-PROD',
        orderedQty: 2,
        deliveredQty: 2,
        serialNumbers: ['ANT-KU180-2026-091', 'ANT-KU180-2026-092'],
        condition: 'conforme',
        inspectionRemarks: 'Réflecteurs intacts, visserie inox scellée complète sous blister.'
      },
      {
        designation: 'Émetteur BUC Ku-Band 8W PLL Terrasat IBUC 2',
        sku: 'BUC-KU-08W-TERRA',
        orderedQty: 3,
        deliveredQty: 3,
        serialNumbers: ['IBUC2-08W-881921', 'IBUC2-08W-881922', 'IBUC2-08W-881923'],
        condition: 'conforme',
        inspectionRemarks: 'Scellés usine étanches intacts, test RF sur banc ok.'
      },
      {
        designation: 'Récepteur LNB Ku-Band PLL Norsat 1000H',
        sku: 'LNB-KU-PLL-NORS',
        orderedQty: 4,
        deliveredQty: 4,
        serialNumbers: ['NORS-1000H-441', 'NORS-1000H-442', 'NORS-1000H-443', 'NORS-1000H-444'],
        condition: 'conforme',
        inspectionRemarks: 'Emballage d\'origine non endommagé.'
      },
      {
        designation: 'Modem Satellite iDirect iQ Desktop',
        sku: 'MOD-IDIR-IQ-DESK',
        orderedQty: 2,
        deliveredQty: 2,
        serialNumbers: ['MAC: 00:1B:54:88:21:0A', 'MAC: 00:1B:54:88:21:0B'],
        condition: 'conforme',
        inspectionRemarks: 'Alimentation 24V et câbles ethernet inclus.'
      }
    ],
    status: 'livre_conforme',
    recipientName: 'Ir. Fabrice Mukendi',
    recipientTitle: 'Chef Service Déploiement Terrain & Liaisons VSAT',
    recipientSignatureDate: '2026-09-28 16:30',
    isRecipientSigned: true,
    preparedByAgentId: 'user-agent-tech',
    preparedByAgentName: 'Christian Kalala (Agent Service Exécutant)',
    serviceName: 'Service Déploiement Terrain & Liaisons VSAT',
    technicalReceiptCertificate: {
      isConform: true,
      testPassed: true,
      technicianNotes: 'Contrôle métrologique validé. Puissance BUC mesurée à +39 dBm. Pointage faisceau Ku-Band Eutelsat 7B opérationnel.',
      testedAt: '2026-09-28 17:15',
      testedBy: 'Christian Kalala (Ingénieur VSAT)'
    },
    remarks: 'Livraison réceptionnée sans réserve avec décharge contradictoire signée.'
  },
  {
    id: 'bl-2026-002',
    deliveryNumber: 'BL-SOLAR-2026-002',
    purchaseOrderId: 'bc-2026-002',
    purchaseOrderNumber: 'BC-SOLAR-2026-002',
    organizationId: 'org-1',
    date: '2026-10-01',
    transporterName: 'Flotte Interne Rhema Logistics & Express',
    driverName: 'Guillaume Ilunga Mutombo',
    vehiclePlateNumber: 'KIN-8822-AA (Camion Grue Mercedes Actros)',
    sealNumber: 'SEAL-RH-2026-108',
    destinationSite: 'Téléport & Station Terrienne Rhema N\'sele (Kinshasa)',
    category: 'energie_solaire',
    items: [
      {
        designation: 'Panneau Solaire Monocristallin 550W Jinko Tiger Pro',
        sku: 'SOL-PAN-550W-JIN',
        orderedQty: 24,
        deliveredQty: 24,
        serialNumbers: [
          'JK550-26-001', 'JK550-26-002', 'JK550-26-003', 'JK550-26-004',
          'JK550-26-005', 'JK550-26-006', 'JK550-26-007', 'JK550-26-008',
          'JK550-26-009', 'JK550-26-010', 'JK550-26-011', 'JK550-26-012'
        ],
        condition: 'conforme',
        inspectionRemarks: 'Palette cerclée d\'origine, contrôle d\'électroluminescence sans microfissure.'
      },
      {
        designation: 'Onduleur Hybride Pur Sinus 5kVA Victron MultiPlus-II',
        sku: 'OND-VIC-5KVA-48V',
        orderedQty: 2,
        deliveredQty: 2,
        serialNumbers: ['HQ234190821', 'HQ234190822'],
        condition: 'conforme',
        inspectionRemarks: 'Firmware v508 préinstallé, accessoires capteur de courant inclus.'
      },
      {
        designation: 'Batterie Lithium LiFePO4 48V 100Ah Pylontech US3000C',
        sku: 'BAT-LITH-48V100AH',
        orderedQty: 8,
        deliveredQty: 8,
        serialNumbers: [
          'PYL-US3C-7801', 'PYL-US3C-7802', 'PYL-US3C-7803', 'PYL-US3C-7804',
          'PYL-US3C-7805', 'PYL-US3C-7806', 'PYL-US3C-7807', 'PYL-US3C-7808'
        ],
        condition: 'conforme',
        inspectionRemarks: 'Tension de repos mesurée à 52.8V par bloc. Câbles inter-batteries présents.'
      }
    ],
    status: 'en_preparation',
    recipientName: 'M. Alain Boni',
    recipientTitle: 'Chef Département Opérations Télécoms & Supply Chain',
    isRecipientSigned: false,
    preparedByAgentId: 'user-agent-field',
    preparedByAgentName: 'Marc Tshimanga (Agent Exécutant Solaire)',
    serviceName: 'Service Déploiement Terrain & Liaisons VSAT',
    remarks: 'En cours de déchargement au dépôt N\'sele. Contrôle technique programmé avec banc de charge.'
  }
];

// =========================================================================
// 3. SUIVI DES EXPÉDITIONS & LETTRES DE FRAIS (AÉRIEN & MARITIME RDC)
// =========================================================================
export const initialShipments: ShipmentTracking[] = [
  // --- EXPÉDITION 1 : FRET AÉRIEN D'URGENCE (LETTRE DE TRANSPORT AÉRIEN - LTA / AWB) ---
  {
    id: 'exp-2026-001',
    trackingNumber: 'EXP-AIR-2026-001',
    title: 'Équipements VSAT & Modems Haute Fréquence - Fret Aérien Express',
    freightType: 'aerien',
    category: 'vsat',
    relatedOrderNumber: 'BC-VSAT-2026-001',
    supplierOrigin: 'Terrasat Communications / Hub Logistique Dubai DWC (Émirats Arabes Unis)',
    destinationFinal: 'Aéroport International N\'djili (Kinshasa FIH) -> Site Minier Kolwezi',
    carrierName: 'Ethiopian Cargo / Congo Airways',
    airWaybillDetails: {
      awbNumber: 'AWB-ET-071-8842109',
      airline: 'Ethiopian Airlines Cargo (Vol ET-3742)',
      flightNumber: 'ET-3742 / Correspondance ET-841',
      originAirport: 'Dubai Al Maktoum Intl (DWC)',
      transitAirport: 'Addis Ababa Bole Intl (ADD)',
      destinationAirport: 'Kinshasa N\'djili Intl (FIH)',
      grossWeightKg: 420.5,
      chargeableWeightKg: 465.0, // Poids volumétrique facturable
      volumeM3: 2.79,
      numberOfColis: 8,
      // Lettre de frais aérien détaillée :
      airFreightRatePerKg: 5.80, // USD/kg
      fuelSurchargeUSD: 465.00, // Surcharge carburant FSC
      securitySurchargeUSD: 93.00, // Surcharge sûreté aéroportuaire SCC
      handlingAirportUSD: 240.00, // Manutention magasin fret RVA / SEGUCE
      dgdaCustomsBondUSD: 350.00, // Caution transit douanier aéroportuaire DGDA
      totalAirCostUSD: 3845.00
    },
    currentStatus: 'dedouanement_dgda',
    estimatedDeliveryDate: '2026-10-06',
    workflowSteps: [
      {
        id: 'step-1',
        status: 'depart_fournisseur',
        label: 'Enlèvement usine & conditionnement aéronautique',
        location: 'Hub DWC Dubai Logistics City',
        timestamp: '2026-09-24 09:30',
        executedByAgent: 'M. Tariq Al-Mansoor',
        agentRole: 'Transitaire Aérien Fret',
        comment: 'Palettes sous filet homologué IATA avec capteurs d\'inclinaison et scellés inviolables.',
        completed: true
      },
      {
        id: 'step-2',
        status: 'fret_en_transit',
        label: 'Vol cargo international Dubai -> Addis Ababa -> Kinshasa',
        location: 'Espace Aérien / Transit Hub Addis Ababa (ADD)',
        timestamp: '2026-09-26 14:15',
        executedByAgent: 'Capt. Haile Bekele',
        agentRole: 'Commandant de Bord Ethiopian Cargo',
        comment: 'Atterrissage à Kinshasa FIH le 27/09 à 02:40 du matin sans anomalie.',
        completed: true
      },
      {
        id: 'step-3',
        status: 'arrivee_douane',
        label: 'Débarquement fret aéroport N\'djili & Mise sous douane RVA',
        location: 'Magasin Fret Régie des Voies Aériennes (RVA) N\'djili',
        timestamp: '2026-09-27 08:00',
        executedByAgent: 'Christian Kalala (Agent Exécutant)',
        agentRole: 'Agent Service Déploiement Rhema',
        comment: 'Prise en charge magasin sous douane. Numéro de manifeste RVA : MAN-2026-4419.',
        completed: true
      },
      {
        id: 'step-4',
        status: 'dedouanement_dgda',
        label: 'Déclaration en Douane DGDA & Guichet Unique Intégral SEGUCE',
        location: 'Bureau Douane N\'djili Aéro (DGDA Kinshasa)',
        timestamp: '2026-09-29 11:20',
        executedByAgent: 'Christian Kalala (Agent Exécutant)',
        agentRole: 'Agent Service Déploiement Rhema',
        comment: 'Liquidation de la Déclaration IM4 en cours. Paiement quittance DGDA et BIVAC / OCC effectué.',
        completed: false
      },
      {
        id: 'step-5',
        status: 'transit_national',
        label: 'Acheminement national vers le site minier',
        location: 'Corridor Kinshasa -> Lubumbashi / Kolwezi',
        timestamp: 'En attente',
        executedByAgent: 'Agent Logistique Terrain',
        agentRole: 'Agent Opérationnel',
        comment: 'Transfert par vol fret intérieur CAA ou convoi routier sécurisé.',
        completed: false
      },
      {
        id: 'step-6',
        status: 'livre_sur_site',
        label: 'Livraison finale & Recette technique terrain',
        location: 'Site Minier Tenke Fungurume',
        timestamp: 'En attente',
        executedByAgent: 'Ir. Fabrice Mukendi',
        agentRole: 'Chef de Service Déploiement',
        comment: 'PV de recette contradictoire et montage antenne Ku-Band.',
        completed: false
      }
    ],
    totalLogisticsCostUSD: 3845.00,
    assignedAgentId: 'user-agent-tech',
    assignedAgentName: 'Christian Kalala',
    serviceName: 'Service Déploiement Terrain & Liaisons VSAT',
    qrTrackingCode: 'QR-EXP-AIR-071-8842109-RHEMA'
  },

  // --- EXPÉDITION 2 : FRET MARITIME CONTENEURISÉ (CONNAISSEMENT MARITIME - B/L & PORT DE MATADI) ---
  {
    id: 'exp-2026-002',
    trackingNumber: 'EXP-MAR-2026-002',
    title: 'Centrale Solaire & Batteries Lithium 48V - Conteneur 40\' High Cube Maritime',
    freightType: 'maritime',
    category: 'energie_solaire',
    relatedOrderNumber: 'BC-SOLAR-2026-002',
    supplierOrigin: 'Victron Energy & Jinko Solar / Port d\'Anvers (Belgique) & Ningbo',
    destinationFinal: 'Port de Matadi (RDC) -> Kinshasa (Route Nationale 1) -> Téléport N\'sele',
    carrierName: 'Mediterranean Shipping Company (MSC) / LMC RDC',
    oceanBillOfLadingDetails: {
      blNumber: 'MEDU-8923014-ANR-MAT',
      shippingLine: 'MSC Mediterranean Shipping Company S.A.',
      vesselName: 'MSC MARTINA V.2608',
      voyageNumber: 'VOY-2608W',
      containerNumber: 'MSCU-7821094',
      containerType: '40_high_cube',
      sealNumber: 'SEAL-MSC-99120',
      portOfLoading: 'Port d\'Anvers-Bruges (POL: BEANR)',
      transshipmentPort: 'Pointe-Noire (Congo) / Matadi Gateway Terminal',
      portOfDischarge: 'Port Maritime de Matadi (POD: CDMAT - MGT)',
      grossWeightTonnes: 14.8,
      cbmVolume: 58.4,
      // Lettre de frais maritime détaillée :
      oceanFreightBaseUSD: 4200.00, // Fret de base O/F Anvers -> Matadi
      bunkerAdjustmentBAF_USD: 680.00, // BAF (Bunker Adjustment Factor)
      currencyAdjustmentCAF_USD: 240.00, // CAF (Currency Adjustment Factor)
      terminalHandlingTHC_MatadiUSD: 850.00, // THC Débarquement Terminal Matadi Gateway (MGT)
      lmcAgencyFeeUSD: 320.00, // Redevance Lignes Maritimes Congolaises (LMC)
      ogefremFeriFeeUSD: 450.00, // Fiche Électronique de Renseignement à l\'Importation (FERI OGEFREM)
      isFeriValidated: true,
      dgdaDutiesEstimateUSD: 1850.00, // Droits d\'entrée tarif douanier RDC matériels solaires (taux préférentiel loi énergie renouvelable)
      totalOceanCostUSD: 8590.00
    },
    inlandTransitDetails: {
      corridor: 'Corridor Matadi -> Kinshasa (Route Nationale 1, 350 km)',
      transportCompany: 'Trans-Matadi Logistics Express RDC',
      truckPlate: 'MAT-3312-BC / Tracteur Volvo FMX',
      escortRequired: true,
      checkpointStatus: 'Point de contrôle péage Kasangulu franchi avec succès',
      dgdaExitSlipNumber: 'BS-DGDA-MAT-2026-114',
      estimatedArrivalSite: '2026-10-04 18:00'
    },
    currentStatus: 'transit_national',
    estimatedDeliveryDate: '2026-10-04',
    workflowSteps: [
      {
        id: 'step-mar-1',
        status: 'depart_fournisseur',
        label: 'Empotage conteneur 40\' HC & Pose des scellés à Anvers',
        location: 'Terminal Conteneurs Quai 1742 Anvers',
        timestamp: '2026-08-15 11:00',
        executedByAgent: 'MSC Terminal Staff',
        agentRole: 'Armateur Maritime',
        comment: 'Conteneur 40\' High Cube étanche avec calage anti-choc pour 80 modules solaires et 24 batteries LiFePO4.',
        completed: true
      },
      {
        id: 'step-mar-2',
        status: 'fret_en_transit',
        label: 'Navigation Océan Atlantique & Transit Golfe de Guinée',
        location: 'Navire MSC MARTINA en haute mer',
        timestamp: '2026-08-20 au 2026-09-12',
        executedByAgent: 'Capitaine MSC',
        agentRole: 'Marine Marchande',
        comment: 'Traversée maritime sans incident. Suivi AIS par satellite actif.',
        completed: true
      },
      {
        id: 'step-mar-3',
        status: 'arrivee_douane',
        label: 'Accostage et déchargement au Port Maritime de Matadi (MGT)',
        location: 'Matadi Gateway Terminal - Quai Ango-Ango',
        timestamp: '2026-09-18 16:40',
        executedByAgent: 'Marc Tshimanga (Agent Exécutant)',
        agentRole: 'Agent Service Déploiement Rhema',
        comment: 'Inspection contradictoire à quai. Scellé MSCU-7821094 intact. Déclaration FERI OGEFREM validée.',
        completed: true
      },
      {
        id: 'step-mar-4',
        status: 'dedouanement_dgda',
        label: 'Dédouanement DGDA & Guichet SEGUCE Matadi',
        location: 'Direction Générale des Douanes et Accises (DGDA Matadi)',
        timestamp: '2026-09-24 14:00',
        executedByAgent: 'Marc Tshimanga (Agent Exécutant)',
        agentRole: 'Agent Service Déploiement Rhema',
        comment: 'Application du taux préférentiel énergie propre (TVA réduite + exonération partielle droit de douane). Bon à enlever délivré.',
        completed: true
      },
      {
        id: 'step-mar-5',
        status: 'transit_national',
        label: 'Convoi sécurisé sur la Route Nationale 1 (Matadi -> Kinshasa)',
        location: 'RN1 km 210 - Entre Mbanza-Ngungu et Kasangulu',
        timestamp: '2026-10-02 08:30',
        executedByAgent: 'Marc Tshimanga (Agent Exécutant)',
        agentRole: 'Agent Service Déploiement Rhema',
        comment: 'Convoi en route sous surveillance GPS temps réel. Arrivée prévue en fin d\'après-midi au dépôt de N\'sele.',
        completed: true
      },
      {
        id: 'step-mar-6',
        status: 'livre_sur_site',
        label: 'Dépotage, recette technique et montage des onduleurs',
        location: 'Station Téléport Rhema N\'sele (Kinshasa)',
        timestamp: '2026-10-04 (Prévu)',
        executedByAgent: 'M. Alain Boni',
        agentRole: 'Chef Département Opérations Télécoms',
        comment: 'Mise en baie des batteries LiFePO4 et raccordement au champ photovoltaïque.',
        completed: false
      }
    ],
    totalLogisticsCostUSD: 8590.00,
    assignedAgentId: 'user-agent-field',
    assignedAgentName: 'Marc Tshimanga',
    serviceName: 'Service Déploiement Terrain & Liaisons VSAT',
    qrTrackingCode: 'QR-EXP-MAR-MEDU-8923014-MATADI'
  }
];

// =========================================================================
// 4. FACTURES PROFORMA
// =========================================================================
export const initialProformas: ProformaInvoiceItem[] = [
  {
    id: 'pro-2026-001',
    proformaNumber: 'PRO-2026-VSAT-018',
    organizationId: 'org-1',
    date: '2026-09-08',
    validityDate: '2026-10-08',
    clientOrSupplierName: 'Tenke Fungurume Mining S.A. (TFM Katanga)',
    clientType: 'projet_minier',
    contactPerson: 'M. Patrick Kazadi (Directeur Systèmes d\'Information)',
    contactEmail: 'p.kazadi@tfm.cd',
    contactPhone: '+243 99 800 4120',
    projectOrSite: 'Mine de Cuivre & Cobalt Tenke Fungurume (Lualaba)',
    category: 'vsat',
    items: [
      {
        designation: 'Antenne Parabolique Ku-Band 1.8m Prodelin avec Feedhorn OMT',
        category: 'vsat',
        specs: 'Réflecteur SMC renforcé, polarisation linéaire croisée, mât anti-tempête',
        quantity: 2,
        unitPriceUSD: 2450,
        totalUSD: 4900
      },
      {
        designation: 'Émetteur BUC Ku-Band 8W PLL Terrasat IBUC 2',
        category: 'vsat',
        specs: '14.00 - 14.50 GHz, LO 13.05 GHz, boîtier IP67 tropicalisé',
        quantity: 3,
        unitPriceUSD: 1850,
        totalUSD: 5550
      },
      {
        designation: 'Récepteur LNB Ku-Band PLL Norsat 1000H (0.7 dB)',
        category: 'vsat',
        specs: 'Stabilité LO ±10 kHz, gain 60 dB typique',
        quantity: 4,
        unitPriceUSD: 290,
        totalUSD: 1160
      },
      {
        designation: 'Modem Satellite Haut Débit iDirect iQ Desktop',
        category: 'vsat',
        specs: 'DVB-S2X Adaptive TDMA, port GigE',
        quantity: 2,
        unitPriceUSD: 1450,
        totalUSD: 2900
      }
    ],
    subtotalHT_USD: 14510,
    vatRate: 0.16,
    vatAmount_USD: 2321.60,
    discountRate: 0.03,
    discountAmount_USD: 435.30,
    totalTTC_USD: 16396.30,
    paymentTerms: '50% à la commande par virement Rawbank, 50% après recette technique contradictoire',
    deliveryLeadTime: '15 jours ouvrables fret aérien express + formalités DGDA N\'djili',
    status: 'acceptee_convertie',
    convertedToOrderId: 'bc-2026-001',
    convertedToInvoiceId: 'fac-2026-001',
    preparedByAgentId: 'user-agent-tech',
    preparedByAgentName: 'Christian Kalala (Agent Service Exécutant)',
    serviceName: 'Service Déploiement Terrain & Liaisons VSAT',
    notes: 'Proforma validée et convertie en bon de commande officiel BC-VSAT-2026-001.'
  },
  {
    id: 'pro-2026-002',
    proformaNumber: 'PRO-2026-SOL-029',
    organizationId: 'org-1',
    date: '2026-09-15',
    validityDate: '2026-10-15',
    clientOrSupplierName: 'Kamoa Copper S.A. (Mine de Kolwezi)',
    clientType: 'projet_minier',
    contactPerson: 'Ing. Michel Mampuya',
    contactEmail: 'm.mampuya@kamoacopper.com',
    contactPhone: '+243 82 555 8899',
    projectOrSite: 'Centrale Solaire Secours & Station Relais Sud',
    category: 'energie_solaire',
    items: [
      {
        designation: 'Panneau Solaire Monocristallin 550W Tier-1 Jinko',
        category: 'energie_solaire',
        specs: '144 Half-cut MBB, rendement 21.3%',
        quantity: 40,
        unitPriceUSD: 165,
        totalUSD: 6600
      },
      {
        designation: 'Onduleur Hybride Minier Triphasé 10kVA Growatt',
        category: 'energie_solaire',
        specs: 'Double MPPT, pur sinus 380V/220V',
        quantity: 2,
        unitPriceUSD: 2890,
        totalUSD: 5780
      },
      {
        designation: 'Batterie Lithium LiFePO4 48V 100Ah Pylontech US3000C',
        category: 'energie_solaire',
        specs: '6000 cycles, BMS intelligent 4.8 kWh',
        quantity: 12,
        unitPriceUSD: 1480,
        totalUSD: 17760
      }
    ],
    subtotalHT_USD: 30140,
    vatRate: 0.16,
    vatAmount_USD: 4822.40,
    totalTTC_USD: 34962.40,
    paymentTerms: 'Virement bancaire irrévocable Equity BCDC à 30 jours',
    deliveryLeadTime: '21 jours ouvrables fret combiné',
    status: 'soumise',
    preparedByAgentId: 'user-agent-field',
    preparedByAgentName: 'Marc Tshimanga (Agent Service Exécutant)',
    serviceName: 'Service Déploiement Terrain & Liaisons VSAT',
    notes: 'Offre technique et financière transmise au comité des achats Kamoa Copper.'
  }
];

// =========================================================================
// 5. FACTURES DÉFINITIVES NET À PAYER (CONFORMES LOI FINANCES RDC)
// =========================================================================
export const initialNetToPayInvoices: NetToPayInvoiceItem[] = [
  {
    id: 'fac-2026-001',
    invoiceNumber: 'FAC-2026-VSAT-091',
    proformaReference: 'PRO-2026-VSAT-018',
    purchaseOrderReference: 'BC-VSAT-2026-001',
    deliveryNoteReference: 'BL-VSAT-2026-001',
    organizationId: 'org-1',
    date: '2026-09-29',
    dueDate: '2026-10-29',
    clientName: 'Tenke Fungurume Mining S.A. (TFM RDC)',
    clientTaxId: 'RCCM: CD/LSH/RCCM/14-B-1209 | IdNat: 05-83-N11200K | NIF: A0801129W',
    clientAddress: 'Concession Minière Fungurume, Territoire de Lubudi, Province du Lualaba, RD CONGO',
    category: 'vsat',
    items: [
      {
        designation: 'Antenne Parabolique Ku-Band 1.8m Prodelin complète avec OMT',
        specs: 'Réflecteur SMC renforcé, mât galvanisé anti-tempête',
        quantity: 2,
        unitPriceUSD: 2450,
        totalUSD: 4900
      },
      {
        designation: 'Émetteur BUC Ku-Band 8W PLL Terrasat IBUC 2 IP67',
        specs: '14.00 - 14.50 GHz, LO 13.05 GHz tropicalisé',
        quantity: 3,
        unitPriceUSD: 1850,
        totalUSD: 5550
      },
      {
        designation: 'Récepteur LNB Ku-Band PLL Norsat 1000H',
        specs: 'Facteur de bruit 0.7 dB, stabilité LO ±10 kHz',
        quantity: 4,
        unitPriceUSD: 290,
        totalUSD: 1160
      },
      {
        designation: 'Modem Satellite Haut Débit iDirect iQ Desktop',
        specs: 'DVB-S2X Adaptive TDMA, port GigE',
        quantity: 2,
        unitPriceUSD: 1450,
        totalUSD: 2900
      }
    ],
    subtotalHT_USD: 14510,
    vatRate: 0.16, // 16% TVA RDC
    vatAmount_USD: 2321.60,
    advancePaymentDeduction_USD: 7255.00, // 50% d'acompte déjà versé à la commande
    withholdingTaxDeduction_USD: 0, // Exonération retenue code minier
    otherDeductions_USD: 0,
    netToPayUSD: 9576.60, // NET À PAYER RESTANT EN USD
    netToPayCDF: 27293310, // NET À PAYER CONVERTI EN CDF (9576.60 * 2850)
    currencyRate: 2850,
    bankDetails: {
      bankName: 'RAWBANK KINSHASA (Siège Gombe)',
      accountNumberUSD: '05100-01004419201-88 USD',
      accountNumberCDF: '05100-01004419201-99 CDF',
      swiftBic: 'RAWBCDZX',
      ibanOrRib: 'CD68 0510 0010 0441 9201 88'
    },
    paymentStatus: 'partiellement_payee',
    paidAmountUSD: 7255.00, // Acompte initial réglé
    remainingBalanceUSD: 9576.60,
    paymentRecords: [
      {
        id: 'pay-rec-1',
        date: '2026-09-14',
        amountUSD: 7255.00,
        amountCDF: 20676750,
        paymentMethod: 'virement_rawbank',
        reference: 'VIR-RAW-2026-991204-TFM',
        registeredByAgent: 'Patricia Mwamba (Comptabilité Trésorerie)'
      }
    ],
    electronicSealHash: 'sha256-fac-vsat-tfm-2026-99128841-rhema-drc',
    preparedByAgentId: 'user-agent-compta',
    preparedByAgentName: 'Patricia Mwamba (Agent Comptable de Service)',
    serviceName: 'Service Facturation & Recouvrement Télécoms',
    isOfficialDocumentEmitted: true
  },
  {
    id: 'fac-2026-002',
    invoiceNumber: 'FAC-2026-SOL-092',
    proformaReference: 'PRO-2026-SOL-028',
    purchaseOrderReference: 'BC-SOLAR-2026-002',
    deliveryNoteReference: 'BL-SOLAR-2026-002',
    organizationId: 'org-1',
    date: '2026-10-01',
    dueDate: '2026-10-31',
    clientName: 'Société Nationale d\'Électricité & Télécoms (Projet Hybride Kinshasa)',
    clientTaxId: 'RCCM: CD/KIN/RCCM/10-A-00412 | IdNat: 01-19-N22014M | NIF: A0700142R',
    clientAddress: 'Avenue de la Justice, Gombe, Kinshasa - RD CONGO',
    category: 'energie_solaire',
    items: [
      {
        designation: 'Panneau Solaire Monocristallin 550W Jinko Half-Cell',
        specs: '144 Half-cut MBB, rendement 21.3%',
        quantity: 24,
        unitPriceUSD: 165,
        totalUSD: 3960
      },
      {
        designation: 'Onduleur Hybride Pur Sinus 5kVA Victron MultiPlus-II 48V',
        specs: 'Puissance continue 5000VA, chargeur 70A',
        quantity: 2,
        unitPriceUSD: 1720,
        totalUSD: 3440
      },
      {
        designation: 'Batterie Lithium LiFePO4 48V 100Ah Pylontech US3000C',
        specs: '6000 cycles, BMS intelligent 4.8 kWh',
        quantity: 8,
        unitPriceUSD: 1480,
        totalUSD: 11840
      },
      {
        designation: 'Régulateur MPPT SmartSolar Victron 250/100',
        specs: 'Tension PV max 250V, courant 100A, Bluetooth',
        quantity: 2,
        unitPriceUSD: 780,
        totalUSD: 1560
      }
    ],
    subtotalHT_USD: 20800,
    vatRate: 0.16,
    vatAmount_USD: 3328.00,
    advancePaymentDeduction_USD: 0,
    withholdingTaxDeduction_USD: 0,
    otherDeductions_USD: 0,
    netToPayUSD: 24128.00,
    netToPayCDF: 68764800,
    currencyRate: 2850,
    bankDetails: {
      bankName: 'EQUITY BCDC RDC (Agence Libération)',
      accountNumberUSD: '00012-44100982-14 USD',
      accountNumberCDF: '00012-44100982-15 CDF',
      swiftBic: 'BCDCCDKI',
      ibanOrRib: 'CD68 0001 2441 0098 2140 12'
    },
    paymentStatus: 'en_attente',
    paidAmountUSD: 0,
    remainingBalanceUSD: 24128.00,
    paymentRecords: [],
    electronicSealHash: 'sha256-fac-solar-snel-2026-118420-rhema-drc',
    preparedByAgentId: 'user-agent-compta',
    preparedByAgentName: 'Patricia Mwamba (Agent Comptable de Service)',
    serviceName: 'Service Facturation & Recouvrement Télécoms',
    isOfficialDocumentEmitted: true
  }
];
