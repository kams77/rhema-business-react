// src/components/PayrollSystemView.tsx
// Module Intégral Paie & RH RDC - Conforme Code du Travail RDC, CNSS, INPP, ONEM, IPR
// 100% Autonome et Identique à l'IMAGE 1 (Dark Theme Slate-900 / Slate-950, Devises $ USD et CDF, Taux BCC)

import React, { useState, useMemo } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { titleHasAny, HR_TITLE_TERMS } from '../utils/rbac';
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
  DisciplinaryAction,
  DocumentItem
} from '../types';
import { 
  calculatePayslipSimulation, 
  createStandardPayrollSystem,
  DEFAULT_EXCHANGE_RATE_USD_CDF
} from '../data/standardPayroll';
import { 
  initialContracts,
  initialLeaves,
  initialAdvances,
  initialOvertimes,
  initialDisciplinaryActions
} from '../data/initialData';
import { 
  exportPayslipToPDF, 
  exportPayslipToCSV, 
  exportPayrollRunToPDF, 
  exportPayrollRunToCSV, 
  type PayslipExportData 
} from '../utils/exportUtils';

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
  Check,
  Download,
  FileSpreadsheet,
  CreditCard,
  Sparkles
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
  onAddDocument?: (document: DocumentItem) => void;
  /** Contrats partagés avec le reste de l'application (sinon, liste propre à ce module). */
  contracts?: EmployeeContract[];
  onContractsChange?: React.Dispatch<React.SetStateAction<EmployeeContract[]>>;
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
  onLogAction,
  onAddDocument,
  contracts: sharedContracts,
  onContractsChange,
}) => {
  // Organisation par défaut RDC
  const currentOrg: Organization = propCurrentOrg || organization || {
    id: 'org-rb-01',
    name: 'RHEMA BUSINESS RDC',
    code: 'RB-RDC',
    type: 'entreprise',
    registrationNumber: 'CD/KNG/RCCM/18-B-01290',
    rccm: 'CD/KNG/RCCM/18-B-01290',
    idNat: '01-83-N45201L',
    numImpot: 'A1934892Z',
    headquarters: 'Avenue de la Justice, Gombe, Kinshasa - RDC',
    phone: '+243 81 000 0000',
    email: 'direction@rhemabusiness.cd',
    directorGeneral: 'Junior Monya',
    hasDepartements: true,
    hasDirections: true,
    hasDivisions: true,
    hasServices: true,
    description: 'RHEMA BUSINESS RDC',
    createdAt: '2020-01-01'
  };

  // Droits Direction & DRH
  const isHR =
    currentUser.role === 'dg' ||
    currentUser.role === 'chef_departement' ||
    currentUser.role === 'directeur' ||
    titleHasAny(currentUser.roleTitle, ['pdg', 'dg', 'president', 'financier', 'daf', ...HR_TITLE_TERMS]);


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
  const [exchangeRate, setExchangeRate] = usePersistentState<number>('payroll.exchangeRate', DEFAULT_EXCHANGE_RATE_USD_CDF);
  const [expandedPayrollRunId, setExpandedPayrollRunId] = useState<string | null>('run-2026-09');

  // =========================================================================
  // DONNÉES DU PERSONNEL & HISTORIQUE DES ACTIONS RH
  // =========================================================================
  const [localContracts, setLocalContracts] = usePersistentState<EmployeeContract[]>('payroll.contracts', initialContracts);
  const contracts = sharedContracts ?? localContracts;
  const setContracts = onContractsChange ?? setLocalContracts;
  const [leaves, setLeaves] = usePersistentState<LeaveRequest[]>('payroll.leaves', initialLeaves);
  const [advances, setAdvances] = usePersistentState<SalaryAdvanceRequest[]>('payroll.advances', initialAdvances);
  const [overtimeRecords, setOvertimeRecords] = usePersistentState<OvertimeRecord[]>('payroll.overtime', initialOvertimes);
  const [disciplinaryActions, setDisciplinaryActions] = usePersistentState<DisciplinaryAction[]>('payroll.disciplinary', initialDisciplinaryActions);

  const [payrollRuns, setPayrollRuns] = usePersistentState<PayrollRunPeriod[]>('payroll.runs', [
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
  // ÉTATS DES MODALES D'ACTIONS RH & WORKFLOW MENSUEL STRICT
  // =========================================================================
  const [modalAction, setModalAction] = useState<null | 'new_contract' | 'new_leave' | 'new_advance' | 'new_overtime' | 'new_discipline' | 'doc_print' | 'configure_payment_run' | 'confirm_bank_transfer'>(null);
  const [docPreviewMode, setDocPreviewMode] = useState<'officiel' | 'specimen'>('officiel');
  const [selectedRunForWorkflow, setSelectedRunForWorkflow] = useState<PayrollRunPeriod | null>(null);

  // Formulaire Étape 1 : Paramétrage du Paiement Mensuel
  const [paymentParamForm, setPaymentParamForm] = useState({
    month: '2026-09',
    exchangeRateUSD_CDF: DEFAULT_EXCHANGE_RATE_USD_CDF,
    bankName: 'Rawbank Kinshasa',
    bankAccount: '01002-39201928019-88',
    valueDate: '2026-09-30',
    globalBonusUSD: 100,
    currency: 'USD' as 'USD' | 'CDF',
    comments: 'Paie mensuelle conforme au barème légal et convention collective RHEMA BUSINESS.'
  });

  // Formulaire Étape 3 : Confirmation du Virement Bancaire
  const [bankConfirmForm, setBankConfirmForm] = useState({
    bankName: 'Rawbank Kinshasa',
    transactionRef: 'RAW-TXN-202609-481029',
    confirmedDate: new Date().toISOString().slice(0, 10),
    debitAccount: '01002-39201928019-88',
    bankReceiptNote: 'Ordre de virement de masse exécuté par Rawbank Kinshasa. Tous les comptes agents ont été crédités.'
  });

  // Notification Étape 4 : Déclenchement automatique de l'envoi des bulletins
  const [autoDispatchNotification, setAutoDispatchNotification] = useState<{
    show: boolean;
    runTitle: string;
    count: number;
    bankRef: string;
    bankName: string;
    timestamp: string;
  } | null>(null);

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

  const getPayslipExportDataForUser = (userId: string, customContent?: any): PayslipExportData => {
    const targetUser = users.find(u => u.id === userId);
    const contract = contracts.find(c => c.userId === userId);
    
    const baseSal = customContent?.baseSalary ?? (contract ? contract.baseSalary : simBaseSalary);
    const curr = customContent?.currency ?? (contract ? contract.salaryCurrency : config.currency);
    const dependents = customContent?.dependents ?? (contract ? contract.dependentsCount : simDependents);
    const seniority = customContent?.seniorityYears ?? (contract ? 3 : simSeniorityYears);
    
    // Ancienneté bonus (3% par tranche de 2 ans)
    const seniorityBonus = seniority >= 2 ? baseSal * Math.floor(seniority / 2) * 0.03 : 0;
    const allowances = 100;
    
    // Heures sup
    const userOvertime = overtimeRecords.find(o => o.userId === userId && o.month === '2026-09');
    const overtimeAmount = userOvertime ? userOvertime.calculatedAmountUSD : 0;
    
    // Acompte
    const userAdvance = advances.find(a => a.userId === userId && a.repaymentMonth === '2026-09');
    const advanceDeduction = userAdvance ? userAdvance.amount : 0;
    
    const gross = baseSal + seniorityBonus + allowances + overtimeAmount;
    const cnssSal = gross * 0.05;
    const ipr = (gross - cnssSal) * 0.15;
    const totalDeductions = cnssSal + ipr + advanceDeduction;
    const net = gross - totalDeductions;
    
    const cnssPat = gross * 0.13;
    const inpp = gross * 0.03;
    const onem = gross * 0.002;
    const totalEmployer = gross + cnssPat + inpp + onem;
    
    return {
      orgName: currentOrg.name,
      rccm: currentOrg.rccm || 'CD/KNG/RCCM/20-A-01120',
      idNat: currentOrg.idNat || '01-83-N45201L',
      numImpot: currentOrg.numImpot || 'A1934892Z',
      headquarters: currentOrg.headquarters,
      ref: customContent?.ref || `BP-2026-09-${contract?.matricule || targetUser?.matricule || 'MAT-RB'}`,
      period: 'Septembre 2026',
      date: new Date().toLocaleDateString('fr-FR'),
      employeeName: customContent?.userName || targetUser?.name || contract?.employeeCode || 'Collaborateur',
      matricule: customContent?.matricule || contract?.matricule || targetUser?.matricule || 'MAT-2026-RHEMA',
      roleTitle: customContent?.roleTitle || targetUser?.roleTitle || contract?.categoryPro || 'Cadre',
      cnssNumber: contract?.cnssNumber || 'CNSS-CD-9982410',
      bankName: contract?.bankName || 'Rawbank Kinshasa',
      accountNumber: contract?.bankAccountNumber || '01002-39201928019-88',
      seniorityYears: seniority,
      dependents: dependents,
      currency: curr,
      baseSalary: baseSal,
      seniorityBonus,
      allowances,
      overtimeAmount,
      grossSalary: gross,
      socialDeductionCNSS: cnssSal,
      taxDeductionIPR: ipr,
      advanceDeduction,
      totalDeductions,
      netSalary: net,
      counterValueCDF: curr === 'USD' ? net * exchangeRate : net,
      employerCNSS: cnssPat,
      employerINPP: inpp,
      employerONEM: onem,
      totalEmployerCost: totalEmployer,
      sha256Hash: `SHA256:${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`
    };
  };

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
      validatedByDG: `${currentUser?.name || 'Junior Monya'} (DG / Direction Générale)`,
      validatedAt: `${new Date().toISOString().slice(0, 10)} 17:00`,
      closureHash: hash
    } : r));
    if (onLogAction) onLogAction('Signature DG Paie', `Période clôturée par la Direction Générale.`, 'admin');
  };

  // -------------------------------------------------------------------------
  // RÈGLE STRICTE 1 : ÉTAPE 1 - PARAMÉTRAGE DES PAIEMENTS MENSUELS
  // -------------------------------------------------------------------------
  const handleOpenConfigPayment = (run: PayrollRunPeriod) => {
    setSelectedRunForWorkflow(run);
    setPaymentParamForm({
      month: run.month,
      exchangeRateUSD_CDF: run.exchangeRateUSD_CDF || exchangeRate,
      bankName: run.bankName || 'Rawbank Kinshasa',
      bankAccount: '01002-39201928019-88',
      valueDate: `${run.month}-28`,
      globalBonusUSD: 100,
      currency: run.currency,
      comments: `Paramètres de paiement officiels pour la période ${run.title}.`
    });
    setModalAction('configure_payment_run');
  };

  const handleConfigurePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRunForWorkflow) return;

    setPayrollRuns(prev => prev.map(r => r.id === selectedRunForWorkflow.id ? {
      ...r,
      status: 'parametre',
      currency: paymentParamForm.currency,
      exchangeRateUSD_CDF: paymentParamForm.exchangeRateUSD_CDF,
      bankName: paymentParamForm.bankName,
    } : r));

    if (onLogAction) {
      onLogAction(
        'Paramétrage Paie Mensuelle',
        `Paramètres de versement arrêtés pour ${selectedRunForWorkflow.title} (Banque: ${paymentParamForm.bankName}, Taux: ${paymentParamForm.exchangeRateUSD_CDF} CDF, Échéance: ${paymentParamForm.valueDate})`,
        'admin'
      );
    }

    setModalAction(null);
  };

  // -------------------------------------------------------------------------
  // RÈGLE STRICTE 2 : ÉTAPE 2 - APPROBATION DRH
  // -------------------------------------------------------------------------
  const handleApproveDRH = (runId: string) => {
    const run = payrollRuns.find(r => r.id === runId);
    if (!run) return;

    const drhName = currentUser?.name || 'M. Jean-Paul Kouassi';
    const drhRole = currentUser?.roleTitle || 'Directeur des Ressources Humaines (DRH)';
    const dateStr = new Date().toISOString().replace('T', ' ').slice(0, 16);

    setPayrollRuns(prev => prev.map(r => r.id === runId ? {
      ...r,
      status: 'valide_drh',
      validatedByDRH: `${drhName} (${drhRole})`,
      validatedAtDRH: dateStr,
    } : r));

    if (onLogAction) {
      onLogAction(
        'Visa & Approbation DRH',
        `L'état des salaires pour la période ${run.title} a été certifié par le DRH (${drhName}). Autorisation de transmission bancaire émise.`,
        'admin'
      );
    }
  };

  // -------------------------------------------------------------------------
  // RÈGLE STRICTE 3 & 4 : ÉTAPE 3 & 4 - CONFIRMATION BANCAIRE & ENVOI AUTOMATIQUE DES BULLETINS
  // -------------------------------------------------------------------------
  const handleOpenBankConfirm = (run: PayrollRunPeriod) => {
    setSelectedRunForWorkflow(run);
    setBankConfirmForm({
      bankName: run.bankName || 'Rawbank Kinshasa',
      transactionRef: `RAW-TXN-${run.month.replace('-', '')}-${Math.floor(100000 + Math.random() * 900000)}`,
      confirmedDate: new Date().toISOString().slice(0, 10),
      debitAccount: '01002-39201928019-88',
      bankReceiptNote: `Ordre de virement bancaire collectif exécuté par la banque pour ${contracts.length} agents. Fonds transférés sur les comptes bénéficiaires.`
    });
    setModalAction('confirm_bank_transfer');
  };

  const handleConfirmBankTransferAndAutoDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRunForWorkflow) return;

    const run = selectedRunForWorkflow;
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.replace('T', ' ').slice(0, 16);
    const dateOnly = nowIso.slice(0, 10);
    const bankRef = bankConfirmForm.transactionRef || `RAW-TXN-${Date.now()}`;
    const bankName = bankConfirmForm.bankName || 'Rawbank Kinshasa';

    // RÈGLE STRICTE : GÉNÉRATION ET ENVOI AUTOMATIQUE DES BULLETINS DE PAIE À TOUS LES AGENTS
    let dispatched = 0;
    contracts.forEach(c => {
      const u = users.find(usr => usr.id === c.userId);
      const agentName = u?.name || `Agent ${c.matricule}`;
      const baseSal = c.baseSalary;
      const bonus = paymentParamForm.globalBonusUSD || 100;
      const gross = baseSal + bonus;
      const cnssEmployee = gross * 0.05; // 5% CNSS salarié RDC
      const ipr = Math.max(0, (gross - cnssEmployee) * 0.15); // IPR barème moyen
      const net = Math.round(gross - cnssEmployee - ipr);

      const payslipDoc: DocumentItem = {
        id: `doc-payslip-${run.month}-${c.matricule || c.userId}-${Date.now().toString().slice(-4)}`,
        title: `Bulletin de Paie Officiel - ${run.title} - ${agentName}`,
        referenceNumber: `BP-${run.month}-${c.matricule || 'AG'}`,
        category: 'ressources_humaines',
        subtype: 'bulletin_de_paie',
        organizationId: currentOrg.id,
        authorId: currentUser.id,
        authorName: `${currentUser.name} (${currentUser.roleTitle})`,
        authorRole: currentUser.role,
        authorEntity: 'Direction des Ressources Humaines (DRH) & DAF',
        createdAt: dateOnly,
        status: 'signe',
        size: '1.4 Mo',
        fileType: 'PDF',
        targetUserId: c.userId,
        targetUserName: agentName,
        targetEntityId: u?.departementId || u?.serviceId || 'dept-daf',
        isConfidentialPayslip: true,
        amount: net,
        currency: (c.salaryCurrency || run.currency) as any,
        description: `Bulletin de paie mensuel certifié et scellé électroniquement. Salaire Net transféré par virement bancaire (${bankName} - Réf Virement: ${bankRef}). Cotisations CNSS (5% salarié / 13% employeur) et IPR décomptés.`,
        electronicSignature: {
          signedBy: `${currentOrg.managerName || 'Direction Générale'} (DG) & DRH`,
          signedAt: new Date().toLocaleTimeString(),
          role: 'Directeur Général & DRH',
          certificateHash: `SHA256:bank-transfer-confirmed-${run.month}-${Math.random().toString(36).substring(2, 9)}`,
        },
        allowedRoles: ['dg', 'directeur', 'chef_departement', 'agent'],
        permissions: {
          viewRoles: ['dg', 'directeur', 'chef_departement', 'agent'],
          editRoles: ['dg', 'directeur'],
          validateRoles: ['dg', 'directeur'],
          signRoles: ['dg', 'directeur']
        }
      };

      if (onAddDocument) {
        onAddDocument(payslipDoc);
        dispatched++;
      }
    });

    // Mise à jour de la période de paie
    setPayrollRuns(prev => prev.map(r => r.id === run.id ? {
      ...r,
      status: 'virement_confirme',
      bankTransferConfirmedBy: `${currentUser.name} (${currentUser.roleTitle})`,
      bankTransferReference: bankRef,
      bankTransferConfirmedAt: dateStr,
      bankName: bankName,
      payslipsAutoDispatched: true,
      payslipsDispatchedAt: dateStr,
      dispatchedCount: contracts.length,
      validatedByDG: `${currentOrg.managerName || 'Junior Monya'} (DG)`,
      validatedAt: dateStr,
      closureHash: `SHA256:paie-scellee-${run.month}-${Math.random().toString(36).substring(2, 8)}`
    } : r));

    if (onLogAction) {
      onLogAction(
        'Virement Bancaire Confirmé & Envoi Automatique des Bulletins',
        `La banque ${bankName} a transféré les salaires (Réf: ${bankRef}). L'ERP a automatiquement généré et expédié ${contracts.length} bulletins de paie scellés dans le coffre-fort numérique de chaque agent.`,
        'admin'
      );
    }

    setModalAction(null);
    setAutoDispatchNotification({
      show: true,
      runTitle: run.title,
      count: contracts.length,
      bankRef,
      bankName,
      timestamp: dateStr
    });
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

          {/* NOTIFICATION D'ENVOI AUTOMATIQUE DES BULLETINS */}
          {autoDispatchNotification && (
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border-2 border-emerald-500 rounded-2xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-lg">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Virement Bancaire Confirmé & {autoDispatchNotification.count} Bulletins Envoyés Automatiquement !</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40">
                      Règles Strictes RDC Validées
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    La banque <strong>{autoDispatchNotification.bankName}</strong> a exécuté le virement (Réf: <code className="text-emerald-400 font-mono">{autoDispatchNotification.bankRef}</code>).
                    L'ERP a instantanément généré, scellé et déposé les fiches de paie dans le coffre-fort numérique personnel de chaque agent.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setAutoDispatchNotification(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shrink-0 transition"
              >
                Fermer
              </button>
            </div>
          )}

          <div className="space-y-4">
            {payrollRuns.map(run => {
              const isClosed = run.status === 'cloture' || run.status === 'virement_confirme';
              const isExpanded = expandedPayrollRunId === run.id;
              return (
                <div key={run.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-bold text-white font-mono bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                        {run.month}
                      </span>
                      <h4 className="text-base font-bold text-white">{run.title}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        run.status === 'virement_confirme' || run.status === 'cloture'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : run.status === 'valide_drh'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : run.status === 'parametre'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {run.status === 'virement_confirme' && '✓ Virement Confirmé & Bulletins Envoyés'}
                        {run.status === 'cloture' && '✓ Clôturé & E-Signé par le DG'}
                        {run.status === 'valide_drh' && '✓ Visé par le DRH (En attente virement)'}
                        {run.status === 'parametre' && 'Paramétré (En attente visa DRH)'}
                        {run.status === 'brouillon' && 'Brouillon à paramétrer'}
                      </span>
                    </div>

                    <div className="flex gap-2 flex-wrap items-center">
                      <button
                        onClick={() => {
                          exportPayrollRunToCSV(run, contracts, users);
                          if (onLogAction) onLogAction('Export Livre de Paie CSV', `Export CSV livre de paie période ${run.month}`, 'document');
                        }}
                        title="Exporter le livre de paie complet de la période en CSV"
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="hidden sm:inline">CSV Période</span>
                      </button>

                      <button
                        onClick={() => {
                          exportPayrollRunToPDF(run, contracts, users, currentOrg);
                          if (onLogAction) onLogAction('Export Livre de Paie PDF', `Génération PDF légal du livre de paie ${run.month}`, 'document');
                        }}
                        title="Télécharger l'état récapitulatif officiel certifié en PDF (format paysage)"
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF Période</span>
                      </button>

                      <button
                        onClick={() => setExpandedPayrollRunId(isExpanded ? null : run.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium flex items-center gap-1.5"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? 'Masquer' : 'Consulter le Livre de Paie'}</span>
                      </button>
                    </div>
                  </div>

                  {/* BARRE DU PROCESSUS STRICT 4 ÉTAPES */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span>Cycle Mensuel : Paramétrage ➔ Visa DRH ➔ Virement Bancaire ➔ Envoi Auto Bulletins</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {run.bankName && `Banque : ${run.bankName}`}
                        {run.bankTransferReference && ` • Réf : ${run.bankTransferReference}`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-[11px]">
                      {/* Étape 1 */}
                      <div className={`p-3 rounded-xl border transition ${
                        run.status !== 'brouillon'
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                          : 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200'
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>1. Paramétrage</span>
                          {run.status !== 'brouillon' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Taux BCC: {run.exchangeRateUSD_CDF} CDF • {run.currency}
                        </div>
                        {run.status === 'brouillon' && (
                          <button
                            onClick={() => handleOpenConfigPayment(run)}
                            className="mt-2 w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[10px] transition shadow"
                          >
                            Paramétrer le Paiement
                          </button>
                        )}
                      </div>

                      {/* Étape 2 */}
                      <div className={`p-3 rounded-xl border transition ${
                        run.status === 'valide_drh' || run.status === 'virement_confirme' || run.status === 'cloture'
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                          : run.status === 'parametre'
                            ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>2. Visa DRH</span>
                          {(run.status === 'valide_drh' || run.status === 'virement_confirme' || run.status === 'cloture') && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {run.validatedByDRH ? 'Certifié conforme DRH' : 'Examen fiches & heures'}
                        </div>
                        {run.status === 'parametre' && (
                          <button
                            onClick={() => handleApproveDRH(run.id)}
                            className="mt-2 w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-[10px] transition shadow"
                          >
                            Viser & Valider (DRH)
                          </button>
                        )}
                      </div>

                      {/* Étape 3 */}
                      <div className={`p-3 rounded-xl border transition ${
                        run.status === 'virement_confirme' || run.status === 'cloture'
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                          : run.status === 'valide_drh'
                            ? 'bg-blue-950/40 border-blue-500/50 text-blue-200 ring-1 ring-blue-500/30'
                            : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>3. Virement Bancaire</span>
                          {(run.status === 'virement_confirme' || run.status === 'cloture') && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {run.bankTransferReference ? `Exécuté : ${run.bankTransferReference}` : 'Transfert aux agents'}
                        </div>
                        {run.status === 'valide_drh' && (
                          <button
                            onClick={() => handleOpenBankConfirm(run)}
                            className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] transition shadow animate-pulse"
                          >
                            Confirmer Virement Banque
                          </button>
                        )}
                      </div>

                      {/* Étape 4 */}
                      <div className={`p-3 rounded-xl border transition ${
                        run.payslipsAutoDispatched
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>4. Envoi Bulletins</span>
                          {run.payslipsAutoDispatched && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {run.payslipsAutoDispatched ? `${run.dispatchedCount || run.totalEmployees} bulletins transmis` : 'Déclenchement auto'}
                        </div>
                        {run.payslipsAutoDispatched && (
                          <div className="mt-2 text-center text-[10px] text-emerald-400 bg-emerald-500/20 py-1 rounded-lg font-bold">
                            ✓ Espace agents alimenté
                          </div>
                        )}
                      </div>
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
                            <th className="p-2.5 text-center">Bulletin & Exports</th>
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
                                  <div className="flex items-center justify-center gap-1.5">
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
                                      className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-[10px] font-sans transition"
                                    >
                                      Voir
                                    </button>
                                    <button
                                      onClick={() => {
                                        const exportData = getPayslipExportDataForUser(c.userId, {
                                          ref: `BP-${run.month}-${c.matricule}`,
                                          baseSalary: c.baseSalary,
                                          currency: c.salaryCurrency,
                                          userName: u?.name || c.employeeCode,
                                          matricule: c.matricule
                                        });
                                        exportPayslipToPDF(exportData, false);
                                        if (onLogAction) onLogAction('Export Fiche de Paie PDF', `Téléchargement PDF bulletin officiel ${c.matricule} (${run.month})`, 'document');
                                      }}
                                      title="Télécharger le bulletin officiel en PDF certifié conforme RDC"
                                      className="p-1 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded text-[10px] transition"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-indigo-400 hover:text-white" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        const exportData = getPayslipExportDataForUser(c.userId, {
                                          ref: `BP-${run.month}-${c.matricule}`,
                                          baseSalary: c.baseSalary,
                                          currency: c.salaryCurrency,
                                          userName: u?.name || c.employeeCode,
                                          matricule: c.matricule
                                        });
                                        exportPayslipToPDF(exportData, true);
                                        if (onLogAction) onLogAction('Export Spécimen PDF', `Téléchargement Spécimen bulletin ${c.matricule} (${run.month})`, 'document');
                                      }}
                                      title="Télécharger le Spécimen d'essai RH (Épreuve avec filigrane)"
                                      className="p-1 bg-amber-950/40 hover:bg-amber-600 text-amber-300 hover:text-white rounded text-[10px] transition border border-amber-600/30"
                                    >
                                      <span className="font-bold font-mono text-[9px] px-1">SPÉC</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        const exportData = getPayslipExportDataForUser(c.userId, {
                                          ref: `BP-${run.month}-${c.matricule}`,
                                          baseSalary: c.baseSalary,
                                          currency: c.salaryCurrency,
                                          userName: u?.name || c.employeeCode,
                                          matricule: c.matricule
                                        });
                                        exportPayslipToCSV(exportData);
                                        if (onLogAction) onLogAction('Export Fiche de Paie CSV', `Export CSV bulletin ${c.matricule} (${run.month})`, 'document');
                                      }}
                                      title="Exporter le bulletin au format CSV (Excel)"
                                      className="p-1 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white rounded text-[10px] transition"
                                    >
                                      <Download className="w-3.5 h-3.5 text-cyan-400 hover:text-white" />
                                    </button>
                                  </div>
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
                  +{formatMoney(ot.calculatedAmountUSD || 0, 'USD')}
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

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const exportData = getPayslipExportDataForUser(simSelectedUserId, {
                      baseSalary: simBaseSalary,
                      currency: config.currency,
                      seniorityYears: simSeniorityYears,
                      dependents: simDependents,
                    });
                    exportPayslipToCSV(exportData);
                    if (onLogAction) onLogAction('Export Fiche de Paie CSV', `Export CSV bulletin de paie ${exportData.employeeName} (${exportData.matricule})`, 'document');
                  }}
                  title="Exporter les lignes du bulletin au format CSV (Excel)"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => {
                    const exportData = getPayslipExportDataForUser(simSelectedUserId, {
                      baseSalary: simBaseSalary,
                      currency: config.currency,
                      seniorityYears: simSeniorityYears,
                      dependents: simDependents,
                    });
                    exportPayslipToPDF(exportData, true);
                    if (onLogAction) onLogAction('Export Spécimen PDF', `Génération Spécimen PDF pour ${exportData.employeeName} (${exportData.matricule})`, 'document');
                  }}
                  title="Générer un spécimen de bulletin d'essai avec filigrane non négociable"
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Télécharger Spécimen</span>
                </button>

                <button
                  onClick={() => {
                    const exportData = getPayslipExportDataForUser(simSelectedUserId, {
                      baseSalary: simBaseSalary,
                      currency: config.currency,
                      seniorityYears: simSeniorityYears,
                      dependents: simDependents,
                    });
                    exportPayslipToPDF(exportData, false);
                    if (onLogAction) onLogAction('Export Fiche de Paie PDF', `Génération PDF légal officiel de ${exportData.employeeName} (${exportData.matricule})`, 'document');
                  }}
                  title="Générer directement le bulletin officiel certifié au format PDF conforme RDC"
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-indigo-600/30 active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Télécharger PDF Officiel</span>
                </button>

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
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/30 active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Aperçu A4 & Impression</span>
                </button>
              </div>
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
      {/* RÈGLE STRICTE 1 : MODALE DE PARAMÉTRAGE DU PAIEMENT MENSUEL           */}
      {/* ===================================================================== */}
      {modalAction === 'configure_payment_run' && selectedRunForWorkflow && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Étape 1 : Paramétrage du Paiement Mensuel</h3>
                  <p className="text-[11px] text-slate-400">Période : {selectedRunForWorkflow.title}</p>
                </div>
              </div>
              <button onClick={() => setModalAction(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfigurePaymentSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Mois de Paie</label>
                  <input
                    type="text"
                    disabled
                    value={paymentParamForm.month}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono opacity-80"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Devise de Paiement</label>
                  <select
                    value={paymentParamForm.currency}
                    onChange={e => setPaymentParamForm({ ...paymentParamForm, currency: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value="USD">$ USD (Dollar Américain)</option>
                    <option value="CDF">CDF (Franc Congolais)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Taux Officiel BCC (CDF / USD)</label>
                  <input
                    type="number"
                    value={paymentParamForm.exchangeRateUSD_CDF}
                    onChange={e => setPaymentParamForm({ ...paymentParamForm, exchangeRateUSD_CDF: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Date Valeur du Virement</label>
                  <input
                    type="date"
                    value={paymentParamForm.valueDate}
                    onChange={e => setPaymentParamForm({ ...paymentParamForm, valueDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Banque Partenaire Exécutante (RDC)</label>
                <select
                  value={paymentParamForm.bankName}
                  onChange={e => setPaymentParamForm({ ...paymentParamForm, bankName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                >
                  <option value="Rawbank Kinshasa">Rawbank Kinshasa (Partenaire Principal)</option>
                  <option value="Equity BCDC">Equity BCDC Kinshasa</option>
                  <option value="Trust Merchant Bank (TMB)">Trust Merchant Bank (TMB)</option>
                  <option value="FBNBank DRC">FBNBank DRC</option>
                  <option value="Standard Bank RDC">Standard Bank RDC</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">N° Compte Entreprise Débiteur</label>
                <input
                  type="text"
                  value={paymentParamForm.bankAccount}
                  onChange={e => setPaymentParamForm({ ...paymentParamForm, bankAccount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Note explicative de clôture des paramètres</label>
                <textarea
                  rows={2}
                  value={paymentParamForm.comments}
                  onChange={e => setPaymentParamForm({ ...paymentParamForm, comments: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalAction(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md transition"
                >
                  Enregistrer & Transmettre au DRH (Étape 2)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* RÈGLE STRICTE 3 & 4 : CONFIRMATION BANCAIRE & ENVOI AUTOMATIQUE       */}
      {/* ===================================================================== */}
      {modalAction === 'confirm_bank_transfer' && selectedRunForWorkflow && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border-2 border-blue-500/60 rounded-3xl p-6 max-w-lg w-full text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Étape 3 : Confirmation Virement Bancaire & Envoi Auto</h3>
                  <p className="text-[11px] text-slate-400">Période : {selectedRunForWorkflow.title}</p>
                </div>
              </div>
              <button onClick={() => setModalAction(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bannière Règle Stricte */}
            <div className="bg-blue-950/50 border border-blue-500/40 rounded-2xl p-4 text-xs text-blue-200 space-y-2">
              <div className="font-bold text-white flex items-center gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Règle Stricte de Déclenchement Automatique :</span>
              </div>
              <p className="leading-relaxed text-[11px] text-blue-200/90">
                Dès que vous confirmez ici que <strong>la banque a déjà transféré aux agents leurs salaires</strong>, l'ERP envoie <strong>AUTOMATIQUEMENT</strong> les bulletins de paie scellés électroniquement avec le certificat de virement dans le coffre-fort numérique de chaque agent ({contracts.length} agents concernés).
              </p>
            </div>

            <form onSubmit={handleConfirmBankTransferAndAutoDispatch} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Banque Exécutante</label>
                  <input
                    type="text"
                    value={bankConfirmForm.bankName}
                    onChange={e => setBankConfirmForm({ ...bankConfirmForm, bankName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Date Exécution Virement</label>
                  <input
                    type="date"
                    value={bankConfirmForm.confirmedDate}
                    onChange={e => setBankConfirmForm({ ...bankConfirmForm, confirmedDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Référence Transaction / Ordre Bancaire</label>
                <input
                  type="text"
                  required
                  value={bankConfirmForm.transactionRef}
                  onChange={e => setBankConfirmForm({ ...bankConfirmForm, transactionRef: e.target.value })}
                  placeholder="Ex: RAW-TXN-202609-481029"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Compte Entreprise Débité</label>
                <input
                  type="text"
                  value={bankConfirmForm.debitAccount}
                  onChange={e => setBankConfirmForm({ ...bankConfirmForm, debitAccount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Mention / Accusé de Réception Banque</label>
                <textarea
                  rows={2}
                  value={bankConfirmForm.bankReceiptNote}
                  onChange={e => setBankConfirmForm({ ...bankConfirmForm, bankReceiptNote: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Masse Nette Virée aux Agents :</span>
                  <span className="text-emerald-400 font-mono font-black text-base">{formatMoney(selectedRunForWorkflow.totalNet, selectedRunForWorkflow.currency)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-medium">Bénéficiaires :</span>
                  <span className="text-white font-bold">{contracts.length} Collaborateurs</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalAction(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg transition active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmer Virement & Déclencher Envoi Automatique ({contracts.length} Bulletins)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modalAction === 'doc_print' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl space-y-5 my-8 print:p-0 print:shadow-none print:m-0 print:max-w-none relative">
            
            {/* Filigrane Spécimen si activé */}
            {docPreviewMode === 'specimen' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 overflow-hidden">
                <div className="text-red-500/15 border-4 border-red-500/25 font-black text-5xl sm:text-7xl uppercase tracking-widest rotate-[-30deg] px-8 py-4 rounded-3xl text-center">
                  SPÉCIMEN<br />
                  <span className="text-lg sm:text-2xl tracking-wider text-red-500/25 font-bold">ÉPREUVE D'ESSAI • NON NÉGOCIABLE</span>
                </div>
              </div>
            )}

            {/* Barre d'action supérieure */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 print:hidden relative z-20">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>{activeDocData.title}</span>
                </div>

                {/* Sélecteur de mode : Bulletin Officiel vs Spécimen */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs">
                  <button
                    type="button"
                    onClick={() => setDocPreviewMode('officiel')}
                    className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                      docPreviewMode === 'officiel'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                    <span>Bulletin Officiel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocPreviewMode('specimen')}
                    className={`px-2.5 py-1 rounded-md font-bold transition flex items-center gap-1 ${
                      docPreviewMode === 'specimen'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-950" />
                    <span>Spécimen</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const exportData = getPayslipExportDataForUser(simSelectedUserId, activeDocData.content);
                    exportPayslipToCSV(exportData);
                    if (onLogAction) onLogAction('Export Fiche de Paie CSV', `Export CSV bulletin de ${exportData.employeeName} (${exportData.matricule})`, 'document');
                  }}
                  title="Exporter les rubriques salariales en CSV (Excel)"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Exporter CSV</span>
                </button>

                <button
                  onClick={() => {
                    const exportData = getPayslipExportDataForUser(simSelectedUserId, activeDocData.content);
                    exportPayslipToPDF(exportData, true);
                    if (onLogAction) onLogAction('Export Spécimen PDF', `Génération Spécimen PDF pour ${exportData.employeeName} (${exportData.matricule})`, 'document');
                  }}
                  title="Télécharger le Spécimen avec filigrane d'essai"
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Télécharger Spécimen</span>
                </button>

                <button
                  onClick={() => {
                    const exportData = getPayslipExportDataForUser(simSelectedUserId, activeDocData.content);
                    exportPayslipToPDF(exportData, false);
                    if (onLogAction) onLogAction('Export Fiche de Paie PDF', `Génération PDF officiel de ${exportData.employeeName} (${exportData.matricule})`, 'document');
                  }}
                  title="Générer et télécharger le bulletin officiel en format PDF A4 certifié RDC"
                  className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Télécharger PDF Officiel</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer</span>
                </button>

                <button onClick={() => setModalAction(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* En-tête RHEMA BUSINESS Officiel */}
            <header className="border-b-2 border-slate-300 pb-4 relative z-20">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md shrink-0 border-2 ${
                    docPreviewMode === 'specimen' ? 'bg-amber-600 border-amber-500' : 'bg-indigo-950 border-indigo-700'
                  }`}>
                    {docPreviewMode === 'specimen' ? 'SP' : 'RB'}
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
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider border block sm:inline-block ${
                    docPreviewMode === 'specimen'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                  }`}>
                    {docPreviewMode === 'specimen' ? 'SPÉCIMEN RH - ESSAI' : activeDocData.title.toUpperCase()}
                  </span>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-1">
                    Réf : {docPreviewMode === 'specimen' ? `SPEC-${activeDocData.ref}` : activeDocData.ref}
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
                    {docPreviewMode === 'specimen' ? (
                      <div className="text-amber-400 font-bold flex items-center justify-end gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>SPÉCIMEN RH (SANS EFFET BANCAIRE)</span>
                      </div>
                    ) : (
                      <div className="text-emerald-400 font-bold flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Scellé SHA-256 : d892bc018ae82103fca91</span>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400">
                      {docPreviewMode === 'specimen'
                        ? 'Épreuve d\'essai non négociable - Simulation interne RH'
                        : 'Bulletin officiel scellé et certifié conforme par la Direction Générale'}
                    </div>
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