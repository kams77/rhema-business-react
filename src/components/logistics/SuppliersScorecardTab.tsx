// src/components/logistics/SuppliersScorecardTab.tsx
import React, { useState } from 'react';
import type { PurchaseOrderItem, ShipmentTracking, User } from '../../types';
import { 
  Building2, 
  Truck, 
  Award, 
  Star, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  Mail, 
  MapPin, 
  Plus, 
  FileText, 
  ShieldCheck, 
  Search, 
  DollarSign, 
  Plane, 
  Ship,
  ExternalLink
} from 'lucide-react';

interface SupplierPartner {
  id: string;
  name: string;
  type: 'fournisseur_materiel' | 'transitaire_fret' | 'transporteur_national';
  specialty: string;
  country: string;
  address: string;
  contactPerson: string;
  email: string;
  phone: string;
  globalScore: number; // sur 100
  onTimeDeliveryRate: number; // en %
  conformityRate: number; // en %
  averageLeadTimeDays: number;
  totalOrdersCount: number;
  totalSpentUSD: number;
  status: 'agree' | 'en_revue' | 'privilegie';
  certifications: string[];
}

const INITIAL_PARTNERS: SupplierPartner[] = [
  {
    id: 'sup-1',
    name: 'Victron Energy Africa & B.V.',
    type: 'fournisseur_materiel',
    specialty: 'Onduleurs Pur Sinus, Régulateurs MPPT & Batteries Lithium LiFePO4',
    country: 'Pays-Bas / Afrique du Sud',
    address: 'De Paal 35, 1351 JG Almere / Bureau Régional Johannesburg',
    contactPerson: 'Dirk Van Der Merwe (Directeur Export)',
    email: 'sales-africa@victronenergy.com',
    phone: '+27 11 889 4400',
    globalScore: 96,
    onTimeDeliveryRate: 98,
    conformityRate: 99,
    averageLeadTimeDays: 14,
    totalOrdersCount: 18,
    totalSpentUSD: 142500,
    status: 'privilegie',
    certifications: ['CE', 'IEC 62109', 'ISO 9001', 'Partenaire Certifié Rhema']
  },
  {
    id: 'sup-2',
    name: 'Gilat Satellite Networks Africa',
    type: 'fournisseur_materiel',
    specialty: 'Antennes Paraboliques Ku/C-Band, Modems SkyEdge II-c & OMT',
    country: 'Israël / Kenya (Hub Nairobi)',
    address: '21 Yegia Kapayim St, Petah Tikva / Nairobi Regional Logistics Center',
    contactPerson: 'David Cohen (Head of Africa Satcom)',
    email: 'dcohen@gilat.com',
    phone: '+254 20 499 8000',
    globalScore: 93,
    onTimeDeliveryRate: 92,
    conformityRate: 97,
    averageLeadTimeDays: 18,
    totalOrdersCount: 12,
    totalSpentUSD: 98400,
    status: 'privilegie',
    certifications: ['DVB-S2X Compliant', 'ARPTC RDC Agréé', 'ISO 9001']
  },
  {
    id: 'sup-3',
    name: 'Terrasat Communications Inc.',
    type: 'fournisseur_materiel',
    specialty: 'Émetteurs Radio BUC Ku-Band 8W / 16W & C-Band IBUC 2',
    country: 'États-Unis (Californie)',
    address: 'Morgan Hill, California, USA',
    contactPerson: 'Sarah Jenkins (Directrice Commerciale EMEA)',
    email: 'sales@terrasatinc.com',
    phone: '+1 408 782 5911',
    globalScore: 91,
    onTimeDeliveryRate: 89,
    conformityRate: 98,
    averageLeadTimeDays: 21,
    totalOrdersCount: 9,
    totalSpentUSD: 67200,
    status: 'agree',
    certifications: ['MIL-STD-810G', 'IP67 Tropicalisé', 'FCC Part 25']
  },
  {
    id: 'sup-4',
    name: 'Jinko Solar Global Tier-1',
    type: 'fournisseur_materiel',
    specialty: 'Modules Photovoltaïques 550W Monocristallins Demi-cellules',
    country: 'Chine / Hub Dubai DWC',
    address: 'Dubai South Logistics District, UAE',
    contactPerson: 'Zhang Wei (Regional Sales MEA)',
    email: 'mea-solar@jinkosolar.com',
    phone: '+971 4 888 1234',
    globalScore: 94,
    onTimeDeliveryRate: 95,
    conformityRate: 98,
    averageLeadTimeDays: 25,
    totalOrdersCount: 14,
    totalSpentUSD: 84000,
    status: 'privilegie',
    certifications: ['Tier-1 Bloomberg NEF', 'TÜV Rheinland', 'IEC 61215']
  },
  {
    id: 'car-1',
    name: 'AGL Logistics RDC (Ex-Bolloré Africa Logistics)',
    type: 'transitaire_fret',
    specialty: 'Corridor Maritime Port de Matadi & Dédouanement RN1 Kinshasa',
    country: 'RDC (Kinshasa & Matadi)',
    address: 'Avenue des Poids Lourds, Gombe, Kinshasa / Port de Matadi',
    contactPerson: 'Jean-Marc Kalombo (Chef d\'Agence Fret)',
    email: 'jm.kalombo@aglgroup.com',
    phone: '+243 81 700 8822',
    globalScore: 89,
    onTimeDeliveryRate: 88,
    conformityRate: 95,
    averageLeadTimeDays: 12,
    totalOrdersCount: 22,
    totalSpentUSD: 54000,
    status: 'privilegie',
    certifications: ['Commissionnaire en Douane Agréé DGDA', 'OGEFREM FERI', 'SEGUCE']
  },
  {
    id: 'car-2',
    name: 'Ethiopian Airlines Cargo (Hub N\'djili FIH)',
    type: 'transitaire_fret',
    specialty: 'Fret Aérien Express International (Dubai / Paris / Addis -> Kinshasa)',
    country: 'Éthiopie / RDC',
    address: 'Zone Fret Aéroport International de N\'djili, Kinshasa',
    contactPerson: 'Tewodros Bekele (Cargo Station Manager)',
    email: 'fihcargo@ethiopianairlines.com',
    phone: '+243 82 000 4455',
    globalScore: 92,
    onTimeDeliveryRate: 94,
    conformityRate: 97,
    averageLeadTimeDays: 4,
    totalOrdersCount: 16,
    totalSpentUSD: 38200,
    status: 'agree',
    certifications: ['IATA Cargo Agent', 'DGDA Entrepôt Sous Douane', 'AOA Cert']
  },
  {
    id: 'car-3',
    name: 'Convois Fluviaux Fleuve Congo / Voie Nationale',
    type: 'transporteur_national',
    specialty: 'Acheminement fluvial par barge lourde (Kinshasa -> Mbandaka -> Kisangani)',
    country: 'RDC',
    address: 'Port Public de l\'ONATRA, Kinshasa',
    contactPerson: 'Capitaine Dieudonné Bolamba',
    email: 'transport.fluvial@congo-log.cd',
    phone: '+243 84 333 7711',
    globalScore: 82,
    onTimeDeliveryRate: 78,
    conformityRate: 90,
    averageLeadTimeDays: 28,
    totalOrdersCount: 7,
    totalSpentUSD: 24500,
    status: 'en_revue',
    certifications: ['Régie des Voies Fluviales (RVF)', 'Police Fluviale RDC']
  }
];

interface Props {
  currentUser: User;
  orders: PurchaseOrderItem[];
  shipments: ShipmentTracking[];
  onSelectSupplierForOrder?: (supplierName: string) => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

export const SuppliersScorecardTab: React.FC<Props> = ({
  currentUser,
  orders,
  shipments,
  onSelectSupplierForOrder,
  onLogAction
}) => {
  const [partners, setPartners] = useState<SupplierPartner[]>(INITIAL_PARTNERS);
  const [filterType, setFilterType] = useState<'all' | 'fournisseur_materiel' | 'transitaire_fret' | 'transporteur_national'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<SupplierPartner | null>(null);

  const filteredPartners = partners.filter(p => {
    const matchType = filterType === 'all' || p.type === filterType;
    const matchSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.country.toLowerCase().includes(searchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* BANNIÈRE GESTION DES FOURNISSEURS & TRANSPORTEURS */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Annuaire des Fournisseurs Agréés & Scorecards de Performance
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/40">
                  ÉVALUATION QUALITÉ RDC
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Suivi de la ponctualité, conformité technique, respect des délais de livraison et homologations DGDA/ARPTC des partenaires télécoms et solaires.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Fournisseurs Habilités</div>
                <div className="font-mono text-sm font-bold text-white">{partners.length} Partenaires Clés</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTRES ET RECHERCHE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un fournisseur, équipementier ou transporteur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="all">Tous les Types de Partenaires</option>
            <option value="fournisseur_materiel">Équipementiers & Constructeurs</option>
            <option value="transitaire_fret">Transitaires Fret International</option>
            <option value="transporteur_national">Transporteurs Nationaux & Fluviaux</option>
          </select>
        </div>
      </div>

      {/* GRILLE DES FOURNISSEURS AVEC SCORECARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPartners.map((partner) => (
          <div
            key={partner.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group"
          >
            <div>
              {/* En-tête de carte */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-indigo-400 group-hover:text-indigo-300">
                    {partner.type === 'fournisseur_materiel' ? <Building2 className="w-5 h-5" /> :
                     partner.type === 'transitaire_fret' ? <Plane className="w-5 h-5" /> :
                     <Truck className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{partner.name}</h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{partner.country}</span>
                    </div>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  partner.status === 'privilegie' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                  partner.status === 'agree' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                  'bg-slate-700/50 text-slate-300'
                }`}>
                  {partner.status}
                </span>
              </div>

              <div className="text-xs text-slate-300 font-medium mb-3 min-h-[32px]">
                {partner.specialty}
              </div>

              {/* Scorecard Barres de Progression */}
              <div className="space-y-2.5 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Score Global de Performance :</span>
                  <span className="font-mono font-black text-amber-400 text-sm">{partner.globalScore} / 100</span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>Ponctualité Livraison (OTD)</span>
                    <span className="font-bold text-white">{partner.onTimeDeliveryRate}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full" 
                      style={{ width: `${partner.onTimeDeliveryRate}%` }} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>Conformité Technique S/N</span>
                    <span className="font-bold text-white">{partner.conformityRate}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full rounded-full" 
                      style={{ width: `${partner.conformityRate}%` }} 
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Délai moyen d'acheminement :</span>
                  <span className="font-mono font-bold text-slate-200">{partner.averageLeadTimeDays} jours</span>
                </div>
              </div>

              {/* Certifications */}
              <div className="flex flex-wrap gap-1 mb-4">
                {partner.certifications.map((cert, cIdx) => (
                  <span key={cIdx} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-mono">
                    {cert}
                  </span>
                ))}
              </div>
            </div>

            {/* Pied de carte avec contact & action */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <div className="text-[11px] text-slate-400 truncate max-w-[170px]" title={partner.contactPerson}>
                <div className="font-bold text-slate-300 truncate">{partner.contactPerson}</div>
                <div className="text-[10px] text-slate-500 truncate">{partner.phone}</div>
              </div>

              {onSelectSupplierForOrder && (
                <button
                  onClick={() => onSelectSupplierForOrder(partner.name)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouveau BC</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
