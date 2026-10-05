// src/components/DepartmentTasksProgressChart.tsx
import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Layers,
  Calendar,
  Filter,
  ArrowUpRight,
  Activity,
  Clock,
  Building2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCheck
} from 'lucide-react';
import type { TaskItem, HierarchicalEntity, User } from '../types';

interface DepartmentTasksProgressChartProps {
  tasks?: TaskItem[];
  entities?: HierarchicalEntity[];
  users?: User[];
  currentUser?: User;
  className?: string;
}

// Couleurs harmonisées avec la charte Rhema Business
const DEPT_COLORS = {
  operations: {
    stroke: '#0284c7', // Sky 600
    fill: '#38bdf8',   // Sky 400
    gradientStart: '#0ea5e9',
    gradientEnd: '#e0f2fe',
    name: 'Opérations & VSAT (DOP)',
    short: 'Opérations'
  },
  finance: {
    stroke: '#4f46e5', // Indigo 600
    fill: '#818cf8',   // Indigo 400
    gradientStart: '#6366f1',
    gradientEnd: '#e0e7ff',
    name: 'Admin. & Finances (DAF)',
    short: 'Finances'
  },
  rh: {
    stroke: '#059669', // Emerald 600
    fill: '#34d399',   // Emerald 400
    gradientStart: '#10b981',
    gradientEnd: '#d1fae5',
    name: 'Ressources Humaines (DRH)',
    short: 'RH'
  },
  dg: {
    stroke: '#7c3aed', // Purple 600
    fill: '#a78bfa',   // Purple 400
    gradientStart: '#8b5cf6',
    gradientEnd: '#ede9fe',
    name: 'Direction Générale (DG)',
    short: 'Gouvernance'
  }
};

// Données d'évolution sur les 30 derniers jours (du 6 Septembre au 5 Octobre 2026)
const THIRTY_DAYS_PROGRESSION = [
  {
    date: '06 Sep',
    fullDate: '06/09/2026',
    dayIndex: 1,
    operations: 4,
    finance: 3,
    rh: 2,
    dg: 2,
    total: 11,
    operationsPeriod: 4,
    financePeriod: 3,
    rhPeriod: 2,
    dgPeriod: 2,
    totalPeriod: 11,
    slaRate: 89.2
  },
  {
    date: '10 Sep',
    fullDate: '10/09/2026',
    dayIndex: 5,
    operations: 9,
    finance: 6,
    rh: 4,
    dg: 3,
    total: 22,
    operationsPeriod: 5,
    financePeriod: 3,
    rhPeriod: 2,
    dgPeriod: 1,
    totalPeriod: 11,
    slaRate: 91.0
  },
  {
    date: '15 Sep',
    fullDate: '15/09/2026',
    dayIndex: 10,
    operations: 14,
    finance: 9,
    rh: 6,
    dg: 5,
    total: 34,
    operationsPeriod: 5,
    financePeriod: 3,
    rhPeriod: 2,
    dgPeriod: 2,
    totalPeriod: 12,
    slaRate: 92.4
  },
  {
    date: '20 Sep',
    fullDate: '20/09/2026',
    dayIndex: 15,
    operations: 19,
    finance: 13,
    rh: 9,
    dg: 7,
    total: 48,
    operationsPeriod: 5,
    financePeriod: 4,
    rhPeriod: 3,
    dgPeriod: 2,
    totalPeriod: 14,
    slaRate: 93.8
  },
  {
    date: '25 Sep',
    fullDate: '25/09/2026',
    dayIndex: 20,
    operations: 24,
    finance: 17,
    rh: 11,
    dg: 8,
    total: 60,
    operationsPeriod: 5,
    financePeriod: 4,
    rhPeriod: 2,
    dgPeriod: 1,
    totalPeriod: 12,
    slaRate: 94.6
  },
  {
    date: '30 Sep',
    fullDate: '30/09/2026',
    dayIndex: 25,
    operations: 29,
    finance: 20,
    rh: 13,
    dg: 9,
    total: 71,
    operationsPeriod: 5,
    financePeriod: 3,
    rhPeriod: 2,
    dgPeriod: 1,
    totalPeriod: 11,
    slaRate: 95.5
  },
  {
    date: '03 Oct',
    fullDate: '03/10/2026',
    dayIndex: 28,
    operations: 33,
    finance: 22,
    rh: 15,
    dg: 10,
    total: 80,
    operationsPeriod: 4,
    financePeriod: 2,
    rhPeriod: 2,
    dgPeriod: 1,
    totalPeriod: 9,
    slaRate: 96.1
  },
  {
    date: '05 Oct',
    fullDate: '05/10/2026',
    dayIndex: 30,
    operations: 37,
    finance: 24,
    rh: 16,
    dg: 11,
    total: 88,
    operationsPeriod: 4,
    financePeriod: 2,
    rhPeriod: 1,
    dgPeriod: 1,
    totalPeriod: 8,
    slaRate: 96.8
  }
];

// Liste des tâches récemment finalisées sur les 30 jours
const RECENT_COMPLETED_TASKS = [
  {
    id: 'ct-1',
    title: 'Alignement Paraboles Ku-Band Station Minière Kolwezi',
    department: 'Opérations & VSAT (DOP)',
    deptKey: 'operations',
    date: '04 Octobre 2026',
    completedBy: 'Christian Kalala (Ingénieur VSAT)',
    daysToResolve: 2,
    conformity: '100% Validé'
  },
  {
    id: 'ct-2',
    title: 'Rapprochement Bancaire Mensuel Rawbank & EquityBCDC',
    department: 'Admin. & Finances (DAF)',
    deptKey: 'finance',
    date: '03 Octobre 2026',
    completedBy: 'Mme Sophie Traoré (DAF)',
    daysToResolve: 3,
    conformity: '100% Lettré'
  },
  {
    id: 'ct-3',
    title: 'Clôture Paie & Émargement Pointage 28 Jours Ouvrables',
    department: 'Ressources Humaines (DRH)',
    deptKey: 'rh',
    date: '01 Octobre 2026',
    completedBy: 'M. Jean-Paul Kouassi (DRH)',
    daysToResolve: 1,
    conformity: '100% Conforme'
  },
  {
    id: 'ct-4',
    title: 'Validation & Scellement Cryptographique DA-2026-118',
    department: 'Direction Générale (DG)',
    deptKey: 'dg',
    date: '30 Septembre 2026',
    completedBy: 'Dr. Amadou Diallo (DG)',
    daysToResolve: 1,
    conformity: 'Signé SHA-256'
  },
  {
    id: 'ct-5',
    title: 'Installation Onduleurs & Batterie Solaire Hub Lubumbashi',
    department: 'Opérations & VSAT (DOP)',
    deptKey: 'operations',
    date: '28 Septembre 2026',
    completedBy: 'Marc Tshimanga (Technicien Terrain)',
    daysToResolve: 4,
    conformity: '100% Recette'
  }
];

export const DepartmentTasksProgressChart: React.FC<DepartmentTasksProgressChartProps> = ({
  tasks = [],
  entities = [],
  users = [],
  currentUser,
  className = ''
}) => {
  const [chartMode, setChartMode] = useState<'cumulative' | 'periodic' | 'sla'>('cumulative');
  const [deptFilter, setDeptFilter] = useState<'all' | 'operations' | 'finance' | 'rh' | 'dg'>('all');
  const [rangeFilter, setRangeFilter] = useState<'30' | '15' | '7'>('30');
  const [showRecentTasks, setShowRecentTasks] = useState<boolean>(false);

  // Filtrer selon la plage de jours sélectionnée
  const filteredTimeline = useMemo(() => {
    if (rangeFilter === '7') {
      return THIRTY_DAYS_PROGRESSION.slice(5); // 3 derniers points
    }
    if (rangeFilter === '15') {
      return THIRTY_DAYS_PROGRESSION.slice(3); // 5 derniers points
    }
    return THIRTY_DAYS_PROGRESSION;
  }, [rangeFilter]);

  // Statistiques calculées pour la période sélectionnée
  const currentSnapshot = THIRTY_DAYS_PROGRESSION[THIRTY_DAYS_PROGRESSION.length - 1];
  const firstSnapshot = filteredTimeline[0];

  const totalCompletedPeriod = useMemo(() => {
    if (deptFilter === 'all') {
      return currentSnapshot.total - firstSnapshot.total + firstSnapshot.totalPeriod;
    }
    return Number(currentSnapshot[deptFilter]) - Number(firstSnapshot[deptFilter]) + Number(firstSnapshot[`${deptFilter}Period` as keyof typeof firstSnapshot]);
  }, [deptFilter, currentSnapshot, firstSnapshot]);

  // Tooltip personnalisé soigné
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs space-y-2 min-w-[200px] z-50">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-slate-300">
            <span className="font-semibold text-slate-200">Date : {label}</span>
            <span className="text-[10px] text-slate-400">Jalon 30 jours</span>
          </div>

          <div className="space-y-1 pt-1">
            {payload.map((entry: any, index: number) => {
              if (entry.dataKey === 'total' || entry.dataKey === 'totalPeriod') {
                return (
                  <div key={`tip-${index}`} className="flex items-center justify-between text-white font-bold pt-1 border-t border-slate-800">
                    <span>Total Tâches :</span>
                    <span className="text-amber-400 font-mono text-sm">{entry.value}</span>
                  </div>
                );
              }
              if (entry.dataKey === 'slaRate') {
                return (
                  <div key={`tip-${index}`} className="flex items-center justify-between text-emerald-400 font-bold pt-1 border-t border-slate-800">
                    <span>Taux SLA :</span>
                    <span className="font-mono text-sm">{entry.value}%</span>
                  </div>
                );
              }
              return (
                <div key={`tip-${index}`} className="flex items-center justify-between gap-3 text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="truncate">{entry.name} :</span>
                  </div>
                  <span className="font-mono font-semibold text-white">{entry.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white rounded-2xl border border-sky-200 shadow-sm p-5 space-y-5 ${className}`}>
      {/* En-tête du composant */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-sky-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Progression des Tâches Terminées par Département</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                  30 Derniers Jours
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Suivi chronologique et dynamique de l'achèvement opérationnel par direction (DOP, DAF, DRH, DG).
              </p>
            </div>
          </div>
        </div>

        {/* Contrôles interactifs : Plage temporelle & Type de vue */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur de période */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setRangeFilter('7')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                rangeFilter === '7' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 jours
            </button>
            <button
              onClick={() => setRangeFilter('15')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                rangeFilter === '15' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              15 jours
            </button>
            <button
              onClick={() => setRangeFilter('30')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                rangeFilter === '30' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 jours
            </button>
          </div>

          {/* Mode de représentation graphique */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setChartMode('cumulative')}
              title="Progression cumulative en volume"
              className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                chartMode === 'cumulative' ? 'bg-white text-sky-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Courbe Cumulée</span>
            </button>
            <button
              onClick={() => setChartMode('periodic')}
              title="Volume de tâches traitées par intervalle"
              className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                chartMode === 'periodic' ? 'bg-white text-sky-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Par Palier</span>
            </button>
            <button
              onClick={() => setChartMode('sla')}
              title="Comparatif volume et taux de respect SLA"
              className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                chartMode === 'sla' ? 'bg-white text-sky-700 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Mixte SLA %</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cartes KPI synthétiques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
            Total Tâches Clôturées
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {deptFilter === 'all' ? currentSnapshot.total : currentSnapshot[deptFilter]}
            </span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +18% (30j)
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Sur l'ensemble des jalons</div>
        </div>

        <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-100">
          <div className="text-[11px] font-medium text-sky-800 uppercase tracking-wider mb-1">
            Leader Opérationnel
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-sky-900 truncate">Opérations & VSAT</span>
          </div>
          <div className="text-[10px] text-sky-600 font-semibold mt-1">37 tâches clôturées (42%)</div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
          <div className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider mb-1">
            Respect des Délais (SLA)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {currentSnapshot.slaRate}%
            </span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +7.6 pts
            </span>
          </div>
          <div className="text-[10px] text-emerald-600 mt-1">Cible légale $\ge$ 85%</div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100">
          <div className="text-[11px] font-medium text-indigo-800 uppercase tracking-wider mb-1">
            Délai Moyen de Clôture
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-900 font-mono">2.3 j</span>
            <span className="text-xs font-semibold text-indigo-600 flex items-center">
              <Clock className="w-3 h-3 ml-0.5" />
            </span>
          </div>
          <div className="text-[10px] text-indigo-500 mt-1">En jours ouvrables RDC</div>
        </div>
      </div>

      {/* Barre de filtrage par département (Boutons interactifs) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 flex items-center gap-1 mr-1 text-[11px] shrink-0">
          <Filter className="w-3 h-3" />
          Filtrer :
        </span>

        <button
          onClick={() => setDeptFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
            deptFilter === 'all'
              ? 'bg-slate-900 text-white font-bold shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
        >
          Tous les Départements (Vue d'ensemble)
        </button>

        <button
          onClick={() => setDeptFilter('operations')}
          className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
            deptFilter === 'operations'
              ? 'bg-sky-600 text-white font-bold shadow-sm'
              : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          Opérations & VSAT ({currentSnapshot.operations})
        </button>

        <button
          onClick={() => setDeptFilter('finance')}
          className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
            deptFilter === 'finance'
              ? 'bg-indigo-600 text-white font-bold shadow-sm'
              : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          Finances & Comptabilité ({currentSnapshot.finance})
        </button>

        <button
          onClick={() => setDeptFilter('rh')}
          className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
            deptFilter === 'rh'
              ? 'bg-emerald-600 text-white font-bold shadow-sm'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Ressources Humaines ({currentSnapshot.rh})
        </button>

        <button
          onClick={() => setDeptFilter('dg')}
          className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
            deptFilter === 'dg'
              ? 'bg-purple-600 text-white font-bold shadow-sm'
              : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          Direction Générale ({currentSnapshot.dg})
        </button>
      </div>

      {/* Zone du Graphique Recharts */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'cumulative' ? (
            <AreaChart data={filteredTimeline} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradOps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={DEPT_COLORS.operations.gradientStart} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={DEPT_COLORS.operations.gradientEnd} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradFin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={DEPT_COLORS.finance.gradientStart} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={DEPT_COLORS.finance.gradientEnd} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradRH" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={DEPT_COLORS.rh.gradientStart} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={DEPT_COLORS.rh.gradientEnd} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradDG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={DEPT_COLORS.dg.gradientStart} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={DEPT_COLORS.dg.gradientEnd} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} iconType="circle" />

              {(deptFilter === 'all' || deptFilter === 'operations') && (
                <Area
                  type="monotone"
                  dataKey="operations"
                  name={DEPT_COLORS.operations.name}
                  stroke={DEPT_COLORS.operations.stroke}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradOps)"
                />
              )}

              {(deptFilter === 'all' || deptFilter === 'finance') && (
                <Area
                  type="monotone"
                  dataKey="finance"
                  name={DEPT_COLORS.finance.name}
                  stroke={DEPT_COLORS.finance.stroke}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradFin)"
                />
              )}

              {(deptFilter === 'all' || deptFilter === 'rh') && (
                <Area
                  type="monotone"
                  dataKey="rh"
                  name={DEPT_COLORS.rh.name}
                  stroke={DEPT_COLORS.rh.stroke}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradRH)"
                />
              )}

              {(deptFilter === 'all' || deptFilter === 'dg') && (
                <Area
                  type="monotone"
                  dataKey="dg"
                  name={DEPT_COLORS.dg.name}
                  stroke={DEPT_COLORS.dg.stroke}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradDG)"
                />
              )}
            </AreaChart>
          ) : chartMode === 'periodic' ? (
            <BarChart data={filteredTimeline} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} iconType="rect" />

              {(deptFilter === 'all' || deptFilter === 'operations') && (
                <Bar
                  dataKey="operationsPeriod"
                  name={DEPT_COLORS.operations.name}
                  fill={DEPT_COLORS.operations.stroke}
                  radius={[4, 4, 0, 0]}
                />
              )}

              {(deptFilter === 'all' || deptFilter === 'finance') && (
                <Bar
                  dataKey="financePeriod"
                  name={DEPT_COLORS.finance.name}
                  fill={DEPT_COLORS.finance.stroke}
                  radius={[4, 4, 0, 0]}
                />
              )}

              {(deptFilter === 'all' || deptFilter === 'rh') && (
                <Bar
                  dataKey="rhPeriod"
                  name={DEPT_COLORS.rh.name}
                  fill={DEPT_COLORS.rh.stroke}
                  radius={[4, 4, 0, 0]}
                />
              )}

              {(deptFilter === 'all' || deptFilter === 'dg') && (
                <Bar
                  dataKey="dgPeriod"
                  name={DEPT_COLORS.dg.name}
                  fill={DEPT_COLORS.dg.stroke}
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          ) : (
            <ComposedChart data={filteredTimeline} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#10b981"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[80, 100]}
                unit="%"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} />

              <Bar
                yAxisId="left"
                dataKey="totalPeriod"
                name="Tâches Clôturées (Période)"
                fill="#0284c7"
                radius={[4, 4, 0, 0]}
                barSize={24}
              />

              <Line
                yAxisId="right"
                type="monotone"
                dataKey="slaRate"
                name="Taux de Respect SLA (%)"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: '#10b981' }}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Accordéon : Dernières tâches clôturées vérifiables */}
      <div className="pt-2 border-t border-sky-100">
        <button
          onClick={() => setShowRecentTasks(!showRecentTasks)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-sky-700 py-1 transition"
        >
          <span className="flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-sky-600" />
            <span>Registre des Tâches Clôturées Récentes ({RECENT_COMPLETED_TASKS.length})</span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            {showRecentTasks ? 'Masquer le détail' : 'Afficher le détail'}
            {showRecentTasks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {showRecentTasks && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Intitulé de la Tâche</th>
                  <th className="py-2.5 px-3">Département</th>
                  <th className="py-2.5 px-3">Date d'Achèvement</th>
                  <th className="py-2.5 px-3">Exécutant / Validateur</th>
                  <th className="py-2.5 px-3">Délai</th>
                  <th className="py-2.5 px-3 text-right">Visa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {RECENT_COMPLETED_TASKS
                  .filter(t => deptFilter === 'all' || t.deptKey === deptFilter)
                  .map(task => (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{task.title}</td>
                      <td className="py-2.5 px-3 text-slate-600">{task.department}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{task.date}</td>
                      <td className="py-2.5 px-3 text-slate-700">{task.completedBy}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{task.daysToResolve} j</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {task.conformity}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
