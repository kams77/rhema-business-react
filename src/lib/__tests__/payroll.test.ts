// Tests du moteur de paie — exécutés par `npm run test:paie` (et par la CI).
import assert from 'node:assert/strict';
import {
  computePayslip,
  computePayslipForContract,
  progressiveTax,
  seniorityYearsAt,
  approvedOvertimeForMonth,
  advancesDueForMonth,
  isContractActiveForMonth,
  payMonthLabel,
  nextPayMonth,
} from '../payroll';
import type { EmployeeContract, PayrollSystemConfig } from '../../types';

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`✓ ${name}`);
};

// Configuration minimale et entièrement maîtrisée par le test.
const config: PayrollSystemConfig = {
  id: 'cfg', organizationId: 'o', isStandardTemplate: false, systemName: 'Test', currency: 'USD',
  standardMonthlyHours: 160,
  overtimeRates: { firstBracketRate: 30, secondBracketRate: 60, weekendHolidayRate: 100 },
  payFrequency: 'mensuelle',
  allowances: [
    { id: 'a1', name: 'Transport', code: 'IND_TRANSP', type: 'fixe', defaultValue: 100, isTaxable: false, isSubjectToSocialContributions: false, isActive: true } as any,
    { id: 'a2', name: 'Logement', code: 'IND_LOGEM', type: 'pourcentage', defaultValue: 10, isTaxable: true, isSubjectToSocialContributions: true, isActive: true } as any,
    { id: 'a3', name: 'Inactive', code: 'X', type: 'fixe', defaultValue: 999, isTaxable: true, isSubjectToSocialContributions: true, isActive: false } as any,
  ],
  socialContributions: [
    { id: 's1', name: 'CNSS', code: 'CNSS', employeeRate: 5, employerRate: 13, isActive: true } as any,
    { id: 's2', name: 'Plafonnée', code: 'CAP', employeeRate: 2, employerRate: 0, ceilingAmount: 500, isActive: true } as any,
  ],
  taxConfig: {
    taxName: 'Impôt', type: 'progressif', creditPerDependentChild: 5, localDevelopmentTax: 0,
    brackets: [
      { id: 'b1', min: 0, max: 100, rate: 0 },
      { id: 'b2', min: 100, max: 500, rate: 10 },
      { id: 'b3', min: 500, max: null, rate: 20 },
    ],
  },
  seniorityBonusPerTwoYearsPercent: 3,
};

test('barème progressif par tranches', () => {
  assert.equal(progressiveTax(50, config.taxConfig.brackets), 0);
  assert.equal(progressiveTax(300, config.taxConfig.brackets), 20); // (300-100)*10%
  assert.equal(progressiveTax(1000, config.taxConfig.brackets), 140); // 400*10% + 500*20%
});

test('bulletin complet calculé uniquement depuis la configuration', () => {
  const p = computePayslip({ config, baseSalary: 1000, currency: 'USD', exchangeRate: 2800, seniorityYears: 4, dependents: 2 });
  assert.equal(p.seniorityBonus, 60); // 1000 × 2 tranches × 3 %
  assert.equal(p.totalAllowances, 200); // 100 transport + 10 % logement ; l'inactive est ignorée
  assert.equal(p.grossSalary, 1260);
  assert.equal(p.grossSocialSalary, 1160); // transport exclu
  assert.equal(p.totalEmployeeContributions, 68); // 5 % × 1160 + 2 % × plafond 500
  assert.equal(p.taxableNet, 1092); // 1160 imposable − 68
  assert.equal(p.incomeTaxBeforeCredit, 158.4); // 40 + 592 × 20 %
  assert.equal(p.dependentCredit, 10);
  assert.equal(p.incomeTax, 148.4);
  assert.equal(p.netSalary, 1043.6); // 1260 − 68 − 148.4
  assert.equal(p.totalEmployerContributions, 150.8); // 13 % × 1160
  assert.equal(p.netCounterValue, 2922080);
});

test('changer le barème change le bulletin (plus aucun taux figé)', () => {
  const flat = { ...config, taxConfig: { ...config.taxConfig, type: 'fixe' as const, flatRate: 15 } };
  const p = computePayslip({ config: flat, baseSalary: 1000, currency: 'USD', exchangeRate: 2800 });
  assert.equal(p.incomeTax, Math.round((p.taxableNet * 0.15) * 100) / 100);
  const noCnss = { ...config, socialContributions: [] };
  assert.equal(computePayslip({ config: noCnss, baseSalary: 1000, currency: 'USD', exchangeRate: 1 }).totalEmployeeContributions, 0);
});

test('contrat en CDF avec barème en USD : conversions cohérentes', () => {
  const usd = computePayslip({ config, baseSalary: 1000, currency: 'USD', exchangeRate: 2000 });
  const cdf = computePayslip({ config, baseSalary: 2_000_000, currency: 'CDF', exchangeRate: 2000 });
  assert.equal(cdf.grossSalary, usd.grossSalary * 2000);
  assert.ok(Math.abs(cdf.netSalary - usd.netSalary * 2000) <= 1);
  assert.equal(Number.isInteger(cdf.netSalary), true); // arrondi au franc
});

test('heures sup et prime exceptionnelle imposables, avance déduite du net', () => {
  const base = computePayslip({ config, baseSalary: 1000, currency: 'USD', exchangeRate: 1 });
  const p = computePayslip({ config, baseSalary: 1000, currency: 'USD', exchangeRate: 1, overtimeAmount: 100, advanceDeduction: 50 });
  assert.equal(p.grossSalary, base.grossSalary + 100);
  assert.ok(p.incomeTax > base.incomeTax);
  assert.equal(p.netSalary, Math.round((p.grossSalary - p.totalEmployeeContributions - p.totalTaxes - 50) * 100) / 100);
});

test('ancienneté calculée depuis la date d\'embauche', () => {
  assert.equal(seniorityYearsAt('2020-11-15', '2026-10'), 5);
  assert.equal(seniorityYearsAt('2020-10-15', '2026-10'), 6);
  assert.equal(seniorityYearsAt(undefined, '2026-10'), 0);
});

const contract: EmployeeContract = {
  id: 'c', userId: 'u1', employeeCode: 'E1', matricule: 'M1', contractType: 'CDI', startDate: '2022-01-10',
  baseSalary: 1600, salaryCurrency: 'USD', categoryPro: 'Cadre', echelon: '1', cnssNumber: 'X', inppRegistered: true,
  onemRegistered: true, bankName: 'B', paymentMode: 'virement', dependentsCount: 1, maritalStatus: 'marie', active: true,
};

test('heures sup : seules celles APPROUVÉES du bon mois comptent', () => {
  const records: any[] = [
    { userId: 'u1', month: '2026-10', status: 'approuve', dayHours: 10, nightHours: 0, holidayHours: 0 },
    { userId: 'u1', month: '2026-09', status: 'approuve', dayHours: 50, nightHours: 0, holidayHours: 0 },
    { userId: 'u1', month: '2026-10', status: 'en_attente', dayHours: 50, nightHours: 0, holidayHours: 0 },
    { userId: 'u2', month: '2026-10', status: 'approuve', dayHours: 50, nightHours: 0, holidayHours: 0 },
  ];
  // taux horaire = 1600 / 160 = 10 ; 10 h × 10 × 1,3 = 130
  assert.equal(approvedOvertimeForMonth(records, 'u1', '2026-10', contract, config, 2800), 130);
});

test('avances : seules celles validées et dues ce mois-ci', () => {
  const adv: any[] = [
    { userId: 'u1', repaymentMonth: '2026-10', status: 'valide_rh', amount: 100, currency: 'USD' },
    { userId: 'u1', repaymentMonth: '2026-10', status: 'rejete', amount: 500, currency: 'USD' },
    { userId: 'u1', repaymentMonth: '2026-10', status: 'paye', amount: 28000, currency: 'CDF' },
    { userId: 'u1', repaymentMonth: '2026-11', status: 'valide_rh', amount: 100, currency: 'USD' },
  ];
  assert.equal(advancesDueForMonth(adv, 'u1', '2026-10', 'USD', 2800), 110);
});

test('bulletin d\'un contrat pour un mois donné', () => {
  const p = computePayslipForContract(contract, { config, month: '2026-10', exchangeRate: 2800 });
  assert.equal(p.seniorityYears, 4);
  assert.equal(p.seniorityBonus, 96); // 1600 × 2 × 3 %
});

test('contrats actifs selon les dates', () => {
  assert.equal(isContractActiveForMonth(contract, '2026-10'), true);
  assert.equal(isContractActiveForMonth({ ...contract, startDate: '2026-11-01' }, '2026-10'), false);
  assert.equal(isContractActiveForMonth({ ...contract, endDate: '2026-09-30' }, '2026-10'), false);
  assert.equal(isContractActiveForMonth({ ...contract, active: false }, '2026-10'), false);
});

test('libellés de période', () => {
  assert.equal(payMonthLabel('2026-10'), 'Octobre 2026');
  assert.equal(nextPayMonth('2026-12'), '2027-01');
});

console.log(`\n${n} tests de paie réussis.`);
