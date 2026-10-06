// src/lib/payroll.ts — moteur de calcul de la paie (unique pour tout le module).
//
// Le simulateur, le tableau des salaires, les bulletins PDF/CSV et l'envoi mensuel utilisent
// tous ce fichier. Les règles viennent EXCLUSIVEMENT de la configuration de l'organisation
// (barème fiscal, cotisations, primes, ancienneté, heures supplémentaires) : aucun taux
// n'est écrit en dur ici.
//
// Conventions :
// - Les montants FIXES de la configuration (primes fixes, tranches du barème, réduction par
//   enfant, taxe locale) sont exprimés dans la devise de la configuration (config.currency).
// - Le bulletin est calculé dans la devise du contrat ; les conversions utilisent le taux
//   de change de la période (CDF pour 1 USD).
// - Les tranches du barème sont des montants MENSUELS.
import type {
  EmployeeContract,
  OvertimeRecord,
  PayrollSystemConfig,
  SalaryAdvanceRequest,
} from '../types';

export type Currency = 'USD' | 'CDF';

export interface PayslipLine {
  name: string;
  code: string;
  amount: number;
}

export interface ContributionLine extends PayslipLine {
  rate: number;
  base: number;
}

export interface PayslipComputation {
  currency: Currency;
  exchangeRate: number;
  baseSalary: number;
  seniorityYears: number;
  seniorityBonus: number;
  allowances: Array<PayslipLine & { isTaxable: boolean; isSubjectToSocial: boolean }>;
  totalAllowances: number;
  overtimeAmount: number;
  extraBonus: number;
  grossSalary: number;
  grossSocialSalary: number;
  grossTaxableSalary: number;
  employeeContributions: ContributionLine[];
  totalEmployeeContributions: number;
  employerContributions: ContributionLine[];
  totalEmployerContributions: number;
  taxableNet: number;
  incomeTaxBeforeCredit: number;
  dependentCredit: number;
  incomeTax: number;
  localTax: number;
  totalTaxes: number;
  advanceDeduction: number;
  totalDeductions: number;
  netSalary: number;
  totalEmployerCost: number;
  /** Contre-valeur du net dans l'autre devise. */
  netCounterValue: number;
  counterValueCurrency: Currency;
}

export interface PayslipInput {
  config: PayrollSystemConfig;
  baseSalary: number;
  currency: Currency;
  exchangeRate: number;
  seniorityYears?: number;
  dependents?: number;
  /** Heures supplémentaires du mois (devise du bulletin), soumises aux cotisations et à l'impôt. */
  overtimeAmount?: number;
  /** Prime exceptionnelle du mois (devise du bulletin), soumise aux cotisations et à l'impôt. */
  extraBonus?: number;
  /** Remboursement d'avances sur salaire (devise du bulletin), déduit du net. */
  advanceDeduction?: number;
}

const safe = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** Arrondi monétaire : centimes pour l'USD, franc entier pour le CDF. */
export function roundMoney(amount: number, currency: Currency): number {
  const v = safe(amount);
  return currency === 'USD' ? Math.round(v * 100) / 100 : Math.round(v);
}

/** Conversion USD <-> CDF (rate = nombre de CDF pour 1 USD). */
export function convert(amount: number, from: Currency, to: Currency, rate: number): number {
  const v = safe(amount);
  if (from === to) return v;
  const r = safe(rate) > 0 ? rate : 1;
  return from === 'USD' ? v * r : v / r;
}

/** Impôt progressif par tranches (montants dans la devise de la configuration). */
export function progressiveTax(taxable: number, brackets: PayrollSystemConfig['taxConfig']['brackets']): number {
  const sorted = [...(brackets || [])].sort((a, b) => a.min - b.min);
  let tax = 0;
  for (const b of sorted) {
    if (taxable <= b.min) break;
    const upper = b.max === null || b.max === undefined ? taxable : Math.min(taxable, b.max);
    if (upper > b.min) tax += (upper - b.min) * (safe(b.rate) / 100);
  }
  return tax;
}

/** Calcule un bulletin complet à partir de la configuration de l'organisation. */
export function computePayslip(input: PayslipInput): PayslipComputation {
  const { config } = input;
  const cur = input.currency;
  const cfgCur: Currency = config.currency === 'CDF' ? 'CDF' : 'USD';
  const rate = safe(input.exchangeRate) > 0 ? input.exchangeRate : 1;
  const fromCfg = (v: number) => convert(v, cfgCur, cur, rate);
  const toCfg = (v: number) => convert(v, cur, cfgCur, rate);
  const r = (v: number) => roundMoney(v, cur);

  const baseSalary = Math.max(0, safe(input.baseSalary));
  const seniorityYears = Math.max(0, Math.floor(safe(input.seniorityYears)));
  const dependents = Math.max(0, Math.floor(safe(input.dependents)));
  const overtimeAmount = r(Math.max(0, safe(input.overtimeAmount)));
  const extraBonus = r(Math.max(0, safe(input.extraBonus)));
  const advanceDeduction = r(Math.max(0, safe(input.advanceDeduction)));

  // 1. Prime d'ancienneté : X % du salaire de base par tranche complète de 2 ans.
  const seniorityBonus = r(baseSalary * Math.floor(seniorityYears / 2) * (safe(config.seniorityBonusPerTwoYearsPercent) / 100));

  // 2. Primes et indemnités actives.
  const allowances = (config.allowances || [])
    .filter(a => a.isActive)
    .map(a => {
      let amount = a.type === 'pourcentage' ? baseSalary * (safe(a.defaultValue) / 100) : fromCfg(safe(a.defaultValue));
      // Les allocations familiales sont versées par enfant à charge.
      if (a.code === 'ALLOC_FAM') amount *= dependents;
      return {
        name: a.name,
        code: a.code,
        amount: r(amount),
        isTaxable: !!a.isTaxable,
        isSubjectToSocial: !!a.isSubjectToSocialContributions,
      };
    });
  const totalAllowances = r(allowances.reduce((s, a) => s + a.amount, 0));

  // 3. Brut et assiettes (les heures sup et primes exceptionnelles sont imposables et cotisables).
  const variable = seniorityBonus + overtimeAmount + extraBonus;
  const grossSalary = r(baseSalary + variable + totalAllowances);
  const grossSocialSalary = r(baseSalary + variable + allowances.filter(a => a.isSubjectToSocial).reduce((s, a) => s + a.amount, 0));
  const grossTaxableSalary = r(baseSalary + variable + allowances.filter(a => a.isTaxable).reduce((s, a) => s + a.amount, 0));

  // 4. Cotisations sociales (plafonds exprimés dans la devise de la configuration).
  const contributions = (side: 'employeeRate' | 'employerRate'): ContributionLine[] =>
    (config.socialContributions || [])
      .filter(sc => sc.isActive && safe(sc[side]) > 0)
      .map(sc => {
        const base = sc.ceilingAmount ? Math.min(grossSocialSalary, fromCfg(sc.ceilingAmount)) : grossSocialSalary;
        return { name: sc.name, code: sc.code, rate: safe(sc[side]), base: r(base), amount: r(base * (safe(sc[side]) / 100)) };
      });
  const employeeContributions = contributions('employeeRate');
  const employerContributions = contributions('employerRate');
  const totalEmployeeContributions = r(employeeContributions.reduce((s, c) => s + c.amount, 0));
  const totalEmployerContributions = r(employerContributions.reduce((s, c) => s + c.amount, 0));

  // 5. Impôt sur les rémunérations, calculé dans la devise du barème puis reconverti.
  const taxableNet = r(Math.max(0, grossTaxableSalary - totalEmployeeContributions));
  const tax = config.taxConfig || ({} as PayrollSystemConfig['taxConfig']);
  const taxCfg =
    tax.type === 'fixe'
      ? toCfg(taxableNet) * (safe(tax.flatRate) / 100)
      : progressiveTax(toCfg(taxableNet), tax.brackets);
  const incomeTaxBeforeCredit = r(fromCfg(taxCfg));
  const dependentCredit = r(Math.min(incomeTaxBeforeCredit, fromCfg(dependents * safe(tax.creditPerDependentChild))));
  const incomeTax = r(incomeTaxBeforeCredit - dependentCredit);
  const localTax = r(fromCfg(safe(tax.localDevelopmentTax)));
  const totalTaxes = r(incomeTax + localTax);

  // 6. Net à payer et coût employeur.
  const totalDeductions = r(totalEmployeeContributions + totalTaxes + advanceDeduction);
  const netSalary = r(grossSalary - totalDeductions);
  const totalEmployerCost = r(grossSalary + totalEmployerContributions);
  const counterValueCurrency: Currency = cur === 'USD' ? 'CDF' : 'USD';

  return {
    currency: cur,
    exchangeRate: rate,
    baseSalary: r(baseSalary),
    seniorityYears,
    seniorityBonus,
    allowances,
    totalAllowances,
    overtimeAmount,
    extraBonus,
    grossSalary,
    grossSocialSalary,
    grossTaxableSalary,
    employeeContributions,
    totalEmployeeContributions,
    employerContributions,
    totalEmployerContributions,
    taxableNet,
    incomeTaxBeforeCredit,
    dependentCredit,
    incomeTax,
    localTax,
    totalTaxes,
    advanceDeduction,
    totalDeductions,
    netSalary,
    totalEmployerCost,
    netCounterValue: roundMoney(convert(netSalary, cur, counterValueCurrency, rate), counterValueCurrency),
    counterValueCurrency,
  };
}

// ---------------------------------------------------------------------------
// Période de paie
// ---------------------------------------------------------------------------
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** Mois de paie courant au format AAAA-MM. */
export function currentPayMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Mois suivant (AAAA-MM). */
export function nextPayMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** « 2026-10 » → « Octobre 2026 ». */
export function payMonthLabel(month: string): string {
  const [y, m] = (month || '').split('-').map(Number);
  return y && m >= 1 && m <= 12 ? `${MONTHS_FR[m - 1]} ${y}` : month;
}

/** Dernier jour du mois (AAAA-MM-JJ). */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}

/** Ancienneté en années complètes à la fin du mois de paie. */
export function seniorityYearsAt(startDate: string | undefined, month: string): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 0;
  const end = new Date(lastDayOfMonth(month));
  let years = end.getFullYear() - start.getFullYear();
  if (end.getMonth() < start.getMonth() || (end.getMonth() === start.getMonth() && end.getDate() < start.getDate())) years--;
  return Math.max(0, years);
}

/** Taux horaire de base d'un contrat (devise du contrat). */
export function hourlyRateOf(contract: Pick<EmployeeContract, 'baseSalary'>, config: PayrollSystemConfig): number {
  const hours = safe(config.standardMonthlyHours) > 0 ? config.standardMonthlyHours : 173.33;
  return safe(contract.baseSalary) / hours;
}

/** Montant des heures supplémentaires selon les majorations de la configuration (devise du contrat). */
export function overtimeAmountFor(
  hours: { dayHours: number; nightHours: number; holidayHours: number },
  hourlyRate: number,
  config: PayrollSystemConfig
): number {
  const o = config.overtimeRates || { firstBracketRate: 0, secondBracketRate: 0, weekendHolidayRate: 0 };
  return (
    safe(hours.dayHours) * hourlyRate * (1 + safe(o.firstBracketRate) / 100) +
    safe(hours.nightHours) * hourlyRate * (1 + safe(o.secondBracketRate) / 100) +
    safe(hours.holidayHours) * hourlyRate * (1 + safe(o.weekendHolidayRate) / 100)
  );
}

/** Total des heures supplémentaires APPROUVÉES du mois, dans la devise du contrat. */
export function approvedOvertimeForMonth(
  records: OvertimeRecord[],
  userId: string,
  month: string,
  contract: EmployeeContract | undefined,
  config: PayrollSystemConfig,
  exchangeRate: number
): number {
  const cur: Currency = contract?.salaryCurrency === 'CDF' ? 'CDF' : 'USD';
  return records
    .filter(o => o.userId === userId && o.month === month && o.status === 'approuve')
    .reduce((sum, o) => {
      const stored = o.currency === 'CDF' ? o.calculatedAmountCDF : o.currency === 'USD' ? o.calculatedAmountUSD : undefined;
      if (o.currency && typeof stored === 'number') {
        return sum + convert(stored, o.currency, cur, exchangeRate);
      }
      // Ancien format : recalcul à partir des heures et du contrat.
      return sum + (contract ? overtimeAmountFor(o, hourlyRateOf(contract, config), config) : 0);
    }, 0);
}

/** Avances validées à rembourser sur le mois, dans la devise du contrat. */
export function advancesDueForMonth(
  advances: SalaryAdvanceRequest[],
  userId: string,
  month: string,
  currency: Currency,
  exchangeRate: number
): number {
  return advances
    .filter(a => a.userId === userId && a.repaymentMonth === month && (a.status === 'valide_rh' || a.status === 'paye'))
    .reduce((sum, a) => sum + convert(a.amount, a.currency === 'CDF' ? 'CDF' : 'USD', currency, exchangeRate), 0);
}

/** Bulletin d'un contrat pour un mois donné (toutes les règles réunies). */
export function computePayslipForContract(
  contract: EmployeeContract,
  ctx: {
    config: PayrollSystemConfig;
    month: string;
    exchangeRate: number;
    overtimeRecords?: OvertimeRecord[];
    advances?: SalaryAdvanceRequest[];
    extraBonus?: number;
  }
): PayslipComputation {
  const currency: Currency = contract.salaryCurrency === 'CDF' ? 'CDF' : 'USD';
  return computePayslip({
    config: ctx.config,
    baseSalary: contract.baseSalary,
    currency,
    exchangeRate: ctx.exchangeRate,
    seniorityYears: seniorityYearsAt(contract.startDate, ctx.month),
    dependents: contract.dependentsCount,
    overtimeAmount: approvedOvertimeForMonth(ctx.overtimeRecords || [], contract.userId, ctx.month, contract, ctx.config, ctx.exchangeRate),
    advanceDeduction: advancesDueForMonth(ctx.advances || [], contract.userId, ctx.month, currency, ctx.exchangeRate),
    extraBonus: ctx.extraBonus,
  });
}

/** Contrat actif à la date du mois de paie (non terminé avant le début du mois). */
export function isContractActiveForMonth(contract: EmployeeContract, month: string): boolean {
  if (contract.active === false) return false;
  if (contract.startDate && contract.startDate.slice(0, 7) > month) return false;
  if (contract.endDate && contract.endDate.slice(0, 7) < month) return false;
  return true;
}
