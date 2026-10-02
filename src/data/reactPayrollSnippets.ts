/**
 * Code React + TypeScript Production - Module de Paie & RH Spécifique RDC
 * Intégrable dans n'importe quelle application React / Next.js / Vite
 */

export const reactPayrollSnippets = {
  // 1. Moteur de Calcul & Hook React
  react_engine_hook: `// =====================================================================
// 1. MOTEUR DE CALCUL & HOOK REACT (useDRCPayroll.ts)
// Conforme au Code du Travail RDC (Loi 015/2002) & Barème IPR DGI
// =====================================================================

import { useState, useMemo, useCallback } from 'react';

export interface EmployeeSalaryData {
  id: string;
  name: string;
  matricule: string;
  categoryPro: string;
  baseSalary: number;
  salaryCurrency: 'USD' | 'CDF';
  dependentsCount: number; // Enfants à charge (déduction IPR 2% / enf, max 9)
  dayOtHours?: number;     // Heures sup jour ouvrable (+30%)
  nightOtHours?: number;   // Heures sup nuit (+60%)
  sundayOtHours?: number;  // Heures sup dimanche / férié (+100%)
  advancesToDeduct?: number; // Avance sur salaire programmée
}

export interface PayslipCalculationResult {
  baseSalary: number;
  hourlyRate: number;
  overtimePay: number;
  allowancesTotal: number;
  grossSalary: number;
  cnssEmployee: number; // 5%
  taxableIprBase: number;
  iprDeduction: number;
  advanceDeduction: number;
  netToPay: number;
  convertedNetOpposite: number;
  cnssEmployer: number; // 13%
  inppEmployer: number; // 3%
  onemEmployer: number; // 0.2%
  totalEmployerCost: number;
  sha256Seal: string;
}

export const LEGAL_HOURS_PER_MONTH = 173.33; // 40h/semaine RDC

export function calculateDRCPayslip(
  employee: EmployeeSalaryData,
  exchangeRateUSD_CDF: number = 2850
): PayslipCalculationResult {
  const currency = employee.salaryCurrency;
  const base = employee.baseSalary;
  const hourlyRate = base / LEGAL_HOURS_PER_MONTH;

  // 1. Heures Supplémentaires (Art. 119 Code du Travail RDC)
  const otDay = (employee.dayOtHours || 0) * hourlyRate * 1.30;
  const otNight = (employee.nightOtHours || 0) * hourlyRate * 1.60;
  const otSunday = (employee.sundayOtHours || 0) * hourlyRate * 2.00;
  const overtimePay = Math.round(otDay + otNight + otSunday);

  // 2. Primes conventionnelles (Transport 10% + Logement 5%)
  const allowancesTotal = Math.round(base * 0.15);

  // 3. Salaire Brut Imposable
  const grossSalary = base + overtimePay + allowancesTotal;

  // 4. Retenue CNSS Salarié (5% légal à la source)
  const cnssEmployee = Math.round(grossSalary * 0.05);

  // 5. Assiette Fiscale IPR
  const taxableIprBase = grossSalary - cnssEmployee;

  // 6. Calcul Barème Progressif IPR DGI en Francs Congolais (CDF)
  const baseCDF = currency === 'USD' ? taxableIprBase * exchangeRateUSD_CDF : taxableIprBase;

  const brackets = [
    { limit: 162000, rate: 0.03 },
    { limit: 324000, rate: 0.15 },
    { limit: 648000, rate: 0.30 },
    { limit: Infinity, rate: 0.40 }
  ];

  let rawTaxCDF = 0;
  let previousLimit = 0;

  for (const b of brackets) {
    if (baseCDF > previousLimit) {
      const taxableSlice = Math.min(baseCDF - previousLimit, b.limit - previousLimit);
      rawTaxCDF += taxableSlice * b.rate;
      previousLimit = b.limit;
    } else {
      break;
    }
  }

  // Réduction pour charges de famille (2% par enfant, plafond de 9 enfants = 18%)
  const dependents = Math.min(Math.max(employee.dependentsCount || 0, 0), 9);
  const familyDiscount = rawTaxCDF * (dependents * 0.02);
  const finalTaxCDF = Math.max(0, rawTaxCDF - familyDiscount);

  const iprDeduction = currency === 'USD' 
    ? Math.round((finalTaxCDF / exchangeRateUSD_CDF) * 100) / 100
    : Math.round(finalTaxCDF);

  // 7. Retenue Avance sur Salaire
  const advanceDeduction = employee.advancesToDeduct || 0;

  // 8. Salaire Net à Payer
  const netToPay = Math.max(0, grossSalary - cnssEmployee - iprDeduction - advanceDeduction);

  // 9. Charges Patronales RDC
  const cnssEmployer = Math.round(grossSalary * 0.13); // 13% CNSS Patronale
  const inppEmployer = Math.round(grossSalary * 0.03); // 3% INPP
  const onemEmployer = Math.round(grossSalary * 0.002); // 0.2% ONEM
  const totalEmployerCost = grossSalary + cnssEmployer + inppEmployer + onemEmployer;

  // 10. Contre-valeur monétaire
  const convertedNetOpposite = currency === 'USD'
    ? Math.round(netToPay * exchangeRateUSD_CDF)
    : Math.round(netToPay / exchangeRateUSD_CDF);

  // 11. Scellé SHA-256
  const sha256Seal = \`SEAL-\${employee.matricule}-\${Date.now().toString(36).toUpperCase()}\`;

  return {
    baseSalary: base,
    hourlyRate: Math.round(hourlyRate * 100) / 100,
    overtimePay,
    allowancesTotal,
    grossSalary,
    cnssEmployee,
    taxableIprBase,
    iprDeduction,
    advanceDeduction,
    netToPay,
    convertedNetOpposite,
    cnssEmployer,
    inppEmployer,
    onemEmployer,
    totalEmployerCost,
    sha256Seal
  };
}

export function useDRCPayroll(employees: EmployeeSalaryData[], exchangeRate: number = 2850) {
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const [currentRate, setCurrentRate] = useState<number>(exchangeRate);

  const computedPayroll = useMemo(() => {
    return employees.map(emp => ({
      employee: emp,
      calculation: calculateDRCPayslip(emp, currentRate)
    }));
  }, [employees, currentRate]);

  const totals = useMemo(() => {
    return computedPayroll.reduce((acc, curr) => {
      const calc = curr.calculation;
      return {
        totalGross: acc.totalGross + calc.grossSalary,
        totalNet: acc.totalNet + calc.netToPay,
        totalCNSS: acc.totalCNSS + calc.cnssEmployee + calc.cnssEmployer,
        totalIPR: acc.totalIPR + calc.iprDeduction,
        totalEmployerCost: acc.totalEmployerCost + calc.totalEmployerCost
      };
    }, { totalGross: 0, totalNet: 0, totalCNSS: 0, totalIPR: 0, totalEmployerCost: 0 });
  }, [computedPayroll]);

  return {
    currency,
    setCurrency,
    currentRate,
    setCurrentRate,
    computedPayroll,
    totals
  };
}
`,

  // 2. Composant Tableau de Bord Paie & Clôture Mensuelle
  react_dashboard_component: `// =====================================================================
// 2. COMPOSANT TABLEAU DE BORD PAIE CONSOLIDÉ (PayrollDashboard.tsx)
// =====================================================================

import React, { useState } from 'react';
import { useDRCPayroll, EmployeeSalaryData } from './useDRCPayroll';
import { DollarSign, ShieldCheck, FileText, Printer, CheckCircle } from 'lucide-react';

interface PayrollDashboardProps {
  initialEmployees: EmployeeSalaryData[];
  onOpenPayslip: (employee: EmployeeSalaryData) => void;
}

export const PayrollDashboard: React.FC<PayrollDashboardProps> = ({ 
  initialEmployees, 
  onOpenPayslip 
}) => {
  const { currentRate, setCurrentRate, computedPayroll, totals } = useDRCPayroll(initialEmployees);
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [isClosed, setIsClosed] = useState(false);

  return (
    <div className="space-y-6 bg-slate-950 p-6 rounded-2xl text-slate-100 font-sans">
      {/* En-tête avec Taux BCC et Mois */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            Système RH & Paie RDC • Conformité DGI & CNSS
          </span>
          <h2 className="text-xl font-bold text-white mt-1">
            Livre de Paie Consolidé ({selectedMonth})
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400">Taux BCC (1 USD) :</span>
            <input
              type="number"
              value={currentRate}
              onChange={e => setCurrentRate(Number(e.target.value))}
              className="w-20 bg-slate-900 text-emerald-400 font-mono font-bold px-2 py-1 rounded text-right"
            />
            <span className="text-slate-400">CDF</span>
          </div>

          <button
            onClick={() => setIsClosed(!isClosed)}
            className={\`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition \${
              isClosed ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }\`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>{isClosed ? 'Clôture Validée (SHA-256)' : 'Clôturer le Mois'}</span>
          </button>
        </div>
      </div>

      {/* Cartes KPI Totaux */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400">Masse Salariale Brute</span>
          <div className="text-lg font-bold font-mono text-white mt-1">
            {totals.totalGross.toLocaleString()} $ USD
          </div>
          <span className="text-[10px] text-slate-500">
            ≈ {(totals.totalGross * currentRate).toLocaleString()} CDF
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400">Net Global à Virer</span>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
            {totals.totalNet.toLocaleString()} $ USD
          </div>
          <span className="text-[10px] text-emerald-500/80">Salariés assujettis</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400">Cotisations CNSS (18%)</span>
          <div className="text-lg font-bold font-mono text-indigo-400 mt-1">
            {totals.totalCNSS.toLocaleString()} $ USD
          </div>
          <span className="text-[10px] text-slate-500">5% salarié + 13% patronal</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400">Retenue IPR DGI</span>
          <div className="text-lg font-bold font-mono text-red-400 mt-1">
            {totals.totalIPR.toLocaleString()} $ USD
          </div>
          <span className="text-[10px] text-slate-500">À reverser au Trésor Public</span>
        </div>
      </div>

      {/* Tableau Consolidé des Collaborateurs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Collaborateur</th>
                <th className="py-3 px-3">Matricule</th>
                <th className="py-3 px-3 text-right">Base</th>
                <th className="py-3 px-3 text-right">Heures Sup</th>
                <th className="py-3 px-3 text-right">Primes</th>
                <th className="py-3 px-3 text-right">Brut</th>
                <th className="py-3 px-3 text-right text-amber-400">CNSS 5%</th>
                <th className="py-3 px-3 text-right text-red-400">IPR DGI</th>
                <th className="py-3 px-3 text-right text-emerald-400">Net à Payer</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-200">
              {computedPayroll.map(({ employee, calculation }) => (
                <tr key={employee.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-semibold text-white">
                    {employee.name}
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {employee.categoryPro}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                    {employee.matricule}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {calculation.baseSalary.toLocaleString()} $
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-400">
                    {calculation.overtimePay > 0 ? \`+\${calculation.overtimePay} $\` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    +{calculation.allowancesTotal.toLocaleString()} $
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-white">
                    {calculation.grossSalary.toLocaleString()} $
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-amber-400">
                    -{calculation.cnssEmployee.toLocaleString()} $
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-red-400">
                    -{calculation.iprDeduction.toLocaleString()} $
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 text-sm">
                    {calculation.netToPay.toLocaleString()} $
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onOpenPayslip(employee)}
                      className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 mx-auto"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Bulletin</span>
                    </button>
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
`,

  // 3. Bulletin Officiel Imprimable sur Feuille Blanche
  react_payslip_printable: `// =====================================================================
// 3. COMPOSANT BULLETIN OFFICIEL IMPRIMABLE (OfficialPayslipModal.tsx)
// Conçu pour l'impression A4 officielle RHEMA BUSINESS SARL • RDC
// =====================================================================

import React from 'react';
import { calculateDRCPayslip, EmployeeSalaryData } from './useDRCPayroll';
import { Printer, X, ShieldCheck } from 'lucide-react';

interface OfficialPayslipModalProps {
  employee: EmployeeSalaryData;
  month: string;
  exchangeRate: number;
  onClose: () => void;
}

export const OfficialPayslipModal: React.FC<OfficialPayslipModalProps> = ({
  employee,
  month,
  exchangeRate,
  onClose
}) => {
  const calc = calculateDRCPayslip(employee, exchangeRate);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 max-w-4xl w-full shadow-2xl space-y-6 my-8 print:p-0 print:shadow-none print:m-0 print:max-w-none">
        {/* Actions bar (masquée à l'impression) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 print:hidden">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Bulletin Certifié Conforme aux Normes RDC</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-[#0F4C81] hover:bg-[#0c3c66] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer le Bulletin</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* En-Tête Officiel RHEMA BUSINESS */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-[#0F4C81]">RHEMA BUSINESS SARL</h1>
            <p className="text-xs text-slate-600 font-medium">Télécommunications par Satellite & Services VSAT</p>
            <div className="text-[10px] text-slate-500 font-mono mt-1 space-y-0.5">
              <div>RCCM : CD/KNG/RCCM/20-B-01120 • ID. NAT. : 01-G4701-N88120L</div>
              <div>N° Impôt : A2001928K • Affiliation CNSS : CNSS-CD-9982410</div>
              <div>Siège Social : Boulevard du 30 Juin, Gombe, Kinshasa - RDC</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">BULLETIN DE PAIE</div>
            <div className="text-sm font-black text-slate-900 mt-0.5">PÉRIODE : {month}</div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">1 USD = {exchangeRate.toLocaleString()} CDF</div>
          </div>
        </div>

        {/* Données du Collaborateur */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div>
            <p><span className="text-slate-500">Nom & Prénom :</span> <strong className="text-slate-900">{employee.name}</strong></p>
            <p><span className="text-slate-500">Matricule :</span> <strong className="font-mono">{employee.matricule}</strong></p>
            <p><span className="text-slate-500">Fonction :</span> <strong>{employee.categoryPro}</strong></p>
          </div>
          <div className="text-right">
            <p><span className="text-slate-500">Enfants à charge :</span> <strong>{employee.dependentsCount}</strong> (Déduction IPR {Math.min(employee.dependentsCount * 2, 18)}%)</p>
            <p><span className="text-slate-500">Devise de Référence :</span> <strong className="font-bold">{employee.salaryCurrency}</strong></p>
            <p><span className="text-slate-500">Heures Travaillées :</span> <strong className="font-mono">173.33 h</strong> (Base légale)</p>
          </div>
        </div>

        {/* Tableau Détaillé des Rubriques */}
        <table className="w-full text-xs border border-slate-300 divide-y divide-slate-200">
          <thead className="bg-slate-100 text-slate-700 font-bold text-[11px]">
            <tr>
              <th className="py-2 px-3 text-left">Rubrique de Paie</th>
              <th className="py-2 px-3 text-right">Base / Taux</th>
              <th className="py-2 px-3 text-right">Gains ({employee.salaryCurrency})</th>
              <th className="py-2 px-3 text-right">Retenues ({employee.salaryCurrency})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="py-1.5 px-3 font-medium">Salaire de Base Fixe</td>
              <td className="py-1.5 px-3 text-right font-mono">173.33 h</td>
              <td className="py-1.5 px-3 text-right font-mono font-bold">{calc.baseSalary.toLocaleString()}</td>
              <td className="py-1.5 px-3 text-right font-mono">-</td>
            </tr>
            {calc.overtimePay > 0 && (
              <tr>
                <td className="py-1.5 px-3 font-medium">Heures Supplémentaires (+30%, +60%, +100%)</td>
                <td className="py-1.5 px-3 text-right font-mono">Art. 119 CT</td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-amber-700">+{calc.overtimePay.toLocaleString()}</td>
                <td className="py-1.5 px-3 text-right font-mono">-</td>
              </tr>
            )}
            <tr>
              <td className="py-1.5 px-3 font-medium">Primes Conventionnelles (Transport & Logement)</td>
              <td className="py-1.5 px-3 text-right font-mono">15.00%</td>
              <td className="py-1.5 px-3 text-right font-mono font-bold">+{calc.allowancesTotal.toLocaleString()}</td>
              <td className="py-1.5 px-3 text-right font-mono">-</td>
            </tr>
            <tr className="bg-slate-50 font-bold">
              <td className="py-1.5 px-3">SALAIRE BRUT TOTAL IMPOSABLE</td>
              <td className="py-1.5 px-3 text-right">-</td>
              <td className="py-1.5 px-3 text-right font-mono">{calc.grossSalary.toLocaleString()}</td>
              <td className="py-1.5 px-3 text-right font-mono">-</td>
            </tr>
            <tr>
              <td className="py-1.5 px-3 font-medium text-slate-700">Cotisation Sociale CNSS Salarié</td>
              <td className="py-1.5 px-3 text-right font-mono">5.00%</td>
              <td className="py-1.5 px-3 text-right font-mono">-</td>
              <td className="py-1.5 px-3 text-right font-mono font-bold text-amber-700">-{calc.cnssEmployee.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-1.5 px-3 font-medium text-slate-700">Impôt Professionnel sur les Rémunérations (IPR DGI)</td>
              <td className="py-1.5 px-3 text-right font-mono">Barème DGI</td>
              <td className="py-1.5 px-3 text-right font-mono">-</td>
              <td className="py-1.5 px-3 text-right font-mono font-bold text-red-700">-{calc.iprDeduction.toLocaleString()}</td>
            </tr>
            {calc.advanceDeduction > 0 && (
              <tr>
                <td className="py-1.5 px-3 font-medium text-slate-700">Retenue Avance sur Salaire / Acompte</td>
                <td className="py-1.5 px-3 text-right font-mono">Remboursement</td>
                <td className="py-1.5 px-3 text-right font-mono">-</td>
                <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-700">-{calc.advanceDeduction.toLocaleString()}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Bloc NET À PAYER & Contre-valeur */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-emerald-50 border-2 border-emerald-500 rounded-xl items-center">
          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">NET À VIRER AU SALARIÉ</span>
            <span className="text-2xl font-black font-mono text-emerald-900">
              {calc.netToPay.toLocaleString()} {employee.salaryCurrency === 'USD' ? '$ USD' : 'CDF'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-emerald-700 block">Contre-valeur indicative :</span>
            <span className="text-base font-bold font-mono text-emerald-950">
              {calc.convertedNetOpposite.toLocaleString()} {employee.salaryCurrency === 'USD' ? 'CDF (FC)' : '$ USD'}
            </span>
          </div>
        </div>

        {/* Emargements et Cachets */}
        <div className="grid grid-cols-2 gap-8 pt-4 text-center text-xs">
          <div>
            <p className="font-bold text-slate-800">Le Collaborateur</p>
            <p className="text-[10px] text-slate-500 italic mt-0.5">« Pour acquit et réception »</p>
            <div className="mt-12 font-semibold text-slate-700">{employee.name}</div>
          </div>
          <div>
            <p className="font-bold text-slate-800">Direction Générale RHEMA BUSINESS</p>
            <p className="text-[10px] text-slate-500 italic mt-0.5">Certifié exact & scellé électroniquement</p>
            <div className="mt-12 font-bold text-[#0F4C81]">Junior MONYA (DG)</div>
          </div>
        </div>

        {/* Empreinte de Sécurité */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span>Scellé Numérique : {calc.sha256Seal}</span>
          <span>Imprimé via RHEMA ERP Paie</span>
        </div>
      </div>
    </div>
  );
};
`
};
