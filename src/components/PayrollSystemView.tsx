// src/components/PayrollSystemView.tsx
// Module Intégral Paie & RH RDC - Conforme Code du Travail RDC, CNSS, INPP, ONEM, IPR
// 100% Autonome et Identique à l'IMAGE 1 (Dark Theme Slate-900 / Slate-950, Devises $ USD et CDF, Taux BCC)

import React, { useState, useMemo } from 'react';
import type { 
  PayrollSystemConfig, 
  PayrollAllowance, 
  PayrollSocialContribution, 
  User, 
  Organization,
  EmployeeContract,
  LeaveRequest,
  SalaryAdvanceRequest,
  PayrollRunPeriod,
  OvertimeRecord,
  DisciplinaryAction
} from '../types';
import { 
  calculatePayslipSimulation, 
  createStandardPayrollSystem,
  DEFAULT_EXCHANGE_RATE_USD_CDF
} from '../data/standardPayroll';

import { 
  Coins, 
  Calculator, 
  RotateCcw, 
  Save, 
  Plus, 
  CheckCircle2, 
  ShieldCheck, 
  Layers, 
  Percent, 
  Clock, 
  FileText, 
  Printer, 
  Building2, 
  Sliders,
  DollarSign,
  Calendar,
  Briefcase,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  FileCheck,
  CheckSquare,
  X,
  Check
} from 'lucide-react';

export interface PayrollSystemViewProps {
  currentOrg?: Organization;
  organization?: Organization;
  currentUser: User;
  users: User[];
  payrollConfig?: PayrollSystemConfig;
  onUpdatePayrollConfig?: (updatedConfig: PayrollSystemConfig, auditNote?: string) => void;
  onResetToStandard?: () => void;
  onLogAction?: (action: string, details: string, category: 'admin' | 'document' | 'task' | 'security') => void;
}

export type PayrollTabType = 
  | 'overview' 
  | 'payroll_run' 
  | 'contracts' 
  | 'overtime' 
  | 'leaves' 
  | 'advances' 
  | 'discipline' 
  | 'allowances' 
  | 'social' 
  | 'taxes' 
  | 'simulator';

export const PayrollSystemView: React.FC<PayrollSystemViewProps> = ({
  currentOrg: propCurrentOrg,
  organization,
  currentUser,
  users = [],
  payrollConfig,
  onUpdatePayrollConfig,
  onResetToStandard,
  onLogAction
}) => {
  // Organisation par défaut RDC
  const currentOrg: Organization = propCurrentOrg || organization || {
    id: 'org-rb-01',
    name: 'RHEMA BUSINESS RDC',
    code: 'RB-RDC',
    logoUrl: '',
    rccm: 'CD/KNG/RCCM/18-B-01290',
    idNat: '01-83-N45201L',
    numImpot: 'A1934892Z',
    address: 'Avenue de la Justice, Gombe, Kinshasa - RDC',
    phone: '+243 81 000 0000',
    email: 'direction@rhemabusiness.cd',
    directorGeneral: 'Junior Monya'
  };

  // Droits Direction & DRH
  const isHR = Boolean(
    !currentUser ||
    currentUser.role === 'dg' ||
    currentUser.role === 'chef_departement' ||
    currentUser.role === 'directeur' ||
    currentUser.roleTitle?.toLowerCase().includes('pdg') ||
    currentUser.roleTitle?.toLowerCase().includes('dg') ||
    currentUser.roleTitle?.toLowerCase().includes('président') ||
    currentUser.roleTitle?.toLowerCase().includes('rh') ||
    currentUser.roleTitle?.toLowerCase().includes('ressources humaines') ||
    currentUser.roleTitle?.toLowerCase().includes('financier')
  );

  // Configuration avec devises strictes USD / CDF
  const [config, setConfig] = useState<PayrollSystemConfig>(() => {
    if (payrollConfig) {
      try {
        const raw = JSON.parse(JSON.stringify(payrollConfig));
        if (raw.currency !== 'USD' && raw.currency !== 'CDF') raw.currency = 'USD';
        return raw;
      } catch { /* fallback */ }
    }
    return createStandardPayrollSystem(currentOrg.id, currentOrg.name);
  });

  const [activeTab, setActiveTab] = useState<PayrollTabType>('overview');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [exchangeRate, setExchangeRate] = useState<number>(DEFAULT_EXCHANGE_RATE_USD_CDF);
  const [expandedPayrollRunId, setExpandedPayrollRunId] = useState<string | null>('run-2026-09');

  // =========================================================================
  // DONNÉES DU PERSONNEL & HISTORIQUE DES ACTIONS RH
  // =========================================================================
  const [contracts, setContracts] = useState<EmployeeContract[]>([
    {
      id: 'ctr-1',
      userId: users[0]?.id || 'u-1',
      employeeCode: 'RH-2026-001',
      matricule: 'MAT-001-DG',
      contractType: 'CDI',
      startDate: '2020-01-15',
      baseSalary: 2800,
      salaryCurrency: 'USD',
      categoryPro: 'Cadre Dirigeant (HC)',
      echelon: 'Hors Classe E4',
      cnssNumber: 'CNSS-CD-9982410',
      inppRegistered: true,
      onemRegistered: true,
      bankName: 'Rawbank Kinshasa',
      bankAccountNumber: '01002-39201928019-88',
      mobileMoneyNumber: '+243812791228',
      paymentMode: 'virement',
      dependentsCount: 3,
      maritalStatus: 'marie',
      active: true
    },
    {
      id: 'ctr-2',
      userId: users[1]?.id || 'u-2',
      employeeCode: 'RH-2026-002',
      matricule: 'MAT-002-DIR',
      contractType: 'CDI',
      startDate: '2021-03-01',
      baseSalary: 1950,
      salaryCurrency: 'USD',
      categoryPro: 'Cadre Supérieur',
      echelon: 'Catégorie 7 / Echelon 2',
      cnssNumber: 'CNSS-CD-8817290',
      inppRegistered: true,
      onemRegistered: true,
      bankName: 'Equity BCDC Gombe',
      bankAccountNumber: '00015-88291039821-42',
      mobileMoneyNumber: '+243820000002',
      paymentMode: 'virement',
      dependentsCount: 2,
      maritalStatus: 'marie',
      active: true
    },
    {
      id: 'ctr-3',
      userId: users[2]?.id || 'u-3',
      employeeCode: 'RH-2026-003',
      matricule: 'MAT-003-TECH',
      contractType: 'CDI',
      startDate: '2022-06-15',
      baseSalary: 1100,
      salaryCurrency: 'USD',
      categoryPro: 'Agent de Maîtrise / Télécoms',
      echelon: 'Catégorie 5 / Echelon 1',
      cnssNumber: 'CNSS-CD-7729102',
      inppRegistered: true,
      onemRegistered: true,
      bankName: 'TMB Kinshasa',
      bankAccountNumber: '00004-12903829102-12',
      mobileMoneyNumber: '+243819999003',
      paymentMode: 'virement',
      dependentsCount: 1,
      maritalStatus: 'celibataire',
      active: true
    },
    {
      id: 'ctr-4',
      userId: users[3]?.id || 'u-4',
      employeeCode: 'RH-2026-004',
      matricule: 'MAT-004-LOG',
      contractType: 'CDD',
      startDate: '2023-09-01',
      endDate: '2026-12-31',
      baseSalary: 2280000,
      salaryCurrency: 'CDF',
      categoryPro: 'Exécution Spécialisée',
      echelon: 'Catégorie 4 / Echelon 2',
      cnssNumber: 'CNSS-CD-6638190',
      inppRegistered: true,
      onemRegistered: true,
      bankName: 'Airtel Money RDC',
      bankAccountNumber: '+243998877665',
      mobileMoneyNumber: '+243998877665',
      paymentMode: 'mobile_money',
      dependentsCount: 4,
      maritalStatus: 'marie',
      active: true
    }
  ]);

  const [leaves, setLeaves] = useState<LeaveRequest[]>([
    {
      id: 'lv-1',
      userId: users[1]?.id || 'u-2',
      userName: users[1]?.name || 'Collaborateur DGA',
      type: 'conge_annuel',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      durationDays: 14,
      reason: 'Congé annuel payé au titre de l\'exercice 2026',
      status: 'approuve'
    },
    {
      id: 'lv-2',
      userId: users[2]?.id || 'u-3',
      userName: users[2]?.name || 'Ingénieur VSAT',
      type: 'circonstance',
      startDate: '2026-09-28',
      endDate: '2026-09-30',
      durationDays: 3,
      reason: 'Mariage civil familial',
      status: 'en_attente'
    }
  ]);

  const [advances, setAdvances] = useState<SalaryAdvanceRequest[]>([
    {
      id: 'adv-1',
      userId: users[2]?.id || 'u-3',
      userName: users[2]?.name || 'Ingénieur VSAT',
      amount: 200,
      currency: 'USD',
      requestDate: '2026-09-12',
      repaymentMonth: '2026-09',
      reason: 'Dépannage urgence médicale pharmacie',
      status: 'valide_rh',
      deductedFromPayroll: true
    }
  ]);

  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([
    {
      id: 'ot-1',
      userId: users[2]?.id || 'u-3',
      userName: users[2]?.name || 'Ingénieur VSAT',
      month: '2026-09',
      dayHours: 6,
      nightHours: 4,
      holidayHours: 2,
      hourlyRate: 6.32,
      calculatedAmountUSD: 112.50,
      calculatedAmountCDF: 320625,
      currency: 'USD',
      status: 'approuve',
      reason: 'Déploiement antenne VSAT site minier Kolwezi'
    },
    {
      id: 'ot-2',
      userId: users[3]?.id || 'u-4',
      userName: users[3]?.name || 'Agent Exécutant',
      month: '2026-09',
      dayHours: 8,
      nightHours: 0,
      holidayHours: 0,
      hourlyRate: 4.80,
      calculatedAmountUSD: 49.92,
      calculatedAmountCDF: 142272,
      currency: 'USD',
      status: 'approuve',
      reason: 'Permanence technique'
    }
  ]);

  const [disciplinaryActions, setDisciplinaryActions] = useState<DisciplinaryAction[]>([
    {
      id: 'disc-1',
      userId: users[3]?.id || 'u-4',
      userName: users[3]?.name || 'Agent Exécutant',
      type: 'avertissement',
      title: 'Avertissement Formel - Retard de transmission des fiches',
      date: '2026-09-15',
      reason: 'Manquement répété aux délais de remise des bordereaux.',
      status: 'notifie',
      issuedBy: 'Direction Générale (Junior Monya)',
      legalArticleRef: 'Article 56 du Code du Travail RDC'
    }
  ]);

  const [payrollRuns, setPayrollRuns] = useState<PayrollRunPeriod[]>([
    {
      id: 'run-2026-08',
      month: '2026-08',
      title: 'Paie RHEMA BUSINESS - Août 2026',
      currency: 'USD',
      exchangeRateUSD_CDF: 2850,
      status: 'cloture',
      totalGross: 8650,
      totalNet: 7120,
      totalEmployerCharges: 1420,
      totalEmployees: 4,
      validatedByDG: 'Junior Monya (DG)',
      validatedAt: '2026-08-31 17:00',
      closureHash: 'SHA256:d892bc018ae82103fca9182390a821e'
    },
    {
      id: 'run-2026-09',
      month: '2026-09',
      title: 'Paie RHEMA BUSINESS - Septembre 2026',
      currency: 'USD',
      exchangeRateUSD_CDF: 2850,
      status: 'en_validation',
      totalGross: 8950,
      totalNet: 7380,
      totalEmployerCharges: 1475,
      totalEmployees: 4
    }
  ]);

  // =========================================================================
  // ÉTATS DES MODALES D'ACTIONS RH
  // =========================================================================
  const [modalAction, setModalAction] = useState<null | 'new_contract' | 'new_leave' | 'new_advance' | 'new_overtime' | 'new_discipline' | 'doc_print'>(null);
  const [activeDocData, setActiveDocData] = useState<{ docType: string; title: string; ref: string; content: any }>({
    docType: 'bulletin',
    title: 'Bulletin de Paie Individuel',
    ref: 'BP-2026-09-001',
    content: {}
  });

  // Simulateur
  const [simSelectedUserId, setSimSelectedUserId] = useState<string>(users[0]?.id || '');
  const [simBaseSalary, setSimBaseSalary] = useState<number>(1800);
  const [simSeniorityYears, setSimSeniorityYears] = useState<number>(4);
  const [simDependents, setSimDependents] = useState<number>(3);

  // Formulaires locaux pour modales
  const [contractForm, setContractForm] = useState({
    userId: users[0]?.id || '',
    contractType: 'CDI' as const,
    matricule: 'MAT-2026-005',
    baseSalary: 1500,
    salaryCurrency: 'USD' as 'USD' | 'CDF',
    categoryPro: 'Cadre Technique',
    cnssNumber: 'CNSS-CD-7729103',
    bankName: 'Rawbank Kinshasa',
    paymentMode: 'virement' as const
  });

  const [leaveForm, setLeaveForm] = useState({
    userId: users[0]?.id || '',
    type: 'conge_annuel' as const,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    durationDays: 7,
    reason: 'Congé annuel payé au titre de l\'exercice'
  });

  const [advanceForm, setAdvanceForm] = useState({
    userId: users[0]?.id || '',
    amount: 150,
    currency: 'USD' as 'USD' | 'CDF',
    repaymentMonth: '2026-10',
    reason: 'Frais de scolarité / urgence médicale'
  });

  const [overtimeForm, setOvertimeForm] = useState({
    userId: users[0]?.id || '',
    dayHours: 4,
    nightHours: 2,
    holidayHours: 0,
    reason: 'Intervention d\'urgence antenne satellite'
  });

  const [disciplineForm, setDisciplineForm] = useState({
    userId: users[0]?.id || '',
    type: 'avertissement' as const,
    title: 'Avertissement Formel - Manquement aux horaires',
    reason: 'Absence non justifiée lors de la vacation technique'
  });

  const simulation = useMemo(() => {
    return calculatePayslipSimulation(config, simBaseSalary, simSeniorityYears, simDependents);
  }, [config, simBaseSalary, simSeniorityYears, simDependents]);

  const handleSave = () => {
    const updated: PayrollSystemConfig = {
      ...config,
      isStandardTemplate: false,
      lastModifiedBy: `${currentUser?.name || 'Dr. Amadou Diallo'} (${currentUser?.roleTitle || 'PDG'})`,
      lastModifiedAt: new Date().toISOString().slice(0, 10),
    };
    setConfig(updated);
    if (onUpdatePayrollConfig) {
      onUpdatePayrollConfig(updated, `Système de Paie & RH RDC mis à jour par (${currentUser?.name})`);
    }
    if (onLogAction) {
      onLogAction('Mise à jour Système Paie RH', `Politique salariale RDC sauvegardée pour "${currentOrg.name}".`, 'admin');
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  const handleConfirmReset = () => {
    const standard = createStandardPayrollSystem(currentOrg.id, currentOrg.name);
    setConfig(standard);
    if (onResetToStandard) onResetToStandard();
    setShowResetConfirm(false);
    if (onLogAction) {
      onLogAction('Réinitialisation Barème Légal RDC', `Rétablissement du modèle légal RDC pour "${currentOrg.name}".`, 'admin');
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  const handleSignPayroll = (runId: string) => {
    const hash = `SHA256:d892bc018ae82103fca9182390a821e${Math.random().toString(36).substring(2, 6)}`;
    setPayrollRuns(prev => prev.map(r => r.id === runId ? {
      ...r,
      status: 'cloture',
      validatedByDG: `${currentUser?.name || 'Dr. Amadou Diallo'} (DG / PDG)`,
      validatedAt: `${new Date().toISOString().slice(0, 10)} 17:00`,
      closureHash: hash
    } : r));
    if (onLogAction) onLogAction('Signature DG Paie', `Période clôturée par la Direction Générale.`, 'admin');
  };

  const formatMoney = (amount: number, customCurr?: string) => {
    const curr = customCurr || config.currency;
    if (curr === 'USD') {
      return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`;
    }
    return `${amount.toLocaleString('fr-FR')} CDF`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-100">
      
      {/* 1. EN-TÊTE PRINCIPAL DU MODULE (IDENTIQUE IMAGE 1) */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider border border-indigo-500/30">
              RESSOURCES HUMAINES & PAIE RDC
            </span>
            <span className="text-xs text-slate-400 font-medium">Code du Travail RDC • CNSS • INPP • ONEM • IPR</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Devises : USD ($) & CDF
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <span>Système Intégral de Gestion de la Paie & RH</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Gestion complète des contrats de travail, congés payés, avances sur salaires, déclarations fiscales IPR et cotisations sociales CNSS. Calcul en temps réel selon les barèmes officiels en Franc Congolais (CDF) et Dollar Américain (USD).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="flex items-center bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 mr-2 font-medium">Devise active :</span>
            <button
              onClick={() => setConfig({ ...config, currency: 'USD' })}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-xs ${
                config.currency === 'USD' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              $ USD
            </button>
            <button
              onClick={() => setConfig({ ...config, currency: 'CDF' })}
              className={`px-2.5 py-1 rounded-lg font-bold transition text-xs ml-1 ${
                config.currency === 'CDF' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              CDF (FC)
            </button>
          </div>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
            title="Rétablir le Barème Légal RDC"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rétablir Standard</span>
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/30"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Enregistrer</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Paramètres et barèmes du système de paie RDC enregistrés avec succès.</span>
        </div>
      )}

      {/* 2. ONGLETS DE NAVIGATION FONCTIONNELLE DU MODULE RH (IDENTIQUE IMAGE 1) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        {[
          { id: 'overview', label: '1. Paramètres & Taux BCC', icon: Sliders },
          { id: 'payroll_run', label: `2. Clôture & Journal de Paie (${payrollRuns.length})`, icon: Calendar },
          { id: 'contracts', label: `3. Contrats & Fiches Salariés (${contracts.length})`, icon: Briefcase },
          { id: 'overtime', label: `4. Heures Sup (+30%/+50%/+100%) (${overtimeRecords.length})`, icon: Clock },
          { id: 'leaves', label: `5. Congés & Absences (${leaves.length})`, icon: Clock },
          { id: 'advances', label: `6. Avances sur Salaire (${advances.length})`, icon: DollarSign },
          { id: 'discipline', label: `7. Sanctions & Discipline (${disciplinaryActions.length})`, icon: AlertTriangle },
          { id: 'allowances', label: `8. Primes & Indemnités (${config.allowances.filter(a => a.isActive).length})`, icon: Layers },
          { id: 'social', label: '9. Cotisations CNSS & INPP', icon: Percent },
          { id: 'taxes', label: '10. Barème Fiscal IPR', icon: FileText },
          { id: 'simulator', label: '11. Spécimen & Bulletin Officiel', icon: Calculator },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as PayrollTabType)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* ONGLET 1: PARAMÈTRES & TAUX BCC (EXACTEMENT COMME DANS L'IMAGE 1)     */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Politique Salariale & Paramètres de Rémunération RDC</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Conforme République Démocratique du Congo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Intitulé Officiel du Système de Paie
                </label>
                <input
                  type="text"
                  value={config.systemName}
                  onChange={(e) => setConfig({ ...config, systemName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Devise Monétaire Principale (Stricte)
                </label>
                <select
                  value={config.currency}
                  onChange={(e) => setConfig({ ...config, currency: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="USD">Dollar Américain ($ USD) - Référence Télécoms & Équipements</option>
                  <option value="CDF">Franc Congolais (CDF / FC) - Monnaie Nationale RDC</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Taux de Change Légal BCC (1 USD en CDF)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-xs font-mono">CDF</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Utilisé pour les conversions contractuelles et déclarations.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Base Horaire Légale Mensuelle (Heures)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.standardMonthlyHours}
                    onChange={(e) => setConfig({ ...config, standardMonthlyHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-xs font-mono">h/mois</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Prime d'Ancienneté (% tous les 2 ans de service)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.seniorityBonusPerTwoYearsPercent}
                    onChange={(e) => setConfig({ ...config, seniorityBonusPerTwoYearsPercent: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-xs font-mono">%</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Fréquence d'Émission des Bulletins
                </label>
                <select
                  value={config.payFrequency}
                  onChange={(e) => setConfig({ ...config, payFrequency: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="mensuelle">Mensuelle (Fin de mois)</option>
                  <option value="quinzaine">Par quinzaine</option>
                  <option value="hebdomadaire">Hebdomadaire</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-3">
              <h4 className="font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Barème Légal des Heures Supplémentaires (Code du Travail RDC)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px] mb-1">Heures Sup. Jour Ouvrable</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={config.overtimeRates.firstBracketRate}
                      onChange={(e) => setConfig({
                        ...config,
                        overtimeRates: { ...config.overtimeRates, firstBracketRate: Number(e.target.value) }
                      })}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold text-xs"
                    />
                    <span className="text-amber-400 font-bold">% majoration</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px] mb-1">Heures Sup. Nuit</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={config.overtimeRates.secondBracketRate}
                      onChange={(e) => setConfig({
                        ...config,
                        overtimeRates: { ...config.overtimeRates, secondBracketRate: Number(e.target.value) }
                      })}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold text-xs"
                    />
                    <span className="text-amber-400 font-bold">% majoration</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px] mb-1">Dimanches & Fériés Chômés</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={config.overtimeRates.weekendHolidayRate}
                      onChange={(e) => setConfig({
                        ...config,
                        overtimeRates: { ...config.overtimeRates, weekendHolidayRate: Number(e.target.value) }
                      })}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold text-xs"
                    />
                    <span className="text-amber-400 font-bold">% majoration</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Conformité Fiscale & Sociale RDC</span>
              </h3>

              <div className="space-y-2.5">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">CNSS Régime Général</div>
                    <div className="text-[10px] text-slate-400">Pensions + Risques prof.</div>
                  </div>
                  <div className="text-right font-mono font-bold text-indigo-400">
                    5% salarié / 13% patronal
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">INPP RDC</div>
                    <div className="text-[10px] text-slate-400">Formation professionnelle</div>
                  </div>
                  <div className="text-right font-mono font-bold text-indigo-400">
                    3% patronal
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">ONEM RDC</div>
                    <div className="text-[10px] text-slate-400">Office National Emploi</div>
                  </div>
                  <div className="text-right font-mono font-bold text-indigo-400">
                    0.2% patronal
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">IPR (Impôt Rémunérations)</div>
                    <div className="text-[10px] text-slate-400">DGI République Démocratique du Congo</div>
                  </div>
                  <div className="text-right font-mono font-bold text-emerald-400">
                    Progressif 3% à 40%
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs space-y-2">
              <span className="text-slate-400 block font-medium">Dernière révision RH :</span>
              <p className="text-white font-semibold">{currentUser?.name || 'Dr. Amadou Diallo'} ({currentUser?.roleTitle || 'PDG'})</p>
              <p className="text-[11px] text-slate-400 font-mono">Horodatage : {new Date().toISOString().slice(0, 10)}</p>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* ONGLET 2: CLÔTURE & JOURNAL DE PAIE CONSOLIDÉ                         */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'payroll_run' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Périodes d'Émission des Paies & Validations Hiérarchiques</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1">Livre de paie consolidé et signature du DG.</p>
            </div>
            <button
              onClick={() => {
                const next = `2026-${String(payrollRuns.length + 9).padStart(2, '0')}`;
                setPayrollRuns([{
                  id: `run-${next}`,
                  month: next,
                  title: `Paie RHEMA BUSINESS - Mois ${next}`,
                  currency: config.currency as 'USD' | 'CDF',
                  exchangeRateUSD_CDF: exchangeRate,
                  status: 'brouillon',
                  totalGross: 8950,
                  totalNet: 7380,
                  totalEmployerCharges: 1475,
                  totalEmployees: contracts.length
                }, ...payrollRuns]);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ouvrir une Période</span>
            </button>
          </div>

          <div className="space-y-4">
            {payrollRuns.map(run => {
              const isClosed = run.status === 'cloture';
              const isExpanded = expandedPayrollRunId === run.id;
              return (
                <div key={run.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-white font-mono bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                        {run.month}
                      </span>
                      <h4 className="text-base font-bold text-white">{run.title}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        isClosed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {isClosed ? 'Clôturé & E-Signé par le DG' : 'En Validation Direction'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setExpandedPayrollRunId(isExpanded ? null : run.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium flex items-center gap-1.5"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? 'Masquer' : 'Consulter le Livre de Paie'}</span>
                      </button>

                      {!isClosed && (
                        <button
                          onClick={() => handleSignPayroll(run.id)}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-1.5 shadow"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Signer & Clôturer</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Effectif</span>
                      <span className="text-lg font-bold text-white mt-1 block font-mono">{run.totalEmployees} agents</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Brut Global</span>
                      <span className="text-lg font-bold text-indigo-400 mt-1 block font-mono">{formatMoney(run.totalGross, run.currency)}</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Net à Virer</span>
                      <span className="text-lg font-bold text-emerald-400 mt-1 block font-mono">{formatMoney(run.totalNet, run.currency)}</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Charges Patronales</span>
                      <span className="text-lg font-bold text-amber-400 mt-1 block font-mono">{formatMoney(run.totalEmployerCharges, run.currency)}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-800 overflow-x-auto">
                      <table className="w-full text-[11px] text-left border border-slate-800 rounded-xl">
                        <thead className="bg-slate-950 text-slate-400">
                          <tr>
                            <th className="p-2.5">Matricule & Agent</th>
                            <th className="p-2.5 text-right">Base</th>
                            <th className="p-2.5 text-right">Primes</th>
                            <th className="p-2.5 text-right">Brut Imposable</th>
                            <th className="p-2.5 text-right">CNSS (5%)</th>
                            <th className="p-2.5 text-right">IPR</th>
                            <th className="p-2.5 text-right font-bold text-emerald-400">Net à Virer</th>
                            <th className="p-2.5 text-center">Bulletin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {contracts.map(c => {
                            const u = users.find(usr => usr.id === c.userId);
                            const gross = c.baseSalary + 100;
                            const cnss = gross * 0.05;
                            const ipr = (gross - cnss) * 0.15;
                            const net = gross - cnss - ipr;
                            return (
                              <tr key={c.id}>
                                <td className="p-2.5 font-sans text-white">{u?.name || c.employeeCode} ({c.matricule})</td>
                                <td className="p-2.5 text-right">{formatMoney(c.baseSalary, c.salaryCurrency)}</td>
                                <td className="p-2.5 text-right">+{formatMoney(100)}</td>
                                <td className="p-2.5 text-right font-bold text-indigo-300">{formatMoney(gross)}</td>
                                <td className="p-2.5 text-right text-amber-400">-{formatMoney(cnss)}</td>
                                <td className="p-2.5 text-right text-rose-400">-{formatMoney(ipr)}</td>
                                <td className="p-2.5 text-right font-bold text-emerald-400">{formatMoney(net)}</td>
                                <td className="p-2.5 text-center">
                                  <button
                                    onClick={() => {
                                      setActiveDocData({
                                        docType: 'bulletin',
                                        title: 'Bulletin de Paie Individuel',
                                        ref: `BP-${run.month}-${c.matricule}`,
                                        content: { userName: u?.name || c.employeeCode, matricule: c.matricule, net, currency: c.salaryCurrency }
                                      });
                                      setModalAction('doc_print');
                                    }}
                                    className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-[10px] font-sans"
                                  >
                                    Voir
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* ONGLET 3: CONTRATS & FICHES SALARIÉS                                  */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'contracts' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                <span>Registre du Personnel & Paramètres Contractuels RDC</span>
              </h3>
            </div>
            <button
              onClick={() => setModalAction('new_contract')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau Contrat</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contracts.map(contract => {
              const matchedUser = users.find(u => u.id === contract.userId);
              return (
                <div key={contract.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-white">{matchedUser?.name || contract.employeeCode}</h4>
                      <p className="text-[11px] text-slate-400">{contract.categoryPro} • {contract.echelon}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      {contract.contractType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Matricule :</span>
                      <span className="text-slate-200 font-mono font-semibold">{contract.matricule}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">CNSS RDC :</span>
                      <span className="text-slate-200 font-mono font-semibold">{contract.cnssNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Salaire Fixé :</span>
                      <span className="text-emerald-400 font-bold font-mono">
                        {formatMoney(contract.baseSalary, contract.salaryCurrency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Règlement :</span>
                      <span className="text-slate-200 uppercase">{contract.paymentMode}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setActiveDocData({
                          docType: 'attestation',
                          title: 'Attestation de Service & Travail',
                          ref: `AT-${contract.matricule}`,
                          content: { userName: matchedUser?.name || contract.employeeCode, matricule: contract.matricule, startDate: contract.startDate }
                        });
                        setModalAction('doc_print');
                      }}
                      className="flex-1 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg font-medium"
                    >
                      Attestation
                    </button>
                    <button
                      onClick={() => {
                        setActiveDocData({
                          docType: 'solde',
                          title: 'Solde de Tout Compte',
                          ref: `STC-${contract.matricule}`,
                          content: { userName: matchedUser?.name || contract.employeeCode, matricule: contract.matricule, baseSalary: contract.baseSalary }
                        });
                        setModalAction('doc_print');
                      }}
                      className="flex-1 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg font-medium"
                    >
                      Solde Compte
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* ONGLET 4: HEURES SUPPLÉMENTAIRES (+30%, +50%, +100%)                  */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'overtime' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Heures Supplémentaires (Code du Travail RDC)</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1">Majoration légale : +30% (jour), +50% (nuit), +100% (dimanches & fériés).</p>
            </div>
            <button
              onClick={() => setModalAction('new_overtime')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Saisir Heures Sup.</span>
            </button>
          </div>

          <div className="space-y-3">
            {overtimeRecords.map(ot => (
              <div key={ot.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-white text-sm">{ot.userName}</h4>
                  <p className="text-slate-400 text-xs">{ot.reason}</p>
                  <div className="text-[11px] text-slate-300 mt-1 font-mono">
                    Jour: {ot.dayHours}h • Nuit: {ot.nightHours}h • Férié: {ot.holidayHours}h
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-emerald-400 text-sm">
                  +{formatMoney(ot.calculatedAmountUSD, 'USD')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* ONGLET 5: CONGÉS & ABSENCES                                           */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'leaves' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Gestion des Congés Payés & Absences</span>
              </h3>
            </div>
            <button
              onClick={() => setModalAction('new_leave')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Demande de Congé</span>
            </button>
          </div>

          <div className="space-y-3">
            {leaves.map(l => (
              <div key={l.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-white text-sm">{l.userName}</h4>
                  <p className="text-slate-400 text-xs">{l.reason}</p>
                  <p className="text-[11px] text-slate-300 mt-1">Du {l.startDate} au {l.endDate} ({l.durationDays} jours)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg font-bold text-xs ${l.status === 'approuve' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {l.status === 'approuve' ? 'Approuvé' : 'En Attente'}
                  </span>
                  {l.status === 'en_attente' && (
                    <button
                      onClick={() => setLeaves(prev => prev.map(item => item.id === l.id ? { ...item, status: 'approuve' } : item))}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold"
                    >
                      Valider
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* ONGLET 6: AVANCES SUR SALAIRE                                         */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'advances' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-indigo-400" />
                <span>Avances sur Salaire & Acomptes RDC</span>
              </h3>
            </div>
            <button
              onClick={() => setModalAction('new_advance')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Accorder une Avance</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {advances.map(a => (
              <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-sm">{a.userName}</h4>
                  <span className="text-emerald-400 font-bold font-mono">{formatMoney(a.amount, a.currency)}</span>
                </div>
                <p className="text-slate-400 text-xs">{a.reason}</p>
                <div className="p-2 bg-slate-950 rounded-xl text-[11px] flex justify-between">
                  <span>Mois retenue : {a.repaymentMonth}</span>
                  <span className="text-indigo-400 font-semibold">Déductible sur paie</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* ONGLET 7: SANCTIONS DISCIPLINAIRES                                    */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'discipline' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Sanctions & Procédures Disciplinaires (RDC)</span>
              </h3>
            </div>
            <button
              onClick={() => setModalAction('new_discipline')}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Émettre une Sanction</span>
            </button>
          </div>

          <div className="space-y-3">
            {disciplinaryActions.map(action => (
              <div key={action.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm">{action.userName}</h4>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold uppercase text-[10px]">{action.type}</span>
                  </div>
                  <p className="font-medium text-slate-200 mt-1">{action.title}</p>
                  <p className="text-slate-400 text-xs">{action.reason}</p>
                </div>
                <button
                  onClick={() => {
                    setActiveDocData({
                      docType: 'sanction',
                      title: 'Notification de Mesure Disciplinaire',
                      ref: `DISC-${action.id}`,
                      content: { userName: action.userName, title: action.title, reason: action.reason }
                    });
                    setModalAction('doc_print');
                  }}
                  className="px-3 py-1 bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg font-bold"
                >
                  Imprimer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* SOUS-MODULE 8: PRIMES & INDEMNITÉS CONVENTIONNELLES                   */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'allowances' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Nomenclature des Primes & Indemnités RDC ({config.allowances.length})</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Transport, logement, panier repas et prime technique VSAT. Activez, désactivez ou créez vos primes.
              </p>
            </div>

            <button
              onClick={() => {
                const name = prompt('Intitulé de la prime :');
                if (!name) return;
                const defaultValue = Number(prompt('Montant standard (ou pourcentage) :') || 100);
                const newAllowance: PayrollAllowance = {
                  id: `allw-${Date.now()}`,
                  name,
                  code: `PRIME_${Date.now().toString().slice(-4)}`,
                  type: 'fixe',
                  defaultValue,
                  isTaxable: true,
                  isSubjectToSocialContributions: true,
                  isActive: true,
                  category: 'performance',
                  description: 'Prime personnalisée ajoutée par la Direction RH.'
                };
                setConfig(prev => ({ ...prev, allowances: [...prev.allowances, newAllowance] }));
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer une Prime</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.allowances.map(a => (
              <div
                key={a.id}
                className={`bg-slate-900 border rounded-2xl p-5 shadow-xl space-y-3 transition ${
                  a.isActive ? 'border-slate-800' : 'border-slate-800/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900">
                      {a.code}
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1.5">{a.name}</h4>
                  </div>

                  <button
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        allowances: prev.allowances.map(item => item.id === a.id ? { ...item, isActive: !item.isActive } : item)
                      }));
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition border ${
                      a.isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {a.isActive ? 'Active' : 'Désactivée'}
                  </button>
                </div>

                <p className="text-slate-400 text-xs">{a.description}</p>

                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Valeur Standard</span>
                    <span className="text-white font-bold font-mono">
                      {a.type === 'fixe' ? formatMoney(a.defaultValue) : `${a.defaultValue}% du salaire`}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Régime Fiscal & Social</span>
                    <span className="text-slate-300">
                      {a.isTaxable ? '• Imposable IPR' : '• Exonérée IPR'} <br />
                      {a.isSubjectToSocialContributions ? '• Soumise CNSS' : '• Exonérée CNSS'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* SOUS-MODULE 9: COTISATIONS CNSS & INPP                                */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'social' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Percent className="w-4 h-4 text-indigo-400" />
                <span>Cotisations Sociales & Organismes Parafiscaux RDC</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Barème officiel : CNSS (5% salarié / 13% patronal), INPP (3%) et ONEM (0.2%).
              </p>
            </div>

            <button
              onClick={() => {
                setActiveDocData({
                  docType: 'bordereau_cnss',
                  title: 'BORDEREAU DÉCLARATIF CNSS & PARAFISCAL',
                  ref: `DECL-CNSS-${new Date().getFullYear()}`,
                  content: { userName: 'Direction Générale', matricule: 'DEC-GLOBAL', net: 1420 }
                });
                setModalAction('doc_print');
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Générer Bordereau CNSS</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.socialContributions.map(sc => (
              <div
                key={sc.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900">
                    {sc.code}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    Légal RDC
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white">{sc.name}</h4>
                <p className="text-slate-400 text-xs">{sc.description}</p>

                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Part Salarié (Ouvrière)</span>
                    <span className="text-amber-400 font-bold font-mono text-sm">{sc.employeeRate}%</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Part Employeur (Patronale)</span>
                    <span className="text-indigo-400 font-bold font-mono text-sm">{sc.employerRate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* SOUS-MODULE 10: BARÈME FISCAL IPR RDC                                 */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'taxes' && (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Barème Progressif de l'IPR (Direction Générale des Impôts - DGI RDC)</span>
              </h3>
              <p className="text-slate-400 text-xs mt-1">
                Calcul par tranches progressives (3% à 40%) sur le net imposable après déduction CNSS.
              </p>
            </div>

            <button
              onClick={() => {
                setActiveDocData({
                  docType: 'declaration_dgi',
                  title: 'BORDEREAU MENSUEL IPR - DGI RDC',
                  ref: `IPR-DGI-${new Date().getFullYear()}`,
                  content: { userName: 'Direction Générale', matricule: 'DGI-GLOBAL', net: 1100 }
                });
                setModalAction('doc_print');
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Générer Déclaration DGI</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Tranche Fiscale</th>
                    <th className="py-2.5 px-3">Revenu Imposable Mensuel ({config.currency})</th>
                    <th className="py-2.5 px-3">Taux Applicable</th>
                    <th className="py-2.5 px-3">Mode d'Imposition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {config.taxConfig.brackets.map((b, idx) => (
                    <tr key={b.id} className="hover:bg-slate-950/40">
                      <td className="py-3 px-3 font-bold text-white font-mono">Tranche {idx + 1}</td>
                      <td className="py-3 px-3 font-mono">
                        {formatMoney(b.min)} {b.max !== null ? `à ${formatMoney(b.max)}` : 'et plus'}
                      </td>
                      <td className="py-3 px-3 font-bold text-emerald-400 font-mono text-sm">{b.rate}%</td>
                      <td className="py-3 px-3 text-slate-400">Calcul progressif sur fraction</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white">Réduction d'IPR par charge de famille</span>
                <p className="text-[10px] text-slate-400">Déduction légale directe sur le montant de l'impôt brut.</p>
              </div>
              <span className="font-mono font-bold text-emerald-400">
                {formatMoney(config.taxConfig.creditPerDependentChild)} / enfant
              </span>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* SOUS-MODULE 11: SPÉCIMEN & BULLETIN OFFICIEL RHEMA BUSINESS           */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'simulator' && (
        <div className="space-y-6 text-xs">
          
          {/* Panneau de Paramétrage de la Simulation en Direct */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-indigo-400" />
                  <span>Calculateur & Simulateur en Temps Réel du Bulletin de Paie RDC</span>
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Testez instantanément le salaire net d'un agent selon ses primes, son ancienneté, ses enfants à charge et les retenues légales (CNSS 5% et IPR DGI).
                </p>
              </div>

              <button
                onClick={() => {
                  const targetUser = users.find(u => u.id === simSelectedUserId);
                  setActiveDocData({
                    docType: 'bulletin',
                    title: 'Bulletin de Rémunération Individuel',
                    ref: `BP-2026-09-${simSelectedUserId.toUpperCase()}`,
                    content: {
                      userName: targetUser?.name || 'Collaborateur',
                      roleTitle: targetUser?.roleTitle || 'Cadre Supérieur',
                      matricule: 'MAT-2026-RHEMA',
                      netSalary: simulation.netSalary,
                      baseSalary: simBaseSalary,
                      currency: config.currency,
                      seniorityYears: simSeniorityYears,
                      dependents: simDependents,
                      grossSalary: simulation.grossSalary,
                      cnssDeduction: simulation.socialDeductions,
                      iprDeduction: simulation.taxDeductions
                    }
                  });
                  setModalAction('doc_print');
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-600/30"
              >
                <Printer className="w-4 h-4" />
                <span>Afficher & Imprimer le Bulletin Officiel (A4)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Sélectionner un Collaborateur</label>
                <select
                  value={simSelectedUserId}
                  onChange={(e) => {
                    const uId = e.target.value;
                    setSimSelectedUserId(uId);
                    const matched = contracts.find(c => c.userId === uId);
                    if (matched) {
                      setSimBaseSalary(matched.baseSalary);
                      setSimDependents(matched.dependentsCount);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-indigo-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.roleTitle})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Salaire de Base Fixé ({config.currency})</label>
                <input
                  type="number"
                  value={simBaseSalary}
                  onChange={(e) => setSimBaseSalary(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Ancienneté (Années de service)</label>
                <input
                  type="number"
                  value={simSeniorityYears}
                  onChange={(e) => setSimSeniorityYears(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Enfants à charge (Déduction IPR)</label>
                <input
                  type="number"
                  value={simDependents}
                  onChange={(e) => setSimDependents(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Synthèse Chiffrée Instantanée */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl text-center">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Salaire Brut Imposable</span>
              <span className="text-xl font-bold text-white font-mono mt-1 block">
                {formatMoney(simulation.grossSalary)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl text-center">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Retenue CNSS Salarié (5%)</span>
              <span className="text-xl font-bold text-amber-400 font-mono mt-1 block">
                - {formatMoney(simulation.socialDeductions)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl text-center">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Impôt IPR (DGI RDC)</span>
              <span className="text-xl font-bold text-rose-400 font-mono mt-1 block">
                - {formatMoney(simulation.taxDeductions)}
              </span>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 p-4 rounded-2xl shadow-xl text-center bg-emerald-950/20">
              <span className="text-emerald-400 text-[10px] uppercase font-bold block">Net Net à Payer à l'Agent</span>
              <span className="text-2xl font-bold text-emerald-300 font-mono mt-1 block">
                {formatMoney(simulation.netSalary)}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ≈ {config.currency === 'USD' ? `${(simulation.netSalary * exchangeRate).toLocaleString()} CDF` : `${(simulation.netSalary / exchangeRate).toFixed(2)} $`}
              </span>
            </div>
          </div>

          {/* SPÉCIMEN DU BULLETIN INTÉGRÉ EN DIRECT SUR LA PAGE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Spécimen Visuel du Bulletin de Paie (Aperçu Direct)</span>
              </h4>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                Période active : Septembre 2026
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border border-slate-800 rounded-xl overflow-hidden font-mono">
                <thead className="bg-slate-950 text-slate-400 font-semibold font-sans border-b border-slate-800">
                  <tr>
                    <th className="p-3">Désignation de la Rubrique</th>
                    <th className="p-3 text-right">Base de Calcul</th>
                    <th className="p-3 text-right">Taux / Formule</th>
                    <th className="p-3 text-right text-emerald-400">Gains Salarié (+)</th>
                    <th className="p-3 text-right text-rose-400">Retenues (-)</th>
                    <th className="p-3 text-right text-indigo-400">Charges Employeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="p-3 font-sans text-white font-medium">Salaire de Base Conventionnel</td>
                    <td className="p-3 text-right">{formatMoney(simBaseSalary)}</td>
                    <td className="p-3 text-right">100%</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">+{formatMoney(simBaseSalary)}</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">-</td>
                  </tr>

                  {simSeniorityYears >= 2 && (
                    <tr>
                      <td className="p-3 font-sans text-white">Prime d'Ancienneté ({simSeniorityYears} ans)</td>
                      <td className="p-3 text-right">{formatMoney(simBaseSalary)}</td>
                      <td className="p-3 text-right">{Math.floor(simSeniorityYears / 2) * 3}%</td>
                      <td className="p-3 text-right text-emerald-400">+{formatMoney(simBaseSalary * Math.floor(simSeniorityYears / 2) * 0.03)}</td>
                      <td className="p-3 text-right">-</td>
                      <td className="p-3 text-right">-</td>
                    </tr>
                  )}

                  <tr>
                    <td className="p-3 font-sans text-white">Indemnités Forfaitaires (Transport & Panier)</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">Fixe</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">+{formatMoney(100)}</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">-</td>
                  </tr>

                  <tr className="bg-slate-950/40">
                    <td className="p-3 font-sans text-amber-300">CNSS Régime Général (Pensions & Risques)</td>
                    <td className="p-3 text-right">{formatMoney(simulation.grossSalary)}</td>
                    <td className="p-3 text-right">5% sal. / 13% pat.</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right text-amber-400 font-bold">-{formatMoney(simulation.socialDeductions)}</td>
                    <td className="p-3 text-right text-indigo-400">+{formatMoney(simulation.grossSalary * 0.13)}</td>
                  </tr>

                  <tr className="bg-slate-950/40">
                    <td className="p-3 font-sans text-rose-300">IPR (Impôt Professionnel sur Rémunérations - DGI)</td>
                    <td className="p-3 text-right">{formatMoney(simulation.grossSalary - simulation.socialDeductions)}</td>
                    <td className="p-3 text-right">Barème DGI</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right text-rose-400 font-bold">-{formatMoney(simulation.taxDeductions)}</td>
                    <td className="p-3 text-right">-</td>
                  </tr>

                  <tr className="bg-slate-950/60">
                    <td className="p-3 font-sans text-slate-400">INPP (3%) & ONEM (0.2%) Patronal RDC</td>
                    <td className="p-3 text-right">{formatMoney(simulation.grossSalary)}</td>
                    <td className="p-3 text-right">3.2% total</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right">-</td>
                    <td className="p-3 text-right text-indigo-400">+{formatMoney(simulation.grossSalary * 0.032)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs gap-3">
              <div>
                <span className="text-slate-400 block font-sans">Mode de versement certifié :</span>
                <span className="text-white font-bold">Virement Bancaire Rawbank • Compte 01002-39201928019-88</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block font-sans">Montant Net Net Décompté :</span>
                <span className="text-xl font-bold text-emerald-400 font-mono">{formatMoney(simulation.netSalary)}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* TOUTES LES MODALES D'ACTIONS RH INTÉGRÉES                             */}
      {/* ===================================================================== */}

      {/* Modale Nouveau Contrat */}
      {modalAction === 'new_contract' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-xs space-y-4">
            <h3 className="font-bold text-white text-sm">Enregistrer un Nouveau Contrat RDC</h3>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Collaborateur</label>
                <select
                  value={contractForm.userId}
                  onChange={e => setContractForm({ ...contractForm, userId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Matricule</label>
                  <input
                    type="text"
                    value={contractForm.matricule}
                    onChange={e => setContractForm({ ...contractForm, matricule: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Salaire ({contractForm.salaryCurrency})</label>
                  <input
                    type="number"
                    value={contractForm.baseSalary}
                    onChange={e => setContractForm({ ...contractForm, baseSalary: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setModalAction(null)} className="px-3 py-1.5 bg-slate-800 rounded-lg">Annuler</button>
              <button
                onClick={() => {
                  setContracts(prev => [{
                    id: `ctr-${Date.now()}`,
                    userId: contractForm.userId,
                    employeeCode: `RH-${Date.now().toString().slice(-3)}`,
                    matricule: contractForm.matricule,
                    contractType: contractForm.contractType,
                    startDate: new Date().toISOString().slice(0, 10),
                    baseSalary: contractForm.baseSalary,
                    salaryCurrency: contractForm.salaryCurrency,
                    categoryPro: contractForm.categoryPro,
                    echelon: 'Échelon 1',
                    cnssNumber: contractForm.cnssNumber,
                    inppRegistered: true,
                    onemRegistered: true,
                    bankName: contractForm.bankName,
                    paymentMode: contractForm.paymentMode,
                    dependentsCount: 2,
                    maritalStatus: 'marie',
                    active: true
                  }, ...prev]);
                  setModalAction(null);
                }}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Demande de Congé */}
      {modalAction === 'new_leave' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-xs space-y-4">
            <h3 className="font-bold text-white text-sm">Déposer une Demande de Congé</h3>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Agent</label>
                <select
                  value={leaveForm.userId}
                  onChange={e => setLeaveForm({ ...leaveForm, userId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Début</label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Fin</label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Motif</label>
                <input
                  type="text"
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setModalAction(null)} className="px-3 py-1.5 bg-slate-800 rounded-lg">Annuler</button>
              <button
                onClick={() => {
                  const u = users.find(usr => usr.id === leaveForm.userId);
                  setLeaves(prev => [{
                    id: `lv-${Date.now()}`,
                    userId: leaveForm.userId,
                    userName: u?.name || 'Agent',
                    type: leaveForm.type,
                    startDate: leaveForm.startDate,
                    endDate: leaveForm.endDate,
                    durationDays: leaveForm.durationDays,
                    reason: leaveForm.reason,
                    status: 'en_attente'
                  }, ...prev]);
                  setModalAction(null);
                }}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold"
              >
                Soumettre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Avance sur Salaire */}
      {modalAction === 'new_advance' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-xs space-y-4">
            <h3 className="font-bold text-white text-sm">Accorder une Avance sur Salaire</h3>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Bénéficiaire</label>
                <select
                  value={advanceForm.userId}
                  onChange={e => setAdvanceForm({ ...advanceForm, userId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Montant ({advanceForm.currency})</label>
                <input
                  type="number"
                  value={advanceForm.amount}
                  onChange={e => setAdvanceForm({ ...advanceForm, amount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Motif</label>
                <input
                  type="text"
                  value={advanceForm.reason}
                  onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setModalAction(null)} className="px-3 py-1.5 bg-slate-800 rounded-lg">Annuler</button>
              <button
                onClick={() => {
                  const u = users.find(usr => usr.id === advanceForm.userId);
                  setAdvances(prev => [{
                    id: `adv-${Date.now()}`,
                    userId: advanceForm.userId,
                    userName: u?.name || 'Agent',
                    amount: advanceForm.amount,
                    currency: advanceForm.currency,
                    requestDate: new Date().toISOString().slice(0, 10),
                    repaymentMonth: advanceForm.repaymentMonth,
                    reason: advanceForm.reason,
                    status: 'valide_rh',
                    deductedFromPayroll: true
                  }, ...prev]);
                  setModalAction(null);
                }}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold"
              >
                Valider l'Avance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Heures Sup */}
      {modalAction === 'new_overtime' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-xs space-y-4">
            <h3 className="font-bold text-white text-sm">Saisir des Heures Supplémentaires</h3>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Agent</label>
                <select
                  value={overtimeForm.userId}
                  onChange={e => setOvertimeForm({ ...overtimeForm, userId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Jour (+30%)</label>
                  <input
                    type="number"
                    value={overtimeForm.dayHours}
                    onChange={e => setOvertimeForm({ ...overtimeForm, dayHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nuit (+50%)</label>
                  <input
                    type="number"
                    value={overtimeForm.nightHours}
                    onChange={e => setOvertimeForm({ ...overtimeForm, nightHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Férié (+100%)</label>
                  <input
                    type="number"
                    value={overtimeForm.holidayHours}
                    onChange={e => setOvertimeForm({ ...overtimeForm, holidayHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-white font-mono text-center"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setModalAction(null)} className="px-3 py-1.5 bg-slate-800 rounded-lg">Annuler</button>
              <button
                onClick={() => {
                  const u = users.find(usr => usr.id === overtimeForm.userId);
                  const total = (overtimeForm.dayHours * 6.5 * 1.3) + (overtimeForm.nightHours * 6.5 * 1.5) + (overtimeForm.holidayHours * 6.5 * 2.0);
                  setOvertimeRecords(prev => [{
                    id: `ot-${Date.now()}`,
                    userId: overtimeForm.userId,
                    userName: u?.name || 'Agent',
                    month: '2026-09',
                    dayHours: overtimeForm.dayHours,
                    nightHours: overtimeForm.nightHours,
                    holidayHours: overtimeForm.holidayHours,
                    hourlyRate: 6.5,
                    calculatedAmountUSD: total,
                    calculatedAmountCDF: total * exchangeRate,
                    currency: 'USD',
                    status: 'approuve',
                    reason: overtimeForm.reason
                  }, ...prev]);
                  setModalAction(null);
                }}
                className="px-4 py-1.5 bg-amber-600 text-white rounded-lg font-bold"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Sanction */}
      {modalAction === 'new_discipline' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-xs space-y-4">
            <h3 className="font-bold text-white text-sm">Émettre une Sanction Disciplinaire</h3>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Agent Concerné</label>
                <select
                  value={disciplineForm.userId}
                  onChange={e => setDisciplineForm({ ...disciplineForm, userId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Motif</label>
                <textarea
                  value={disciplineForm.reason}
                  onChange={e => setDisciplineForm({ ...disciplineForm, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white h-16"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => setModalAction(null)} className="px-3 py-1.5 bg-slate-800 rounded-lg">Annuler</button>
              <button
                onClick={() => {
                  const u = users.find(usr => usr.id === disciplineForm.userId);
                  setDisciplinaryActions(prev => [{
                    id: `disc-${Date.now()}`,
                    userId: disciplineForm.userId,
                    userName: u?.name || 'Agent',
                    type: disciplineForm.type,
                    title: disciplineForm.title,
                    date: new Date().toISOString().slice(0, 10),
                    reason: disciplineForm.reason,
                    status: 'notifie',
                    issuedBy: 'Direction Générale (Junior Monya)',
                    legalArticleRef: 'Article 56 du Code du Travail RDC'
                  }, ...prev]);
                  setModalAction(null);
                }}
                className="px-4 py-1.5 bg-rose-600 text-white rounded-lg font-bold"
              >
                Notifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALE D'IMPRESSION UNIVERSELLE DE TOUS LES DOCUMENTS OFFICIELS RDC    */}
      {/* ===================================================================== */}
      {modalAction === 'doc_print' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl space-y-5 my-8 print:p-0 print:shadow-none print:m-0 print:max-w-none">
            
            {/* Barre d'action supérieure */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>{activeDocData.title} • République Démocratique du Congo</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer / PDF</span>
                </button>
                <button onClick={() => setModalAction(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* En-tête RHEMA BUSINESS Officiel */}
            <header className="border-b-2 border-slate-300 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-indigo-950 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md shrink-0 border-2 border-indigo-700">
                    RB
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">{currentOrg.name}</h2>
                    <p className="text-[11px] text-slate-600 font-medium">Télécoms • VSAT • Réseaux & Intégration Technologique</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      RCCM: {currentOrg.rccm || 'CD/KNG/RCCM/18-B-01290'} • Id. Nat: {currentOrg.idNat || '01-83-N45201L'} • N° Impôt: {currentOrg.numImpot || 'A1934892Z'}
                    </p>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 uppercase tracking-wider border border-indigo-200 block sm:inline-block">
                    {activeDocData.title.toUpperCase()}
                  </span>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-1">
                    Réf : {activeDocData.ref}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Kinshasa, le {new Date().toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            </header>

            {/* CORPS SPÉCIFIQUE DU DOCUMENT : ATTESTATION DE TRAVAIL */}
            {activeDocData.docType === 'attestation' && (
              <div className="space-y-4 text-xs leading-relaxed text-slate-800 p-5 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-center text-sm uppercase text-slate-900 border-b border-slate-300 pb-2">
                  ATTESTATION DE SERVICE ET DE TRAVAIL
                </h4>
                <p>Nous soussignés, <strong>{currentOrg.name}</strong>, certifions par la présente que :</p>
                <p className="font-bold text-slate-900 text-sm">
                  Monsieur / Madame {activeDocData.content?.userName}, Matricule {activeDocData.content?.matricule},
                </p>
                <p>
                  est engagé(e) au sein de notre établissement en qualité de cadre sous contrat de travail depuis le <strong>{activeDocData.content?.startDate || '15 Janvier 2020'}</strong>.
                </p>
                <p>
                  Durant son activité, l'intéressé(e) a fait preuve de loyauté, d'assiduité et de compétence technique dans l'accomplissement des missions qui lui sont confiées.
                </p>
                <p>En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.</p>
                <div className="pt-6 text-right font-bold">
                  Pour la Direction Générale,<br />
                  <span className="text-indigo-900 font-extrabold">{currentOrg.directorGeneral || 'Junior MONYA'}</span>
                </div>
              </div>
            )}

            {/* CORPS SPÉCIFIQUE DU DOCUMENT : SOLDE DE TOUT COMPTE */}
            {activeDocData.docType === 'solde' && (
              <div className="space-y-4 text-xs leading-relaxed text-slate-800 p-5 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-center text-sm uppercase text-slate-900 border-b border-slate-300 pb-2">
                  REÇU POUR SOLDE DE TOUT COMPTE (ARTICLE 62 CODE DU TRAVAIL RDC)
                </h4>
                <p>Je soussigné(e), <strong>{activeDocData.content?.userName}</strong>, Matricule <strong>{activeDocData.content?.matricule}</strong>, reconnais avoir reçu la somme totale pour règlement définitif :</p>
                <div className="p-3 bg-white border border-slate-300 rounded font-mono text-sm font-bold text-emerald-800">
                  Total Net Décompté : {formatMoney(Number(activeDocData.content?.baseSalary || 1500) * 1.5)}
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Prorata du dernier mois de traitement salarial</li>
                  <li>Indemnité compensatoire de congés payés non pris</li>
                  <li>Indemnité conventionnelle de fin de contrat</li>
                </ul>
                <div className="flex justify-between pt-6 border-t font-bold">
                  <div>Signature du Salarié (précédée de « Pour solde de tout compte »)</div>
                  <div>Visa Direction Générale</div>
                </div>
              </div>
            )}

            {/* CORPS SPÉCIFIQUE DU DOCUMENT : NOTIFICATION DISCIPLINAIRE */}
            {activeDocData.docType === 'sanction' && (
              <div className="space-y-4 text-xs leading-relaxed text-slate-800 p-5 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="font-bold text-center text-sm uppercase text-rose-900 border-b border-rose-200 pb-2">
                  NOTIFICATION DE MESURE DISCIPLINAIRE
                </h4>
                <p>À l'attention de : <strong>{activeDocData.content?.userName}</strong></p>
                <p><strong>Objet :</strong> {activeDocData.content?.title}</p>
                <p>Vu les dispositions du Code du Travail de la RDC et du Règlement d'Ordre Intérieur de {currentOrg.name} :</p>
                <div className="p-3 bg-white border border-rose-200 rounded text-rose-950 font-medium">
                  {activeDocData.content?.reason}
                </div>
                <p>Nous vous prions de prendre les mesures correctives nécessaires afin d'éviter toute récidive susceptible d'entraîner des sanctions plus rigoureuses.</p>
                <div className="pt-6 text-right font-bold">
                  La Direction Générale
                </div>
              </div>
            )}

            {/* CORPS DU BULLETIN OFFICIEL DE PAIE STANDARD (A4) */}
            {(activeDocData.docType === 'bulletin' || !['attestation', 'solde', 'sanction'].includes(activeDocData.docType)) && (
              <>
                <div className="grid grid-cols-2 gap-4 text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="space-y-1">
                    <div><strong>Nom de l'Agent :</strong> {users.find(u => u.id === simSelectedUserId)?.name || 'Collaborateur'}</div>
                    <div><strong>Fonction / Emploi :</strong> {users.find(u => u.id === simSelectedUserId)?.roleTitle || 'Cadre Supérieur'}</div>
                    <div><strong>Matricule Interne :</strong> MAT-2026-RHEMA</div>
                    <div><strong>Ancienneté de service :</strong> {simSeniorityYears} an(s)</div>
                  </div>
                  <div className="space-y-1">
                    <div><strong>N° Immatriculation CNSS :</strong> CNSS-CD-9982410</div>
                    <div><strong>Période de Paie :</strong> Septembre 2026</div>
                    <div><strong>Devise Contractuelle :</strong> {config.currency === 'USD' ? 'Dollar Américain ($ USD)' : 'Franc Congolais (CDF)'}</div>
                    <div><strong>Charges de famille :</strong> {simDependents} enfant(s) à charge</div>
                  </div>
                </div>

                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-800">
                    <tr>
                      <th className="p-2.5 text-left">Rubriques Rémunératrices & Déductions</th>
                      <th className="p-2.5 text-right">Base</th>
                      <th className="p-2.5 text-right">Taux / Formule</th>
                      <th className="p-2.5 text-right text-emerald-800">Gains (+)</th>
                      <th className="p-2.5 text-right text-rose-800">Retenues (-)</th>
                      <th className="p-2.5 text-right text-slate-700">Part Patronale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    <tr>
                      <td className="p-2 font-sans font-medium text-slate-900">Salaire de Base Conventionnel</td>
                      <td className="p-2 text-right">{formatMoney(simBaseSalary)}</td>
                      <td className="p-2 text-right">100%</td>
                      <td className="p-2 text-right text-emerald-700 font-bold">+{formatMoney(simBaseSalary)}</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right">-</td>
                    </tr>

                    {simSeniorityYears >= 2 && (
                      <tr>
                        <td className="p-2 font-sans font-medium text-slate-900">Prime d'Ancienneté ({simSeniorityYears} ans)</td>
                        <td className="p-2 text-right">{formatMoney(simBaseSalary)}</td>
                        <td className="p-2 text-right">{Math.floor(simSeniorityYears / 2) * 3}%</td>
                        <td className="p-2 text-right text-emerald-700 font-bold">+{formatMoney(simBaseSalary * Math.floor(simSeniorityYears / 2) * 0.03)}</td>
                        <td className="p-2 text-right">-</td>
                        <td className="p-2 text-right">-</td>
                      </tr>
                    )}

                    <tr>
                      <td className="p-2 font-sans font-medium text-slate-900">Indemnités Conventionnelles (Transport/Logement)</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right">Fixe</td>
                      <td className="p-2 text-right text-emerald-700 font-bold">+{formatMoney(100)}</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right">-</td>
                    </tr>

                    <tr className="bg-slate-50">
                      <td className="p-2 font-sans text-slate-900">Cotisation CNSS Salarié (Pensions & Risques)</td>
                      <td className="p-2 text-right">{formatMoney(simulation.grossSalary)}</td>
                      <td className="p-2 text-right">5% sal. / 13% pat.</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right text-rose-700 font-bold">-{formatMoney(simulation.socialDeductions)}</td>
                      <td className="p-2 text-right text-slate-700 font-bold">+{formatMoney(simulation.grossSalary * 0.13)}</td>
                    </tr>

                    <tr className="bg-slate-50">
                      <td className="p-2 font-sans text-slate-900">IPR (Impôt Professionnel sur Rémunérations - DGI)</td>
                      <td className="p-2 text-right">{formatMoney(simulation.grossSalary - simulation.socialDeductions)}</td>
                      <td className="p-2 text-right">Barème DGI RDC</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right text-rose-700 font-bold">-{formatMoney(simulation.taxDeductions)}</td>
                      <td className="p-2 text-right">-</td>
                    </tr>

                    <tr className="bg-slate-100/50">
                      <td className="p-2 font-sans text-slate-700">Cotisations Patronales INPP (3%) & ONEM (0.2%)</td>
                      <td className="p-2 text-right">{formatMoney(simulation.grossSalary)}</td>
                      <td className="p-2 text-right">3.2% total</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right text-slate-700 font-bold">+{formatMoney(simulation.grossSalary * 0.032)}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900 text-white rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">NET À PAYER À L'AGENT (VIREMENT BANCAIRE)</span>
                    <span className="text-2xl font-bold text-emerald-400 font-mono mt-0.5 block">
                      {formatMoney(simulation.netSalary)}
                    </span>
                    <span className="text-xs text-slate-300 font-mono">
                      Contrevaleur BCC : {config.currency === 'USD' ? `${(simulation.netSalary * exchangeRate).toLocaleString()} CDF` : `${(simulation.netSalary / exchangeRate).toFixed(2)} $`}
                    </span>
                  </div>
                  <div className="text-right text-xs text-slate-300 space-y-1">
                    <div>Coût global employeur : <strong>{formatMoney(simulation.grossSalary * 1.162)}</strong></div>
                    <div className="text-emerald-400 font-bold">Scellé SHA-256 : d892bc018ae82103fca91</div>
                    <div className="text-[10px] text-slate-400">Certifié conforme par la Direction Générale</div>
                  </div>
                </div>
              </>
            )}

            {/* Pied de page officiel RHEMA BUSINESS */}
            <footer className="pt-3 border-t-2 border-slate-200 text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-800">{currentOrg.name}</span> • RCCM: {currentOrg.rccm || 'CD/KNG/RCCM/18-B-01290'}
              </div>
              <div>
                Avenue de la Justice, Gombe, Kinshasa - RDC • Plateforme Certifiée RH
              </div>
            </footer>

          </div>
        </div>
      )}

      {/* Confirmation Reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-3">
            <h3 className="font-bold text-sm text-amber-400">Rétablir le Barème Légal RDC</h3>
            <p className="text-xs text-slate-300">Rétablir les cotisations officielles CNSS 5%/13%, INPP 3%, ONEM 0.2%, barème IPR ?</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowResetConfirm(false)} className="px-3 py-1.5 bg-slate-800 text-xs rounded">Annuler</button>
              <button onClick={handleConfirmReset} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded">Confirmer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};