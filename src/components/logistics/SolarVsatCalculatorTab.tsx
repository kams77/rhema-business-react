// src/components/logistics/SolarVsatCalculatorTab.tsx
import React, { useState, useMemo } from 'react';
import { addDaysLocal, todayLocal } from '../../lib/dates';
import { useRate } from '../../lib/exchangeRate';
import { formatCDF, round2, usdToCdf } from '../../lib/money';
import { nextReference } from '../../lib/sequence';
import { newId } from '../../utils/id';
import { usePersistentState } from '../../hooks/usePersistentState';
import type { LogisticsItem, PurchaseOrderItem, HubStockItem, LogisticsHub, User, Organization } from '../../types';
import { 
  Sun, 
  Radio, 
  BatteryCharging, 
  Zap, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  FileText, 
  ArrowRight, 
  Boxes, 
  Warehouse, 
  ShieldCheck, 
  Printer, 
  Sparkles,
  Info,
  Sliders,
  DollarSign
} from 'lucide-react';

interface Props {
  currentUser: User;
  organization: Organization;
  catalog: LogisticsItem[];
  hubs: LogisticsHub[];
  stocks: HubStockItem[];
  /** Bons de commande existants (pour la numérotation). */
  orders?: PurchaseOrderItem[];
  onCreateOrder: (order: PurchaseOrderItem) => void;
  onNavigateToTab?: (tab: 'orders' | 'hubs') => void;
  onPrintOfficialDoc?: (title: string, desc: string, ref: string, amount: number) => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

interface EquipmentLoad {
  id: string;
  name: string;
  category: 'vsat' | 'solaire' | 'auxiliaire';
  powerWatts: number;
  operatingHoursPerDay: number;
  quantity: number;
  isEssential: boolean;
}

const DEFAULT_LOADS: EquipmentLoad[] = [
  { id: 'load-1', name: 'Modem VSAT iDirect Evolution X7', category: 'vsat', powerWatts: 35, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
  { id: 'load-2', name: 'Émetteur BUC Ku-Band 8W PLL', category: 'vsat', powerWatts: 65, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
  { id: 'load-3', name: 'Routeur Cisco ISR & Switch PoE 8 Ports', category: 'vsat', powerWatts: 45, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
  { id: 'load-4', name: 'Point d\'Accès Wi-Fi Hotspot Longue Portée', category: 'vsat', powerWatts: 20, operatingHoursPerDay: 16, quantity: 2, isEssential: false },
  { id: 'load-5', name: 'Système Vidéosurveillance IP & NVR', category: 'auxiliaire', powerWatts: 50, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
  { id: 'load-6', name: 'Éclairage Sécurité LED Station', category: 'auxiliaire', powerWatts: 30, operatingHoursPerDay: 12, quantity: 4, isEssential: false },
  { id: 'load-7', name: 'Ventilation / Climatiseur Inverter Baie Radio', category: 'auxiliaire', powerWatts: 180, operatingHoursPerDay: 10, quantity: 1, isEssential: false }
];

const PROVINCE_SOLAR_HOURS: { [key: string]: { hours: number; name: string; hubId: string } } = {
  'gbadolite': { hours: 5.1, name: 'Nord-Ubangi (Gbadolite)', hubId: 'hub-nord-ubangi' },
  'gemena': { hours: 5.0, name: 'Sud-Ubangi (Gemena)', hubId: 'hub-sud-ubangi' },
  'boende': { hours: 4.8, name: 'Tshuapa (Boende)', hubId: 'hub-tshuapa' },
  'tshikapa': { hours: 5.3, name: 'Kasaï (Tshikapa)', hubId: 'hub-kasai' },
  'kisangani': { hours: 4.7, name: 'Tshopo (Kisangani)', hubId: 'hub-tshopo' },
  'mbandaka': { hours: 4.9, name: 'Équateur (Mbandaka)', hubId: 'hub-equateur' },
  'kolwezi': { hours: 5.7, name: 'Lualaba (Kolwezi / Mines)', hubId: 'hub-katanga' },
  'kinshasa': { hours: 4.8, name: 'Kinshasa (Dépôt Central)', hubId: 'hub-kinshasa' }
};

export const SolarVsatCalculatorTab: React.FC<Props> = ({
  currentUser,
  organization,
  catalog,
  hubs,
  stocks,
  orders = [],
  onCreateOrder,
  onNavigateToTab,
  onPrintOfficialDoc,
  onLogAction
}) => {
  const rate = useRate();
  const [selectedProvince, setSelectedProvince] = useState<string>('gbadolite');
  const [siteName, setSiteName] = useState<string>('Station Relais VSAT Gbadolite Aéroport');
  const [autonomyDays, setAutonomyDays] = useState<number>(3); // 3 jours d'autonomie (saison des pluies RDC)
  const [batteryType, setBatteryType] = useState<'lifepo4' | 'gel'>('lifepo4');
  const [safetyMarginPercent, setSafetyMarginPercent] = useState<number>(20); // 20% marge de sécurité
  const [systemVoltage, setSystemVoltage] = useState<48 | 24>(48);
  const [panelWattPeak, setPanelWattPeak] = useState<number>(550); // 550Wc Tier-1
  const [loads, setLoads] = usePersistentState<EquipmentLoad[]>('logistics.solarLoads', DEFAULT_LOADS, { keepDefaultInApi: true });

  // Nouvel équipement manuel
  const [newLoadName, setNewLoadName] = useState('');
  const [newLoadPower, setNewLoadPower] = useState(50);
  const [newLoadHours, setNewLoadHours] = useState(24);
  const [newLoadQty, setNewLoadQty] = useState(1);
  const [newLoadCategory, setNewLoadCategory] = useState<'vsat' | 'solaire' | 'auxiliaire'>('vsat');

  const [orderCreatedSuccess, setOrderCreatedSuccess] = useState<string | null>(null);

  // Ensoleillement moyen effectif (Heures Équivalent Plein Soleil - PSH)
  const peakSunHours = PROVINCE_SOLAR_HOURS[selectedProvince]?.hours || 5.0;

  // Calculs Bilan de Puissance
  const calculations = useMemo(() => {
    // Puissance totale connectée (W)
    const totalConnectedPowerWatts = loads.reduce((sum, item) => sum + (item.powerWatts * item.quantity), 0);

    // Consommation journalière totale (Wh/jour)
    const dailyEnergyDemandWh = loads.reduce((sum, item) => {
      return sum + (item.powerWatts * item.quantity * item.operatingHoursPerDay);
    }, 0);

    // Consommation avec marge de sécurité et pertes onduleur/câbles (~15%)
    const efficiencyFactor = 0.85; // Rendement global (pertes câbles, onduleur, poussière)
    const designDailyEnergyWh = (dailyEnergyDemandWh * (1 + safetyMarginPercent / 100)) / efficiencyFactor;

    // Dimensionnement Champ Solaire Photovoltaïque
    const requiredSolarArrayPeakWatts = designDailyEnergyWh / peakSunHours;
    const numberOfPanels = Math.ceil(requiredSolarArrayPeakWatts / panelWattPeak);
    const actualSolarArrayPeakWatts = numberOfPanels * panelWattPeak;

    // Dimensionnement Banc de Batteries
    const depthOfDischarge = batteryType === 'lifepo4' ? 0.85 : 0.50; // LiFePO4 85% DoD vs Gel 50%
    const totalRequiredStorageWh = (dailyEnergyDemandWh * autonomyDays) / depthOfDischarge;
    const totalRequiredCapacityAh48V = totalRequiredStorageWh / systemVoltage;

    // Modules recommandés (Batterie LiFePO4 48V 100Ah = 4.8 kWh ou 200Ah = 9.6 kWh)
    const battery100AhCount = Math.ceil(totalRequiredCapacityAh48V / 100);
    const battery200AhCount = Math.ceil(totalRequiredCapacityAh48V / 200);

    // Dimensionnement Onduleur
    // Puissance crête au démarrage x1.4
    const recommendedInverterVA = Math.max(3000, Math.ceil((totalConnectedPowerWatts * 1.5) / 500) * 500);

    // Dimensionnement Régulateur MPPT
    // Courant de charge = Puissance PV / Tension système
    const estimatedChargeCurrentA = Math.ceil(actualSolarArrayPeakWatts / systemVoltage);

    return {
      totalConnectedPowerWatts,
      dailyEnergyDemandWh,
      dailyEnergyDemandKWh: (dailyEnergyDemandWh / 1000).toFixed(2),
      designDailyEnergyWh,
      requiredSolarArrayPeakWatts: Math.round(requiredSolarArrayPeakWatts),
      numberOfPanels,
      actualSolarArrayPeakWatts,
      totalRequiredStorageWh: Math.round(totalRequiredStorageWh),
      totalRequiredCapacityAh48V: Math.round(totalRequiredCapacityAh48V),
      battery100AhCount,
      battery200AhCount,
      recommendedInverterVA,
      estimatedChargeCurrentA
    };
  }, [loads, peakSunHours, safetyMarginPercent, panelWattPeak, batteryType, autonomyDays, systemVoltage]);

  // Nomenclature Bill of Materials (BOM) avec correspondance dans le catalogue
  const bomItems = useMemo(() => {
    return [
      {
        sku: 'PAN-SOL-550W-MONO',
        name: `Panneau Solaire Photovoltaïque ${panelWattPeak}W Monocristallin Tier-1`,
        category: 'energie_solaire' as const,
        quantity: calculations.numberOfPanels,
        unitPriceUSD: 165,
        specs: `Module 144 demi-cellules 550Wc, rendement 21.5%, certifié CE/IEC, garanti 25 ans. Architecture ${calculations.numberOfPanels} panneaux en strings adaptés.`
      },
      {
        sku: 'BAT-LITH-48V-100AH',
        name: `Batterie Solaire Lithium LiFePO4 48V 100Ah (4.8 kWh) avec BMS`,
        category: 'energie_solaire' as const,
        quantity: calculations.battery100AhCount,
        unitPriceUSD: 1450,
        specs: `Technologie LiFePO4 rackable 19", 6000 cycles à 80% DoD, communication CAN-Bus Victron, coupe-circuit intégré.`
      },
      {
        sku: 'OND-HYB-5KVA-VIC',
        name: `Onduleur-Chargeur Hybride Pur Sinus 48V / ${calculations.recommendedInverterVA >= 5000 ? '8kVA' : '5kVA'}`,
        category: 'energie_solaire' as const,
        quantity: 1,
        unitPriceUSD: calculations.recommendedInverterVA >= 5000 ? 2850 : 2100,
        specs: `Victron MultiPlus-II 48V, fonction PowerAssist, basculement sans coupure <20ms, monitoring distant Cerbo GX.`
      },
      {
        sku: 'REG-MPPT-250-100',
        name: `Régulateur de Charge Solaire SmartSolar MPPT 250V / ${calculations.estimatedChargeCurrentA > 70 ? '100A' : '70A'}`,
        category: 'energie_solaire' as const,
        quantity: 1,
        unitPriceUSD: 820,
        specs: `Technologie ultra-rapide MPPT, tension PV max 250V, Bluetooth intégré pour configuration et télémétrie.`
      },
      {
        sku: 'ANT-KU-180-PROD',
        name: `Antenne Parabolique Ku-Band 1.8m Tx/Rx avec BUC 8W et OMT`,
        category: 'vsat' as const,
        quantity: 1,
        unitPriceUSD: 2450,
        specs: `Réflecteur SMC fibre de verre, support mât anti-tempête 200 km/h, polarisation linéaire croisée, émetteur BUC 8W tropicalisé.`
      },
      {
        sku: 'CAB-SOL-6MM-RED-BLK',
        name: `Kit Câblage Solaire 6mm² H1Z2Z2-K (100m) + Connecteurs MC4`,
        category: 'energie_solaire' as const,
        quantity: 2,
        unitPriceUSD: 125,
        specs: `Cuivre étamé double isolation anti-UV résistant 1500V DC, 20 paires connecteurs MC4 IP68 étanches.`
      },
      {
        sku: 'COF-PROT-DCAC-PARAF',
        name: `Coffret de Protection DC/AC Parafoudre Para-foudre Type II RDC`,
        category: 'energie_solaire' as const,
        quantity: 1,
        unitPriceUSD: 380,
        specs: `Disjoncteurs bipolaires DC 1000V, parafoudres SPD débrochables, arrêt d'urgence coup-de-poing.`
      }
    ];
  }, [calculations, panelWattPeak]);

  const totalBOMCostUSD = round2(bomItems.reduce((sum, item) => sum + (item.unitPriceUSD * item.quantity), 0));
  const totalBOMCostCDF = usdToCdf(totalBOMCostUSD, rate);

  // Vérifier la disponibilité de ces composants dans le Hub de la province sélectionnée
  const currentTargetHubId = PROVINCE_SOLAR_HOURS[selectedProvince]?.hubId || hubs[0]?.id;
  const targetHub = hubs.find(h => h.id === currentTargetHubId) || hubs[0];

  const stockAvailability = useMemo(() => {
    return bomItems.map(item => {
      const matchStock = stocks.find(s => s.hubId === currentTargetHubId && (s.sku.toLowerCase() === item.sku.toLowerCase() || s.name.toLowerCase().includes(item.sku.split('-')[0].toLowerCase())));
      const availableQty = matchStock ? matchStock.quantityAvailable : 0;
      return {
        ...item,
        availableInHub: availableQty,
        isSufficient: availableQty >= item.quantity,
        missingQty: Math.max(0, item.quantity - availableQty)
      };
    });
  }, [bomItems, stocks, currentTargetHubId]);

  const allAvailable = stockAvailability.every(i => i.isSufficient);

  // Charger un profil type
  const handleApplyPreset = (preset: 'hub_vsat_heavy' | 'rural_station' | 'medical_center' | 'border_post') => {
    if (preset === 'hub_vsat_heavy') {
      setSiteName('Hub Provincial VSAT Haut-Débit C-Band (Station Maîtresse)');
      setAutonomyDays(3);
      setBatteryType('lifepo4');
      setLoads([
        { id: 'load-1', name: 'Modem VSAT C-Band iDirect X7 & Hub Master', category: 'vsat', powerWatts: 85, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-2', name: 'Émetteur BUC C-Band 16W Forte Puissance', category: 'vsat', powerWatts: 140, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-3', name: 'Switch Core Cisco 24 Ports & Routeur BGP', category: 'vsat', powerWatts: 110, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-4', name: 'Serveur Local de Cache & DNS Linux', category: 'vsat', powerWatts: 120, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-5', name: 'Vidéosurveillance IP PTZ 4K & NVR', category: 'auxiliaire', powerWatts: 75, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-6', name: 'Éclairage Sécurité Enceinte Périphérique', category: 'auxiliaire', powerWatts: 40, operatingHoursPerDay: 12, quantity: 6, isEssential: false },
        { id: 'load-7', name: 'Climatisation Inverter Baie Télécom (22°C)', category: 'auxiliaire', powerWatts: 350, operatingHoursPerDay: 16, quantity: 1, isEssential: true }
      ]);
    } else if (preset === 'rural_station') {
      setSiteName('Station Rurale VSAT Ku-Band 1.8m & Hotspot Wi-Fi');
      setAutonomyDays(3);
      setBatteryType('lifepo4');
      setLoads([
        { id: 'load-1', name: 'Modem VSAT iDirect Evolution X7', category: 'vsat', powerWatts: 35, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-2', name: 'Émetteur BUC Ku-Band 8W PLL', category: 'vsat', powerWatts: 65, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-3', name: 'Routeur MikroTik Gigabit & Switch PoE', category: 'vsat', powerWatts: 30, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-4', name: 'Antenne Hotspot Wi-Fi Longue Portée', category: 'vsat', powerWatts: 25, operatingHoursPerDay: 18, quantity: 2, isEssential: true },
        { id: 'load-5', name: 'Éclairage LED Site & Guérite', category: 'auxiliaire', powerWatts: 20, operatingHoursPerDay: 12, quantity: 2, isEssential: false }
      ]);
    } else if (preset === 'medical_center') {
      setSiteName('Centre Médical Rural & Télé-Médecine Connectée');
      setAutonomyDays(4); // 4 jours pour préserver vaccins
      setBatteryType('lifepo4');
      setLoads([
        { id: 'load-1', name: 'Terminal VSAT Ku-Band pour Télé-médecine', category: 'vsat', powerWatts: 50, operatingHoursPerDay: 12, quantity: 1, isEssential: true },
        { id: 'load-2', name: 'Réfrigérateur Médical à Vaccins Solaires Dulas', category: 'solaire', powerWatts: 60, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-3', name: 'Éclairage Salle d\'Opération & Urgences LED', category: 'auxiliaire', powerWatts: 60, operatingHoursPerDay: 8, quantity: 3, isEssential: true },
        { id: 'load-4', name: 'Stérilisateur Médical & Concentrateur O2', category: 'auxiliaire', powerWatts: 150, operatingHoursPerDay: 4, quantity: 1, isEssential: true },
        { id: 'load-5', name: 'Ordinateur Portable & Système Patient', category: 'auxiliaire', powerWatts: 45, operatingHoursPerDay: 10, quantity: 2, isEssential: false }
      ]);
    } else if (preset === 'border_post') {
      setSiteName('Poste Frontière DGM / DGDA & Contrôle Biométrique');
      setAutonomyDays(3);
      setBatteryType('lifepo4');
      setLoads([
        { id: 'load-1', name: 'Liaison VSAT Sécurisée VPN DGM/DGDA', category: 'vsat', powerWatts: 60, operatingHoursPerDay: 24, quantity: 1, isEssential: true },
        { id: 'load-2', name: 'Postes Biométriques & Scanners Passeport', category: 'auxiliaire', powerWatts: 80, operatingHoursPerDay: 14, quantity: 2, isEssential: true },
        { id: 'load-3', name: 'Caméras LAPI & Reconnaissance Faciale', category: 'auxiliaire', powerWatts: 45, operatingHoursPerDay: 24, quantity: 2, isEssential: true },
        { id: 'load-4', name: 'Projecteurs LED Sécurité Barrière', category: 'auxiliaire', powerWatts: 50, operatingHoursPerDay: 12, quantity: 4, isEssential: true }
      ]);
    }
  };

  const handleAddCustomLoad = () => {
    if (!newLoadName.trim()) return;
    const newId = `load-${Date.now()}`;
    setLoads(prev => [
      ...prev,
      {
        id: newId,
        name: newLoadName,
        category: newLoadCategory,
        powerWatts: Number(newLoadPower) || 10,
        operatingHoursPerDay: Math.min(24, Math.max(1, Number(newLoadHours) || 24)),
        quantity: Math.max(1, Number(newLoadQty) || 1),
        isEssential: true
      }
    ]);
    setNewLoadName('');
  };

  const handleRemoveLoad = (id: string) => {
    setLoads(prev => prev.filter(l => l.id !== id));
  };

  // Convertir le résultat en Bon de Commande Officiel
  const handleGeneratePurchaseOrder = () => {
    const orderNumber = nextReference('BC-HYB', orders.map(o => o.orderNumber));
    const newPO: PurchaseOrderItem = {
      id: `po-${Date.now()}`,
      orderNumber,
      organizationId: organization.id,
      date: todayLocal(),
      deliveryDueDate: addDaysLocal(15),
      category: 'hybride',
      // Le fournisseur est choisi lors de l'approbation du bon de commande.
      supplierName: 'Fournisseur à désigner',
      supplierContact: '',
      supplierEmail: '',
      supplierAddress: '',
      destinationSite: `${siteName} (Hub: ${targetHub?.name || 'RDC'})`,
      items: bomItems.map(item => ({
        itemId: newId('item'),
        designation: item.name,
        category: item.category as any,
        sku: item.sku,
        specs: item.specs,
        quantity: item.quantity,
        unitPriceUSD: item.unitPriceUSD,
        totalUSD: item.quantity * item.unitPriceUSD,
        notes: `Issu du Dimensionnement Solaire & VSAT automatique (${PROVINCE_SOLAR_HOURS[selectedProvince]?.name})`
      })),
      totalHT_USD: totalBOMCostUSD,
      vatRate: 0.16,
      vatAmount_USD: Math.round(totalBOMCostUSD * 0.16 * 100) / 100,
      totalTTC_USD: Math.round(totalBOMCostUSD * 1.16 * 100) / 100,
      currency: 'USD',
      exchangeRate: rate,
      paymentTerms: '50% à la validation de commande, 50% après recette technique et PV de conformité',
      status: 'en_attente_approbation',
      createdByAgentId: currentUser.id,
      createdByAgentName: currentUser.name,
      createdByServiceName: currentUser.departmentName || 'Service Ingénierie & Logistique',
      notes: `Dimensionnement certifié pour ${siteName}. Autonomie ${autonomyDays} jours, ensoleillement ${peakSunHours}h/j PSH.`
    };

    onCreateOrder(newPO);
    setOrderCreatedSuccess(orderNumber);

    if (onLogAction) {
      onLogAction(
        'Génération Bon de Commande depuis Dimensionneur',
        `Création automatique du BC ${orderNumber} pour un montant de $${newPO.totalTTC_USD.toLocaleString()} USD (${siteName}).`,
        'logistics'
      );
    }
  };

  const handlePrintTechnicalReport = () => {
    if (onPrintOfficialDoc) {
      const title = `Fiche d'Ingénierie & Dimensionnement Solaire/VSAT : ${siteName}`;
      const desc = `Bilan de puissance certifié : ${calculations.dailyEnergyDemandKWh} kWh/j. Champ photovoltaïque : ${calculations.numberOfPanels}x 550W (${calculations.actualSolarArrayPeakWatts} Wc). Stockage LiFePO4 : ${calculations.totalRequiredCapacityAh48V} Ah @ 48V (${calculations.battery100AhCount} modules 100Ah). Ensoleillement : ${peakSunHours}h/j à ${PROVINCE_SOLAR_HOURS[selectedProvince]?.name}. Autonomie : ${autonomyDays} jours.`;
      const ref = `DIM-SOL-VSAT-${Date.now().toString().slice(-6)}`;
      onPrintOfficialDoc(title, desc, ref, totalBOMCostUSD);
    }
  };

  return (
    <div className="space-y-6">
      {/* BANNIÈRE DE PRÉSENTATION DE L'OUTIL D'INGÉNIERIE */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400">
              <Calculator className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Dimensionneur & Configurateur Solaire & Kits VSAT RDC</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/40">
                  ALGORITHME D'INGÉNIERIE ISOLÉE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                Calcul automatique du bilan de puissance, nombre de panneaux solaires 550W, capacité batteries LiFePO4 48V et onduleurs Victron selon les provinces de la RDC et la couverture nuageuse.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrintTechnicalReport}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Imprimer Fiche Technique</span>
            </button>
            <button
              onClick={handleGeneratePurchaseOrder}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/25 flex items-center gap-2 transition"
            >
              <FileText className="w-4 h-4 text-slate-950" />
              <span>Générer Bon de Commande (BC)</span>
            </button>
          </div>
        </div>

        {orderCreatedSuccess && (
          <div className="mt-4 p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-300 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong>Bon de Commande officiel {orderCreatedSuccess} généré avec succès !</strong> Les composants ont été transférés vers l'onglet des Bons de Commande pour validation hiérarchique.
              </div>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('orders')}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shrink-0 transition"
              >
                Voir dans Bons de Commande &rarr;
              </button>
            )}
          </div>
        )}
      </div>

      {/* PROFILS DE SITES TYPE (PRESETS RAPIDES) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Profils Types Prédéfinis (Déploiements Standards en RDC) :</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            onClick={() => handleApplyPreset('rural_station')}
            className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-left transition group"
          >
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs mb-1 group-hover:text-indigo-300">
              <Radio className="w-4 h-4" />
              <span>1. Relais VSAT Ku 1.8m</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-tight">
              BUC 8W + Modem iDirect + Hotspot Wi-Fi rural (Consom. ~3.5 kWh/j)
            </div>
          </button>

          <button
            onClick={() => handleApplyPreset('hub_vsat_heavy')}
            className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left transition group"
          >
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1 group-hover:text-amber-300">
              <Zap className="w-4 h-4" />
              <span>2. Hub Provincial C-Band</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-tight">
              Parabole 2.4m + BUC 16W + Serveurs + Climatisation (Consom. ~18 kWh/j)
            </div>
          </button>

          <button
            onClick={() => handleApplyPreset('medical_center')}
            className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-left transition group"
          >
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1 group-hover:text-emerald-300">
              <BatteryCharging className="w-4 h-4" />
              <span>3. Centre Médical Isolé</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-tight">
              Télé-médecine + Réfrigérateur Vaccins + Autonomie renforcée 4 jours
            </div>
          </button>

          <button
            onClick={() => handleApplyPreset('border_post')}
            className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 text-left transition group"
          >
            <div className="flex items-center gap-2 text-sky-400 font-bold text-xs mb-1 group-hover:text-sky-300">
              <ShieldCheck className="w-4 h-4" />
              <span>4. Poste Frontière DGDA</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-tight">
              VSAT + Biométrie DGM + Caméras de sécurité + Éclairage périmétrique
            </div>
          </button>
        </div>
      </div>

      {/* PARAMÈTRES GÉOGRAPHIQUES ET ENVIRONNEMENTAUX */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Province & Ensoleillement */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-amber-400" />
            <span>Province & Ensoleillement (PSH)</span>
          </label>
          <select
            value={selectedProvince}
            onChange={(e) => setSelectedProvince(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
          >
            {Object.entries(PROVINCE_SOLAR_HOURS).map(([key, data]) => (
              <option key={key} value={key}>
                {data.name} &mdash; {data.hours}h / jour (PSH)
              </option>
            ))}
          </select>
          <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Hub Logistique Assigné :</span>
            <span className="font-bold text-indigo-400">{targetHub?.name || 'Hub Provincial'}</span>
          </div>
        </div>

        {/* Nom du Site & Application */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-indigo-400" />
            <span>Nom du Site / Destination</span>
          </label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            placeholder="Ex: Station Relais VSAT Gbadolite Aéroport"
          />
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-1">Tension Système</label>
              <select
                value={systemVoltage}
                onChange={(e) => setSystemVoltage(Number(e.target.value) as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value={48}>48V DC (Standard Télécom)</option>
                <option value={24}>24V DC (Petits sites)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-1">Type Panneau</label>
              <select
                value={panelWattPeak}
                onChange={(e) => setPanelWattPeak(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value={550}>550Wc Tier-1 Mono</option>
                <option value={450}>450Wc Monocristallin</option>
                <option value={600}>600Wc Bifacial</option>
              </select>
            </div>
          </div>
        </div>

        {/* Autonomie & Technologie Batterie */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
            <span>Autonomie & Technologie Batterie</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Jours d'autonomie</label>
              <select
                value={autonomyDays}
                onChange={(e) => setAutonomyDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold"
              >
                <option value={1}>1 jour (Urbain secouru)</option>
                <option value={2}>2 jours (Moyen)</option>
                <option value={3}>3 jours (Recommandé RDC)</option>
                <option value={4}>4 jours (Saison des pluies)</option>
                <option value={5}>5 jours (Sites hyper critiques)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Technologie</label>
              <select
                value={batteryType}
                onChange={(e) => setBatteryType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold"
              >
                <option value="lifepo4">LiFePO4 (85% DoD)</option>
                <option value="gel">Gel/AGM (50% DoD)</option>
              </select>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Marge de sécurité globale :</span>
            <span className="font-mono text-amber-400 font-bold">+{safetyMarginPercent}%</span>
          </div>
        </div>
      </div>

      {/* BILAN DE PUISSANCE ET TABLEAU DES CHARGES (EQUIPMENT LOADS) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Inventaire des Équipements Télécom & Énergie du Site</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Ajustez les puissances (Watts) et durées d'opération (h/j) pour recalculer instantanément le dimensionnement.
            </p>
          </div>

          <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs flex items-center gap-4">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Puissance Totale</div>
              <div className="font-mono font-bold text-white">{calculations.totalConnectedPowerWatts} W</div>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <div className="text-[10px] text-slate-400 uppercase">Consommation / Jour</div>
              <div className="font-mono font-black text-amber-400">{calculations.dailyEnergyDemandKWh} kWh/j</div>
            </div>
          </div>
        </div>

        {/* Tableau des charges */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Équipement</th>
                <th className="p-3">Catégorie</th>
                <th className="p-3 text-center">Puissance (W)</th>
                <th className="p-3 text-center">Quantité</th>
                <th className="p-3 text-center">Heures / Jour</th>
                <th className="p-3 text-right">Énergie (Wh/j)</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loads.map((load) => {
                const subWh = load.powerWatts * load.quantity * load.operatingHoursPerDay;
                return (
                  <tr key={load.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-medium text-white">
                      <div className="flex items-center gap-2">
                        {load.isEssential && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Équipement Critique 24/7" />
                        )}
                        <span>{load.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                        load.category === 'vsat' ? 'bg-indigo-500/20 text-indigo-300' :
                        load.category === 'solaire' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-slate-700/50 text-slate-300'
                      }`}>
                        {load.category}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min="1"
                        value={load.powerWatts}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setLoads(prev => prev.map(l => l.id === load.id ? { ...l, powerWatts: val } : l));
                        }}
                        className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min="1"
                        value={load.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1;
                          setLoads(prev => prev.map(l => l.id === load.id ? { ...l, quantity: val } : l));
                        }}
                        className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={load.operatingHoursPerDay}
                        onChange={(e) => {
                          const val = Math.min(24, Math.max(1, Number(e.target.value) || 1));
                          setLoads(prev => prev.map(l => l.id === load.id ? { ...l, operatingHoursPerDay: val } : l));
                        }}
                        className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                      />
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-300">
                      {subWh.toLocaleString()} Wh
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleRemoveLoad(load.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Supprimer la charge"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Formulaire ajout rapide d'un équipement */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-400 font-bold text-[11px] uppercase">+ Ajouter un Équipement :</span>
          <input
            type="text"
            placeholder="Désignation (ex: Onduleur Auxiliaire)"
            value={newLoadName}
            onChange={(e) => setNewLoadName(e.target.value)}
            className="flex-1 min-w-[180px] bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
          />
          <select
            value={newLoadCategory}
            onChange={(e) => setNewLoadCategory(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
          >
            <option value="vsat">VSAT</option>
            <option value="solaire">Solaire</option>
            <option value="auxiliaire">Auxiliaire</option>
          </select>
          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
            <span>Watts:</span>
            <input
              type="number"
              value={newLoadPower}
              onChange={(e) => setNewLoadPower(Number(e.target.value))}
              className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-center"
            />
          </div>
          <div className="flex items-center gap-1 text-slate-400 text-[11px]">
            <span>Heures/j:</span>
            <input
              type="number"
              min="1"
              max="24"
              value={newLoadHours}
              onChange={(e) => setNewLoadHours(Number(e.target.value))}
              className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-center"
            />
          </div>
          <button
            onClick={handleAddCustomLoad}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter</span>
          </button>
        </div>
      </div>

      {/* RÉSULTATS D'INGÉNIERIE & PRÉCONISATIONS TECHNIQUES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Champ Photovoltaïque */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-amber-400">
            <Sun className="w-20 h-20" />
          </div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase mb-2">
            <Sun className="w-4 h-4" />
            <span>Champ Solaire PV</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {calculations.numberOfPanels} <span className="text-sm font-normal text-slate-400">Panneaux</span>
          </div>
          <div className="text-xs text-amber-300 font-mono mt-1 font-bold">
            {calculations.actualSolarArrayPeakWatts.toLocaleString()} Wc ({panelWattPeak}Wc/panneau)
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-snug">
            Garantit {calculations.dailyEnergyDemandKWh} kWh/j même à {peakSunHours}h/j d'ensoleillement moyen.
          </div>
        </div>

        {/* Stockage Batteries Lithium */}
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-emerald-400">
            <BatteryCharging className="w-20 h-20" />
          </div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase mb-2">
            <BatteryCharging className="w-4 h-4" />
            <span>Banc Batteries {systemVoltage}V</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {calculations.battery100AhCount} <span className="text-sm font-normal text-slate-400">x 100Ah</span>
          </div>
          <div className="text-xs text-emerald-300 font-mono mt-1 font-bold">
            {calculations.totalRequiredCapacityAh48V} Ah @ {systemVoltage}V ({(calculations.totalRequiredStorageWh / 1000).toFixed(1)} kWh)
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-snug">
            Autonomie de {autonomyDays} jours consécutifs à {batteryType === 'lifepo4' ? '85%' : '50%'} de décharge (DoD).
          </div>
        </div>

        {/* Onduleur Chargeur Pur Sinus */}
        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-indigo-400">
            <Zap className="w-20 h-20" />
          </div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase mb-2">
            <Zap className="w-4 h-4" />
            <span>Onduleur Hybride</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {calculations.recommendedInverterVA >= 5000 ? '8 kVA' : '5 kVA'}
          </div>
          <div className="text-xs text-indigo-300 font-mono mt-1 font-bold">
            Victron MultiPlus-II {systemVoltage}V
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-snug">
            Crête transitoire supportée jusqu'à {(calculations.totalConnectedPowerWatts * 2)} W au démarrage radio.
          </div>
        </div>

        {/* Régulateur de Charge MPPT */}
        <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-4 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-sky-400">
            <Sliders className="w-20 h-20" />
          </div>
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase mb-2">
            <Sliders className="w-4 h-4" />
            <span>Régulateur MPPT</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {calculations.estimatedChargeCurrentA > 70 ? '100 A' : '70 A'}
          </div>
          <div className="text-xs text-sky-300 font-mono mt-1 font-bold">
            SmartSolar 250V / {calculations.estimatedChargeCurrentA}A
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-snug">
            Télémétrie Bluetooth & gestion thermique tropicalisée RDC.
          </div>
        </div>
      </div>

      {/* NOMENCLATURE MATÉRIELLE (BOM) & VÉRIFICATION DISPONIBILITÉ DANS LE HUB */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-400" />
              <span>Nomenclature Matérielle (Bill of Materials - BOM) & Audit Stock Hub</span>
            </h3>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span>Comparaison en direct avec l'inventaire du Hub :</span>
              <strong className="text-indigo-400">{targetHub?.name}</strong>
              <span>({targetHub?.city}, {targetHub?.province})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {allAvailable ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>100% Disponible en Hub</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Réapprovisionnement Requis</span>
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Référence / Désignation</th>
                <th className="p-3">Spécifications Techniques</th>
                <th className="p-3 text-center">Qté Requise</th>
                <th className="p-3 text-center">En Stock Hub</th>
                <th className="p-3 text-right">Prix Unitaire</th>
                <th className="p-3 text-right">Total HT (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stockAvailability.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 font-semibold text-white">
                    <div>{item.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                  </td>
                  <td className="p-3 text-slate-300 text-[11px] max-w-xs">
                    {item.specs}
                  </td>
                  <td className="p-3 text-center font-bold text-white font-mono">
                    {item.quantity}
                  </td>
                  <td className="p-3 text-center font-mono">
                    {item.isSufficient ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        {item.availableInHub} dispo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold" title={`Manque ${item.missingQty} pièces`}>
                        {item.availableInHub} / {item.quantity} (Manque {item.missingQty})
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-300">
                    ${item.unitPriceUSD.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-amber-300">
                    ${(item.unitPriceUSD * item.quantity).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-950/90 font-bold text-white border-t border-slate-700">
              <tr>
                <td colSpan={5} className="p-3 text-right uppercase text-slate-400 text-xs">
                  Montant Total Estimé du Kit Solaire & VSAT (HT) :
                </td>
                <td className="p-3 text-right font-mono text-base text-amber-400">
                  ${totalBOMCostUSD.toLocaleString()} USD
                </td>
              </tr>
              <tr>
                <td colSpan={5} className="p-3 text-right uppercase text-slate-400 text-xs">
                  Contre-valeur indicative en Francs Congolais (1 $ = {rate.toLocaleString('fr-FR')} CDF) :
                </td>
                <td className="p-3 text-right font-mono text-xs text-slate-300">
                  ~ {formatCDF(totalBOMCostCDF)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Actions d'exécution logistique */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400">
            * Ce dimensionnement intègre les recommandations techniques du Ministère des Postes et Télécommunications et de l'ARPTC pour les stations terriennes isolées.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintTechnicalReport}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Imprimer Fiche Certifiée</span>
            </button>
            <button
              onClick={handleGeneratePurchaseOrder}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-2 transition"
            >
              <FileText className="w-4 h-4" />
              <span>Émettre le Bon de Commande Officiel &rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
