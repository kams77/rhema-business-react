// src/components/logistics/HubsStockChartDashboard.tsx
import React, { useState, useMemo } from 'react';
import type { 
  LogisticsHub, 
  HubStockItem, 
  LogisticsItem, 
  User,
  StockMovementItem 
} from '../../types';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  Line, 
  ComposedChart
} from 'recharts';
import { 
  AlertTriangle, 
  Warehouse, 
  Package, 
  Boxes, 
  CheckCircle2, 
  ArrowLeftRight, 
  Radio, 
  Sun, 
  Filter, 
  ShieldAlert, 
  Activity, 
  Eye, 
  Building2, 
  MapPin, 
  DollarSign, 
  Plus, 
  ArrowUpRight, 
  TrendingDown, 
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface HubsStockChartDashboardProps {
  currentUser?: User;
  hubs: LogisticsHub[];
  stocks: HubStockItem[];
  catalog?: LogisticsItem[];
  movements?: StockMovementItem[];
  onSelectHub?: (hubId: string) => void;
  onRequestTransfer?: (stock: HubStockItem) => void;
  onRequestOrder?: (stock: HubStockItem) => void;
}

export const HubsStockChartDashboard: React.FC<HubsStockChartDashboardProps> = ({
  currentUser,
  hubs,
  stocks,
  catalog = [],
  movements = [],
  onSelectHub,
  onRequestTransfer,
  onRequestOrder
}) => {
  // Filtre de Hub actif
  const [selectedHubId, setSelectedHubId] = useState<string>('all');
  // Type de métrique pour le graphique principal
  const [displayMetric, setDisplayMetric] = useState<'units' | 'valueUSD'>('units');
  // Filtre d'alerte dans la liste d'alertes
  const [alertFilter, setAlertFilter] = useState<'all' | 'rupture_only' | 'low_only'>('all');
  // Filtre catégorie
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'vsat' | 'solaire'>('all');

  // 1. KPI Globaux en temps réel
  const metrics = useMemo(() => {
    const relevantStocks = selectedHubId === 'all' 
      ? stocks 
      : stocks.filter(s => s.hubId === selectedHubId);

    const totalAvailable = relevantStocks.reduce((sum, s) => sum + s.quantityAvailable, 0);
    const totalReserved = relevantStocks.reduce((sum, s) => sum + s.quantityReserved, 0);
    const totalInTransit = relevantStocks.reduce((sum, s) => sum + s.quantityInTransit, 0);
    const totalValueUSD = relevantStocks.reduce((sum, s) => sum + s.totalValueUSD, 0);

    const ruptureItems = relevantStocks.filter(s => s.quantityAvailable === 0 || s.status === 'rupture');
    const lowStockItems = relevantStocks.filter(s => s.quantityAvailable > 0 && s.quantityAvailable <= s.minAlertThreshold);
    const healthyItems = relevantStocks.filter(s => s.quantityAvailable > s.minAlertThreshold);

    return {
      totalAvailable,
      totalReserved,
      totalInTransit,
      totalValueUSD,
      ruptureCount: ruptureItems.length,
      lowStockCount: lowStockItems.length,
      totalAlerts: ruptureItems.length + lowStockItems.length,
      healthyCount: healthyItems.length,
      activeHubsCount: hubs.filter(h => h.status === 'actif').length
    };
  }, [stocks, hubs, selectedHubId]);

  // 2. Données comparatives par Hub provincial (pour Recharts BarChart)
  const hubComparisonData = useMemo(() => {
    return hubs.map(hub => {
      let hubStocks = stocks.filter(s => s.hubId === hub.id);
      if (categoryFilter !== 'all') {
        hubStocks = hubStocks.filter(s => s.category === categoryFilter);
      }

      const available = hubStocks.reduce((sum, s) => sum + s.quantityAvailable, 0);
      const reserved = hubStocks.reduce((sum, s) => sum + s.quantityReserved, 0);
      const inTransit = hubStocks.reduce((sum, s) => sum + s.quantityInTransit, 0);
      const threshold = hubStocks.reduce((sum, s) => sum + s.minAlertThreshold, 0);
      const valueUSD = hubStocks.reduce((sum, s) => sum + s.totalValueUSD, 0);

      const ruptures = hubStocks.filter(s => s.quantityAvailable === 0 || s.status === 'rupture').length;
      const lowStocks = hubStocks.filter(s => s.quantityAvailable > 0 && s.quantityAvailable <= s.minAlertThreshold).length;

      return {
        id: hub.id,
        hubCode: hub.code,
        name: hub.city, // Nom court affiché sur l'axe X
        fullName: hub.name,
        province: hub.province,
        available: displayMetric === 'units' ? available : valueUSD,
        reserved: displayMetric === 'units' ? reserved : Math.round(reserved * 1500),
        inTransit: displayMetric === 'units' ? inTransit : Math.round(inTransit * 1500),
        threshold: displayMetric === 'units' ? threshold : Math.round(threshold * 1200),
        rawAvailable: available,
        rawThreshold: threshold,
        valueUSD,
        occupancyRate: hub.currentOccupancyRate,
        ruptures,
        lowStocks,
        totalAlerts: ruptures + lowStocks,
        hasRupture: ruptures > 0,
        hasLowStock: lowStocks > 0
      };
    });
  }, [hubs, stocks, displayMetric, categoryFilter]);

  // 3. Liste détaillée des alertes de rupture en temps réel
  const realTimeAlerts = useMemo(() => {
    return stocks
      .filter(s => {
        if (selectedHubId !== 'all' && s.hubId !== selectedHubId) return false;
        if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;

        const isRupture = s.quantityAvailable === 0 || s.status === 'rupture';
        const isLow = s.quantityAvailable > 0 && s.quantityAvailable <= s.minAlertThreshold;

        if (alertFilter === 'rupture_only') return isRupture;
        if (alertFilter === 'low_only') return isLow;
        return isRupture || isLow;
      })
      .map(s => {
        const hub = hubs.find(h => h.id === s.hubId);
        const isRupture = s.quantityAvailable === 0 || s.status === 'rupture';
        const deficit = Math.max(0, s.minAlertThreshold - s.quantityAvailable);
        return {
          ...s,
          hubName: hub ? hub.name : s.hubId,
          hubCity: hub ? hub.city : 'RDC',
          hubProvince: hub ? hub.province : '',
          hubCode: hub ? hub.code : '',
          isRupture,
          deficit
        };
      })
      .sort((a, b) => {
        if (a.isRupture && !b.isRupture) return -1;
        if (!a.isRupture && b.isRupture) return 1;
        return a.quantityAvailable - b.quantityAvailable;
      });
  }, [stocks, hubs, selectedHubId, categoryFilter, alertFilter]);

  // 4. Données pour le graphique des équipements spécifiques
  const criticalItemsData = useMemo(() => {
    const relevant = (selectedHubId === 'all' 
      ? stocks 
      : stocks.filter(s => s.hubId === selectedHubId))
      .filter(s => categoryFilter === 'all' || s.category === categoryFilter)
      .slice(0, 8); // Top 8 items les plus représentatifs

    return relevant.map(item => {
      const hub = hubs.find(h => h.id === item.hubId);
      const isRupture = item.quantityAvailable === 0 || item.status === 'rupture';
      const isLow = item.quantityAvailable > 0 && item.quantityAvailable <= item.minAlertThreshold;

      return {
        sku: item.sku,
        shortName: item.name.length > 20 ? item.name.slice(0, 18) + '…' : item.name,
        fullName: item.name,
        hubCity: hub?.city || '',
        available: item.quantityAvailable,
        threshold: item.minAlertThreshold,
        reserved: item.quantityReserved,
        isRupture,
        isLow,
        statusColor: isRupture ? '#EF4444' : isLow ? '#F59E0B' : '#10B981'
      };
    });
  }, [stocks, selectedHubId, hubs, categoryFilter]);

  // 5. Répartition Statut Santé (PieChart)
  const healthPieData = useMemo(() => {
    const relevantStocks = selectedHubId === 'all' 
      ? stocks 
      : stocks.filter(s => s.hubId === selectedHubId);

    const ruptures = relevantStocks.filter(s => s.quantityAvailable === 0 || s.status === 'rupture').length;
    const lows = relevantStocks.filter(s => s.quantityAvailable > 0 && s.quantityAvailable <= s.minAlertThreshold).length;
    const normals = relevantStocks.filter(s => s.quantityAvailable > s.minAlertThreshold).length;

    return [
      { name: 'Stock Conforme / Optimal', value: normals, color: '#10B981' },
      { name: 'Alerte Seuil Bas', value: lows, color: '#F59E0B' },
      { name: 'Rupture Immédiate (0 unité)', value: ruptures, color: '#EF4444' }
    ].filter(item => item.value > 0);
  }, [stocks, selectedHubId]);

  // 6. Répartition par Catégorie (PieChart)
  const categoryPieData = useMemo(() => {
    const relevantStocks = selectedHubId === 'all' 
      ? stocks 
      : stocks.filter(s => s.hubId === selectedHubId);

    const vsatQty = relevantStocks.filter(s => s.category === 'vsat').reduce((sum, s) => sum + s.quantityAvailable, 0);
    const solarQty = relevantStocks.filter(s => s.category === 'solaire').reduce((sum, s) => sum + s.quantityAvailable, 0);

    return [
      { name: 'Équipements VSAT Télécoms', value: vsatQty, color: '#0EA5E9' },
      { name: 'Énergie Solaire & Batteries', value: solarQty, color: '#F59E0B' }
    ].filter(item => item.value > 0);
  }, [stocks, selectedHubId]);

  return (
    <div className="space-y-6">
      {/* EN-TÊTE DU TABLEAU DE BORD GRAPHIQUE */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow discret */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Activity className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">
                Tableau de Bord Graphique des Stocks & Alertes Multi-Hubs
              </h2>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                TEMPS RÉEL ACTIF
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 max-w-2xl leading-relaxed">
              Supervision visuelle de la disponibilité du matériel VSAT et Solaire dans les 6 provinces de la RDC. Détection instantanée des ruptures et des passages sous seuil de réapprovisionnement.
            </p>
          </div>

          {/* SÉLECTEUR RAPIDE DE HUB & CATÉGORIE */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-900/90 p-2 rounded-2xl border border-slate-800 shrink-0">
            {/* Filtre Hub */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 rounded-xl text-xs text-slate-300">
              <Warehouse className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={selectedHubId}
                onChange={(e) => {
                  setSelectedHubId(e.target.value);
                  if (onSelectHub) onSelectHub(e.target.value);
                }}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-2"
              >
                <option value="all" className="bg-slate-900 text-white">🌐 Tous les Hubs (Consolidé RDC)</option>
                {hubs.map(h => (
                  <option key={h.id} value={h.id} className="bg-slate-900 text-white">
                    📍 {h.city} ({h.province})
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre Catégorie */}
            <div className="flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl text-xs">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  categoryFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tout
              </button>
              <button
                onClick={() => setCategoryFilter('vsat')}
                className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                  categoryFilter === 'vsat'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3" /> VSAT
              </button>
              <button
                onClick={() => setCategoryFilter('solaire')}
                className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                  categoryFilter === 'solaire'
                    ? 'bg-amber-400 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3 h-3" /> Solaire
              </button>
            </div>
          </div>
        </div>

        {/* CARTES KPI SYNTHÉTIQUES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider truncate">
                Disponibles en Stock
              </div>
              <div className="text-lg font-black text-white flex items-baseline gap-1.5">
                <span>{metrics.totalAvailable.toLocaleString()}</span>
                <span className="text-[11px] text-slate-400 font-normal">unités</span>
              </div>
              <div className="text-[10px] text-emerald-400/90 font-mono font-medium truncate">
                ${metrics.totalValueUSD.toLocaleString()} USD
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-rose-500/30 flex items-center gap-3 relative overflow-hidden">
            {metrics.ruptureCount > 0 && (
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
            <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-rose-300 uppercase font-bold tracking-wider truncate">
                Ruptures Immédiates
              </div>
              <div className="text-lg font-black text-rose-400 flex items-baseline gap-1.5">
                <span>{metrics.ruptureCount}</span>
                <span className="text-[11px] text-slate-400 font-normal">articles (0 unité)</span>
              </div>
              <div className="text-[10px] text-rose-300/80 truncate">
                Action réappro requise
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-amber-500/30 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-amber-300 uppercase font-bold tracking-wider truncate">
                Sous Seuil d'Alerte
              </div>
              <div className="text-lg font-black text-amber-400 flex items-baseline gap-1.5">
                <span>{metrics.lowStockCount}</span>
                <span className="text-[11px] text-slate-400 font-normal">articles bas</span>
              </div>
              <div className="text-[10px] text-amber-300/80 truncate">
                À surveiller étroitement
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider truncate">
                Réservés & Transit
              </div>
              <div className="text-lg font-black text-sky-400 flex items-baseline gap-1.5">
                <span>{metrics.totalReserved + metrics.totalInTransit}</span>
                <span className="text-[11px] text-slate-400 font-normal">en mouvement</span>
              </div>
              <div className="text-[10px] text-sky-300/80 truncate">
                {metrics.totalInTransit} en transit fret
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BANDEAU VISUEL D'ALERTES DE RUPTURE EN TEMPS RÉEL (IDENTIFICATION IMMÉDIATE) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${
              metrics.totalAlerts > 0 ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  Alertes de Rupture & Seuils Critiques en Direct
                </h3>
                {metrics.totalAlerts > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-mono font-black animate-pulse">
                    {metrics.totalAlerts} ALERTE{metrics.totalAlerts > 1 ? 'S' : ''} CRITIQUE{metrics.totalAlerts > 1 ? 'S' : ''}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-bold">
                    AUCUNE RUPTURE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Identification automatique dès qu'un équipement franchit le seuil minimal de réapprovisionnement.
              </p>
            </div>
          </div>

          {/* Filtres de niveau d'urgence */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setAlertFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                alertFilter === 'all'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Toutes ({metrics.totalAlerts})
            </button>
            <button
              onClick={() => setAlertFilter('rupture_only')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 ${
                alertFilter === 'rupture_only'
                  ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50 font-bold'
                  : 'text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Ruptures Seules ({metrics.ruptureCount})
            </button>
            <button
              onClick={() => setAlertFilter('low_only')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 ${
                alertFilter === 'low_only'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold'
                  : 'text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Seuils Bas ({metrics.lowStockCount})
            </button>
          </div>
        </div>

        {/* LISTE VISUELLE DES ALERTES */}
        {realTimeAlerts.length === 0 ? (
          <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-emerald-300">
              Situation Optimale : Aucun stock en rupture sur le périmètre sélectionné
            </div>
            <p className="text-xs text-emerald-400/80 max-w-md mx-auto">
              Tous les équipements disposent d'un volume supérieur aux seuils de sécurité provinciaux.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {realTimeAlerts.map(alert => (
              <div 
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                  alert.isRupture 
                    ? 'bg-rose-950/25 border-rose-500/40 hover:border-rose-500 shadow-md shadow-rose-950/30' 
                    : 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500 shadow-md shadow-amber-950/20'
                }`}
              >
                {/* Liseré supérieur coloré */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${
                  alert.isRupture ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                }`} />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      {alert.hubCity} ({alert.hubProvince})
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black border ${
                      alert.isRupture 
                        ? 'bg-rose-500/30 text-rose-300 border-rose-500/60 animate-pulse'
                        : 'bg-amber-500/30 text-amber-300 border-amber-500/60'
                    }`}>
                      {alert.isRupture ? '🔴 RUPTURE IMMÉDIATE' : '⚠️ SEUIL D\'ALERTE'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white line-clamp-1" title={alert.name}>
                    {alert.name}
                  </h4>
                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{alert.sku}</span>
                    <span>•</span>
                    <span className="capitalize text-slate-300">{alert.category}</span>
                  </div>

                  {/* Jauge Visuelle de Stock Disponible vs Seuil Minimum */}
                  <div className="mt-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Stock Disponible :</span>
                      <span className={`font-mono font-bold ${alert.isRupture ? 'text-rose-400' : 'text-amber-400'}`}>
                        {alert.quantityAvailable} unité{alert.quantityAvailable > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Seuil Minimal de Sécurité :</span>
                      <span className="font-mono text-slate-300 font-bold">
                        {alert.minAlertThreshold} unités
                      </span>
                    </div>

                    {/* Barre de progression visuelle */}
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-1">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          alert.isRupture ? 'bg-rose-500 w-0' : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((alert.quantityAvailable / Math.max(1, alert.minAlertThreshold)) * 100))}%`
                        }}
                      />
                    </div>

                    <div className="text-[10px] text-slate-500 text-right font-mono">
                      Déficit : <span className="text-rose-400 font-bold">-{alert.deficit} unité{alert.deficit > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>

                {/* Actions contextuelles rapides */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="text-[10px] text-slate-400 truncate">
                    Rack : <span className="text-slate-300 font-mono">{alert.locationRack || 'Zone standard'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onRequestTransfer && (
                      <button
                        onClick={() => onRequestTransfer(alert)}
                        className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold flex items-center gap-1 transition"
                        title="Initier un transfert depuis un autre Hub"
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        Transfert
                      </button>
                    )}
                    {onRequestOrder && (
                      <button
                        onClick={() => onRequestOrder(alert)}
                        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition"
                        title="Émettre un bon de commande pour réapprovisionnement"
                      >
                        <Plus className="w-3 h-3" />
                        Réappro
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION GRAPHIQUE PRINCIPALE : RECHARTS COMPARATIF PAR HUB */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRAPHIQUE 1 : NIVEAUX DE STOCK PAR HUB PROVINCIAL (BARCHART / COMPOSED) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Comparatif des Niveaux de Stock par Hub Provincial (RDC)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Volumes disponibles vs Seuil d'Alerte minimal pour chacun des Hubs provinciaux
              </p>
            </div>

            {/* Commutateur de Métrique (Quantités vs Valeur USD) */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shrink-0">
              <button
                onClick={() => setDisplayMetric('units')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  displayMetric === 'units'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Quantité (Unités)
              </button>
              <button
                onClick={() => setDisplayMetric('valueUSD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  displayMetric === 'valueUSD'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Valeur ($ USD)
              </button>
            </div>
          </div>

          {/* ZONE DE RENDU RECHARTS */}
          <div className="h-80 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hubComparisonData}
                margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d6dde5" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#94a3b8' }} 
                  axisLine={{ stroke: '#b3bec9' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#94a3b8' }} 
                  axisLine={{ stroke: '#b3bec9' }}
                  tickLine={false}
                  unit={displayMetric === 'units' ? '' : '$'}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const label = name === 'available' ? 'Stock Disponible' : 
                                  name === 'reserved' ? 'Stock Réservé' : 
                                  name === 'threshold' ? 'Seuil Alerte Sécurité' : name;
                    const formatted = displayMetric === 'units' 
                      ? `${value} unités` 
                      : `$${Number(value).toLocaleString()} USD`;
                    return [formatted, label];
                  }}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload;
                    return item ? `Hub ${item.fullName} (${item.province})` : label;
                  }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '16px',
                    color: '#fff',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                />
                <Legend 
                  verticalAlign="top"
                  height={36}
                  formatter={(val) => {
                    const label = val === 'available' ? 'Stock Disponible' : 
                                  val === 'reserved' ? 'Stock Réservé' : 
                                  val === 'threshold' ? 'Seuil Minimal de Sécurité' : val;
                    return <span className="text-xs text-slate-300 font-medium">{label}</span>;
                  }}
                />

                {/* Barres Recharts */}
                <Bar 
                  dataKey="available" 
                  name="available" 
                  fill="#10B981" 
                  radius={[6, 6, 0, 0]} 
                />
                <Bar 
                  dataKey="reserved" 
                  name="reserved" 
                  fill="#6366F1" 
                  radius={[6, 6, 0, 0]} 
                />
                <Bar 
                  dataKey="threshold" 
                  name="threshold" 
                  fill="#F59E0B" 
                  radius={[6, 6, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Vert : Stock disponible</span>
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block ml-2" />
              <span>Bleu : Réservé / Projets</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block ml-2" />
              <span>Jaune : Seuil d'alerte</span>
            </div>
            <div className="font-mono text-slate-400">
              6 Provinces interconnectées : Gbadolite, Gemena, Boende, Tshikapa, Kisangani, Mbandaka
            </div>
          </div>
        </div>

        {/* GRAPHIQUE 2 : SANTÉ DU STOCK & RÉPARTITION CATÉGORIELLE */}
        <div className="space-y-6">
          {/* SANTÉ GLOBALE DES STOCKS (DONUT CHART) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white">
                  Santé Opérationnelle des Stocks
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {selectedHubId === 'all' ? 'National RDC' : 'Hub Sélectionné'}
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {healthPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value} références`, name]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Légende détaillée */}
            <div className="space-y-1.5 text-xs pt-1 border-t border-slate-800/80">
              {healthPieData.map(item => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-white">{item.value} ref.</span>
                </div>
              ))}
            </div>
          </div>

          {/* RÉPARTITION PAR CATÉGORIE (VSAT VS SOLAIRE) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400">
                  <Radio className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white">
                  Répartition VSAT vs Énergie Solaire
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Unités en stock
              </span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-cat-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => [`${value} unités`, name]}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 text-xs pt-1 border-t border-slate-800/80">
              {categoryPieData.map(item => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-white">{item.value} unités</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* GRAPHIQUE 3 : ÉQUIPEMENTS DU HUB FACE AUX SEUILS D'ALERTE (HORIZONTAL BARCHART) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                <Boxes className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">
                Niveaux Critiques par Référence Matériel ({selectedHubId === 'all' ? 'Toutes Provinces' : hubs.find(h => h.id === selectedHubId)?.city})
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparaison unitaire immédiate : Stock Disponible vs Seuil Minimum de Rupture
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={criticalItemsData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#d6dde5" />
              <XAxis 
                type="number" 
                tick={{ fontSize: 11, fill: '#94a3b8' }} 
                axisLine={{ stroke: '#b3bec9' }}
                tickLine={false}
              />
              <YAxis 
                type="category" 
                dataKey="shortName" 
                tick={{ fontSize: 11, fill: '#cbd5e1' }} 
                axisLine={{ stroke: '#b3bec9' }}
                tickLine={false}
                width={140}
              />
              <Tooltip
                formatter={(value: any, name: any) => {
                  const label = name === 'available' ? 'Stock Disponible' : 'Seuil d\'Alerte Minimum';
                  return [`${value} unités`, label];
                }}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${item.fullName} (${item.sku}) - Hub: ${item.hubCity}` : label;
                }}
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '16px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Legend 
                verticalAlign="top"
                height={30}
                formatter={(val) => {
                  const label = val === 'available' ? 'Quantité Disponible' : 'Seuil Minimal de Sécurité';
                  return <span className="text-xs text-slate-300 font-medium">{label}</span>;
                }}
              />
              <Bar 
                dataKey="available" 
                name="available" 
                fill="#0EA5E9" 
                radius={[0, 6, 6, 0]} 
              />
              <Bar 
                dataKey="threshold" 
                name="threshold" 
                fill="#EF4444" 
                radius={[0, 6, 6, 0]} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
