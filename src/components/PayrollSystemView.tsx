// src/components/PayrollSystemView.tsx
// Module Intégral Paie & RH RDC - Conforme Code du Travail RDC, CNSS, INPP, ONEM, IPR
// 100% Autonome et Identique à l'IMAGE 1 (Dark Theme Slate-900 / Slate-950, Devises $ USD et CDF, Taux BCC)

import React, { useState, useMemo, useEffect } from 'react';
import { demoSeed, usePersistentState } from '../hooks/usePersistentState';
import { isPayrollStaff } from '../utils/rbac';
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
  createStandardPayrollSystem
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
  type PayslipExportData,
  type PayrollBookRow
} from '../utils/exportUtils';
import {
  computePayslip,
  computePayslipForContract,
  convert,
  currentPayMonth,
  hourlyRateOf,
  isContractActiveForMonth,
  lastDayOfMonth,
  nextPayMonth,
  overtimeAmountFor,
  payMonthLabel,
  roundMoney,
} from '../lib/payroll';
import { buildPayslipExport, withIntegrityHash } from '../lib/payslipDocument';
import { contentHash, shortHash } from '../lib/integrity';
import { PayslipTable, formatPayslipMoney } from './payroll/PayslipTable';
import { DEMO_MODE } from '../config';
import { isValidRate, rateStatusLabel, useExchangeRate } from '../lib/exchangeRate';
import { addDaysLocal, todayLocal, workingDaysBetween } from '../lib/dates';
import { newId } from '../utils/id';
import { cdfToUsd, formatCDF, formatUSD, parseAmount, usdToCdf } from '../lib/money';

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
    registrationNumber: '',
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
  // Gestion de la paie : même règle que le serveur (shared/access.mjs).
  const isHR = isPayrollStaff(currentUser);


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
  // Taux USD/CDF partagé par toute l'application (paie, factures, bons de commande, rapports).
  const [rateSetting, setRateSetting] = useExchangeRate();
  const exchangeRate = rateSetting.rate;
  const [rateDraft, setRateDraft] = useState<string>(String(rateSetting.rate));
  useEffect(() => setRateDraft(String(rateSetting.rate)), [rateSetting.rate]);
  // Reprise de l'ancien réglage (« payroll.exchangeRate », un nombre seul) s'il avait été modifié.
  const [legacyRate] = usePersistentState<number | null>('payroll.exchangeRate', null);
  useEffect(() => {
    if (isHR && rateSetting.date === null && isValidRate(legacyRate) && legacyRate !== rateSetting.rate) {
      setRateSetting({ rate: legacyRate, date: todayLocal(), updatedBy: 'Reprise du réglage de paie' });
    }
  }, [legacyRate]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveRate = () => {
    const n = parseAmount(rateDraft);
    if (!isValidRate(n)) { setRateDraft(String(rateSetting.rate)); return; }
    setRateSetting({ rate: n, date: todayLocal(), updatedBy: currentUser.name });
  };
  const [expandedPayrollRunId, setExpandedPayrollRunId] = useState<string | null>(null);

  // =========================================================================
  // DONNÉES DU PERSONNEL & HISTORIQUE DES ACTIONS RH
  // =========================================================================
  const [localContracts, setLocalContracts] = usePersistentState<EmployeeContract[]>('payroll.contracts', () => demoSeed(initialContracts));
  const contracts = sharedContracts ?? localContracts;
  const setContracts = onContractsChange ?? setLocalContracts;
  const [leaves, setLeaves] = usePersistentState<LeaveRequest[]>('payroll.leaves', () => demoSeed(initialLeaves));
  const [advances, setAdvances] = usePersistentState<SalaryAdvanceRequest[]>('payroll.advances', () => demoSeed(initialAdvances));
  const [overtimeRecords, setOvertimeRecords] = usePersistentState<OvertimeRecord[]>('payroll.overtime', () => demoSeed(initialOvertimes));
  const [disciplinaryActions, setDisciplinaryActions] = usePersistentState<DisciplinaryAction[]>('payroll.disciplinary', () => demoSeed(initialDisciplinaryActions));

  // Périodes de paie (vide au départ en mode réel ; une période de démonstration sinon).
  const [payrollRuns, setPayrollRuns] = usePersistentState<PayrollRunPeriod[]>('payroll.runs', () =>
    DEMO_MODE
      ? [{
          id: `run-${currentPayMonth()}`,
          month: currentPayMonth(),
          title: `Paie ${payMonthLabel(currentPayMonth())}`,
          currency: 'USD',
          exchangeRateUSD_CDF: exchangeRate,
          status: 'brouillon',
          totalGross: 0,
          totalNet: 0,
          totalEmployerCharges: 0,
          totalEmployees: 0,
        }]
      : []
  );

  // =========================================================================
  // ÉTATS DES MODALES D'ACTIONS RH & WORKFLOW MENSUEL STRICT
  // =========================================================================
  const [modalAction, setModalAction] = useState<null | 'new_contract' | 'new_leave' | 'new_advance' | 'new_overtime' | 'new_discipline' | 'doc_print' | 'configure_payment_run' | 'confirm_bank_transfer'>(null);
  const [docPreviewMode, setDocPreviewMode] = useState<'officiel' | 'specimen'>('officiel');
  const [selectedRunForWorkflow, setSelectedRunForWorkflow] = useState<PayrollRunPeriod | null>(null);

  // Formulaire Étape 1 : Paramétrage du Paiement Mensuel
  const [paymentParamForm, setPaymentParamForm] = useState({
    month: currentPayMonth(),
    exchangeRateUSD_CDF: exchangeRate,
    bankName: '',
    bankAccount: '',
    valueDate: lastDayOfMonth(currentPayMonth()),
    globalBonusUSD: 0,
    currency: 'USD' as 'USD' | 'CDF',
    comments: 'Paie mensuelle conforme au barème légal et convention collective RHEMA BUSINESS.'
  });

  // Formulaire Étape 3 : Confirmation du Virement Bancaire
  const [bankConfirmForm, setBankConfirmForm] = useState({
    bankName: '',
    transactionRef: '',
    confirmedDate: todayLocal(),
    debitAccount: '',
    bankReceiptNote: ''
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
    ref: '',
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
    matricule: '',
    baseSalary: 0,
    salaryCurrency: 'USD' as 'USD' | 'CDF',
    categoryPro: '',
    cnssNumber: '',
    bankName: '',
    paymentMode: 'virement' as const
  });

  const [leaveForm, setLeaveForm] = useState({
    userId: users[0]?.id || '',
    type: 'conge_annuel' as const,
    startDate: todayLocal(),
    endDate: addDaysLocal(7),
    reason: 'Congé annuel payé au titre de l\'exercice'
  });

  const leaveDays = workingDaysBetween(leaveForm.startDate, leaveForm.endDate);

  const [advanceForm, setAdvanceForm] = useState({
    userId: users[0]?.id || '',
    amount: 150,
    currency: 'USD' as 'USD' | 'CDF',
    repaymentMonth: nextPayMonth(currentPayMonth()),
    reason: 'Frais de scolarité / urgence médicale'
  });

  const [overtimeForm, setOvertimeForm] = useState({
    userId: users[0]?.id || '',
    dayHours: 4,
    nightHours: 2,
    holidayHours: 0,
    month: currentPayMonth(),
    reason: ''
  });

  const [disciplineForm, setDisciplineForm] = useState({
    userId: users[0]?.id || '',
    type: 'avertissement' as const,
    title: 'Avertissement Formel - Manquement aux horaires',
    reason: 'Absence non justifiée lors de la vacation technique'
  });

  const simulation = useMemo(() => {
    return calculatePayslipSimulation(config, simBaseSalary, simSeniorityYears, simDependents, exchangeRate);
  }, [config, simBaseSalary, simSeniorityYears, simDependents, exchangeRate]);

  /** Calcul détaillé du simulateur (même moteur que les bulletins officiels). */
  const simComputation = useMemo(() => computePayslip({
    config,
    baseSalary: simBaseSalary,
    currency: config.currency === 'CDF' ? 'CDF' : 'USD',
    exchangeRate,
    seniorityYears: simSeniorityYears,
    dependents: simDependents,
  }), [config, simBaseSalary, simSeniorityYears, simDependents, exchangeRate]);

  const simUser = users.find(u => u.id === simSelectedUserId);
  const simContract = contracts.find(c => c.userId === simSelectedUserId);
  const simulationExport: PayslipExportData = buildPayslipExport(simComputation, {
    org: currentOrg,
    month: currentPayMonth(),
    ref: `SIM-${currentPayMonth()}-${simContract?.matricule || simUser?.matricule || 'X'}`,
    user: simUser,
    contract: simContract,
    dependents: simDependents,
  });

  /** Bulletins d'une période : contrats actifs ce mois-là, calculés avec la configuration. */
  const computeRunRows = (run: PayrollRunPeriod): PayrollBookRow[] => {
    const rate = run.exchangeRateUSD_CDF || exchangeRate;
    return contracts
      .filter(c => isContractActiveForMonth(c, run.month))
      .map(c => {
        const bonus = run.extraBonus
          ? convert(run.extraBonus, run.currency, c.salaryCurrency === 'CDF' ? 'CDF' : 'USD', rate)
          : 0;
        return {
          contract: c,
          user: users.find(u => u.id === c.userId),
          payslip: computePayslipForContract(c, { config, month: run.month, exchangeRate: rate, overtimeRecords, advances, extraBonus: bonus }),
        };
      });
  };

  /** Totaux d'une période dans la devise de la période. */
  const computeRunTotals = (run: PayrollRunPeriod, rows: PayrollBookRow[] = computeRunRows(run)) => {
    const rate = run.exchangeRateUSD_CDF || exchangeRate;
    const to = (v: number, from: string) => convert(v, from === 'CDF' ? 'CDF' : 'USD', run.currency, rate);
    const r = (v: number) => roundMoney(v, run.currency);
    return {
      totalEmployees: rows.length,
      totalGross: r(rows.reduce((s, x) => s + to(x.payslip.grossSalary, x.payslip.currency), 0)),
      totalNet: r(rows.reduce((s, x) => s + to(x.payslip.netSalary, x.payslip.currency), 0)),
      totalEmployerCharges: r(rows.reduce((s, x) => s + to(x.payslip.totalEmployerContributions, x.payslip.currency), 0)),
    };
  };

  /** Données d'un bulletin officiel (aperçu, PDF, CSV) pour un contrat et une période. */
  const buildRunPayslip = (run: PayrollRunPeriod, row: PayrollBookRow): PayslipExportData =>
    buildPayslipExport(row.payslip as ReturnType<typeof computePayslipForContract>, {
      org: currentOrg,
      month: run.month,
      ref: `BP-${run.month}-${row.contract.matricule || row.contract.userId}`,
      user: row.user,
      contract: row.contract,
    });

  /** Ouvre l'aperçu A4 d'un bulletin. */
  const openPayslipPreview = (data: PayslipExportData, title = 'Bulletin de Paie Individuel') => {
    setActiveDocData({ docType: 'bulletin', title, ref: data.ref, content: { payslip: data } });
    setModalAction('doc_print');
  };

  /** Téléchargement PDF / CSV d'un bulletin, avec empreinte SHA-256 réelle du contenu. */
  const downloadPayslip = async (data: PayslipExportData, format: 'pdf' | 'csv' | 'specimen') => {
    try {
      const sealed = format === 'specimen' ? data : await withIntegrityHash(data);
      if (format === 'csv') exportPayslipToCSV(sealed);
      else exportPayslipToPDF(sealed, format === 'specimen');
      onLogAction?.(
        format === 'specimen' ? 'Export Spécimen PDF' : `Export Fiche de Paie ${format.toUpperCase()}`,
        `Bulletin ${data.ref} de ${data.employeeName}${sealed.sha256Hash ? ` (empreinte ${shortHash(sealed.sha256Hash)})` : ''}`,
        'document'
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Export impossible.');
    }
  };

  const handleSave = () => {
    const updated: PayrollSystemConfig = {
      ...config,
      isStandardTemplate: false,
      lastModifiedBy: `${currentUser?.name || 'Dr. Amadou Diallo'} (${currentUser?.roleTitle || 'PDG'})`,
      lastModifiedAt: todayLocal(),
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

  const handleSignPayroll = async (runId: string) => {
    const run = payrollRuns.find(r => r.id === runId);
    if (!run || currentUser?.role !== 'dg') return;
    const rows = computeRunRows(run);
    const hash = await contentHash({ month: run.month, rows: rows.map(x => ({ matricule: x.contract.matricule, ...x.payslip })) });
    setPayrollRuns(prev => prev.map(r => r.id === runId ? {
      ...r,
      ...computeRunTotals(run, rows),
      status: 'cloture',
      validatedByDG: `${currentUser.name} (${currentUser.roleTitle})`,
      validatedAt: new Date().toLocaleString('fr-FR'),
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
      bankName: run.bankName || '',
      bankAccount: '',
      valueDate: lastDayOfMonth(run.month),
      globalBonusUSD: run.extraBonus || 0,
      currency: run.currency,
      comments: `Paramètres de paiement officiels pour la période ${run.title}.`
    });
    setModalAction('configure_payment_run');
  };

  const handleConfigurePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRunForWorkflow || !isHR) return;

    setPayrollRuns(prev => prev.map(r => r.id === selectedRunForWorkflow.id ? {
      ...r,
      status: 'parametre',
      currency: paymentParamForm.currency,
      exchangeRateUSD_CDF: paymentParamForm.exchangeRateUSD_CDF,
      bankName: paymentParamForm.bankName,
      extraBonus: Math.max(0, Number(paymentParamForm.globalBonusUSD) || 0),
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

    if (!isHR) return;
    const drhName = currentUser.name;
    const drhRole = currentUser.roleTitle;
    const dateStr = new Date().toLocaleString('fr-FR');

    setPayrollRuns(prev => prev.map(r => r.id === runId ? {
      ...r,
      ...computeRunTotals(run),
      status: 'valide_drh',
      validatedByDRH: `${drhName} (${drhRole})`,
      validatedByDRHUserId: currentUser.id,
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
      bankName: run.bankName || '',
      transactionRef: '',
      confirmedDate: todayLocal(),
      debitAccount: '',
      bankReceiptNote: ''
    });
    setModalAction('confirm_bank_transfer');
  };

  const handleConfirmBankTransferAndAutoDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRunForWorkflow || !isHR) return;

    const run = selectedRunForWorkflow;
    const bankRef = bankConfirmForm.transactionRef.trim();
    const bankName = bankConfirmForm.bankName.trim();
    if (!bankRef || !bankName) {
      window.alert('Indiquez la banque et la référence du virement figurant sur l\'avis bancaire.');
      return;
    }
    const dateStr = new Date().toLocaleString('fr-FR');
    const dateOnly = todayLocal();

    // Bulletins calculés avec la configuration, les heures sup et les avances du mois de la période.
    const rows = computeRunRows(run);
    const totals = computeRunTotals(run, rows);
    let dispatched = 0;
    for (const row of rows) {
      const c = row.contract;
      const agentName = row.user?.name || `Agent ${c.matricule}`;
      const data = await withIntegrityHash(buildRunPayslip(run, row));
      const payslipDoc: DocumentItem = {
        id: `doc-payslip-${run.month}-${c.matricule || c.userId}`,
        title: `Bulletin de paie ${payMonthLabel(run.month)} - ${agentName}`,
        referenceNumber: data.ref,
        category: 'ressources_humaines',
        subtype: 'bulletin_de_paie',
        organizationId: currentOrg.id,
        authorId: currentUser.id,
        authorName: `${currentUser.name} (${currentUser.roleTitle})`,
        authorRole: currentUser.role,
        authorEntity: currentUser.departmentName || 'Ressources Humaines',
        createdAt: dateOnly,
        status: 'approuve',
        size: '—',
        fileType: 'PDF',
        targetUserId: c.userId,
        targetUserName: agentName,
        targetEntityId: row.user?.serviceId || row.user?.departementId,
        isConfidentialPayslip: true,
        amount: data.netSalary,
        currency: data.currency as 'USD' | 'CDF',
        description: `Net à payer : ${formatPayslipMoney(data.netSalary, data.currency)}. Virement ${bankName} (réf. ${bankRef}). Empreinte du contenu : ${shortHash(data.sha256Hash)}.`,
        payslipData: data,
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
    }

    const closureHash = await contentHash({ month: run.month, rows: rows.map(x => ({ matricule: x.contract.matricule, ...x.payslip })) });
    setPayrollRuns(prev => prev.map(r => r.id === run.id ? {
      ...r,
      ...totals,
      status: 'virement_confirme',
      bankTransferConfirmedBy: `${currentUser.name} (${currentUser.roleTitle})`,
      bankTransferConfirmedByUserId: currentUser.id,
      bankTransferReference: bankRef,
      bankTransferConfirmedAt: dateStr,
      bankName: bankName,
      payslipsAutoDispatched: dispatched > 0,
      payslipsDispatchedAt: dateStr,
      dispatchedCount: dispatched,
      closureHash
    } : r));

    if (onLogAction) {
      onLogAction(
        'Virement Bancaire Confirmé & Envoi des Bulletins',
        `Virement ${bankName} (réf. ${bankRef}) confirmé par ${currentUser.name}. ${dispatched} bulletin(s) de ${payMonthLabel(run.month)} publié(s). Net total : ${formatPayslipMoney(totals.totalNet, run.currency)}. Empreinte de la période : ${shortHash(closureHash)}.`,
        'admin'
      );
    }

    setModalAction(null);
    setAutoDispatchNotification({
      show: true,
      runTitle: run.title,
      count: dispatched,
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
          { id: 'overview', label: '1. Paramètres & Taux', icon: Sliders },
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
                  Taux de change (1 USD en CDF)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={rateDraft}
                      disabled={!isHR}
                      onChange={(e) => setRateDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRate(); }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono font-bold disabled:opacity-60"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 text-xs font-mono">CDF</span>
                  </div>
                  {isHR && (
                    <button
                      type="button"
                      onClick={saveRate}
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                    >
                      Enregistrer
                    </button>
                  )}
                </div>
                <p className={`text-[10px] mt-1 ${rateSetting.date ? 'text-slate-400' : 'text-amber-300'}`}>
                  {rateStatusLabel(rateSetting)}{rateSetting.updatedBy ? ` • saisi par ${rateSetting.updatedBy}` : ''}. Utilisé partout : paie, factures, bons de commande et rapports.
                  Reportez le taux du jour publié par la Banque Centrale du Congo.
                </p>
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
              <p className="text-[11px] text-slate-400 font-mono">Horodatage : {todayLocal()}</p>
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
                if (!isHR) return;
                // Mois suivant la dernière période ouverte, ou mois en cours s'il n'y en a pas.
                const latest = [...payrollRuns].map(r => r.month).sort().pop();
                const next = latest ? nextPayMonth(latest) : currentPayMonth();
                if (payrollRuns.some(r => r.month === next)) return;
                const draft: PayrollRunPeriod = {
                  id: `run-${next}`,
                  month: next,
                  title: `Paie ${payMonthLabel(next)}`,
                  currency: config.currency as 'USD' | 'CDF',
                  exchangeRateUSD_CDF: exchangeRate,
                  status: 'brouillon',
                  totalGross: 0,
                  totalNet: 0,
                  totalEmployerCharges: 0,
                  totalEmployees: 0
                };
                setPayrollRuns([{ ...draft, ...computeRunTotals(draft) }, ...payrollRuns]);
                onLogAction?.('Ouverture Période de Paie', `Période ${payMonthLabel(next)} ouverte par ${currentUser.name}.`, 'admin');
              }}
              disabled={!isHR}
              title={isHR ? undefined : 'Réservé à la Direction et aux Ressources Humaines'}
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
            {payrollRuns.length === 0 && (
              <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-8 text-center text-sm text-slate-400">
                Aucune période de paie. Cliquez sur « Ouvrir une Période » pour préparer la paie de {payMonthLabel(currentPayMonth())}.
              </div>
            )}
            {payrollRuns.map(run => {
              const isClosed = run.status === 'cloture' || run.status === 'virement_confirme';
              const isExpanded = expandedPayrollRunId === run.id;
              // Période close : totaux figés au moment du virement ; sinon calcul en direct.
              const runRows = computeRunRows(run);
              const liveTotals = isClosed ? run : { ...run, ...computeRunTotals(run, runRows) };
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
                        {run.status === 'cloture' && `✓ Clôturé par ${run.validatedByDG || 'la Direction'}`}
                        {run.status === 'en_validation' && 'En validation'}
                        {run.status === 'valide_drh' && '✓ Visé par le DRH (En attente virement)'}
                        {run.status === 'parametre' && 'Paramétré (En attente visa DRH)'}
                        {run.status === 'brouillon' && 'Brouillon à paramétrer'}
                      </span>
                    </div>

                    <div className="flex gap-2 flex-wrap items-center">
                      <button
                        onClick={() => {
                          exportPayrollRunToCSV(run, runRows);
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
                          exportPayrollRunToPDF(run, runRows, currentOrg);
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
                          Taux : 1 $ = {run.exchangeRateUSD_CDF} CDF • {run.currency}
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
                      <span className="text-lg font-bold text-white mt-1 block font-mono">{liveTotals.totalEmployees} agents</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Brut Global</span>
                      <span className="text-lg font-bold text-indigo-400 mt-1 block font-mono">{formatMoney(liveTotals.totalGross, run.currency)}</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Net à Virer</span>
                      <span className="text-lg font-bold text-emerald-400 mt-1 block font-mono">{formatMoney(liveTotals.totalNet, run.currency)}</span>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Charges Patronales</span>
                      <span className="text-lg font-bold text-amber-400 mt-1 block font-mono">{formatMoney(liveTotals.totalEmployerCharges, run.currency)}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-800 overflow-x-auto">
                      <table className="w-full text-[11px] text-left border border-slate-800 rounded-xl">
                        <thead className="bg-slate-950 text-slate-400">
                          <tr>
                            <th className="p-2.5">Matricule & Agent</th>
                            <th className="p-2.5 text-right">Base</th>
                            <th className="p-2.5 text-right">Primes & variables</th>
                            <th className="p-2.5 text-right">Brut</th>
                            <th className="p-2.5 text-right">Cotisations</th>
                            <th className="p-2.5 text-right">Impôt</th>
                            <th className="p-2.5 text-right font-bold text-emerald-400">Net à Virer</th>
                            <th className="p-2.5 text-center">Bulletin & Exports</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {runRows.map(row => {
                            const c = row.contract;
                            const u = row.user;
                            const p = row.payslip;
                            const payslipData = buildRunPayslip(run, row);
                            return (
                              <tr key={c.id}>
                                <td className="p-2.5 font-sans text-white">{u?.name || c.employeeCode} ({c.matricule})</td>
                                <td className="p-2.5 text-right">{formatMoney(p.baseSalary, p.currency)}</td>
                                <td className="p-2.5 text-right">+{formatMoney(p.grossSalary - p.baseSalary, p.currency)}</td>
                                <td className="p-2.5 text-right font-bold text-indigo-300">{formatMoney(p.grossSalary, p.currency)}</td>
                                <td className="p-2.5 text-right text-amber-400">-{formatMoney(p.totalEmployeeContributions, p.currency)}</td>
                                <td className="p-2.5 text-right text-rose-400">-{formatMoney(p.totalTaxes, p.currency)}</td>
                                <td className="p-2.5 text-right font-bold text-emerald-400">{formatMoney(p.netSalary, p.currency)}</td>
                                <td className="p-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => openPayslipPreview(payslipData)}
                                      className="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded text-[10px] font-sans transition"
                                    >
                                      Voir
                                    </button>
                                    <button
                                      onClick={() => void downloadPayslip(payslipData, 'pdf')}
                                      title="Télécharger le bulletin en PDF"
                                      className="p-1 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded text-[10px] transition"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-indigo-400 hover:text-white" />
                                    </button>
                                    <button
                                      onClick={() => void downloadPayslip(payslipData, 'specimen')}
                                      title="Télécharger le Spécimen d'essai RH (Épreuve avec filigrane)"
                                      className="p-1 bg-amber-950/40 hover:bg-amber-600 text-amber-300 hover:text-white rounded text-[10px] transition border border-amber-600/30"
                                    >
                                      <span className="font-bold font-mono text-[9px] px-1">SPÉC</span>
                                    </button>
                                    <button
                                      onClick={() => void downloadPayslip(payslipData, 'csv')}
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
                  onClick={() => exportPayslipToCSV(simulationExport)}
                  title="Exporter les lignes du bulletin au format CSV (Excel)"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Export CSV</span>
                </button>

                <button
                  onClick={() => void downloadPayslip(simulationExport, 'specimen')}
                  title="Générer un spécimen de bulletin d'essai avec filigrane non négociable"
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Télécharger Spécimen</span>
                </button>


                <button
                  onClick={() => {
                    setDocPreviewMode('specimen');
                    openPayslipPreview(simulationExport, 'Simulation de bulletin');
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/30 active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Aperçu A4 (simulation)</span>
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
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Salaire brut</span>
              <span className="text-xl font-bold text-white font-mono mt-1 block">
                {formatMoney(simulation.grossSalary)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl text-center">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Cotisations salariales</span>
              <span className="text-xl font-bold text-amber-400 font-mono mt-1 block">
                - {formatMoney(simulation.socialDeductions)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl text-center">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Impôt sur les rémunérations</span>
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
                ≈ {config.currency === 'USD' ? formatCDF(usdToCdf(simulation.netSalary, exchangeRate)) : formatUSD(cdfToUsd(simulation.netSalary, exchangeRate))}
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
                Simulation • {payMonthLabel(currentPayMonth())}
              </span>
            </div>

            <PayslipTable data={simulationExport} variant="dark" />

            <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs gap-3">
              <div>
                <span className="text-slate-400 block font-sans">Mode de versement :</span>
                <span className="text-white font-bold">{simContract ? `${simContract.paymentMode} • ${simContract.bankName || 'Banque non renseignée'}` : 'Aucun contrat pour ce collaborateur'}</span>
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
                    startDate: todayLocal(),
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
              <p className={leaveDays > 0 ? 'text-slate-400' : 'text-rose-300'}>
                {leaveDays > 0
                  ? `Durée : ${leaveDays} jour(s) ouvrable(s) (dimanches exclus).`
                  : 'La date de fin doit être postérieure ou égale à la date de début.'}
              </p>
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
                disabled={leaveDays <= 0 || !leaveForm.userId}
                onClick={() => {
                  if (leaveDays <= 0) return;
                  const u = users.find(usr => usr.id === leaveForm.userId);
                  setLeaves(prev => [{
                    id: newId('lv'),
                    userId: leaveForm.userId,
                    userName: u?.name || 'Agent',
                    type: leaveForm.type,
                    startDate: leaveForm.startDate,
                    endDate: leaveForm.endDate,
                    durationDays: leaveDays,
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
                    requestDate: todayLocal(),
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
              <div>
                <label className="text-slate-400 block mb-1">Mois de paie</label>
                <input
                  type="month"
                  value={overtimeForm.month}
                  onChange={e => setOvertimeForm({ ...overtimeForm, month: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Jour (+{config.overtimeRates?.firstBracketRate ?? 0} %)</label>
                  <input
                    type="number"
                    value={overtimeForm.dayHours}
                    onChange={e => setOvertimeForm({ ...overtimeForm, dayHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nuit (+{config.overtimeRates?.secondBracketRate ?? 0} %)</label>
                  <input
                    type="number"
                    value={overtimeForm.nightHours}
                    onChange={e => setOvertimeForm({ ...overtimeForm, nightHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Férié (+{config.overtimeRates?.weekendHolidayRate ?? 0} %)</label>
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
                  const contract = contracts.find(c => c.userId === overtimeForm.userId);
                  if (!contract) {
                    window.alert('Ce collaborateur n\'a pas de contrat : impossible de calculer son taux horaire.');
                    return;
                  }
                  const cur = contract.salaryCurrency === 'CDF' ? 'CDF' : 'USD';
                  const hourlyRate = hourlyRateOf(contract, config);
                  const total = roundMoney(overtimeAmountFor(overtimeForm, hourlyRate, config), cur);
                  setOvertimeRecords(prev => [{
                    id: `ot-${overtimeForm.userId}-${Date.now()}`,
                    userId: overtimeForm.userId,
                    userName: u?.name || 'Agent',
                    month: overtimeForm.month,
                    dayHours: overtimeForm.dayHours,
                    nightHours: overtimeForm.nightHours,
                    holidayHours: overtimeForm.holidayHours,
                    hourlyRate: roundMoney(hourlyRate, cur),
                    calculatedAmountUSD: cur === 'USD' ? total : roundMoney(convert(total, 'CDF', 'USD', exchangeRate), 'USD'),
                    calculatedAmountCDF: cur === 'CDF' ? total : roundMoney(convert(total, 'USD', 'CDF', exchangeRate), 'CDF'),
                    currency: cur,
                    status: 'approuve',
                    reason: overtimeForm.reason
                  }, ...prev]);
                  onLogAction?.('Saisie Heures Supplémentaires', `${u?.name} : ${overtimeForm.dayHours} h jour, ${overtimeForm.nightHours} h nuit, ${overtimeForm.holidayHours} h fériés (${payMonthLabel(overtimeForm.month)}) = ${formatPayslipMoney(total, cur)}.`, 'admin');
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
                    date: todayLocal(),
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
                  onClick={() => activeDocData.content?.payslip && void downloadPayslip(activeDocData.content.payslip, 'csv')}
                  title="Exporter les rubriques salariales en CSV (Excel)"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Exporter CSV</span>
                </button>

                <button
                  onClick={() => activeDocData.content?.payslip && void downloadPayslip(activeDocData.content.payslip, 'specimen')}
                  title="Télécharger le Spécimen avec filigrane d'essai"
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Télécharger Spécimen</span>
                </button>

                <button
                  onClick={() => activeDocData.content?.payslip && void downloadPayslip(activeDocData.content.payslip, 'pdf')}
                  title="Télécharger le bulletin en PDF"
                  disabled={String(activeDocData.ref || '').startsWith('SIM-')}
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
                    <p className="text-[11px] text-slate-600 font-medium">{currentOrg.headquarters || ''}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      RCCM : {currentOrg.rccm || currentOrg.registrationNumber || 'Non renseigné'} • Id. Nat : {currentOrg.idNat || 'Non renseigné'} • N° Impôt : {currentOrg.numImpot || 'Non renseigné'}
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
                  est engagé(e) au sein de notre établissement sous contrat de travail depuis le <strong>{activeDocData.content?.startDate || '…………'}</strong>.
                </p>
                <p>
                  Durant son activité, l'intéressé(e) a fait preuve de loyauté, d'assiduité et de compétence technique dans l'accomplissement des missions qui lui sont confiées.
                </p>
                <p>En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.</p>
                <div className="pt-6 text-right font-bold">
                  Pour la Direction Générale,<br />
                  <span className="text-indigo-900 font-extrabold">{currentOrg.directorGeneral || currentOrg.managerName || ''}</span>
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
                  Total Net Décompté : {activeDocData.content?.amount != null ? formatMoney(Number(activeDocData.content.amount), activeDocData.content?.currency) : '…………'}
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
            {(activeDocData.docType === 'bulletin' || !['attestation', 'solde', 'sanction'].includes(activeDocData.docType)) && (() => {
              const ps: PayslipExportData | undefined = activeDocData.content?.payslip;
              if (!ps) {
                return <p className="text-sm text-slate-600">Aucune donnée de bulletin à afficher.</p>;
              }
              const isSimulation = String(ps.ref).startsWith('SIM-');
              return (
              <>
                <div className="grid grid-cols-2 gap-4 text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="space-y-1">
                    <div><strong>Nom de l'agent :</strong> {ps.employeeName}</div>
                    <div><strong>Fonction :</strong> {ps.roleTitle}</div>
                    <div><strong>Matricule :</strong> {ps.matricule}</div>
                    <div><strong>Ancienneté :</strong> {ps.seniorityYears ?? 0} an(s)</div>
                  </div>
                  <div className="space-y-1">
                    <div><strong>N° CNSS :</strong> {ps.cnssNumber}</div>
                    <div><strong>Période de paie :</strong> {ps.period}</div>
                    <div><strong>Devise :</strong> {ps.currency === 'USD' ? 'Dollar américain (USD)' : 'Franc congolais (CDF)'}</div>
                    <div><strong>Enfants à charge :</strong> {ps.dependents ?? 0}</div>
                  </div>
                </div>

                <PayslipTable data={ps} variant="light" />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900 text-white rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Net à payer</span>
                    <span className="text-2xl font-bold text-emerald-400 font-mono mt-0.5 block">
                      {formatPayslipMoney(ps.netSalary, ps.currency)}
                    </span>
                    {ps.counterValueCDF != null && ps.currency === 'USD' && (
                      <span className="text-xs text-slate-300 font-mono">
                        Contre-valeur : {formatPayslipMoney(ps.counterValueCDF, 'CDF')}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-300 space-y-1">
                    <div>Coût total employeur : <strong>{formatPayslipMoney(ps.totalEmployerCost, ps.currency)}</strong></div>
                    {docPreviewMode === 'specimen' || isSimulation ? (
                      <div className="text-amber-400 font-bold flex items-center justify-end gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isSimulation ? 'SIMULATION — SANS VALEUR' : 'SPÉCIMEN (SANS EFFET)'}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400">
                        Une empreinte SHA-256 du contenu est ajoutée au PDF et au CSV téléchargés.
                      </div>
                    )}
                  </div>
                </div>
              </>
              );
            })()}

            {/* Pied de page officiel RHEMA BUSINESS */}
            <footer className="pt-3 border-t-2 border-slate-200 text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-800">{currentOrg.name}</span> • RCCM : {currentOrg.rccm || currentOrg.registrationNumber || 'Non renseigné'}
              </div>
              <div>
                {currentOrg.headquarters || ''}
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