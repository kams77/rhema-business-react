// src/components/logistics/UniversalSerialTrackerTab.tsx
import React, { useState, useMemo } from 'react';
import { todayLocal } from '../../lib/dates';
import { downloadTextFile } from '../../lib/csv';
import type { HubStockItem, LogisticsHub, DeliveryNoteItem, PurchaseOrderItem, User } from '../../types';
import { 
  Barcode, 
  Search, 
  Scan, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Warehouse, 
  Calendar, 
  FileText, 
  Copy, 
  Check, 
  Camera, 
  Sparkles, 
  Download, 
  RefreshCw,
  Clock,
  Radio,
  Sun,
  Truck,
  Eye
} from 'lucide-react';

interface Props {
  stocks: HubStockItem[];
  hubs: LogisticsHub[];
  deliveryNotes: DeliveryNoteItem[];
  orders: PurchaseOrderItem[];
  currentUser: User;
  onNavigateToTab?: (tab: 'delivery' | 'orders' | 'hubs') => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

interface SerialItemRecord {
  serialNumber: string;
  itemName: string;
  sku: string;
  category: 'vsat' | 'energie_solaire' | 'solaire' | 'hybride';
  hubId: string;
  hubName: string;
  locationRack: string;
  unitPriceUSD: number;
  status: 'en_stock' | 'deployee_site' | 'en_transit' | 'reserve' | 'sav_maintenance';
  /** Garantie restante en mois (null = non renseignée). */
  warrantyMonthsRemaining: number | null;
  deliveryNoteNumber?: string;
  purchaseOrderNumber?: string;
  lastInspectionDate: string;
}

export const UniversalSerialTrackerTab: React.FC<Props> = ({
  stocks,
  hubs,
  deliveryNotes,
  orders,
  currentUser,
  onNavigateToTab,
  onLogAction
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'vsat' | 'solaire'>('all');
  const [filterHub, setFilterHub] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Scanner Simulator State
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [selectedSerialRecord, setSelectedSerialRecord] = useState<SerialItemRecord | null>(null);
  const [copiedSN, setCopiedSN] = useState<string | null>(null);

  // Batch Generator State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState('VIC-MPPT-48250-');
  const [batchStartNum, setBatchStartNum] = useState(1001);
  const [batchCount, setBatchCount] = useState(10);
  const [generatedBatch, setGeneratedBatch] = useState<string[]>([]);

  // Extraire tous les numéros de série enregistrés dans l'ensemble des stocks et BL
  const allSerialRecords: SerialItemRecord[] = useMemo(() => {
    const list: SerialItemRecord[] = [];

    // 1. Depuis les stocks des Hubs
    stocks.forEach(stock => {
      const hub = hubs.find(h => h.id === stock.hubId);
      const hubName = hub ? `${hub.name} (${hub.city})` : 'Hub Inconnu';

      stock.serialNumbers.forEach((sn, idx) => {
        // Déterminer statut selon la disponibilité
        let status: SerialItemRecord['status'] = 'en_stock';
        if (stock.quantityAvailable === 0) status = 'reserve';

        list.push({
          serialNumber: sn,
          itemName: stock.name,
          sku: stock.sku,
          category: stock.category,
          hubId: stock.hubId,
          hubName,
          locationRack: stock.locationRack || `RACK-${idx + 1}`,
          unitPriceUSD: stock.unitPriceUSD,
          status,
          warrantyMonthsRemaining: null,
          purchaseOrderNumber: undefined,
          lastInspectionDate: stock.lastAuditDate || ''
        });
      });
    });

    // 2. Depuis les Bons de Livraison (matériels déployés ou en transit)
    deliveryNotes.forEach(bl => {
      bl.items.forEach(item => {
        item.serialNumbers.forEach((sn, idx) => {
          // Si pas déjà présent
          if (!list.some(r => r.serialNumber.toLowerCase() === sn.toLowerCase())) {
            list.push({
              serialNumber: sn,
              itemName: item.designation,
              sku: item.sku,
              category: bl.category,
              hubId: 'deployed',
              hubName: `Déployé sur : ${bl.destinationSite}`,
              locationRack: 'En Service Actif',
              unitPriceUSD: 1850,
              status: bl.status === 'en_transit' ? 'en_transit' : 'deployee_site',
              warrantyMonthsRemaining: null,
              deliveryNoteNumber: bl.deliveryNumber,
              purchaseOrderNumber: bl.purchaseOrderNumber,
              lastInspectionDate: bl.date
            });
          }
        });
      });
    });

    return list;
  }, [stocks, hubs, deliveryNotes]);

  // Filtrage
  const filteredRecords = useMemo(() => {
    return allSerialRecords.filter(item => {
      const query = searchQuery.trim().toLowerCase();
      const matchSearch = 
        !query || 
        item.serialNumber.toLowerCase().includes(query) ||
        item.itemName.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.hubName.toLowerCase().includes(query);

      const matchCat = filterCategory === 'all' || 
        (filterCategory === 'vsat' ? item.category === 'vsat' : item.category.includes('solaire'));

      const matchHub = filterHub === 'all' || item.hubId === filterHub;
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;

      return matchSearch && matchCat && matchHub && matchStatus;
    });
  }, [allSerialRecords, searchQuery, filterCategory, filterHub, filterStatus]);

  const handleCopySN = (sn: string) => {
    navigator.clipboard.writeText(sn);
    setCopiedSN(sn);
    setTimeout(() => setCopiedSN(null), 2000);
  };

  const handleSimulateScan = (sn: string) => {
    setScannedResult(sn);
    setSearchQuery(sn);
    const found = allSerialRecords.find(r => r.serialNumber.toLowerCase() === sn.toLowerCase());
    if (found) {
      setSelectedSerialRecord(found);
    }
    setIsScannerActive(false);

    if (onLogAction) {
      onLogAction('Scan Numéro de Série', `Vérification optique S/N ${sn}`, 'logistics');
    }
  };

  const handleGenerateBatch = () => {
    const list: string[] = [];
    for (let i = 0; i < batchCount; i++) {
      list.push(`${batchPrefix}${batchStartNum + i}`);
    }
    setGeneratedBatch(list);
  };

  const handleExportCSV = () => {
    const headers = ['Numero_Serie', 'Designation', 'SKU', 'Categorie', 'Hub_Emplacement', 'Rack', 'Statut', 'Garantie_Mois', 'Bon_Livraison', 'Bon_Commande'];
    const rows = filteredRecords.map(r => [
      `"${r.serialNumber}"`,
      `"${r.itemName}"`,
      `"${r.sku}"`,
      `"${r.category}"`,
      `"${r.hubName}"`,
      `"${r.locationRack}"`,
      `"${r.status}"`,
      r.warrantyMonthsRemaining ?? '',
      `"${r.deliveryNoteNumber || 'N/A'}"`,
      `"${r.purchaseOrderNumber || 'N/A'}"`
    ]);

    downloadTextFile(`registre_sn_rhema_${todayLocal()}.csv`, [headers.join(','), ...rows.map(e => e.join(','))].join('\n'));
  };

  return (
    <div className="space-y-6">
      {/* BANNIÈRE TRAÇABILITÉ DES NUMÉROS DE SÉRIE */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Barcode className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Traçabilité Universelle & Registre S/N / Codes-Barres
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold border border-sky-500/40">
                  {allSerialRecords.length} ÉQUIPEMENTS AUDITÉS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Suivi unitaire de chaque équipement VSAT et Solaire depuis le dédouanement DGDA jusqu'à son déploiement final sur site minier ou provincial en RDC.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsScannerActive(prev => !prev)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition shadow-lg ${
                isScannerActive 
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500' 
                  : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500 shadow-sky-600/25'
              }`}
            >
              <Scan className="w-4 h-4" />
              <span>{isScannerActive ? 'Fermer Scanner' : 'Ouvrir Lecteur Code-Barres'}</span>
            </button>

            <button
              onClick={() => setShowBatchModal(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Générateur S/N de Lot</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>

        {/* LECTEUR CODE-BARRES / CAMÉRA SIMULATEUR */}
        {isScannerActive && (
          <div className="mt-4 p-5 bg-slate-950 border border-sky-500/40 rounded-2xl animate-fadeIn space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <Camera className="w-4 h-4 animate-pulse" />
                <span>Viseur Optique & Détection Automatique de Code-Barres (Simulation Haute Fréquence)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">CAPTEUR IP67 PRÊT</span>
            </div>

            <div className="relative bg-black/90 border border-slate-800 rounded-xl h-44 flex flex-col items-center justify-center overflow-hidden">
              {/* Ligne laser animée */}
              <div className="absolute inset-x-8 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)] animate-pulse" />
              <div className="border-2 border-dashed border-sky-400/60 rounded-lg w-72 h-24 flex items-center justify-center">
                <div className="text-center">
                  <Scan className="w-8 h-8 text-sky-400/50 mx-auto animate-bounce mb-1" />
                  <span className="text-[11px] text-slate-400 font-mono">Placez le code-barres dans la mire</span>
                </div>
              </div>
            </div>

            {/* Boutons de test rapide avec de vrais S/N de l'inventaire */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-2">Simuler la lecture d'un équipement réel :</div>
              <div className="flex flex-wrap gap-2">
                {allSerialRecords.slice(0, 6).map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSimulateScan(item.serialNumber)}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-sky-950 border border-slate-800 hover:border-sky-500/50 rounded-lg text-xs font-mono text-slate-200 transition flex items-center gap-1.5"
                  >
                    <Barcode className="w-3.5 h-3.5 text-sky-400" />
                    <span>{item.serialNumber}</span>
                    <span className="text-[10px] text-slate-500">({item.sku})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FICHE D'ÉQUIPEMENT SÉLECTIONNÉ OU SCANNÉ */}
      {selectedSerialRecord && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-sky-950/30 border border-sky-500/40 rounded-2xl p-5 shadow-xl animate-fadeIn space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase">Fiche d'Identité de l'Équipement</div>
                <div className="text-lg font-black text-white">{selectedSerialRecord.itemName}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopySN(selectedSerialRecord.serialNumber)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
              >
                {copiedSN === selectedSerialRecord.serialNumber ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier S/N</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setSelectedSerialRecord(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-400 hover:text-white transition"
              >
                Fermer Fiche
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Numéro de Série Unitaire</div>
              <div className="font-mono text-sm font-black text-sky-400 mt-0.5">{selectedSerialRecord.serialNumber}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono">SKU: {selectedSerialRecord.sku}</div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Emplacement Physique Actuel</div>
              <div className="font-bold text-sm text-white mt-0.5">{selectedSerialRecord.hubName}</div>
              <div className="text-[10px] text-indigo-400 mt-1 font-mono">Allée / Rack: {selectedSerialRecord.locationRack}</div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Statut Opérationnel</div>
              <div className="mt-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                  selectedSerialRecord.status === 'en_stock' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                  selectedSerialRecord.status === 'deployee_site' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' :
                  selectedSerialRecord.status === 'en_transit' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                  'bg-slate-700/50 text-slate-300'
                }`}>
                  {selectedSerialRecord.status === 'en_stock' ? 'EN STOCK DISPONIBLE' :
                   selectedSerialRecord.status === 'deployee_site' ? 'DÉPLOYÉ SUR SITE' :
                   selectedSerialRecord.status === 'en_transit' ? 'EN CONVOI / TRANSIT' :
                   selectedSerialRecord.status.toUpperCase()}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1.5">Valeur : ${selectedSerialRecord.unitPriceUSD.toLocaleString()} USD</div>
            </div>

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Garantie & Conformité</div>
              <div className="font-mono text-sm font-bold text-emerald-400 mt-0.5">
                {selectedSerialRecord.warrantyMonthsRemaining === null ? 'Non renseignée' : `${selectedSerialRecord.warrantyMonthsRemaining} mois restants`}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Dernier contrôle : {selectedSerialRecord.lastInspectionDate || 'non renseigné'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTRES & BARRE DE RECHERCHE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par Numéro de Série (S/N), SKU, Hub ou nom de matériel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="all">Toutes Catégories</option>
              <option value="vsat">Équipements VSAT</option>
              <option value="solaire">Énergie Solaire</option>
            </select>

            <select
              value={filterHub}
              onChange={(e) => setFilterHub(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="all">Tous les Hubs</option>
              {hubs.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
              <option value="deployed">Matériels Déployés sur Sites</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="all">Tous Statuts</option>
              <option value="en_stock">En Stock</option>
              <option value="deployee_site">Déployé sur Site</option>
              <option value="en_transit">En Transit</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLEAU DES NUMÉROS DE SÉRIE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-300">
            {filteredRecords.length} équipement{filteredRecords.length > 1 ? 's' : ''} trouvé{filteredRecords.length > 1 ? 's' : ''}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Règles de traçabilité DGDA & Certification RDC
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="p-3">Numéro de Série (S/N)</th>
                <th className="p-3">Désignation Matériel</th>
                <th className="p-3">Catégorie</th>
                <th className="p-3">Emplacement / Hub</th>
                <th className="p-3 text-center">Rack</th>
                <th className="p-3 text-center">Garantie</th>
                <th className="p-3 text-center">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRecords.map((item, idx) => (
                <tr 
                  key={idx} 
                  className={`hover:bg-slate-800/40 transition cursor-pointer ${
                    selectedSerialRecord?.serialNumber === item.serialNumber ? 'bg-sky-500/10' : ''
                  }`}
                  onClick={() => setSelectedSerialRecord(item)}
                >
                  <td className="p-3 font-mono font-bold text-sky-400">
                    <div className="flex items-center gap-1.5">
                      <Barcode className="w-3.5 h-3.5 text-sky-500/70" />
                      <span>{item.serialNumber}</span>
                    </div>
                  </td>
                  <td className="p-3 font-medium text-white max-w-xs">
                    <div>{item.itemName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                      item.category === 'vsat' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {item.category === 'vsat' ? 'VSAT' : 'SOLAIRE'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 font-medium">
                    {item.hubName}
                  </td>
                  <td className="p-3 text-center font-mono text-slate-400">
                    {item.locationRack}
                  </td>
                  <td className="p-3 text-center font-mono text-emerald-400 font-bold">
                    {item.warrantyMonthsRemaining === null ? '—' : `${item.warrantyMonthsRemaining} mois`}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      item.status === 'en_stock' ? 'bg-emerald-500/20 text-emerald-300' :
                      item.status === 'deployee_site' ? 'bg-indigo-500/20 text-indigo-300' :
                      item.status === 'en_transit' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-slate-700/50 text-slate-300'
                    }`}>
                      {item.status === 'en_stock' ? 'En Stock' :
                       item.status === 'deployee_site' ? 'Sur Site' :
                       item.status === 'en_transit' ? 'En Transit' : item.status}
                    </span>
                  </td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleCopySN(item.serialNumber)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                        title="Copier le S/N"
                      >
                        {copiedSN === item.serialNumber ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => setSelectedSerialRecord(item)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-600 text-slate-400 hover:text-white transition"
                        title="Voir la fiche détaillée"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL GÉNÉRATEUR DE NUMÉROS DE SÉRIE PAR LOTS */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">Générateur S/N de Lot Conforme</h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Générez une série séquentielle de numéros de série normalisés pour une nouvelle cargaison arrivant au dépôt ou pour l'étiquetage des racks.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 font-bold block mb-1">Préfixe Constructeur :</label>
                <input
                  type="text"
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  placeholder="Ex: VIC-MPPT-48250- ou IDR-X7-"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-300 font-bold block mb-1">Numéro de Départ :</label>
                  <input
                    type="number"
                    value={batchStartNum}
                    onChange={(e) => setBatchStartNum(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-300 font-bold block mb-1">Nombre d'unités :</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={batchCount}
                    onChange={(e) => setBatchCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateBatch}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition"
              >
                Générer les {batchCount} numéros de série
              </button>

              {generatedBatch.length > 0 && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[11px] text-slate-400 font-bold flex items-center justify-between">
                    <span>Série générée :</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedBatch.join('\n'));
                        alert('Numéros de série copiés dans le presse-papiers !');
                      }}
                      className="text-xs text-sky-400 hover:underline"
                    >
                      Copier tout
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
                    {generatedBatch.map((sn, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span>{sn}</span>
                        <span className="text-slate-600">#{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
