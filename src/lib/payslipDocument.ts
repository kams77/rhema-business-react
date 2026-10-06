// src/lib/payslipDocument.ts — construction des données d'un bulletin (aperçu, PDF, CSV)
// à partir du calcul du moteur de paie. Aucune valeur fictive : un identifiant légal absent
// est affiché « Non renseigné ».
import type { EmployeeContract, Organization, User } from '../types';
import type { PayslipComputation } from './payroll';
import { payMonthLabel } from './payroll';
import { contentHash } from './integrity';
import type { PayslipExportData, PayslipExportLine } from '../utils/exportUtils';

export const NOT_PROVIDED = 'Non renseigné';

const pct = (rate: number) => `${Number(rate.toFixed(2))} %`;

/** Lignes détaillées (gains, retenues, charges patronales) d'un bulletin. */
export function payslipLines(p: PayslipComputation): {
  earnings: PayslipExportLine[];
  deductions: PayslipExportLine[];
  employer: PayslipExportLine[];
} {
  const earnings: PayslipExportLine[] = [{ label: 'Salaire de base', base: 'Contrat', amount: p.baseSalary }];
  if (p.seniorityBonus > 0) {
    earnings.push({ label: `Prime d'ancienneté (${p.seniorityYears} an${p.seniorityYears > 1 ? 's' : ''})`, base: 'Configuration', amount: p.seniorityBonus });
  }
  for (const a of p.allowances) {
    if (a.amount > 0) {
      const flags = [a.isTaxable ? 'imposable' : 'non imposable', a.isSubjectToSocial ? 'cotisable' : 'non cotisable'].join(', ');
      earnings.push({ label: a.name, base: flags, amount: a.amount });
    }
  }
  if (p.overtimeAmount > 0) earnings.push({ label: 'Heures supplémentaires approuvées', base: 'Majorations configurées', amount: p.overtimeAmount });
  if (p.extraBonus > 0) earnings.push({ label: 'Prime exceptionnelle du mois', base: 'Période de paie', amount: p.extraBonus });

  const deductions: PayslipExportLine[] = p.employeeContributions.map(c => ({
    label: c.name,
    base: `${pct(c.rate)} × ${c.base.toLocaleString('fr-FR')}`,
    rate: c.rate,
    amount: c.amount,
  }));
  if (p.incomeTax > 0 || p.incomeTaxBeforeCredit > 0) {
    deductions.push({
      label: 'Impôt sur les rémunérations',
      base: `Barème configuré sur ${p.taxableNet.toLocaleString('fr-FR')}${p.dependentCredit > 0 ? ` (réduction enfants : ${p.dependentCredit.toLocaleString('fr-FR')})` : ''}`,
      amount: p.incomeTax,
    });
  }
  if (p.localTax > 0) deductions.push({ label: 'Taxe locale', base: 'Configuration', amount: p.localTax });
  if (p.advanceDeduction > 0) deductions.push({ label: 'Remboursement d\'avance sur salaire', base: 'Avance validée', amount: p.advanceDeduction });

  const employer: PayslipExportLine[] = p.employerContributions.map(c => ({
    label: c.name,
    base: `${pct(c.rate)} × ${c.base.toLocaleString('fr-FR')}`,
    rate: c.rate,
    amount: c.amount,
  }));

  return { earnings, deductions, employer };
}

const sumByCode = (p: PayslipComputation, test: (code: string) => boolean) =>
  p.employerContributions.filter(c => test(c.code.toUpperCase())).reduce((s, c) => s + c.amount, 0);

/** Données complètes d'un bulletin pour l'aperçu et les exports (sans empreinte). */
export function buildPayslipExport(
  p: PayslipComputation,
  info: {
    org: Organization;
    month: string;
    ref: string;
    user?: Pick<User, 'name' | 'roleTitle' | 'matricule'>;
    contract?: Pick<EmployeeContract, 'matricule' | 'cnssNumber' | 'bankName' | 'bankAccountNumber' | 'categoryPro' | 'dependentsCount'>;
    dependents?: number;
  }
): PayslipExportData {
  const lines = payslipLines(p);
  return {
    orgName: info.org.name,
    rccm: info.org.rccm || info.org.registrationNumber || NOT_PROVIDED,
    idNat: info.org.idNat || NOT_PROVIDED,
    numImpot: info.org.numImpot || NOT_PROVIDED,
    headquarters: info.org.headquarters,
    ref: info.ref,
    period: payMonthLabel(info.month),
    date: new Date().toLocaleDateString('fr-FR'),
    employeeName: info.user?.name || NOT_PROVIDED,
    matricule: info.contract?.matricule || info.user?.matricule || NOT_PROVIDED,
    roleTitle: info.user?.roleTitle || info.contract?.categoryPro || NOT_PROVIDED,
    cnssNumber: info.contract?.cnssNumber || NOT_PROVIDED,
    bankName: info.contract?.bankName || NOT_PROVIDED,
    accountNumber: info.contract?.bankAccountNumber || NOT_PROVIDED,
    seniorityYears: p.seniorityYears,
    dependents: info.dependents ?? info.contract?.dependentsCount ?? 0,
    currency: p.currency,
    baseSalary: p.baseSalary,
    seniorityBonus: p.seniorityBonus,
    allowances: p.totalAllowances,
    overtimeAmount: p.overtimeAmount,
    grossSalary: p.grossSalary,
    socialDeductionCNSS: p.totalEmployeeContributions,
    taxDeductionIPR: p.totalTaxes,
    advanceDeduction: p.advanceDeduction,
    totalDeductions: p.totalDeductions,
    netSalary: p.netSalary,
    counterValueCDF: p.currency === 'USD' ? p.netCounterValue : p.netSalary,
    employerCNSS: sumByCode(p, c => c.startsWith('CNSS')),
    employerINPP: sumByCode(p, c => c.startsWith('INPP')),
    employerONEM: sumByCode(p, c => c.startsWith('ONEM')),
    totalEmployerCost: p.totalEmployerCost,
    earnings: lines.earnings,
    deductions: lines.deductions,
    employerLines: lines.employer,
  };
}

/** Ajoute l'empreinte SHA-256 réelle du contenu du bulletin. */
export async function withIntegrityHash(data: PayslipExportData): Promise<PayslipExportData> {
  const { date: _date, sha256Hash: _h, ...content } = data;
  return { ...data, sha256Hash: await contentHash(content as Record<string, unknown>) };
}
