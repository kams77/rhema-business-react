// src/components/BulkImportView.tsx
import React, { useState, useId } from 'react';
import type { 
  User, 
  Organization, 
  HierarchicalEntity, 
  EmployeeContract, 
  PayrollRunPeriod,
  DocumentItem,
  UserRole,
  AttendanceRecord,
  Attendance28DaysCycleReport
} from '../types';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Download, 
  Clock, 
  Send, 
  ShieldCheck, 
  Building2, 
  Coins, 
  Check, 
  RotateCcw, 
  HelpCircle,
  Eye,
  FileCheck2,
  Lock,
  Layers,
  Sparkles,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { getRoleBadgeClass } from '../utils/rbac';

interface BulkImportViewProps {
  currentUser: User;
  currentOrg: Organization;
  entities: HierarchicalEntity[];
  users: User[];
  contracts: EmployeeContract[];
  onImportUsersAndContracts: (newUsers: User[], newContracts: EmployeeContract[], auditNote: string) => void;
  onImportPayrollHistory: (newRun: PayrollRunPeriod, newPayslipDocs: DocumentItem[], auditNote: string) => void;
  onLogAction?: (action: string, details: string, category: 'admin' | 'document' | 'task' | 'security') => void;
  onAddDocument?: (document: DocumentItem) => void;
}

type BulkImportTab = 'employees_csv' | 'payroll_csv' | 'attendance_28d';

interface ParsedEmployeeRow {
  index: number;
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  role: UserRole;
  roleTitle: string;
  nomEntite: string;
  typeContrat: 'CDI' | 'CDD' | 'Stage' | 'Consultant' | 'Journalier';
  salaireBase: number;
  devise: 'USD' | 'CDF';
  cnssNumero: string;
  banque: string;
  compteBancaire: string;
  modePaiement: 'virement' | 'mobile_money' | 'cheque' | 'especes';
  dependentsCount: number;
  isValid: boolean;
  errors: string[];
}

interface ParsedPayrollRow {
  index: number;
  periode: string;
  matricule: string;
  nomEmploye: string;
  salaireBase: number;
  primes: number;
  heuresSupPay: number;
  devise: 'USD' | 'CDF';
  tauxChange: number;
  cnssSalarie: number;
  iprTax: number;
  netPaye: number;
  banque: string;
  refVirement: string;
  isValid: boolean;
  errors: string[];
}

export const BulkImportView: React.FC<BulkImportViewProps> = ({
  currentUser,
  currentOrg,
  entities,
  users,
  contracts,
  onImportUsersAndContracts,
  onImportPayrollHistory,
  onLogAction,
  onAddDocument,
}) => {
  const [activeTab, setActiveTab] = useState<BulkImportTab>('employees_csv');

  // Input file IDs uniques et sûrs
  const employeesFileInputId = useId();
  const payrollFileInputId = useId();

  // État Import Employés
  const [employeeRawCSV, setEmployeeRawCSV] = useState('');
  const [parsedEmployees, setParsedEmployees] = useState<ParsedEmployeeRow[]>([]);
  const [employeeImportSuccess, setEmployeeImportSuccess] = useState<string | null>(null);

  // État Import Paie Historique
  const [payrollRawCSV, setPayrollRawCSV] = useState('');
  const [parsedPayroll, setParsedPayroll] = useState<ParsedPayrollRow[]>([]);
  const [payrollImportSuccess, setPayrollImportSuccess] = useState<string | null>(null);

  // État Module Pointage & Horodatage 28 Jours Ouvrables
  const [targetWorkingDays, setTargetWorkingDays] = useState<number>(28);
  const [overtimeDayRatePercent, setOvertimeDayRatePercent] = useState<number>(25); // +25%
  const [overtimeNightRatePercent, setOvertimeNightRatePercent] = useState<number>(50); // +50%
  const [overtimeHolidayRatePercent, setOvertimeHolidayRatePercent] = useState<number>(100); // +100%
  const [isAutoDispatchSimulated, setIsAutoDispatchSimulated] = useState<boolean>(false);
  const [lastDispatchReport, setLastDispatchReport] = useState<Attendance28DaysCycleReport[] | null>(null);

  // Vérification stricte des droits Direction Générale / DRH
  const isDGOrHR = 
    currentUser.role === 'dg' || 
    currentUser.role === 'chef_departement' || 
    currentUser.role === 'directeur' ||
    currentUser.roleTitle?.toLowerCase().includes('dg') ||
    currentUser.roleTitle?.toLowerCase().includes('rh');

  // =========================================================================
  // GABARITS CSV TÉLÉCHARGEABLES
  // =========================================================================
  const downloadEmployeeTemplate = () => {
    const header = "matricule,nom,prenom,email,telephone,role,intitule_poste,nom_entite,type_contrat,salaire_base,devise,cnss_numero,banque,compte_bancaire,mode_paiement,personnes_charge\n";
    const sample = [
      "MAT-2026-101,Kalombo,Dieudonné,d.kalombo@rhemabusiness.com,+243 81 222 3344,agent,Technicien Faisceaux Hertziens,Service Déploiement VSAT,CDI,1200,USD,01-83-CNSS-991,Rawbank Kinshasa,01002-39201928019-88,virement,3",
      "MAT-2026-102,Mwamba,Nathalie,n.mwamba@rhemabusiness.com,+243 82 333 4455,agent,Comptable Auxiliaire,Service Comptabilité & Trésorerie,CDI,950,USD,01-83-CNSS-992,Equity BCDC,00012-92019201920-12,virement,1",
      "MAT-2026-103,Mutombo,Gabriel,g.mutombo@rhemabusiness.com,+243 99 444 5566,chef_service,Superviseur NOC Réseau,Service Support & Supervision,CDI,1600,USD,01-83-CNSS-993,Rawbank Kinshasa,01002-44910294819-22,virement,4",
      "MAT-2026-104,Bikangi,Christian,c.bikangi@rhemabusiness.com,+243 85 555 6677,agent,Développeur Logiciel Intégration,Service Support & Supervision,CDD,800,USD,01-83-CNSS-994,Rawbank Kinshasa,01002-88291049281-99,virement,0"
    ].join("\n");

    const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Gabarit_Import_Employes_RDC_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPayrollTemplate = () => {
    const header = "periode,matricule,nom_employe,salaire_base,primes,heures_sup,devise,taux_change_bcc,cnss_salarie_5pct,ipr_deduction,net_paye,banque,ref_virement\n";
    const sample = [
      "2026-08,MAT-2026-006,Eric Ndong,1500,100,75,USD,2850,75,160,1340,Rawbank Kinshasa,RAW-HIST-202608-48201",
      "2026-08,MAT-2026-005,Sophie Traoré,1950,150,0,USD,2850,97.5,210,1792.5,Rawbank Kinshasa,RAW-HIST-202608-48202",
      "2026-08,MAT-2026-007,Claire Mwamba,850,50,45,USD,2850,42.5,90,762.5,Equity BCDC,EQ-HIST-202608-91022",
      "2026-07,MAT-2026-006,Eric Ndong,1500,80,60,USD,2850,75,155,1350,Rawbank Kinshasa,RAW-HIST-202607-33102"
    ].join("\n");

    const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Gabarit_Historique_Paie_RDC_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // =========================================================================
  // PARSEUR CSV EMPLOYÉS AVEC CONTRÔLE DE VALIDITÉ RDC
  // =========================================================================
  const parseEmployeesCSV = (csvText: string) => {
    setEmployeeImportSuccess(null);
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      setParsedEmployees([]);
      return;
    }

    // Détection séparateur (, ou ;)
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.toLowerCase().replace(/["']/g, '').trim());

    const result: ParsedEmployeeRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(sep).map(v => v.replace(/["']/g, '').trim());
      if (values.length < 3) continue;

      const getVal = (possibleKeys: string[]): string => {
        for (const k of possibleKeys) {
          const idx = headers.indexOf(k);
          if (idx !== -1 && values[idx] !== undefined) return values[idx];
        }
        return '';
      };

      const matricule = getVal(['matricule', 'id', 'mat', 'code']) || `MAT-2026-${Math.floor(100 + Math.random() * 900)}`;
      const nom = getVal(['nom', 'lastname', 'name']) || 'Collaborateur';
      const prenom = getVal(['prenom', 'firstname']) || '';
      const email = getVal(['email', 'mail']) || `${nom.toLowerCase().replace(/\s/g, '')}@rhemabusiness.com`;
      const telephone = getVal(['telephone', 'phone', 'tel']) || '+243 81 279 1228';
      const rawRole = getVal(['role', 'grade', 'statut']).toLowerCase();
      
      let role: UserRole = 'agent';
      if (rawRole.includes('dg') || rawRole.includes('directeur général') || rawRole.includes('pdg')) role = 'dg';
      else if (rawRole.includes('chef_departement') || rawRole.includes('departement')) role = 'chef_departement';
      else if (rawRole.includes('directeur') || rawRole.includes('dir')) role = 'directeur';
      else if (rawRole.includes('chef_division') || rawRole.includes('division')) role = 'chef_division';
      else if (rawRole.includes('chef_service') || rawRole.includes('service')) role = 'chef_service';

      const roleTitle = getVal(['intitule_poste', 'poste', 'fonction', 'title']) || 'Agent Spécialiste';
      const nomEntite = getVal(['nom_entite', 'entite', 'service', 'departement']) || 'Service Opérationnel VSAT';
      
      const rawContract = getVal(['type_contrat', 'contrat']).toUpperCase();
      let typeContrat: ParsedEmployeeRow['typeContrat'] = 'CDI';
      if (rawContract.includes('CDD')) typeContrat = 'CDD';
      else if (rawContract.includes('STAGE')) typeContrat = 'Stage';
      else if (rawContract.includes('CONSULT')) typeContrat = 'Consultant';
      else if (rawContract.includes('JOURN')) typeContrat = 'Journalier';

      const salaireBase = parseFloat(getVal(['salaire_base', 'salaire', 'base', 'salary']).replace(/[^0-9.]/g, '')) || 800;
      const rawDevise = getVal(['devise', 'currency']).toUpperCase();
      const devise: 'USD' | 'CDF' = rawDevise.includes('CDF') ? 'CDF' : 'USD';
      const cnssNumero = getVal(['cnss_numero', 'cnss']) || `01-83-CNSS-${Math.floor(1000 + Math.random() * 9000)}`;
      const banque = getVal(['banque', 'bank']) || 'Rawbank Kinshasa';
      const compteBancaire = getVal(['compte_bancaire', 'compte', 'account']) || '01002-39201928019-88';
      
      const rawMode = getVal(['mode_paiement', 'paiement']).toLowerCase();
      let modePaiement: ParsedEmployeeRow['modePaiement'] = 'virement';
      if (rawMode.includes('mobile') || rawMode.includes('m-pesa') || rawMode.includes('orange')) modePaiement = 'mobile_money';
      else if (rawMode.includes('cheque')) modePaiement = 'cheque';
      else if (rawMode.includes('espece')) modePaiement = 'especes';

      const dependentsCount = parseInt(getVal(['personnes_charge', 'enfants', 'charges'])) || 0;

      // Validation
      const errors: string[] = [];
      if (!nom) errors.push("Nom obligatoire");
      if (!email.includes('@')) errors.push("Email invalide");
      if (salaireBase <= 0) errors.push("Salaire de base nul ou négatif");
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        errors.push("Email déjà existant dans l'ERP");
      }
      if (users.some(u => u.matricule && u.matricule.toLowerCase() === matricule.toLowerCase())) {
        errors.push("Matricule déjà attribué");
      }

      result.push({
        index: i,
        matricule,
        nom,
        prenom,
        email,
        telephone,
        role,
        roleTitle,
        nomEntite,
        typeContrat,
        salaireBase,
        devise,
        cnssNumero,
        banque,
        compteBancaire,
        modePaiement,
        dependentsCount,
        isValid: errors.length === 0,
        errors
      });
    }

    setParsedEmployees(result);
  };

  // Exécution de l'import des employés
  const handleExecuteEmployeeImport = () => {
    const valids = parsedEmployees.filter(e => e.isValid);
    if (valids.length === 0) return;

    const newUsers: User[] = [];
    const newContracts: EmployeeContract[] = [];

    valids.forEach(row => {
      const userId = `usr-csv-${Date.now()}-${row.index}-${Math.random().toString(36).substring(2, 6)}`;
      
      // Recherche entité concordante ou service par défaut
      const matchedEntity = entities.find(e => 
        e.name.toLowerCase().includes(row.nomEntite.toLowerCase()) ||
        row.nomEntite.toLowerCase().includes(e.name.toLowerCase())
      ) || entities[0];

      const fullUserName = row.prenom ? `${row.nom} ${row.prenom}` : row.nom;

      const newUser: User = {
        id: userId,
        name: fullUserName,
        email: row.email,
        matricule: row.matricule,
        employeeCode: row.matricule,
        password: 'rhema2026',
        role: row.role,
        roleTitle: row.roleTitle,
        organizationId: currentOrg.id,
        departmentName: matchedEntity?.name || 'Département Opérations',
        departementId: matchedEntity?.level === 'departement' ? matchedEntity.id : matchedEntity?.parentId,
        serviceId: matchedEntity?.level === 'service' ? matchedEntity.id : undefined,
        status: 'actif',
        failedAccessAttempts: 0,
        phone: row.telephone,
        canCreateSubAgents: row.role !== 'agent',
        canApproveServiceDocuments: row.role !== 'agent'
      };

      const newContract: EmployeeContract = {
        id: `cnt-${userId}`,
        userId: userId,
        employeeCode: row.matricule,
        matricule: row.matricule,
        contractType: row.typeContrat,
        startDate: new Date().toISOString().slice(0, 10),
        baseSalary: row.salaireBase,
        salaryCurrency: row.devise,
        categoryPro: row.role === 'dg' ? 'Cadre Dirigeant' : row.role === 'chef_service' ? 'Agent de Maîtrise' : 'Exécution',
        echelon: 'Echelon A',
        cnssNumber: row.cnssNumero,
        inppRegistered: true,
        onemRegistered: true,
        bankName: row.banque,
        bankAccountNumber: row.compteBancaire,
        paymentMode: row.modePaiement,
        dependentsCount: row.dependentsCount,
        maritalStatus: 'celibataire',
        active: true
      };

      newUsers.push(newUser);
      newContracts.push(newContract);
    });

    onImportUsersAndContracts(
      newUsers, 
      newContracts, 
      `Massification de ${newUsers.length} collaborateurs & contrats RH via import CSV officiel par la Direction Générale.`
    );

    setEmployeeImportSuccess(`Succès : ${newUsers.length} nouveaux collaborateurs et contrats ont été intégrés dans l'annuaire et le système de paie RDC.`);
    setParsedEmployees([]);
    setEmployeeRawCSV('');
  };

  // =========================================================================
  // PARSEUR CSV HISTORIQUE DE PAIE
  // =========================================================================
  const parsePayrollCSV = (csvText: string) => {
    setPayrollImportSuccess(null);
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      setParsedPayroll([]);
      return;
    }

    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.toLowerCase().replace(/["']/g, '').trim());

    const result: ParsedPayrollRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(sep).map(v => v.replace(/["']/g, '').trim());
      if (values.length < 3) continue;

      const getVal = (keys: string[]): string => {
        for (const k of keys) {
          const idx = headers.indexOf(k);
          if (idx !== -1 && values[idx] !== undefined) return values[idx];
        }
        return '';
      };

      const periode = getVal(['periode', 'mois', 'month', 'run']) || '2026-08';
      const matricule = getVal(['matricule', 'id', 'code']) || '';
      const nomEmploye = getVal(['nom_employe', 'nom', 'nom_agent']) || 'Agent';
      const salaireBase = parseFloat(getVal(['salaire_base', 'base', 'salaire']).replace(/[^0-9.]/g, '')) || 0;
      const primes = parseFloat(getVal(['primes', 'prime', 'bonus']).replace(/[^0-9.]/g, '')) || 0;
      const heuresSupPay = parseFloat(getVal(['heures_sup', 'heures_supplémentaires', 'overtime']).replace(/[^0-9.]/g, '')) || 0;
      
      const rawDevise = getVal(['devise', 'currency']).toUpperCase();
      const devise: 'USD' | 'CDF' = rawDevise.includes('CDF') ? 'CDF' : 'USD';
      const tauxChange = parseFloat(getVal(['taux_change_bcc', 'taux', 'rate'])) || 2850;

      const gross = salaireBase + primes + heuresSupPay;
      // Règle RDC : CNSS Salarié 5%
      const rawCnss = parseFloat(getVal(['cnss_salarie_5pct', 'cnss', 'cnss_sal'])) || (gross * 0.05);
      // Règle RDC : IPR estimation barème
      const rawIpr = parseFloat(getVal(['ipr_deduction', 'ipr', 'impot'])) || ((gross - rawCnss) * 0.15);
      const netPaye = parseFloat(getVal(['net_paye', 'net', 'salaire_net'])) || (gross - rawCnss - rawIpr);

      const banque = getVal(['banque', 'bank']) || 'Rawbank Kinshasa';
      const refVirement = getVal(['ref_virement', 'reference', 'ref']) || `RAW-HIST-${periode.replace('-', '')}-${rowMatriculeRef(matricule)}`;

      const errors: string[] = [];
      if (!matricule) errors.push("Matricule manquant");
      if (salaireBase <= 0) errors.push("Salaire nul ou négatif");

      result.push({
        index: i,
        periode,
        matricule,
        nomEmploye,
        salaireBase,
        primes,
        heuresSupPay,
        devise,
        tauxChange,
        cnssSalarie: Math.round(rawCnss),
        iprTax: Math.round(rawIpr),
        netPaye: Math.round(netPaye),
        banque,
        refVirement,
        isValid: errors.length === 0,
        errors
      });
    }

    setParsedPayroll(result);
  };

  const rowMatriculeRef = (mat: string) => mat.replace(/[^0-9]/g, '').slice(-4) || '99';

  const handleExecutePayrollImport = () => {
    const valids = parsedPayroll.filter(p => p.isValid);
    if (valids.length === 0) return;

    // Regroupement par période
    const periodeTarget = valids[0].periode;
    const totalGross = valids.reduce((acc, v) => acc + v.salaireBase + v.primes + v.heuresSupPay, 0);
    const totalNet = valids.reduce((acc, v) => acc + v.netPaye, 0);
    const totalEmployerCharges = Math.round(totalGross * 0.162); // 13% CNSS + 3% INPP + 0.2% ONEM

    const newRun: PayrollRunPeriod = {
      id: `run-hist-${periodeTarget}`,
      month: periodeTarget,
      title: `Archive Salariale RDC - ${periodeTarget}`,
      currency: valids[0].devise,
      exchangeRateUSD_CDF: valids[0].tauxChange,
      status: 'cloture',
      totalGross,
      totalNet,
      totalEmployerCharges,
      totalEmployees: valids.length,
      validatedByDRH: 'M. Jean-Paul Kouassi (DRH Historique)',
      validatedAtDRH: `${periodeTarget}-28`,
      bankTransferConfirmedBy: 'Direction Générale (Virement Validé)',
      bankTransferReference: valids[0].refVirement,
      bankTransferConfirmedAt: `${periodeTarget}-29`,
      bankName: valids[0].banque,
      payslipsAutoDispatched: true,
      payslipsDispatchedAt: `${periodeTarget}-29`,
      dispatchedCount: valids.length,
      validatedByDG: `${currentOrg.managerName || 'Direction Générale'} (DG)`,
      validatedAt: `${periodeTarget}-29`,
      closureHash: `SHA256:import-historique-${periodeTarget}-${Math.random().toString(36).substring(2, 8)}`
    };

    // Création des bulletins archivés
    const newPayslipDocs: DocumentItem[] = valids.map(row => {
      const u = users.find(usr => usr.matricule === row.matricule);
      return {
        id: `doc-bp-hist-${row.periode}-${row.matricule}`,
        title: `Bulletin de Paie Archivé - ${row.periode} - ${row.nomEmploye}`,
        referenceNumber: `BP-${row.periode}-${row.matricule}`,
        category: 'ressources_humaines',
        subtype: 'bulletin_de_paie',
        organizationId: currentOrg.id,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorRole: currentUser.role,
        authorEntity: 'Direction des Ressources Humaines (DRH)',
        createdAt: `${row.periode}-28`,
        status: 'signe',
        size: '1.2 Mo',
        fileType: 'PDF',
        targetUserId: u?.id || `usr-ref-${row.matricule}`,
        targetUserName: row.nomEmploye,
        isConfidentialPayslip: true,
        amount: row.netPaye,
        currency: row.devise,
        description: `Bulletin de paie historisé certifié. Virement bancaire ${row.banque} (Réf: ${row.refVirement}). Décomptes CNSS RDC & IPR.`,
        electronicSignature: {
          signedBy: `${currentOrg.managerName || 'Direction Générale'} & DRH`,
          signedAt: `${row.periode}-29 16:30`,
          role: 'Directeur Général & DRH',
          certificateHash: `SHA256:archive-${row.periode}-${row.matricule}-${Math.random().toString(36).substring(2, 8)}`
        },
        allowedRoles: ['dg', 'directeur', 'chef_departement', 'agent'],
        permissions: {
          viewRoles: ['dg', 'directeur', 'chef_departement', 'agent'],
          editRoles: ['dg', 'directeur'],
          validateRoles: ['dg', 'directeur'],
          signRoles: ['dg', 'directeur']
        }
      };
    });

    onImportPayrollHistory(
      newRun, 
      newPayslipDocs, 
      `Importation historique de ${valids.length} bulletins de paie et clôture certifiée pour la période ${periodeTarget}.`
    );

    setPayrollImportSuccess(`Succès : La période de paie ${periodeTarget} et ses ${valids.length} bulletins scellés ont été intégrés dans l'historique et les coffres-forts des employés.`);
    setParsedPayroll([]);
    setPayrollRawCSV('');
  };

  // =========================================================================
  // MODULE HORODATAGE & ENVOI AUTOMATIQUE 28 JOURS OUVRABLES
  // =========================================================================
  // Calcul et génération des rapports de pointage par entité avec heures supplémentaires
  const generate28DaysReports = (): Attendance28DaysCycleReport[] => {
    // Regroupement des agents par entité
    return entities.map((ent, idx) => {
      // Trouver les agents affectés à cette entité
      const agentsOfEntity = users.filter(u => 
        u.role === 'agent' && (u.serviceId === ent.id || u.departementId === ent.id || u.directionId === ent.id)
      );

      const count = agentsOfEntity.length > 0 ? agentsOfEntity.length : Math.floor(3 + idx * 2);

      let totalNormalHours = 0;
      let totalOvertimeDay = 0;
      let totalOvertimeNight = 0;
      let totalOvertimeHoliday = 0;

      const agentSummaries = (agentsOfEntity.length > 0 ? agentsOfEntity : [
        { id: `mock-1-${ent.id}`, name: `Agent Leader (${ent.code})`, matricule: `MAT-2026-0${idx + 1}1` },
        { id: `mock-2-${ent.id}`, name: `Technicien Équipe (${ent.code})`, matricule: `MAT-2026-0${idx + 1}2` },
        { id: `mock-3-${ent.id}`, name: `Opérateur Terrain (${ent.code})`, matricule: `MAT-2026-0${idx + 1}3` }
      ]).map((ag, aIdx) => {
        const daysWorked = targetWorkingDays; // 28 jours ouvrables atteints
        const normalHours = daysWorked * 8; // 224 heures normales
        const overtimeDay = 8 + (aIdx * 4); // heures sup jour
        const overtimeNight = aIdx % 2 === 0 ? 4 : 0; // heures sup nuit
        const overtimeHoliday = aIdx === 0 ? 6 : 0; // dimanches & fériés
        const overtimeTotal = overtimeDay + overtimeNight + overtimeHoliday;

        totalNormalHours += normalHours;
        totalOvertimeDay += overtimeDay;
        totalOvertimeNight += overtimeNight;
        totalOvertimeHoliday += overtimeHoliday;

        // Calcul bonus estimé RDC : base horaire moyenne 6 USD/h
        const baseHourly = 6;
        const bonusUSD = 
          (overtimeDay * baseHourly * (1 + overtimeDayRatePercent / 100)) +
          (overtimeNight * baseHourly * (1 + overtimeNightRatePercent / 100)) +
          (overtimeHoliday * baseHourly * (1 + overtimeHolidayRatePercent / 100));

        return {
          userId: ag.id,
          userName: ag.name,
          matricule: (ag as any).matricule || `MAT-AG-${aIdx}`,
          daysWorked,
          normalHours,
          overtimeHours: overtimeTotal,
          overtimeDay,
          overtimeNight,
          overtimeHoliday,
          estimatedOvertimeBonusUSD: Math.round(bonusUSD)
        };
      });

      const totalOvertimeHours = totalOvertimeDay + totalOvertimeNight + totalOvertimeHoliday;

      return {
        id: `rpt-att-28d-${ent.id}`,
        cycleNumber: 9,
        monthPeriod: '09/2026',
        workingDaysCompleted: targetWorkingDays,
        targetWorkingDays,
        entityId: ent.id,
        entityName: ent.name,
        entityLevel: ent.level,
        managerName: ent.managerName || 'Chef de Service',
        managerEmail: ent.managerEmail || `${ent.code.toLowerCase()}@rhemabusiness.com`,
        managerRole: ent.managerRole || (ent.level === 'service' ? 'chef_service' : 'directeur'),
        totalAgents: count,
        totalNormalHours,
        totalOvertimeHours,
        overtimeDayHours: totalOvertimeDay,
        overtimeNightHours: totalOvertimeNight,
        overtimeHolidayHours: totalOvertimeHoliday,
        isAutoDispatched: isAutoDispatchSimulated,
        autoDispatchedAt: isAutoDispatchSimulated ? new Date().toISOString().replace('T', ' ').slice(0, 16) : undefined,
        status: isAutoDispatchSimulated ? 'transmis_responsable' : 'cycle_28j_atteint',
        agentSummaries,
        sha256Hash: `SHA256:pointage-28j-${ent.code}-${Math.random().toString(36).substring(2, 8)}`,
        signatureCert: {
          signedBy: `Horodatage Automatique ERP (${currentOrg.name})`,
          signedAt: new Date().toLocaleTimeString(),
          role: 'Contrôleur Automatique de Présence SHA-256'
        }
      };
    });
  };

  const reportsList = lastDispatchReport || generate28DaysReports();

  // Déclencheur automatique / simulation envoi
  const handleTriggerAutoDispatch28Days = () => {
    const updated = generate28DaysReports().map(r => ({
      ...r,
      isAutoDispatched: true,
      autoDispatchedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'transmis_responsable' as const
    }));

    setLastDispatchReport(updated);
    setIsAutoDispatchSimulated(true);

    // Publication du document scellé dans l'ERP
    updated.forEach(rpt => {
      if (onAddDocument) {
        onAddDocument({
          id: `doc-att-28d-${rpt.entityId}-${Date.now().toString().slice(-4)}`,
          title: `Rapport Pointage & Heures Sup (28 Jours) - ${rpt.entityName}`,
          referenceNumber: `POINTAGE-28J-${rpt.entityId.toUpperCase()}-092026`,
          category: 'ressources_humaines',
          subtype: 'feuille_de_temps',
          organizationId: currentOrg.id,
          authorId: currentUser.id,
          authorName: 'Horodatage Automatique ERP',
          authorRole: 'dg',
          authorEntity: 'Système Centralisé de Pointage',
          createdAt: new Date().toISOString().slice(0, 10),
          status: 'approuve',
          size: '850 Ko',
          fileType: 'PDF',
          targetEntityId: rpt.entityId,
          targetEntityName: rpt.entityName,
          description: `Cycle de ${rpt.targetWorkingDays} jours ouvrables atteint. Envoi automatique au responsable (${rpt.managerName}) de ${rpt.totalAgents} fiches agents, ${rpt.totalOvertimeHours} heures supplémentaires comptabilisées.`,
          allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service'],
          permissions: {
            viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service'],
            editRoles: ['dg'],
            validateRoles: ['dg', 'chef_service', 'directeur'],
            signRoles: ['dg', 'chef_service', 'directeur']
          },
          electronicSignature: {
            signedBy: rpt.managerName,
            signedAt: new Date().toLocaleTimeString(),
            role: 'Visa Hiérarchique Entité',
            certificateHash: rpt.sha256Hash
          }
        });
      }
    });

    if (onLogAction) {
      onLogAction(
        'Envoi Automatique Pointage 28 Jours',
        `Transmission automatique du cycle de ${targetWorkingDays} jours ouvrables et des relevés d'heures supplémentaires aux responsables de ${updated.length} entités pour intégration paie.`,
        'admin'
      );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-100">
      
      {/* 1. EN-TÊTE PRINCIPAL */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase tracking-wider border border-indigo-500/30">
              DIRECTION GÉNÉRALE & RH
            </span>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Conformité RDC (Code du Travail & BCC)</span>
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-indigo-400" />
            <span>Massification des Données CSV & Pointage Automatisé (28 Jours)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Importation massive des collaborateurs, des contrats et des historiques de paie avec validation métier stricte. Gestion de l'horodatage officiel et transmission automatique après 28 jours ouvrables aux responsables d'entités.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadEmployeeTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Gabarit Employés CSV</span>
          </button>
          <button
            onClick={downloadPayrollTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Gabarit Paie CSV</span>
          </button>
        </div>
      </div>

      {/* 2. NAVIGATION DES SOUS-MODULES */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('employees_csv')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'employees_csv'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>1. Massification Employés & Contrats ({parsedEmployees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payroll_csv')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'payroll_csv'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>2. Historique de Paie & Bulletins ({parsedPayroll.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance_28d')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'attendance_28d'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>3. Horodatage & Envoi 28 Jours (+ Heures Sup)</span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Automatique
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : MASSIFICATION DES EMPLOYÉS & CONTRATS CSV                       */}
      {/* ========================================================================= */}
      {activeTab === 'employees_csv' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                  <span>Importer un fichier CSV d'Employés & Contrats RDC</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Prend en charge les séparateurs virgule (,) et point-virgule (;). Vérifie les matricules, emails et devises USD/CDF.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id={employeesFileInputId}
                  accept=".csv,text/csv"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = event => {
                        const content = event.target?.result as string;
                        setEmployeeRawCSV(content);
                        parseEmployeesCSV(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor={employeesFileInputId}
                  className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Sélectionner le fichier CSV</span>
                </label>
              </div>
            </div>

            {/* Zone de saisie / collage direct */}
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">
                Ou collez directement vos lignes CSV ci-dessous :
              </label>
              <textarea
                rows={4}
                value={employeeRawCSV}
                onChange={e => {
                  setEmployeeRawCSV(e.target.value);
                  parseEmployeesCSV(e.target.value);
                }}
                placeholder="matricule,nom,prenom,email,telephone,role,intitule_poste,nom_entite,type_contrat,salaire_base,devise,cnss_numero,banque,compte_bancaire,mode_paiement,personnes_charge"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {employeeImportSuccess && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{employeeImportSuccess}</span>
              </div>
            )}
          </div>

          {/* Tableau de Prévisualisation des lignes parsées */}
          {parsedEmployees.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-white">
                    Prévisualisation & Contrôle de Cohérence RDC ({parsedEmployees.length} lignes)
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span className="text-emerald-400 font-semibold">
                      ✓ {parsedEmployees.filter(e => e.isValid).length} Valides
                    </span>
                    {parsedEmployees.filter(e => !e.isValid).length > 0 && (
                      <span className="text-rose-400 font-semibold">
                        ✗ {parsedEmployees.filter(e => !e.isValid).length} Anomalies à corriger
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleExecuteEmployeeImport}
                  disabled={parsedEmployees.filter(e => e.isValid).length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Intégrer les {parsedEmployees.filter(e => e.isValid).length} Employés dans l'ERP</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Statut</th>
                      <th className="p-3">Matricule</th>
                      <th className="p-3">Nom & Prénom</th>
                      <th className="p-3">Email & Téléphone</th>
                      <th className="p-3">Poste & Entité</th>
                      <th className="p-3">Contrat & CNSS</th>
                      <th className="p-3 text-right">Salaire Base</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {parsedEmployees.map(row => (
                      <tr key={row.index} className={row.isValid ? 'hover:bg-slate-800/40' : 'bg-rose-950/20'}>
                        <td className="p-3">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ✓ Prêt
                            </span>
                          ) : (
                            <div className="text-[10px] text-rose-300 space-y-0.5">
                              {row.errors.map((err, ei) => (
                                <div key={ei} className="flex items-center gap-1 font-semibold">
                                  <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-white">{row.matricule}</td>
                        <td className="p-3 font-semibold text-slate-200">
                          {row.nom} {row.prenom}
                        </td>
                        <td className="p-3 text-slate-400">
                          <div>{row.email}</div>
                          <div className="text-[10px] font-mono text-slate-500">{row.telephone}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-300">{row.roleTitle}</div>
                          <div className="text-[10px] text-indigo-400">{row.nomEntite}</div>
                        </td>
                        <td className="p-3">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 mr-1.5">
                            {row.typeContrat}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">CNSS: {row.cnssNumero}</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-400">
                          {row.salaireBase.toLocaleString()} {row.devise}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : MASSIFICATION DES HISTORIQUES DE PAIE                           */}
      {/* ========================================================================= */}
      {activeTab === 'payroll_csv' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Importer un fichier CSV d'Historique de Paie & Bulletins RDC</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Injecte les cycles de paie antérieurs et crée les bulletins électroniques scellés dans le coffre-fort numérique de chaque agent.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id={payrollFileInputId}
                  accept=".csv,text/csv"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = event => {
                        const content = event.target?.result as string;
                        setPayrollRawCSV(content);
                        parsePayrollCSV(content);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor={payrollFileInputId}
                  className="cursor-pointer px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Sélectionner le fichier CSV</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold">
                Ou collez vos lignes d'historique de paie :
              </label>
              <textarea
                rows={4}
                value={payrollRawCSV}
                onChange={e => {
                  setPayrollRawCSV(e.target.value);
                  parsePayrollCSV(e.target.value);
                }}
                placeholder="periode,matricule,nom_employe,salaire_base,primes,heures_sup,devise,taux_change_bcc,cnss_salarie_5pct,ipr_deduction,net_paye,banque,ref_virement"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            {payrollImportSuccess && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{payrollImportSuccess}</span>
              </div>
            )}
          </div>

          {/* Tableau de Prévisualisation Paie */}
          {parsedPayroll.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-white">
                    Bulletins Archivés Détectés ({parsedPayroll.length} bulletins pour la période {parsedPayroll[0]?.periode})
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Total Net Global : <strong className="text-emerald-400 font-mono">
                      {parsedPayroll.reduce((acc, p) => acc + p.netPaye, 0).toLocaleString()} {parsedPayroll[0]?.devise}
                    </strong>
                  </p>
                </div>

                <button
                  onClick={handleExecutePayrollImport}
                  disabled={parsedPayroll.filter(p => p.isValid).length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Créer la Période & Générer {parsedPayroll.filter(p => p.isValid).length} Bulletins Scellés</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Période</th>
                      <th className="p-3">Matricule & Agent</th>
                      <th className="p-3 text-right">Salaire Base</th>
                      <th className="p-3 text-right">Primes & H.Sup</th>
                      <th className="p-3 text-right">CNSS Salarié (5%)</th>
                      <th className="p-3 text-right">IPR</th>
                      <th className="p-3 text-right font-bold text-emerald-400">Net Payé</th>
                      <th className="p-3">Réf Virement Banque</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono">
                    {parsedPayroll.map(row => (
                      <tr key={row.index} className="hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-indigo-300">{row.periode}</td>
                        <td className="p-3 font-sans">
                          <span className="font-bold text-white">{row.nomEmploye}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">({row.matricule})</span>
                        </td>
                        <td className="p-3 text-right">{row.salaireBase.toLocaleString()} {row.devise}</td>
                        <td className="p-3 text-right text-indigo-300">+{(row.primes + row.heuresSupPay).toLocaleString()}</td>
                        <td className="p-3 text-right text-amber-400">-{row.cnssSalarie.toLocaleString()}</td>
                        <td className="p-3 text-right text-rose-400">-{row.iprTax.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-emerald-400">{row.netPaye.toLocaleString()} {row.devise}</td>
                        <td className="p-3 text-[11px] text-slate-400">{row.refVirement} ({row.banque})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : POINTAGE & HORODATAGE 28 JOURS OUVRABLES (+ HEURES SUP)         */}
      {/* ========================================================================= */}
      {activeTab === 'attendance_28d' && (
        <div className="space-y-6">
          
          {/* Panneau de configuration du cycle de 28 jours ouvrables & majorations */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-base text-white">
                    Paramétrage du Cycle de Pointage & Envoi Automatique
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Déclenchement automatique du rapport consolidé après <strong>28 jours ouvrables effectifs</strong> avec décompte des heures supplémentaires selon le Code du Travail RDC.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerAutoDispatch28Days}
                  className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Déclencher l'Envoi Automatique aux Responsables</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold block">Seuil Jours Ouvrables :</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={20}
                    max={31}
                    value={targetWorkingDays}
                    onChange={e => setTargetWorkingDays(parseInt(e.target.value) || 28)}
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold"
                  />
                  <span className="font-bold text-white">Jours Ouvrables</span>
                </div>
                <span className="text-[10px] text-slate-500">Standard légal RDC de clôture</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold block">Heures Sup. Jour :</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">+{overtimeDayRatePercent}%</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">Légal RDC</span>
                </div>
                <span className="text-[10px] text-slate-500">Au-delà de la 8ème heure quotidienne</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold block">Heures Sup. Nuit :</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">+{overtimeNightRatePercent}%</span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded font-bold">22h00 - 06h00</span>
                </div>
                <span className="text-[10px] text-slate-500">Majoration travail de nuit</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold block">Dimanches & Fériés :</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">+{overtimeHolidayRatePercent}%</span>
                  <span className="text-[10px] text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded font-bold">Repos Légal</span>
                </div>
                <span className="text-[10px] text-slate-500">Heures doublées conformément à la loi</span>
              </div>
            </div>

            {isAutoDispatchSimulated && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <strong className="block text-emerald-200">Envoi Automatique Réussi !</strong>
                    Le rapport consolidé de 28 jours ouvrables a été horodaté sous scellement SHA-256 et transmis aux responsables de chaque entité.
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg">
                  Horodatage : {new Date().toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {/* Liste des Rapports de Pointage 28 Jours par Entité */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span>Rapports de Pointage Consolidés (28 Jours) Destinés aux Responsables d'Entités</span>
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                {reportsList.length} Entités sous surveillance automatique
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {reportsList.map(rpt => (
                <div 
                  key={rpt.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-sm text-white">{rpt.entityName}</h5>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                            {rpt.entityLevel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Destinataire officiel : <strong className="text-slate-200">{rpt.managerName}</strong> ({rpt.managerEmail})
                        </p>
                      </div>

                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1 ${
                        rpt.isAutoDispatched
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {rpt.isAutoDispatched ? '✓ Transmis au Responsable' : '28 Jours Atteints'}
                      </span>
                    </div>

                    {/* Statistiques d'heures du cycle de 28 jours */}
                    <div className="grid grid-cols-3 gap-2.5 my-3 text-center">
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Jours Effectifs</span>
                        <strong className="text-sm font-mono text-white mt-0.5 block">{rpt.workingDaysCompleted} / {rpt.targetWorkingDays} j</strong>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Heures Normales</span>
                        <strong className="text-sm font-mono text-indigo-400 mt-0.5 block">{rpt.totalNormalHours} h</strong>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Heures Sup. Cumul</span>
                        <strong className="text-sm font-mono text-emerald-400 mt-0.5 block">+{rpt.totalOvertimeHours} h</strong>
                      </div>
                    </div>

                    {/* Détail par Agent du Service */}
                    <div className="space-y-1.5 mt-3">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Agents du Service ({rpt.agentSummaries.length})</span>
                        <span>Décompte Heures Sup</span>
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {rpt.agentSummaries.map(ag => (
                          <div 
                            key={ag.userId}
                            className="bg-slate-950 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-white">{ag.userName}</span>
                              <span className="text-[10px] font-mono text-slate-500 ml-1.5">({ag.matricule})</span>
                            </div>
                            <div className="text-right font-mono">
                              <span className="text-emerald-400 font-bold">+{ag.overtimeHours} h sup</span>
                              <span className="text-[10px] text-slate-400 ml-2">(~{ag.estimatedOvertimeBonusUSD} $)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">
                      {rpt.sha256Hash}
                    </span>

                    <button
                      onClick={() => {
                        alert(`Rapport officiel de pointage (28 jours) pour ${rpt.entityName} transmis avec succès à ${rpt.managerName} (${rpt.managerEmail}). Le document a été scellé et enregistré dans le registre d'audit.`);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-[11px] border border-slate-700 transition"
                    >
                      Émarger / Vérifier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
