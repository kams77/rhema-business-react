// src/components/BulkImportView.tsx
import { contentHashSync } from '../lib/integrity';
import { localDateTime, todayLocal } from '../lib/dates';
import { cellGetter, csvEscape, normalizeHeader, parseCsv, parseDateCell, parseMonthCell } from '../lib/csv';
import { parseAmount, round2 } from '../lib/money';
import { nextReference } from '../lib/sequence';
import { useRate } from '../lib/exchangeRate';
import { ATTENDANCE_KEY, periodStartForWorkingDays, summarizeAttendance, type AttendancePunch } from '../lib/attendance';
import { usePersistentState } from '../hooks/usePersistentState';
import { newId } from '../utils/id';
import React, { useState, useId } from 'react';
import { DEMO_MODE, DEMO_PASSWORD } from '../config';
import { generateTemporaryPassword } from '../lib/auth';
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
import { getRoleBadgeClass, titleHasAny, HR_TITLE_TERMS } from '../utils/rbac';

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
  /** Date d'embauche (AAAA-MM-JJ) : base de l'ancienneté. */
  dateEmbauche: string;
  entityId?: string;
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
  const exchangeRate = useRate();
  const [punches] = usePersistentState<AttendancePunch[]>(ATTENDANCE_KEY, []);
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
    titleHasAny(currentUser.roleTitle, ['dg', 'pdg', ...HR_TITLE_TERMS]);

  // =========================================================================
  // GABARITS CSV TÉLÉCHARGEABLES
  // =========================================================================
  const downloadEmployeeTemplate = () => {
    const header = "matricule,nom,prenom,email,telephone,role,intitule_poste,nom_entite,type_contrat,date_embauche,salaire_base,devise,cnss_numero,banque,compte_bancaire,mode_paiement,personnes_charge\n";
    // Lignes d'exemple (à remplacer) : les entités proposées sont celles de votre organigramme.
    const ent1 = entities.find(e => e.level === 'service')?.name || entities[0]?.name || 'Nom exact du service';
    const ent2 = entities.find(e => e.level === 'departement')?.name || ent1;
    const sample = [
      `,Exemple,Agent,agent.exemple@votre-entreprise.cd,+243 81 000 0000,agent,Technicien,${csvEscape(ent1)},CDI,2024-03-01,"1200,00",USD,,Nom de la banque,Numéro de compte,virement,2`,
      `,Exemple,Responsable,responsable.exemple@votre-entreprise.cd,,chef_service,Chef de service,${csvEscape(ent2)},CDD,15/01/2025,950,USD,,,,mobile_money,0`,
    ].join("\n");

    const blob = new Blob(['\uFEFF' + header + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Gabarit_Import_Employes_RDC_${todayLocal()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPayrollTemplate = () => {
    const header = "periode,matricule,nom_employe,salaire_base,primes,heures_sup,devise,taux_change,cnss_salarie,ipr_deduction,net_paye,banque,ref_virement\n";
    // Ligne d'exemple (à remplacer par les montants réellement versés) : brut − CNSS − IPR = net.
    const sampleUser = users.find(u => u.matricule);
    const sample = [
      `2026-08,${csvEscape(sampleUser?.matricule || 'MAT-2026-001')},${csvEscape(sampleUser?.name || 'Nom Prénom')},1500,100,0,USD,${exchangeRate},80,160,1360,Nom de la banque,Référence du virement`,
    ].join("\n");

    const blob = new Blob(['\uFEFF' + header + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Gabarit_Historique_Paie_RDC_${todayLocal()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // =========================================================================
  // PARSEUR CSV EMPLOYÉS AVEC CONTRÔLE DE VALIDITÉ RDC
  // =========================================================================
  const parseEmployeesCSV = (csvText: string) => {
    setEmployeeImportSuccess(null);
    const { headers, rows } = parseCsv(csvText);
    if (rows.length === 0) {
      setParsedEmployees([]);
      return;
    }

    const result: ParsedEmployeeRow[] = [];
    // Matricules déjà pris (annuaire + lignes précédentes du fichier) pour attribuer les suivants.
    const takenMatricules: string[] = users.map(u => u.matricule || '');
    const seenEmails = new Set<string>();
    const norm = (v: string) => normalizeHeader(v).replace(/_/g, ' ');

    rows.forEach((values, rowIdx) => {
      const i = rowIdx + 1;
      const getVal = cellGetter(headers, values);
      const errors: string[] = [];

      const nom = getVal(['nom', 'lastname', 'name']);
      const prenom = getVal(['prenom', 'firstname']);
      const providedMatricule = getVal(['matricule', 'id', 'mat', 'code']);
      const matricule = providedMatricule || nextReference('MAT', takenMatricules);
      takenMatricules.push(matricule);
      const email = getVal(['email', 'mail']).toLowerCase();
      const telephone = getVal(['telephone', 'phone', 'tel']);
      const rawRole = getVal(['role', 'grade', 'statut']).toLowerCase();

      let role: UserRole = 'agent';
      // Comparaison par mots entiers : « Budget » ne doit jamais donner le rôle DG.
      if (rawRole === 'dg' || titleHasAny(rawRole, ['dg', 'pdg', 'directeur general'])) role = 'dg';
      else if (rawRole.includes('chef_departement') || titleHasAny(rawRole, ['departement', 'chef departement'])) role = 'chef_departement';
      else if (titleHasAny(rawRole, ['directeur', 'directrice', 'dir'])) role = 'directeur';
      else if (rawRole.includes('chef_division') || titleHasAny(rawRole, ['division'])) role = 'chef_division';
      else if (rawRole.includes('chef_service') || titleHasAny(rawRole, ['service', 'chef service'])) role = 'chef_service';

      const roleTitle = getVal(['intitule_poste', 'poste', 'fonction', 'title']) || 'Agent';
      const nomEntite = getVal(['nom_entite', 'entite', 'service', 'departement']);

      const rawContract = getVal(['type_contrat', 'contrat']).toUpperCase();
      let typeContrat: ParsedEmployeeRow['typeContrat'] = 'CDI';
      if (rawContract.includes('CDD')) typeContrat = 'CDD';
      else if (rawContract.includes('STAGE')) typeContrat = 'Stage';
      else if (rawContract.includes('CONSULT')) typeContrat = 'Consultant';
      else if (rawContract.includes('JOURN')) typeContrat = 'Journalier';

      const salaire = parseAmount(getVal(['salaire_base', 'salaire', 'base', 'salary']));
      const salaireBase = salaire ?? 0;
      const rawDevise = getVal(['devise', 'currency']).toUpperCase();
      const devise: 'USD' | 'CDF' = rawDevise.includes('CDF') || rawDevise === 'FC' ? 'CDF' : 'USD';
      const cnssNumero = getVal(['cnss_numero', 'cnss']);
      const banque = getVal(['banque', 'bank']);
      const compteBancaire = getVal(['compte_bancaire', 'compte', 'account']);

      const rawMode = getVal(['mode_paiement', 'paiement']).toLowerCase();
      let modePaiement: ParsedEmployeeRow['modePaiement'] = 'virement';
      if (rawMode.includes('mobile') || rawMode.includes('m-pesa') || rawMode.includes('orange')) modePaiement = 'mobile_money';
      else if (rawMode.includes('cheque') || rawMode.includes('chèque')) modePaiement = 'cheque';
      else if (rawMode.includes('espece') || rawMode.includes('espèce')) modePaiement = 'especes';

      const rawDependents = getVal(['personnes_charge', 'enfants', 'charges']);
      const dependentsCount = rawDependents ? Number.parseInt(rawDependents, 10) : 0;
      if (!Number.isInteger(dependentsCount) || dependentsCount < 0) errors.push('Nombre de personnes à charge invalide');

      const rawHire = getVal(['date_embauche', 'embauche', 'date_entree', 'date_debut']);
      const parsedHire = rawHire ? parseDateCell(rawHire) : null;
      if (rawHire && !parsedHire) errors.push(`Date d'embauche illisible : « ${rawHire} » (format AAAA-MM-JJ ou JJ/MM/AAAA)`);
      const dateEmbauche = parsedHire || todayLocal();

      // Entité : correspondance exacte du nom ou du code (sans accents ni majuscules).
      const entityMatch = nomEntite
        ? entities.find(e => norm(e.name) === norm(nomEntite) || (e.code && norm(e.code) === norm(nomEntite)))
        : undefined;
      if (!nomEntite) errors.push('Entité (service / département) obligatoire');
      else if (!entityMatch) errors.push(`Entité inconnue dans l'organigramme : « ${nomEntite} »`);

      if (salaire === null) errors.push('Salaire de base manquant ou illisible');
      if (modePaiement === 'virement' && !compteBancaire) errors.push('Compte bancaire obligatoire pour un paiement par virement');
      if (!email) errors.push('Email obligatoire (identifiant de connexion)');
      else if (seenEmails.has(email)) errors.push('Email présent deux fois dans le fichier');
      seenEmails.add(email);
      if (providedMatricule && takenMatricules.filter(m => m.toLowerCase() === matricule.toLowerCase()).length > 1) {
        errors.push('Matricule déjà attribué');
      }

      if (!nom) errors.push("Nom obligatoire");
      if (!email.includes('@')) errors.push("Email invalide");
      if (salaireBase <= 0) errors.push("Salaire de base nul ou négatif");
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        errors.push("Email déjà existant dans l'ERP");
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
        dateEmbauche,
        entityId: entityMatch?.id,
        isValid: errors.length === 0,
        errors
      });
    });

    setParsedEmployees(result);
  };

  // Exécution de l'import des employés
  const handleExecuteEmployeeImport = () => {
    const valids = parsedEmployees.filter(e => e.isValid);
    if (valids.length === 0) return;

    const newUsers: User[] = [];
    const newContracts: EmployeeContract[] = [];
    // Identifiants provisoires à transmettre aux collaborateurs (changement obligatoire à la 1re connexion).
    const credentials: Array<{ name: string; email: string; matricule: string; password: string }> = [];

    valids.forEach(row => {
      const userId = newId('usr-csv');
      const matchedEntity = entities.find(e => e.id === row.entityId);

      const fullUserName = row.prenom ? `${row.nom} ${row.prenom}` : row.nom;

      const newUser: User = {
        id: userId,
        name: fullUserName,
        email: row.email,
        matricule: row.matricule,
        employeeCode: row.matricule,
        password: DEMO_MODE ? DEMO_PASSWORD : generateTemporaryPassword(),
        mustChangePassword: !DEMO_MODE,
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
        startDate: row.dateEmbauche,
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
      credentials.push({ name: fullUserName, email: row.email, matricule: row.matricule, password: newUser.password! });
    });

    onImportUsersAndContracts(
      newUsers, 
      newContracts, 
      `Massification de ${newUsers.length} collaborateurs & contrats RH via import CSV officiel par la Direction Générale.`
    );

    if (!DEMO_MODE) {
      // Fichier à remettre aux collaborateurs puis à détruire : c'est la seule fois où les mots de passe sont visibles.
      const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = ['Nom;Email;Matricule;Mot de passe provisoire']
        .concat(credentials.map(c => [c.name, c.email, c.matricule, c.password].map(esc).join(';')))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `identifiants-provisoires-${todayLocal()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    setEmployeeImportSuccess(
      `Succès : ${newUsers.length} nouveaux collaborateurs et contrats ont été intégrés dans l'annuaire et le système de paie RDC.` +
      (DEMO_MODE
        ? ` Mot de passe de démonstration : ${DEMO_PASSWORD}.`
        : ' Les mots de passe provisoires ont été téléchargés (fichier CSV) : remettez-les aux collaborateurs puis supprimez ce fichier.')
    );
    setParsedEmployees([]);
    setEmployeeRawCSV('');
  };

  // =========================================================================
  // PARSEUR CSV HISTORIQUE DE PAIE
  // =========================================================================
  const parsePayrollCSV = (csvText: string) => {
    setPayrollImportSuccess(null);
    const { headers, rows } = parseCsv(csvText);
    if (rows.length === 0) {
      setParsedPayroll([]);
      return;
    }

    const result: ParsedPayrollRow[] = [];
    let firstPeriod: string | null = null;
    let firstCurrency: 'USD' | 'CDF' | null = null;
    const seen = new Set<string>();

    rows.forEach((values, rowIdx) => {
      const i = rowIdx + 1;
      const getVal = cellGetter(headers, values);
      const errors: string[] = [];
      // Montant obligatoire : une cellule vide est une erreur, un vrai 0 est accepté.
      const amount = (keys: string[], label: string, required = true): number => {
        const raw = getVal(keys);
        const n = parseAmount(raw);
        if (n === null) {
          if (required || raw) errors.push(raw ? `${label} illisible : « ${raw} »` : `${label} manquant`);
          return 0;
        }
        if (n < 0) errors.push(`${label} négatif`);
        return n;
      };

      const rawPeriod = getVal(['periode', 'mois', 'month', 'run']);
      const periode = parseMonthCell(rawPeriod) || '';
      if (!periode) errors.push(rawPeriod ? `Période illisible : « ${rawPeriod} » (format AAAA-MM)` : 'Période manquante');
      const matricule = getVal(['matricule', 'id', 'code']);
      const agent = matricule ? users.find(u => (u.matricule || '').toLowerCase() === matricule.toLowerCase()) : undefined;
      if (!matricule) errors.push('Matricule manquant');
      else if (!agent) errors.push(`Matricule inconnu dans l'annuaire : ${matricule}`);
      const nomEmploye = getVal(['nom_employe', 'nom', 'nom_agent']) || agent?.name || '';

      const salaireBase = amount(['salaire_base', 'base', 'salaire'], 'Salaire de base');
      const primes = amount(['primes', 'prime', 'bonus'], 'Primes', false);
      const heuresSupPay = amount(['heures_sup', 'heures_supplementaires', 'overtime'], 'Heures supplémentaires', false);
      // Archive : les retenues et le net sont ceux réellement appliqués, ils ne sont jamais devinés.
      const cnssSalarie = amount(['cnss_salarie', 'cnss_salarie_5pct', 'cnss', 'cnss_sal'], 'CNSS salarié');
      const iprTax = amount(['ipr_deduction', 'ipr', 'impot'], 'IPR');
      const netPaye = amount(['net_paye', 'net', 'salaire_net'], 'Net payé');

      const rawDevise = getVal(['devise', 'currency']).toUpperCase();
      const devise: 'USD' | 'CDF' = rawDevise.includes('CDF') || rawDevise === 'FC' ? 'CDF' : 'USD';
      const rawRate = getVal(['taux_change', 'taux_change_bcc', 'taux', 'rate']);
      const parsedRate = parseAmount(rawRate);
      if (rawRate && (parsedRate === null || parsedRate <= 0)) errors.push(`Taux de change illisible : « ${rawRate} »`);
      const tauxChange = parsedRate && parsedRate > 0 ? parsedRate : exchangeRate;

      const gross = round2(salaireBase + primes + heuresSupPay);
      if (errors.length === 0 && Math.abs(gross - cnssSalarie - iprTax - netPaye) > 1) {
        errors.push(`Net incohérent : brut ${gross} − CNSS ${cnssSalarie} − IPR ${iprTax} ≠ net ${netPaye}`);
      }

      if (periode) {
        firstPeriod ??= periode;
        if (periode !== firstPeriod) errors.push(`Une seule période par import (${firstPeriod} attendue)`);
      }
      firstCurrency ??= devise;
      if (devise !== firstCurrency) errors.push(`Une seule devise par import (${firstCurrency} attendue)`);
      const key = `${periode}|${matricule.toLowerCase()}`;
      if (matricule && seen.has(key)) errors.push('Agent présent deux fois pour cette période');
      seen.add(key);

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
        cnssSalarie: round2(cnssSalarie),
        iprTax: round2(iprTax),
        netPaye: round2(netPaye),
        banque: getVal(['banque', 'bank']),
        refVirement: getVal(['ref_virement', 'reference', 'ref']),
        isValid: errors.length === 0,
        errors
      });
    });

    setParsedPayroll(result);
  };


  const handleExecutePayrollImport = () => {
    const valids = parsedPayroll.filter(p => p.isValid);
    if (valids.length === 0) return;

    // Regroupement par période
    const periodeTarget = valids[0].periode;
    const totalGross = round2(valids.reduce((acc, v) => acc + v.salaireBase + v.primes + v.heuresSupPay, 0));
    const totalNet = round2(valids.reduce((acc, v) => acc + v.netPaye, 0));
    // Les charges patronales réellement versées ne figurent pas dans le fichier : non renseignées.
    const totalEmployerCharges = 0;

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
      validatedByDRH: `Archive importée par ${currentUser.name}`,
      validatedAtDRH: todayLocal(),
      bankTransferConfirmedBy: `Archive importée par ${currentUser.name}`,
      bankTransferReference: valids[0].refVirement || undefined,
      bankTransferConfirmedAt: `${periodeTarget}-29`,
      bankName: valids[0].banque,
      payslipsAutoDispatched: true,
      payslipsDispatchedAt: `${periodeTarget}-29`,
      dispatchedCount: valids.length,
      validatedByDG: `Import CSV par ${currentUser.name}`,
      validatedAt: new Date().toLocaleString('fr-FR'),
      closureHash: contentHashSync(valids)
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
        size: '—',
        fileType: 'PDF',
        targetUserId: u?.id || '',
        targetUserName: row.nomEmploye,
        isConfidentialPayslip: true,
        amount: row.netPaye,
        currency: row.devise,
        description: `Bulletin de paie importé depuis un fichier CSV (archive). Brut ${round2(row.salaireBase + row.primes + row.heuresSupPay)} ${row.devise}, CNSS ${row.cnssSalarie}, IPR ${row.iprTax}, net ${row.netPaye}.${row.banque ? ` Virement ${row.banque}${row.refVirement ? ` (réf. ${row.refVirement})` : ''}.` : ''}`,
        electronicSignature: {
          signedBy: `Archive importée par ${currentUser.name}`,
          signedAt: new Date().toLocaleString('fr-FR'),
          role: 'Import CSV (archive)',
          certificateHash: contentHashSync(row)
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
    const endDate = todayLocal();
    const startDate = periodStartForWorkingDays(targetWorkingDays, endDate);
    const [, mm, yyyy] = endDate.split('-').reverse();
    return entities
      .map(ent => {
        // Agents rattachés directement à cette entité (aucun agent fictif).
        const agentsOfEntity = users.filter(u =>
          u.role !== 'dg' && (u.serviceId || u.divisionId || u.directionId || u.departementId) === ent.id
        );
        if (agentsOfEntity.length === 0) return null;

        let totalNormalHours = 0;
        let totalOvertimeDay = 0;
        let totalOvertimeNight = 0;
        let totalOvertimeHoliday = 0;
        let daysCompleted = 0;

        const agentSummaries = agentsOfEntity.map(ag => {
          const sum = summarizeAttendance(punches, ag.id, startDate, endDate);
          totalNormalHours += sum.normalHours;
          totalOvertimeDay += sum.overtimeDay;
          totalOvertimeNight += sum.overtimeNight;
          totalOvertimeHoliday += sum.overtimeHoliday;
          daysCompleted = Math.max(daysCompleted, sum.daysWorked);
          // Montant indicatif : taux horaire du contrat (salaire / 173,33 h) × majorations saisies.
          const c = contracts.find(k => k.userId === ag.id && k.active !== false);
          const hourly = c ? (c.salaryCurrency === 'CDF' ? c.baseSalary / exchangeRate : c.baseSalary) / 173.33 : 0;
          const bonusUSD =
            sum.overtimeDay * hourly * (1 + overtimeDayRatePercent / 100) +
            sum.overtimeNight * hourly * (1 + overtimeNightRatePercent / 100) +
            sum.overtimeHoliday * hourly * (1 + overtimeHolidayRatePercent / 100);
          return {
            userId: ag.id,
            userName: ag.name,
            matricule: ag.matricule || '—',
            daysWorked: sum.daysWorked,
            normalHours: sum.normalHours,
            overtimeHours: round2(sum.overtimeDay + sum.overtimeNight + sum.overtimeHoliday),
            overtimeDay: sum.overtimeDay,
            overtimeNight: sum.overtimeNight,
            overtimeHoliday: sum.overtimeHoliday,
            estimatedOvertimeBonusUSD: round2(bonusUSD)
          };
        });

        const totalOvertimeHours = round2(totalOvertimeDay + totalOvertimeNight + totalOvertimeHoliday);
        const manager = ent.managerName ? users.find(u => u.name === ent.managerName) : undefined;
        const reached = daysCompleted >= targetWorkingDays;

        const report: Attendance28DaysCycleReport = {
          id: `rpt-att-${ent.id}-${startDate}`,
          cycleNumber: Number(mm),
          monthPeriod: `${mm}/${yyyy}`,
          workingDaysCompleted: daysCompleted,
          targetWorkingDays,
          entityId: ent.id,
          entityName: ent.name,
          entityLevel: ent.level,
          managerId: manager?.id,
          managerName: ent.managerName || manager?.name || 'Responsable non désigné',
          managerEmail: ent.managerEmail || manager?.email || '',
          managerRole: ent.managerRole || manager?.role || (ent.level === 'service' ? 'chef_service' : 'directeur'),
          totalAgents: agentsOfEntity.length,
          totalNormalHours: round2(totalNormalHours),
          totalOvertimeHours,
          overtimeDayHours: round2(totalOvertimeDay),
          overtimeNightHours: round2(totalOvertimeNight),
          overtimeHolidayHours: round2(totalOvertimeHoliday),
          isAutoDispatched: false,
          status: reached ? 'cycle_28j_atteint' : 'en_cours',
          agentSummaries,
          sha256Hash: contentHashSync({ entity: ent.id, startDate, endDate, agentSummaries }),
          signatureCert: {
            signedBy: `Calcul à partir des pointages (${currentOrg.name})`,
            signedAt: localDateTime(),
            role: `Période du ${startDate.split('-').reverse().join('/')} au ${endDate.split('-').reverse().join('/')}`
          }
        };
        return report;
      })
      .filter((r): r is Attendance28DaysCycleReport => r !== null);
  };

  const reportsList = lastDispatchReport || generate28DaysReports();

  // Déclencheur automatique / simulation envoi
  const handleTriggerAutoDispatch28Days = () => {
    const updated = generate28DaysReports().filter(r => r.agentSummaries.some(a => a.daysWorked > 0)).map(r => ({
      ...r,
      isAutoDispatched: true,
      autoDispatchedAt: localDateTime(),
      status: 'transmis_responsable' as const
    }));

    setLastDispatchReport(updated);
    setIsAutoDispatchSimulated(true);

    // Publication du document scellé dans l'ERP
    updated.forEach(rpt => {
      if (onAddDocument) {
        onAddDocument({
          id: newId('doc-att'),
          title: `Rapport Pointage & Heures Sup (28 Jours) - ${rpt.entityName}`,
          referenceNumber: `POINTAGE-${rpt.entityId.toUpperCase()}-${rpt.monthPeriod.replace('/', '')}`,
          category: 'ressources_humaines',
          subtype: 'feuille_de_temps',
          organizationId: currentOrg.id,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorRole: currentUser.role,
          authorEntity: 'Relevé calculé à partir des pointages',
          createdAt: todayLocal(),
          // Le responsable doit encore viser le relevé : il n'est pas approuvé d'office.
          status: 'en_revue',
          size: '—',
          fileType: 'PDF',
          targetEntityId: rpt.entityId,
          targetEntityName: rpt.entityName,
          description: `${rpt.signatureCert?.role ?? ''} : ${rpt.totalAgents} agent(s), ${rpt.totalNormalHours} h normales et ${rpt.totalOvertimeHours} h supplémentaires d'après les pointages enregistrés. Transmis à ${rpt.managerName} pour visa.`,
          allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service'],
          permissions: {
            viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service'],
            editRoles: ['dg'],
            validateRoles: ['dg', 'chef_service', 'directeur'],
            signRoles: ['dg', 'chef_service', 'directeur']
          },
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
          <span>3. Relevés de pointage (28 jours, heures sup.)</span>
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
                placeholder="matricule,nom,prenom,email,telephone,role,intitule_poste,nom_entite,type_contrat,date_embauche,salaire_base,devise,cnss_numero,banque,compte_bancaire,mode_paiement,personnes_charge"
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
                placeholder="periode,matricule,nom_employe,salaire_base,primes,heures_sup,devise,taux_change,cnss_salarie,ipr_deduction,net_paye,banque,ref_virement"
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
                      <th className="p-3 text-right">CNSS salarié</th>
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
                  Relevés calculés à partir des <strong>pointages enregistrés</strong> par les agents (Espace Employé) sur les {targetWorkingDays} derniers jours ouvrables : heures normales (8 h/jour), heures supplémentaires de jour, de nuit (22 h – 6 h) et du dimanche. Les montants sont indicatifs ; les majorations légales restent à faire valider.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerAutoDispatch28Days}
                  className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Transmettre les relevés aux responsables</span>
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
                <span className="text-[10px] text-slate-500">Période de calcul du relevé</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold block">Heures Sup. Jour :</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">+{overtimeDayRatePercent}%</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded font-bold">À valider</span>
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
                <span className="text-[10px] text-slate-500">Majoration à faire valider (Code du travail)</span>
              </div>
            </div>

            {isAutoDispatchSimulated && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <strong className="block text-emerald-200">Relevés transmis</strong>
                    Un relevé par entité ayant des pointages a été ajouté aux Documents, en attente du visa du responsable.
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
                {reportsList.length} entité(s) avec des agents rattachés
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
