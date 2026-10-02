// src/components/logistics/HubsStockManagementTab.tsx
import React, { useState, useMemo } from 'react';
import type { 
  User, 
  Organization, 
  HierarchicalEntity, 
  LogisticsItem, 
  LogisticsHub, 
  HubStockItem, 
  StockMovementItem,
  StockMovementType
} from '../../types';
import { 
  Warehouse, 
  Layers, 
  ArrowLeftRight, 
  Plus, 
  Search, 
  Filter, 
  Barcode, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  ShieldCheck, 
  Eye, 
  MapPin, 
  Phone, 
  Mail, 
  Send, 
  X, 
  Printer, 
  TrendingUp, 
  Building2, 
  Truck, 
  Radio, 
  Sun,
  Boxes,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Shield,
  Activity
} from 'lucide-react';
import { canManageHubs } from '../../utils/rbac';
import { HubsStockChartDashboard } from './HubsStockChartDashboard';

interface HubsStockManagementTabProps {
  currentUser: User;
  organization: Organization;
  entities: HierarchicalEntity[];
  catalog: LogisticsItem[];
  hubs: LogisticsHub[];
  stocks: HubStockItem[];
  movements: StockMovementItem[];
  onAddHub: (hub: LogisticsHub) => void;
  onAddMovement: (mvt: StockMovementItem) => void;
  onApproveMovement: (mvtId: string) => void;
  onReceiveTransfer: (mvtId: string) => void;
  onPrintDocument: (item: StockMovementItem, type: 'bes' | 'bss' | 'otih') => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

export const HubsStockManagementTab: React.FC<HubsStockManagementTabProps> = ({
  currentUser,
  organization,
  catalog,
  hubs,
  stocks,
  movements,
  onAddHub,
  onAddMovement,
  onApproveMovement,
  onReceiveTransfer,
  onPrintDocument,
  onLogAction
}) => {
  // Sélection du Hub : 'all' (Vue Consolidée Nationale) ou id du Hub (ex: 'hub-nord-ubangi')
  const [selectedHubId, setSelectedHubId] = useState<string>('all');
  
  // Sous-onglets dans la vue Hub
  const [subTab, setSubTab] = useState<'inventory' | 'charts' | 'movements' | 'documents'>('inventory');

  // Filtres de recherche inventaire
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'vsat' | 'solaire'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alert_only'>('all');

  // Modales
  const [showAddHubModal, setShowAddHubModal] = useState(false);
  const [showNewMovementModal, setShowNewMovementModal] = useState(false);
  const [movementInitialType, setMovementInitialType] = useState<StockMovementType>('entree_fournisseur');
  const [inspectingStockItem, setInspectingStockItem] = useState<HubStockItem | null>(null);
  const [copiedSN, setCopiedSN] = useState<string | null>(null);

  const canAddHub = canManageHubs(currentUser);
  const activeHub = useMemo(() => hubs.find(h => h.id === selectedHubId), [hubs, selectedHubId]);

  // Stocks filtrés selon le Hub sélectionné
  const filteredStocks = useMemo(() => {
    return stocks.filter(stk => {
      if (selectedHubId !== 'all' && stk.hubId !== selectedHubId) return false;
      if (categoryFilter !== 'all' && stk.category !== categoryFilter) return false;
      if (statusFilter === 'alert_only' && stk.status !== 'alerte_basse' && stk.status !== 'rupture') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = stk.name.toLowerCase().includes(q);
        const matchSku = stk.sku.toLowerCase().includes(q);
        const matchSN = stk.serialNumbers.some(sn => sn.toLowerCase().includes(q));
        const matchRack = stk.locationRack.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchSN && !matchRack) return false;
      }
      return true;
    });
  }, [stocks, selectedHubId, categoryFilter, statusFilter, searchQuery]);

  // Mouvements filtrés selon le Hub sélectionné
  const filteredMovements = useMemo(() => {
    return movements.filter(mvt => {
      if (selectedHubId === 'all') return true;
      return mvt.sourceHubId === selectedHubId || mvt.destinationHubId === selectedHubId;
    });
  }, [movements, selectedHubId]);

  // Données globales pour la Vue Consolidée Nationale
  const nationalStats = useMemo(() => {
    const totalVal = stocks.reduce((acc, s) => acc + s.totalValueUSD, 0);
    const totalArticles = stocks.reduce((acc, s) => acc + s.quantityAvailable, 0);
    const alertCount = stocks.filter(s => s.status === 'alerte_basse' || s.status === 'rupture').length;
    const inTransitCount = stocks.reduce((acc, s) => acc + s.quantityInTransit, 0);
    return { totalVal, totalArticles, alertCount, inTransitCount };
  }, [stocks]);

  // Statistiques du Hub sélectionné
  const currentHubStats = useMemo(() => {
    if (!activeHub) return null;
    const hubStocks = stocks.filter(s => s.hubId === activeHub.id);
    const val = hubStocks.reduce((acc, s) => acc + s.totalValueUSD, 0);
    const qty = hubStocks.reduce((acc, s) => acc + s.quantityAvailable, 0);
    const alerts = hubStocks.filter(s => s.status === 'alerte_basse' || s.status === 'rupture').length;
    const transit = hubStocks.reduce((acc, s) => acc + s.quantityInTransit, 0);
    return { val, qty, alerts, transit, stockCount: hubStocks.length };
  }, [activeHub, stocks]);

  const handleCopySN = (sn: string) => {
    navigator.clipboard.writeText(sn);
    setCopiedSN(sn);
    setTimeout(() => setCopiedSN(null), 2000);
  };

  const openMovementModal = (type: StockMovementType) => {
    setMovementInitialType(type);
    setShowNewMovementModal(true);
  };

  return (
    <div className="space-y-6">
      {/* BARRE DE SÉLECTION DES HUBS PROVINCIAUX */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Hubs Provinciaux & Gestion des Stocks Décentralisés</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                  {hubs.length} HUBS ACTIFS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Chaque Hub dispose d'une gestion autonome de ses stocks, numéros de série (S/N), bons d'entrée/sortie et transferts inter-hubs.
              </p>
            </div>
          </div>

          {/* Bouton d'ajout de Hub pour DG et Responsables Logistiques */}
          {canAddHub && (
            <button
              onClick={() => setShowAddHubModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Hub Provincial</span>
            </button>
          )}
        </div>

        {/* LISTE DES BOUTONS DE SÉLECTION DU HUB */}
        <div className="flex items-center gap-2 pt-3 overflow-x-auto select-none no-scrollbar">
          <button
            onClick={() => setSelectedHubId('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 border ${
              selectedHubId === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-extrabold'
                : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Vue Consolidée Nationale (RDC)</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] ${
              selectedHubId === 'all' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
            }`}>
              {stocks.length} réf
            </span>
          </button>

          {hubs.map((hub) => {
            const isSelected = selectedHubId === hub.id;
            const hubStockCount = stocks.filter(s => s.hubId === hub.id).length;
            const hubAlerts = stocks.filter(s => s.hubId === hub.id && (s.status === 'alerte_basse' || s.status === 'rupture')).length;

            return (
              <button
                key={hub.id}
                onClick={() => setSelectedHubId(hub.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>{hub.city} ({hub.province})</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  isSelected ? 'bg-indigo-900/80 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {hubStockCount} art.
                </span>
                {hubAlerts > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title={`${hubAlerts} alerte(s) stock`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* EN-TÊTE D'INFORMATIONS DU HUB OU DE LA VUE NATIONALE */}
      {selectedHubId === 'all' ? (
        /* VUE CONSOLIDÉE NATIONALE */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/15 text-amber-400">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Valeur Globale Stocks RDC</div>
              <div className="text-xl font-black text-white font-mono mt-0.5">
                ${nationalStats.totalVal.toLocaleString()} USD
              </div>
              <div className="text-[10px] text-amber-400 mt-0.5">
                Consolidé sur les {hubs.length} Hubs provinciaux
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400">
              <Warehouse className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Unités Physiques Disponibles</div>
              <div className="text-xl font-black text-white font-mono mt-0.5">
                {nationalStats.totalArticles} équipements
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">
                Prêts pour déploiement chantiers
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-sky-500/15 text-sky-400">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Transferts Inter-Hubs en Transit</div>
              <div className="text-xl font-black text-white font-mono mt-0.5">
                {nationalStats.inTransitCount} unités
              </div>
              <div className="text-[10px] text-sky-400 mt-0.5">
                Barges fluviales & convois routiers
              </div>
            </div>
          </div>

          <div 
            onClick={() => setSubTab('charts')}
            className="cursor-pointer bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-red-500/50 rounded-2xl p-4 flex items-center gap-4 transition shadow-md group"
          >
            <div className="p-3 rounded-xl bg-red-500/15 text-red-400 group-hover:scale-105 transition">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Alertes Seuil Critique</div>
              <div className="text-xl font-black text-white font-mono mt-0.5">
                {nationalStats.alertCount} référence(s)
              </div>
              <div className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1">
                <span>Voir Graphiques Recharts & Alertes</span>
                <Activity className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      ) : activeHub && (
        /* VUE DU HUB PROVINCIAL SÉLECTIONNÉ */
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                  {activeHub.code}
                </span>
                <h3 className="text-lg font-black text-white">{activeHub.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  activeHub.status === 'actif'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {activeHub.status}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                  {activeHub.securityLevel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <strong>Ville :</strong> {activeHub.city} ({activeHub.province}) — {activeHub.address}
                </span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-sky-400" />
                  <strong>Responsable :</strong> {activeHub.managerName}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  {activeHub.managerContact}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  {activeHub.managerEmail}
                </span>
              </div>

              {/* Zones de couverture */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-slate-500">Périmètre de desserte :</span>
                {activeHub.coverageZones.map((z, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-slate-950/70 border border-slate-800 rounded-md text-[10px] text-slate-300">
                    {z}
                  </span>
                ))}
              </div>
            </div>

            {/* Jauge d'occupation & Valeur du stock */}
            <div className="flex items-center gap-4 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 shrink-0">
              <div className="space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Taux d'Occupation de l'Entrepôt
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        activeHub.currentOccupancyRate > 75 
                          ? 'bg-red-500' 
                          : activeHub.currentOccupancyRate > 50 
                            ? 'bg-amber-500' 
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${activeHub.currentOccupancyRate}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-white">
                    {activeHub.currentOccupancyRate}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Capacité totale : {activeHub.storageCapacityM3} m³
                </div>
              </div>

              <div className="border-l border-slate-800 pl-4 space-y-0.5">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Valeur du Stock Hub</div>
                <div className="text-base font-black text-amber-400 font-mono">
                  ${currentHubStats?.val.toLocaleString()} USD
                </div>
                <div className="text-[10px] text-slate-400">
                  {currentHubStats?.qty} unités ({currentHubStats?.stockCount} réf)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOUTONS D'ACTIONS RAPIDES : ENTRÉE, SORTIE, TRANSFERT INTER-HUB */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        {/* Navigation des sous-onglets du Hub */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setSubTab('inventory')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              subTab === 'inventory' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Inventaire & S/N ({filteredStocks.length})</span>
          </button>
          <button
            onClick={() => setSubTab('charts')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              subTab === 'charts' ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Graphiques Recharts & Alertes</span>
          </button>
          <button
            onClick={() => setSubTab('movements')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              subTab === 'movements' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Mouvements de Stock ({filteredMovements.length})</span>
          </button>
          <button
            onClick={() => setSubTab('documents')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              subTab === 'documents' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Bons & Approbations (BES, BSS, OTIH)</span>
          </button>
        </div>

        {/* Boutons d'émissions de Mouvements */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openMovementModal('entree_fournisseur')}
            className="px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Entrée Stock (BES)</span>
          </button>

          <button
            onClick={() => openMovementModal('sortie_deploiement')}
            className="px-3 py-1.5 bg-amber-600/90 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Sortie Chantier (BSS)</span>
          </button>

          <button
            onClick={() => openMovementModal('transfert_inter_hub')}
            className="px-3 py-1.5 bg-sky-600/90 hover:bg-sky-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow transition active:scale-95"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfert Inter-Hub (OTIH)</span>
          </button>
        </div>
      </div>

      {/* CONTENU SELON LE SOUS-ONGLET ACTIF */}

      {/* 0. SOUS-ONGLET : TABLEAU DE BORD GRAPHIQUE RECHARTS & ALERTES EN TEMPS RÉEL */}
      {subTab === 'charts' && (
        <HubsStockChartDashboard
          currentUser={currentUser}
          hubs={hubs}
          stocks={stocks}
          catalog={catalog}
          movements={movements}
          onSelectHub={(hubId) => setSelectedHubId(hubId)}
          onRequestTransfer={(stk) => {
            setMovementInitialType('transfert_inter_hub');
            setShowNewMovementModal(true);
          }}
          onRequestOrder={() => {
            setSubTab('inventory');
          }}
        />
      )}

      {/* 1. SOUS-ONGLET : INVENTAIRE & TRAÇABILITÉ DES NUMÉROS DE SÉRIE */}
      {subTab === 'inventory' && (
        <div className="space-y-4">
          {/* Barre de filtre et recherche */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher par article, SKU, n° de série (S/N), travée de stockage..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Toutes Catégories</option>
                <option value="vsat">Équipements VSAT</option>
                <option value="solaire">Énergie Solaire</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Tous les Statuts</option>
                <option value="alert_only">Alertes & Ruptures Uniquement</option>
              </select>
            </div>
          </div>

          {/* Tableau de l'inventaire des stocks du Hub */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Hub / Emplacement</th>
                    <th className="p-3.5">Désignation Équipement</th>
                    <th className="p-3.5">SKU / Catégorie</th>
                    <th className="p-3.5 text-center">Disponible</th>
                    <th className="p-3.5 text-center">Réservé</th>
                    <th className="p-3.5 text-center">En Transit</th>
                    <th className="p-3.5 text-right">Valeur Stock</th>
                    <th className="p-3.5 text-center">Numéros de Série (S/N)</th>
                    <th className="p-3.5 text-center">Statut</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        Aucun article ne correspond aux critères de recherche dans ce périmètre.
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map((stk) => {
                      const hub = hubs.find(h => h.id === stk.hubId);
                      const isAlert = stk.status === 'alerte_basse' || stk.status === 'rupture';

                      return (
                        <tr key={stk.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3.5">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{hub?.city || stk.hubId}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {stk.locationRack}
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="font-bold text-white max-w-xs">{stk.name}</div>
                            <div className="text-[10px] text-slate-400">
                              Dernier inventaire : {stk.lastAuditDate}
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="font-mono text-indigo-300 font-bold">{stk.sku}</div>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] mt-0.5 ${
                              stk.category === 'vsat' ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {stk.category === 'vsat' ? <Radio className="w-2.5 h-2.5" /> : <Sun className="w-2.5 h-2.5" />}
                              {stk.category.toUpperCase()}
                            </span>
                          </td>

                          <td className="p-3.5 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                              stk.quantityAvailable === 0
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : stk.quantityAvailable <= stk.minAlertThreshold
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {stk.quantityAvailable}
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5">seuil min: {stk.minAlertThreshold}</div>
                          </td>

                          <td className="p-3.5 text-center font-mono text-slate-400">
                            {stk.quantityReserved}
                          </td>

                          <td className="p-3.5 text-center font-mono text-sky-400">
                            {stk.quantityInTransit > 0 ? `+${stk.quantityInTransit}` : '-'}
                          </td>

                          <td className="p-3.5 text-right font-mono">
                            <div className="font-bold text-white">${stk.totalValueUSD.toLocaleString()}</div>
                            <div className="text-[10px] text-slate-500">${stk.unitPriceUSD} / u</div>
                          </td>

                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setInspectingStockItem(stk)}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-700 hover:border-indigo-500 rounded-lg text-[11px] font-mono font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 mx-auto transition"
                            >
                              <Barcode className="w-3.5 h-3.5 text-indigo-400" />
                              <span>{stk.serialNumbers.length} S/N</span>
                            </button>
                          </td>

                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              stk.status === 'normal'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : stk.status === 'alerte_basse'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                              {stk.status.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="p-3.5 text-right space-x-1">
                            <button
                              onClick={() => setInspectingStockItem(stk)}
                              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                              title="Inspecter le stock & numéros de série"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. SOUS-ONGLET : MOUVEMENTS DE STOCK & TRANSFERTS INTER-HUBS */}
      {subTab === 'movements' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Registre des Mouvements & Transferts Inter-Hubs</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Traçabilité immuable des flux logistiques : Entrées, Sorties chantiers et Transferts entre provinces.
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {filteredMovements.length} mouvement(s) enregistré(s)
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {filteredMovements.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Aucun mouvement de stock enregistré pour ce hub.
                </div>
              ) : (
                filteredMovements.map((mvt) => {
                  const isPending = mvt.status === 'en_attente_visa';
                  const isTransit = mvt.status === 'en_transit';

                  return (
                    <div key={mvt.id} className="p-4 hover:bg-slate-800/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                            mvt.type === 'entree_fournisseur'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : mvt.type === 'sortie_deploiement'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}>
                            {mvt.type === 'entree_fournisseur' ? 'Entrée Stock (BES)' : mvt.type === 'sortie_deploiement' ? 'Sortie Chantier (BSS)' : 'Transfert Inter-Hub (OTIH)'}
                          </span>
                          <span className="font-bold text-white text-xs">{mvt.movementNumber}</span>
                          <span className="text-[11px] text-slate-500 font-mono">Réf: {mvt.referenceDocumentNumber}</span>
                          <span className="text-[11px] text-slate-400 font-mono">• {mvt.date}</span>
                        </div>

                        {/* Trajet du mouvement */}
                        <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                          {mvt.type === 'transfert_inter_hub' ? (
                            <span className="flex items-center gap-1.5 text-sky-300 font-medium">
                              <MapPin className="w-3.5 h-3.5" /> De <strong>{mvt.sourceHubName}</strong>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                              Vers <strong>{mvt.destinationHubName}</strong>
                            </span>
                          ) : mvt.type === 'sortie_deploiement' ? (
                            <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                              <Building2 className="w-3.5 h-3.5" /> Site Client : <strong>{mvt.destinationClientSite}</strong> (Depuis {mvt.sourceHubName})
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                              <Warehouse className="w-3.5 h-3.5" /> Destination : <strong>{mvt.destinationHubName}</strong>
                            </span>
                          )}
                        </div>

                        {/* Éléments déplacés */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {mvt.items.map((it, idx) => (
                            <div key={idx} className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
                              <span><strong>{it.quantity}x</strong> {it.name}</span>
                              <span className="font-mono text-[10px] text-indigo-400 font-semibold">({it.sku})</span>
                              {it.serialNumbers.length > 0 && (
                                <span className="bg-slate-900 px-1 rounded text-[9px] font-mono text-slate-400">
                                  {it.serialNumbers.length} S/N
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="text-[11px] text-slate-400 italic">
                          "{mvt.notes}" — Opérateur : {mvt.operatorName}
                        </div>
                      </div>

                      {/* Statut & Actions */}
                      <div className="flex flex-col md:items-end gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            mvt.status === 'valide'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : mvt.status === 'en_transit'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : mvt.status === 'receptionne'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {mvt.status.replace('_', ' ')}
                          </span>
                          <span className="font-mono text-xs font-bold text-white">
                            ${mvt.totalValueUSD.toLocaleString()} USD
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Bouton pour approuver le visa */}
                          {isPending && (currentUser.role === 'dg' || canAddHub) && (
                            <button
                              onClick={() => {
                                onApproveMovement(mvt.id);
                                if (onLogAction) onLogAction('Visa Mouvement Stock', `Approbation du mouvement ${mvt.movementNumber}`, 'document');
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Viser & Valider</span>
                            </button>
                          )}

                          {/* Bouton pour accuser réception d'un transfert */}
                          {isTransit && (
                            <button
                              onClick={() => {
                                onReceiveTransfer(mvt.id);
                                if (onLogAction) onLogAction('Réception Transfert Inter-Hub', `Réception confirmée du transfert ${mvt.movementNumber}`, 'document');
                              }}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow transition"
                            >
                              <Warehouse className="w-3.5 h-3.5" />
                              <span>Confirmer Réception Hub</span>
                            </button>
                          )}

                          {/* Imprimer le bon officiel */}
                          <button
                            onClick={() => {
                              const type = mvt.type === 'entree_fournisseur' ? 'bes' : mvt.type === 'sortie_deploiement' ? 'bss' : 'otih';
                              onPrintDocument(mvt, type);
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                            title="Générer le bordereau officiel certifié (PDF / Impression)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimer Bon</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. SOUS-ONGLET : BONS & WORKFLOWS D'APPROBATION OFFICIELS */}
      {subTab === 'documents' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span>Documents & Circuits d'Approbation du Hub</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Conformément aux normes RHEMA BUSINESS et à l'arrêté ministériel RDC sur les télécoms, tout flux de matériel est régi par un document normé et scellé par signature électronique.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Bon d'Entrée en Stock (BES)
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                    BES-2026
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Consigne formelle de réception après vérification technique des numéros de série (S/N) et inspection physique.
                </p>
                <button
                  onClick={() => openMovementModal('entree_fournisseur')}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg border border-slate-700 transition"
                >
                  + Émettre un BES
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Bon de Sortie & Mise en Service (BSS)
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                    BSS-2026
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Décharge et affectation définitive ou temporaire pour un site minier, bancaire ou télécom.
                </p>
                <button
                  onClick={() => openMovementModal('sortie_deploiement')}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg border border-slate-700 transition"
                >
                  + Émettre un BSS
                </button>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-sky-400 flex items-center gap-1.5">
                    <ArrowLeftRight className="w-4 h-4" /> Ordre de Transfert Inter-Hubs (OTIH)
                  </span>
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-mono">
                    OTIH-2026
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Régulation de stock inter-provinces avec lettre de voiture fluviale/routière et suivi des quantités en transit.
                </p>
                <button
                  onClick={() => openMovementModal('transfert_inter_hub')}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg border border-slate-700 transition"
                >
                  + Émettre un OTIH
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1 : AJOUTER UN NOUVEAU HUB PROVINCIAL (RÉSERVÉ DG & RESPONSABLES) */}
      {/* ========================================================================= */}
      {showAddHubModal && (
        <AddHubModal
          hubs={hubs}
          onClose={() => setShowAddHubModal(false)}
          onSave={(newHub) => {
            onAddHub(newHub);
            setShowAddHubModal(false);
            setSelectedHubId(newHub.id);
            if (onLogAction) {
              onLogAction('Création Hub Provincial', `Nouveau Hub créé : ${newHub.name} (${newHub.province})`, 'admin');
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2 : NOUVEAU MOUVEMENT DE STOCK (BES, BSS, OTIH) */}
      {/* ========================================================================= */}
      {showNewMovementModal && (
        <NewStockMovementModal
          initialType={movementInitialType}
          currentHubId={selectedHubId === 'all' ? hubs[0]?.id : selectedHubId}
          hubs={hubs}
          stocks={stocks}
          catalog={catalog}
          currentUser={currentUser}
          onClose={() => setShowNewMovementModal(false)}
          onSave={(mvt) => {
            onAddMovement(mvt);
            setShowNewMovementModal(false);
            if (onLogAction) {
              onLogAction('Mouvement de Stock Hub', `Enregistrement du ${mvt.movementNumber} (${mvt.type})`, 'document');
            }
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3 : INSPECTION DES NUMÉROS DE SÉRIE (S/N) DU STOCK */}
      {/* ========================================================================= */}
      {inspectingStockItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{inspectingStockItem.name}</h3>
                  <div className="text-xs text-indigo-300 font-mono">{inspectingStockItem.sku}</div>
                </div>
              </div>
              <button onClick={() => setInspectingStockItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Hub Localisé :</span>
                <span className="font-bold text-white">
                  {hubs.find(h => h.id === inspectingStockItem.hubId)?.name || inspectingStockItem.hubId}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Emplacement / Rack :</span>
                <span className="font-bold text-white">{inspectingStockItem.locationRack}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Disponibles en rayon :</span>
                <span className="font-mono font-bold text-emerald-400">{inspectingStockItem.quantityAvailable} unités</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  Relevé des Numéros de Série (S/N) vérifiés ({inspectingStockItem.serialNumbers.length}) :
                </label>
                <span className="text-[10px] text-slate-500">Traçabilité conforme DGDA</span>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {inspectingStockItem.serialNumbers.length === 0 ? (
                  <div className="p-4 bg-slate-950 rounded-xl text-center text-slate-500 text-xs">
                    Aucun numéro de série scanné pour cet article (en rupture ou non étiqueté).
                  </div>
                ) : (
                  inspectingStockItem.serialNumbers.map((sn, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs font-mono">
                      <span className="text-emerald-400 font-bold">{sn}</span>
                      <button
                        onClick={() => handleCopySN(sn)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 transition"
                      >
                        {copiedSN === sn ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSN === sn ? 'Copié' : 'Copier'}</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setInspectingStockItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
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

// =========================================================================
// SOUS-COMPOSANT : MODAL AJOUT D'UN NOUVEAU HUB
// =========================================================================
interface AddHubModalProps {
  hubs: LogisticsHub[];
  onClose: () => void;
  onSave: (hub: LogisticsHub) => void;
}

const AddHubModal: React.FC<AddHubModalProps> = ({ hubs, onClose, onSave }) => {
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [address, setAddress] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerContact, setManagerContact] = useState('+243 ');
  const [managerEmail, setManagerEmail] = useState('');
  const [capacity, setCapacity] = useState<number>(400);
  const [zones, setZones] = useState('');
  const [securityLevel, setSecurityLevel] = useState<string>('Niveau 2 - Entrepôt Sécurisé');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !province.trim()) return;

    const code = `HUB-${province.substring(0, 3).toUpperCase()}-${city.substring(0, 3).toUpperCase()}`;
    const newHub: LogisticsHub = {
      id: `hub-${city.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`,
      code,
      name: `Hub ${province} (${city})`,
      province: province.trim(),
      city: city.trim(),
      address: address.trim() || `Entrepôt Logistique & Télécoms de ${city}`,
      managerName: managerName.trim() || 'Responsable Régional',
      managerContact: managerContact.trim(),
      managerEmail: managerEmail.trim() || `hub.${city.toLowerCase()}@rhemabusiness.com`,
      storageCapacityM3: capacity,
      currentOccupancyRate: 10,
      status: 'actif',
      coverageZones: zones.split(',').map(z => z.trim()).filter(Boolean),
      securityLevel,
      createdAt: new Date().toISOString().split('T')[0]
    };

    onSave(newHub);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Nouveau Hub Provincial RDC</h3>
              <p className="text-xs text-slate-400">Création et rattachement au réseau logistique de RHEMA BUSINESS</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Province *</label>
              <input
                type="text"
                required
                placeholder="Ex: Haut-Katanga, Lualaba..."
                value={province}
                onChange={e => setProvince(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Ville / Chef-lieu *</label>
              <input
                type="text"
                required
                placeholder="Ex: Lubumbashi, Kolwezi..."
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Adresse physique de l'entrepôt / Shelter</label>
            <input
              type="text"
              placeholder="Ex: Boulevard Msiri, Quartier Industriel..."
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Responsable du Hub *</label>
              <input
                type="text"
                required
                placeholder="Ex: Ing. Jean Mutombo"
                value={managerName}
                onChange={e => setManagerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Téléphone Contact</label>
              <input
                type="text"
                placeholder="+243 81 000 0000"
                value={managerContact}
                onChange={e => setManagerContact(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Capacité Volumique (m³)</label>
              <input
                type="number"
                min="50"
                max="5000"
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Niveau de Sécurité</label>
              <select
                value={securityLevel}
                onChange={e => setSecurityLevel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Niveau 1 - Shelter Blindé">Niveau 1 - Shelter Blindé</option>
                <option value="Niveau 2 - Entrepôt Sécurisé">Niveau 2 - Entrepôt Sécurisé</option>
                <option value="Niveau 3 - Hub Régional Sécurisé">Niveau 3 - Hub Régional Sécurisé</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Zones de Desserte (séparées par virgule)</label>
            <input
              type="text"
              placeholder="Ex: Lubumbashi, Likasi, Kipushi, Kasumbalesa"
              value={zones}
              onChange={e => setZones(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20"
            >
              Créer & Raccorder le Hub
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// SOUS-COMPOSANT : MODAL NOUVEAU MOUVEMENT DE STOCK (BES, BSS, OTIH)
// =========================================================================
interface NewStockMovementModalProps {
  initialType: StockMovementType;
  currentHubId: string;
  hubs: LogisticsHub[];
  stocks: HubStockItem[];
  catalog: LogisticsItem[];
  currentUser: User;
  onClose: () => void;
  onSave: (mvt: StockMovementItem) => void;
}

const NewStockMovementModal: React.FC<NewStockMovementModalProps> = ({
  initialType,
  currentHubId,
  hubs,
  stocks,
  catalog,
  currentUser,
  onClose,
  onSave
}) => {
  const [type, setType] = useState<StockMovementType>(initialType);
  const [sourceHubId, setSourceHubId] = useState<string>(currentHubId);
  const [destinationHubId, setDestinationHubId] = useState<string>(
    hubs.find(h => h.id !== currentHubId)?.id || hubs[0]?.id || ''
  );
  const [destinationClientSite, setDestinationClientSite] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(catalog[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(1);
  const [serialNumbersText, setSerialNumbersText] = useState<string>('');
  const [refDoc, setRefDoc] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const selectedCatalogItem = catalog.find(c => c.id === selectedCatalogId) || catalog[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalogItem) return;

    const sourceHub = hubs.find(h => h.id === sourceHubId);
    const destHub = hubs.find(h => h.id === destinationHubId);

    const prefix = type === 'entree_fournisseur' ? 'BES' : type === 'sortie_deploiement' ? 'BSS' : 'OTIH';
    const movementNumber = `${prefix}-2026-${Date.now().toString(36).toUpperCase()}`;

    // S/N scannés ou saisis manuellement
    const parsedSN = serialNumbersText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    // Si pas de S/N saisis, en auto-générer pour la traçabilité
    const finalSN = parsedSN.length > 0 
      ? parsedSN 
      : Array.from({ length: quantity }, (_, i) => `SN-${selectedCatalogItem.sku.slice(0, 6)}-${Date.now().toString(36).toUpperCase()}-${i + 1}`);

    const newMvt: StockMovementItem = {
      id: `mvt-${Date.now()}`,
      movementNumber,
      type,
      sourceHubId: type === 'entree_fournisseur' ? undefined : sourceHubId,
      sourceHubName: type === 'entree_fournisseur' ? undefined : sourceHub?.name,
      destinationHubId: type === 'sortie_deploiement' ? undefined : (type === 'transfert_inter_hub' ? destinationHubId : sourceHubId),
      destinationHubName: type === 'sortie_deploiement' ? undefined : (type === 'transfert_inter_hub' ? destHub?.name : sourceHub?.name),
      destinationClientSite: type === 'sortie_deploiement' ? (destinationClientSite || 'Site Client RDC') : undefined,
      items: [
        {
          catalogItemId: selectedCatalogItem.id,
          sku: selectedCatalogItem.sku,
          name: selectedCatalogItem.name,
          quantity,
          unitPriceUSD: selectedCatalogItem.unitPriceUSD,
          serialNumbers: finalSN
        }
      ],
      totalValueUSD: quantity * selectedCatalogItem.unitPriceUSD,
      referenceDocumentNumber: refDoc.trim() || `${prefix}-REF-${Date.now().toString(36).toUpperCase()}`,
      operatorId: currentUser.id,
      operatorName: currentUser.name,
      operatorRole: currentUser.role,
      date: new Date().toISOString().split('T')[0],
      status: type === 'transfert_inter_hub' ? 'en_transit' : 'valide',
      approvedByManagerName: currentUser.name,
      approvedAt: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString().slice(0, 5)}`,
      electronicSealHash: `sha256-${movementNumber.toLowerCase()}-${Date.now()}-conforme`,
      notes: notes.trim() || 'Mouvement logistique conforme avec relevé S/N scellé.'
    };

    onSave(newMvt);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${
              type === 'entree_fournisseur' ? 'bg-emerald-500/20 text-emerald-400' : type === 'sortie_deploiement' ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'
            }`}>
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Nouveau Mouvement de Stock</h3>
              <p className="text-xs text-slate-400">Émission d'un Bon de Mouvement avec relevé des Numéros de Série</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Sélecteur du Type de Mouvement */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Type d'Opération *</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType('entree_fournisseur')}
                className={`py-2 px-2.5 rounded-xl border text-center font-bold transition ${
                  type === 'entree_fournisseur'
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                1. Entrée Stock (BES)
              </button>
              <button
                type="button"
                onClick={() => setType('sortie_deploiement')}
                className={`py-2 px-2.5 rounded-xl border text-center font-bold transition ${
                  type === 'sortie_deploiement'
                    ? 'bg-amber-600 text-white border-amber-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                2. Sortie Chantier (BSS)
              </button>
              <button
                type="button"
                onClick={() => setType('transfert_inter_hub')}
                className={`py-2 px-2.5 rounded-xl border text-center font-bold transition ${
                  type === 'transfert_inter_hub'
                    ? 'bg-sky-600 text-white border-sky-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                3. Transfert Inter-Hubs
              </button>
            </div>
          </div>

          {/* Hub Source et Hub Destination */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                {type === 'entree_fournisseur' ? 'Hub Récepteur *' : 'Hub Source / Émetteur *'}
              </label>
              <select
                value={sourceHubId}
                onChange={e => setSourceHubId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                {hubs.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>

            <div>
              {type === 'transfert_inter_hub' ? (
                <>
                  <label className="text-slate-300 font-semibold block mb-1">Hub Destination *</label>
                  <select
                    value={destinationHubId}
                    onChange={e => setDestinationHubId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {hubs.filter(h => h.id !== sourceHubId).map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </>
              ) : type === 'sortie_deploiement' ? (
                <>
                  <label className="text-slate-300 font-semibold block mb-1">Site Client / Projet Minier *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Site Minier Kolwezi, Agence Rawbank Gbadolite..."
                    value={destinationClientSite}
                    onChange={e => setDestinationClientSite(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </>
              ) : (
                <>
                  <label className="text-slate-300 font-semibold block mb-1">N° Document Réf (BL / Facture)</label>
                  <input
                    type="text"
                    placeholder="Ex: BL-VSAT-2026-001"
                    value={refDoc}
                    onChange={e => setRefDoc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </>
              )}
            </div>
          </div>

          {/* Sélection article et Quantité */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-slate-300 font-semibold block mb-1">Article du Catalogue *</label>
              <select
                value={selectedCatalogId}
                onChange={e => setSelectedCatalogId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              >
                {catalog.map(c => (
                  <option key={c.id} value={c.id}>
                    [{c.category.toUpperCase()}] {c.name} (${c.unitPriceUSD})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Quantité *</label>
              <input
                type="number"
                min="1"
                max="500"
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Numéros de série S/N */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-300 font-semibold block">
                Numéros de Série (S/N) — 1 par ligne (Optionnel, auto-générés si vide)
              </label>
              <span className="text-[10px] text-indigo-400 font-mono">Quantité attendue : {quantity}</span>
            </div>
            <textarea
              rows={3}
              placeholder={`SN-${selectedCatalogItem.sku}-001\nSN-${selectedCatalogItem.sku}-002`}
              value={serialNumbersText}
              onChange={e => setSerialNumbersText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Observations */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Motif / Convoi / Modalités de transport</label>
            <input
              type="text"
              placeholder="Ex: Transit par barge fluviale fleuve Congo, escale Mbandaka..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Boutons validation */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl font-bold text-white shadow-lg transition ${
                type === 'entree_fournisseur' ? 'bg-emerald-600 hover:bg-emerald-500' : type === 'sortie_deploiement' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-sky-600 hover:bg-sky-500'
              }`}
            >
              Émettre & Enregistrer le Mouvement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
