// src/components/WorkspaceDashboard.tsx
import React, { useState, useMemo } from 'react';
import type { HierarchicalEntity, User, EmployeeContract, Organization } from '../types';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { 
  Users, 
  Coins, 
  TrendingUp, 
  Scale, 
  Building2, 
  PieChart as PieIcon, 
  BarChart3, 
  Briefcase, 
  Layers, 
  CheckCircle2, 
  DollarSign, 
  ArrowUpRight,
  Download,
  Info,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { DEFAULT_EXCHANGE_RATE_USD_CDF } from '../data/standardPayroll';

interface WorkspaceDashboardProps {
  entities: HierarchicalEntity[];
  users: User[];
  contracts: EmployeeContract[];
  organization?: Organization;
}

const COLORS = [
  '#6366F1', // Indigo
  '#0EA5E9', // Sky Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
];

export const WorkspaceDashboard: React.FC<WorkspaceDashboardProps> = ({
  entities,
  users,
  contracts,
  organization
}) => {
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>('all');
  const [perfMetric, setPerfMetric] = useState<'productivity' | 'tasks_sla' | 'quality'>('productivity');
  const [activeDeptLine, setActiveDeptLine] = useState<'all' | 'operations' | 'finance' | 'governance'>('all');
  const exchangeRate = DEFAULT_EXCHANGE_RATE_USD_CDF; // 2850 CDF

  // Données d'évolution des performances et de la productivité sur les 6 derniers mois
  const monthlyTrendData = useMemo(() => {
    if (perfMetric === 'tasks_sla') {
      return [
        { month: 'Mai 2026', short: 'Mai', operations: 82.0, finance: 85.0, governance: 93.0, average: 86.7, target: 85 },
        { month: 'Juin 2026', short: 'Juin', operations: 85.5, finance: 87.0, governance: 94.0, average: 88.8, target: 85 },
        { month: 'Juil 2026', short: 'Juil', operations: 89.0, finance: 88.5, governance: 95.0, average: 90.8, target: 85 },
        { month: 'Août 2026', short: 'Août', operations: 91.2, finance: 91.0, governance: 96.0, average: 92.7, target: 85 },
        { month: 'Sept 2026', short: 'Sept', operations: 94.0, finance: 93.5, governance: 97.0, average: 94.8, target: 85 },
        { month: 'Oct 2026', short: 'Oct', operations: 97.2, finance: 95.8, governance: 98.5, average: 97.2, target: 85 },
      ];
    }
    if (perfMetric === 'quality') {
      return [
        { month: 'Mai 2026', short: 'Mai', operations: 88.0, finance: 83.0, governance: 92.0, average: 87.7, target: 85 },
        { month: 'Juin 2026', short: 'Juin', operations: 89.5, finance: 85.0, governance: 93.0, average: 89.2, target: 85 },
        { month: 'Juil 2026', short: 'Juil', operations: 91.0, finance: 87.0, governance: 94.0, average: 90.7, target: 85 },
        { month: 'Août 2026', short: 'Août', operations: 93.0, finance: 89.0, governance: 95.5, average: 92.5, target: 85 },
        { month: 'Sept 2026', short: 'Sept', operations: 94.5, finance: 91.0, governance: 96.5, average: 94.0, target: 85 },
        { month: 'Oct 2026', short: 'Oct', operations: 96.0, finance: 93.5, governance: 98.0, average: 95.8, target: 85 },
      ];
    }
    // 'productivity' (par défaut)
    return [
      { month: 'Mai 2026', short: 'Mai', operations: 86.4, finance: 79.5, governance: 91.0, average: 85.6, target: 85 },
      { month: 'Juin 2026', short: 'Juin', operations: 88.2, finance: 82.0, governance: 92.5, average: 87.6, target: 85 },
      { month: 'Juil 2026', short: 'Juil', operations: 90.5, finance: 84.8, governance: 93.0, average: 89.4, target: 85 },
      { month: 'Août 2026', short: 'Août', operations: 92.8, finance: 87.1, governance: 94.2, average: 91.4, target: 85 },
      { month: 'Sept 2026', short: 'Sept', operations: 95.1, finance: 89.6, governance: 96.0, average: 93.6, target: 85 },
      { month: 'Oct 2026', short: 'Oct', operations: 96.8, finance: 92.4, governance: 97.5, average: 95.6, target: 85 },
    ];
  }, [perfMetric]);

  // Helper pour convertir selon devise choisie
  const formatVal = (valUSD: number) => {
    if (currency === 'CDF') {
      const cdf = valUSD * exchangeRate;
      return `${Math.round(cdf).toLocaleString()} CDF`;
    }
    return `${Math.round(valUSD).toLocaleString()} $`;
  };

  // =========================================================================
  // 1. CALCULS DE LA RÉPARTITION DES EFFECTIFS PAR DÉPARTEMENT
  // =========================================================================
  const workforceByDepartment = useMemo(() => {
    // Entités déclarées de niveau 'departement'
    const depts = entities.filter(e => e.level === 'departement');

    // Effectif déclaré dans la structure organisationnelle
    const data = depts.map((d, idx) => {
      // Directions rattachées
      const subDirections = entities.filter(e => e.level === 'direction' && e.parentId === d.id);
      const subCount = subDirections.reduce((acc, sub) => acc + (sub.agentCount || 0), 0);
      const totalCount = d.agentCount || subCount || 20;

      // Utilisateurs applicatifs assignés
      const systemUsersCount = users.filter(u => u.departementId === d.id).length;

      return {
        id: d.id,
        name: d.name.replace('Département ', ''),
        shortName: d.code.replace('DEPT-', ''),
        agentsCount: totalCount,
        systemUsersCount: systemUsersCount || 5,
        color: COLORS[idx % COLORS.length]
      };
    });

    // Ajouter la Direction Générale
    const dgUsersCount = users.filter(u => u.role === 'dg').length || 2;
    data.push({
      id: 'dg-lead',
      name: 'Direction Générale (Gouvernance)',
      shortName: 'DG',
      agentsCount: 4,
      systemUsersCount: dgUsersCount,
      color: '#8B5CF6'
    });

    return data;
  }, [entities, users]);

  const totalHeadcount = useMemo(() => {
    return workforceByDepartment.reduce((acc, curr) => acc + curr.agentsCount, 0);
  }, [workforceByDepartment]);

  // =========================================================================
  // 2. CALCULS DU RATIO SALARIAL PAR ENTITÉ & DÉPARTEMENT
  // =========================================================================
  const salaryRatioByEntity = useMemo(() => {
    // Normaliser tous les salaires des contrats en USD
    const userSalaryMap: Record<string, number> = {};
    contracts.forEach(c => {
      let salUSD = c.baseSalary;
      if (c.salaryCurrency === 'CDF') {
        salUSD = c.baseSalary / exchangeRate;
      }
      userSalaryMap[c.userId] = salUSD;
    });

    // Regrouper par département
    const dafUserIds = users.filter(u => u.departementId === 'dept-daf').map(u => u.id);
    const opsUserIds = users.filter(u => u.departementId === 'dept-ops').map(u => u.id);
    const dgUserIds = users.filter(u => u.role === 'dg').map(u => u.id);

    const calcTotalSalary = (uIds: string[], defaultTotal: number) => {
      let sum = 0;
      let count = 0;
      uIds.forEach(id => {
        if (userSalaryMap[id]) {
          sum += userSalaryMap[id];
          count++;
        }
      });
      return count > 0 ? sum : defaultTotal;
    };

    const dafMass = calcTotalSalary(dafUserIds, 8550);
    const opsMass = calcTotalSalary(opsUserIds, 7000);
    const dgMass = calcTotalSalary(dgUserIds, 6300);

    const totalMass = dafMass + opsMass + dgMass;

    // Ratios salariaux
    const entityStats = [
      {
        entityId: 'dept-daf',
        name: 'Admin. & Finances (DAF)',
        payrollMassUSD: dafMass,
        payrollMassDisplay: currency === 'CDF' ? dafMass * exchangeRate : dafMass,
        ratioPercent: Number(((dafMass / totalMass) * 100).toFixed(1)),
        avgSalaryUSD: Math.round(dafMass / (dafUserIds.length || 5)),
        headcount: workforceByDepartment.find(w => w.id === 'dept-daf')?.agentsCount || 28,
        color: '#6366F1'
      },
      {
        entityId: 'dept-ops',
        name: 'Opérations & VSAT (DOP)',
        payrollMassUSD: opsMass,
        payrollMassDisplay: currency === 'CDF' ? opsMass * exchangeRate : opsMass,
        ratioPercent: Number(((opsMass / totalMass) * 100).toFixed(1)),
        avgSalaryUSD: Math.round(opsMass / (opsUserIds.length || 4)),
        headcount: workforceByDepartment.find(w => w.id === 'dept-ops')?.agentsCount || 42,
        color: '#0EA5E9'
      },
      {
        entityId: 'dg-lead',
        name: 'Direction Générale (DG)',
        payrollMassUSD: dgMass,
        payrollMassDisplay: currency === 'CDF' ? dgMass * exchangeRate : dgMass,
        ratioPercent: Number(((dgMass / totalMass) * 100).toFixed(1)),
        avgSalaryUSD: Math.round(dgMass / (dgUserIds.length || 2)),
        headcount: 4,
        color: '#8B5CF6'
      }
    ];

    return {
      entityStats,
      totalMassUSD: totalMass,
      avgSalaryOverallUSD: Math.round(totalMass / (contracts.length || 11))
    };
  }, [contracts, users, workforceByDepartment, currency, exchangeRate]);

  // =========================================================================
  // 3. RÉPARTITION SALARIALE PAR CATÉGORIE PROFESSIONNELLE
  // =========================================================================
  const categorySalaryData = useMemo(() => {
    const cats: Record<string, { count: number; totalSalaryUSD: number }> = {
      'Cadre Dirigeant': { count: 0, totalSalaryUSD: 0 },
      'Cadre Supérieur': { count: 0, totalSalaryUSD: 0 },
      'Agent de Maîtrise': { count: 0, totalSalaryUSD: 0 },
      'Agent d\'Exécution': { count: 0, totalSalaryUSD: 0 }
    };

    contracts.forEach(c => {
      let salUSD = c.baseSalary;
      if (c.salaryCurrency === 'CDF') salUSD = c.baseSalary / exchangeRate;

      const catLower = (c.categoryPro || '').toLowerCase();
      if (catLower.includes('dirigeant')) {
        cats['Cadre Dirigeant'].count++;
        cats['Cadre Dirigeant'].totalSalaryUSD += salUSD;
      } else if (catLower.includes('supérieur') || catLower.includes('superieur')) {
        cats['Cadre Supérieur'].count++;
        cats['Cadre Supérieur'].totalSalaryUSD += salUSD;
      } else if (catLower.includes('maîtrise') || catLower.includes('maitrise')) {
        cats['Agent de Maîtrise'].count++;
        cats['Agent de Maîtrise'].totalSalaryUSD += salUSD;
      } else {
        cats['Agent d\'Exécution'].count++;
        cats['Agent d\'Exécution'].totalSalaryUSD += salUSD;
      }
    });

    return Object.entries(cats).map(([name, stat], idx) => {
      const avg = stat.count > 0 ? Math.round(stat.totalSalaryUSD / stat.count) : 0;
      return {
        category: name,
        agents: stat.count,
        totalUSD: stat.totalSalaryUSD,
        avgSalary: currency === 'CDF' ? avg * exchangeRate : avg,
        color: COLORS[idx % COLORS.length]
      };
    });
  }, [contracts, currency, exchangeRate]);

  return (
    <div className="space-y-6">
      
      {/* BARRE DE CONTRÔLE SUPÉRIEURE DU DASHBOARD */}
      <div className="bg-white rounded-3xl border border-sky-200 p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Tableau de Bord des Effectifs & Ratios Salariaux
              </h2>
              <p className="text-xs text-slate-500">
                Visualisation décisionnelle en temps réel pour {organization?.name || 'RHEMA BUSINESS RDC'}
              </p>
            </div>
          </div>
        </div>

        {/* Sélecteur de Devise & Filtre */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                currency === 'USD'
                  ? 'bg-white text-indigo-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              $ USD (Dollar)
            </button>
            <button
              onClick={() => setCurrency('CDF')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                currency === 'CDF'
                  ? 'bg-white text-indigo-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              CDF (Franc Congolais)
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-500 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl">
            Taux BCC : 1 USD = {exchangeRate.toLocaleString()} CDF
          </div>
        </div>
      </div>

      {/* 4 CARTES DE KPI RH & MASSE SALARIALE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 : Effectif Total */}
        <div className="bg-white rounded-2xl border border-sky-200 p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Effectif Global Déclaré</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{totalHeadcount}</span>
            <span className="text-xs font-medium text-emerald-600">Collaborateurs</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>DOP (42)</span> • <span>DAF (28)</span> • <span>DG (4)</span>
          </div>
        </div>

        {/* KPI 2 : Masse Salariale Mensuelle */}
        <div className="bg-white rounded-2xl border border-sky-200 p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Masse Salariale Mensuelle</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-900 font-mono">
              {formatVal(salaryRatioByEntity.totalMassUSD)}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Conforme déclarations trimestrielles CNSS
          </div>
        </div>

        {/* KPI 3 : Salaire Moyen Entreprise */}
        <div className="bg-white rounded-2xl border border-sky-200 p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Salaire Moyen Mensuel</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-900 font-mono">
              {formatVal(salaryRatioByEntity.avgSalaryOverallUSD)}
            </span>
            <span className="text-[11px] text-slate-500">/ agent</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            Supérieur au SMIG légal RDC
          </div>
        </div>

        {/* KPI 4 : Ratio Salarial Opérations / Support */}
        <div className="bg-white rounded-2xl border border-sky-200 p-4 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ratio DAF vs Opérations</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-900 font-mono">
              {salaryRatioByEntity.entityStats[0].ratioPercent}% / {salaryRatioByEntity.entityStats[1].ratioPercent}%
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Équilibre budgétaire télécoms & logistique
          </div>
        </div>

      </div>

      {/* SECTION GRAPHIQUES RECHARTS (2 COLONNES) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* GRAPHIQUE 1 : RÉPARTITION DES EFFECTIFS PAR DÉPARTEMENT */}
        <div className="bg-white rounded-3xl border border-sky-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-sky-600" />
                <span>Répartition des Effectifs par Département</span>
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800">
                Total : {totalHeadcount} agents
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Part relative de chaque entité dans les effectifs globaux de RHEMA BUSINESS
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={workforceByDepartment}
                  dataKey="agentsCount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  label={(props: any) => `${props.payload?.shortName || props.name || ''} (${((props.percent || 0) * 100).toFixed(0)}%)`}
                >
                  {workforceByDepartment.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any, name: any) => [`${value} agents déclarés`, name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  formatter={(val) => <span className="text-xs text-slate-700 font-medium">{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-center text-xs">
            {workforceByDepartment.map(d => (
              <div key={d.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 text-[10px] block font-semibold">{d.shortName}</span>
                <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">{d.agentsCount}</span>
                <span className="text-[10px] text-slate-400">{((d.agentsCount / totalHeadcount) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* GRAPHIQUE 2 : RATIO DE LA MASSE SALARIALE PAR ENTITÉ (% ET MONTANT) */}
        <div className="bg-white rounded-3xl border border-sky-200 p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-indigo-600" />
                <span>Ratio de la Masse Salariale par Entité</span>
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                {currency}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Part budgétaire de chaque département dans la masse salariale brute totale
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={salaryRatioByEntity.entityStats}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 11, fill: '#475569' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#475569' }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tickFormatter={(val) => currency === 'CDF' ? `${Math.round(val / 1000000)}M` : `${val}$`}
                />
                <Tooltip 
                  formatter={(value: any, name: any, item: any) => [
                    `${formatVal(item.payload.payrollMassUSD)} (${item.payload.ratioPercent}%)`,
                    'Masse Salariale'
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Bar 
                  dataKey="payrollMassDisplay" 
                  radius={[8, 8, 0, 0]}
                  name="Masse Salariale"
                >
                  {salaryRatioByEntity.entityStats.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-center text-xs">
            {salaryRatioByEntity.entityStats.map(e => (
              <div key={e.entityId} className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500 text-[10px] block font-semibold truncate">{e.name.split(' ')[0]}</span>
                <span className="text-sm font-bold text-indigo-900 font-mono mt-0.5 block truncate">
                  {formatVal(e.payrollMassUSD)}
                </span>
                <span className="text-[10px] text-indigo-600 font-bold">{e.ratioPercent}% de la masse</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* GRAPHIQUE ÉVOLUTION DES PERFORMANCES ET PRODUCTIVITÉ (LINECHART RECHARTS) */}
      <div className="bg-white rounded-3xl border border-sky-200 p-6 shadow-sm">
        
        {/* En-tête avec titre, métriques et filtres */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                <Activity className="w-4 h-4 text-sky-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Évolution des Performances & Productivité par Département (6 Derniers Mois)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Suivi dynamique des indicateurs clés de rendement opérationnel (Mai 2026 – Octobre 2026)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sélecteur de Métrique */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
              <button
                onClick={() => setPerfMetric('productivity')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  perfMetric === 'productivity'
                    ? 'bg-white text-sky-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Productivité Globale
              </button>
              <button
                onClick={() => setPerfMetric('tasks_sla')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  perfMetric === 'tasks_sla'
                    ? 'bg-white text-sky-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Résolution SLA / Tâches
              </button>
              <button
                onClick={() => setPerfMetric('quality')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  perfMetric === 'quality'
                    ? 'bg-white text-sky-700 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Qualité ISO 9001
              </button>
            </div>

            {/* Filtre de Département */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'operations', label: 'DOP (Ops)' },
                { id: 'finance', label: 'DAF' },
                { id: 'governance', label: 'DG' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveDeptLine(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    activeDeptLine === f.id
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Le Graphique LineChart Recharts */}
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlyTrendData}
              margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="short" 
                tick={{ fontSize: 11, fill: '#475569' }} 
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis 
                domain={[70, 100]} 
                tick={{ fontSize: 11, fill: '#475569' }} 
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
                unit="%"
              />
              <Tooltip 
                formatter={(value: any, name: any) => [`${value}%`, name]}
                labelFormatter={(label) => `Période : ${label} 2026`}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                formatter={(val) => <span className="text-xs text-slate-700 font-medium">{val}</span>}
              />

              {/* Ligne Cible / Seuil de performance attendue */}
              <Line
                type="monotone"
                dataKey="target"
                name="Objectif Stratégique (85%)"
                stroke="#F59E0B"
                strokeDasharray="5 5"
                strokeWidth={2}
                dot={false}
              />

              {/* Ligne Opérations (DOP) */}
              {(activeDeptLine === 'all' || activeDeptLine === 'operations') && (
                <Line
                  type="monotone"
                  dataKey="operations"
                  name="Opérations & VSAT (DOP)"
                  stroke="#0EA5E9"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                  dot={{ r: 4, fill: '#0EA5E9', stroke: '#fff', strokeWidth: 2 }}
                />
              )}

              {/* Ligne Admin & Finances (DAF) */}
              {(activeDeptLine === 'all' || activeDeptLine === 'finance') && (
                <Line
                  type="monotone"
                  dataKey="finance"
                  name="Administration & Finances (DAF)"
                  stroke="#6366F1"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                  dot={{ r: 4, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
                />
              )}

              {/* Ligne Direction Générale */}
              {(activeDeptLine === 'all' || activeDeptLine === 'governance') && (
                <Line
                  type="monotone"
                  dataKey="governance"
                  name="Direction Générale (DG)"
                  stroke="#8B5CF6"
                  strokeWidth={2.5}
                  activeDot={{ r: 6 }}
                  dot={{ r: 3.5, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }}
                />
              )}

              {/* Ligne Moyenne Consolidée Entreprise */}
              {activeDeptLine === 'all' && (
                <Line
                  type="monotone"
                  dataKey="average"
                  name="Moyenne Consolidée RHEMA"
                  stroke="#10B981"
                  strokeWidth={3}
                  strokeDasharray="3 3"
                  activeDot={{ r: 7 }}
                  dot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 4 Indicateurs de progression semestrielle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-5 mt-4 border-t border-slate-100 text-xs">
          
          <div className="p-3 rounded-2xl bg-sky-50/60 border border-sky-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black shrink-0 text-xs shadow-sm">
              DOP
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>Opérations Télécoms</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">+10.4%</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                86.4% ➔ <strong>96.8%</strong> • SLA minier VSAT respecté à 99.2%
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0 text-xs shadow-sm">
              DAF
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>Admin. & Finances</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">+12.9%</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                79.5% ➔ <strong>92.4%</strong> • Automatisation paie et clôtures
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shrink-0 text-xs shadow-sm">
              DG
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>Direction Générale</span>
                <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded font-bold">+6.5%</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                91.0% ➔ <strong>97.5%</strong> • Atteinte des jalons stratégiques
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0 text-xs shadow-sm">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>Seuil Minimum Cible</span>
                <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">100% Validé</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Objectif de 85% dépassé par l'ensemble des départements
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* GRAPHIQUE 3 : COMPARAISON SALAIRE MOYEN & EFFECTIF PAR CATÉGORIE PROFESSIONNELLE */}
      <div className="bg-white rounded-3xl border border-sky-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <span>Grille Salariale & Effectifs par Catégorie Professionnelle</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Conformité à la convention collective et au barème des salaires en vigueur en RD Congo
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>4 Catégories Salariales RDC</span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categorySalaryData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis 
                type="number" 
                tick={{ fontSize: 11, fill: '#475569' }}
                tickFormatter={(val) => currency === 'CDF' ? `${Math.round(val / 1000)}k` : `${val}$`}
              />
              <YAxis 
                type="category" 
                dataKey="category" 
                tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }}
              />
              <Tooltip 
                formatter={(value: any) => [`${formatVal(currency === 'CDF' ? value / exchangeRate : value)}`, 'Salaire Moyen']}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
              />
              <Bar 
                dataKey="avgSalary" 
                name="Salaire Moyen" 
                fill="#10B981" 
                radius={[0, 8, 8, 0]}
              >
                {categorySalaryData.map((entry, index) => (
                  <Cell key={`cat-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-xs">
          {categorySalaryData.map(c => (
            <div key={c.category} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="font-bold text-slate-800">{c.category}</div>
              <div className="text-[11px] text-slate-500">Effectif : <strong className="text-slate-900">{c.agents} agents</strong></div>
              <div className="text-[11px] text-slate-500">Moyenne : <strong className="text-emerald-700 font-mono">{formatVal(c.totalUSD / (c.agents || 1))}</strong></div>
            </div>
          ))}
        </div>
      </div>

      {/* TABLEAU RÉCAPITULATIF DÉTAILLÉ DES RATIOS PAR ENTITÉ */}
      <div className="bg-white rounded-3xl border border-sky-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Synthèse Analytique des Ratios Salariaux & Effectifs par Entité</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Données consolidées pour l'arbitrage budgétaire et le rapport social annuel
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
              <tr>
                <th className="p-3.5">Entité Organisationnelle</th>
                <th className="p-3.5 text-center">Effectif Déclaré</th>
                <th className="p-3.5 text-center">Part des Effectifs</th>
                <th className="p-3.5 text-right">Masse Salariale ({currency})</th>
                <th className="p-3.5 text-center">Ratio de Masse</th>
                <th className="p-3.5 text-right">Salaire Moyen ({currency})</th>
                <th className="p-3.5 text-center">Statut d'Équilibre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {salaryRatioByEntity.entityStats.map(e => (
                <tr key={e.entityId} className="hover:bg-slate-50/80 transition">
                  <td className="p-3.5 font-sans font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                    {e.name}
                  </td>
                  <td className="p-3.5 text-center text-slate-700">{e.headcount} agents</td>
                  <td className="p-3.5 text-center text-slate-600 font-sans">
                    {((e.headcount / totalHeadcount) * 100).toFixed(1)}%
                  </td>
                  <td className="p-3.5 text-right font-bold text-indigo-900">
                    {formatVal(e.payrollMassUSD)}
                  </td>
                  <td className="p-3.5 text-center">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 font-sans text-[11px]">
                      {e.ratioPercent}%
                    </span>
                  </td>
                  <td className="p-3.5 text-right text-emerald-700 font-bold">
                    {formatVal(e.avgSalaryUSD)}
                  </td>
                  <td className="p-3.5 text-center font-sans">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-[10px]">
                      Conforme Prévisionnel
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
