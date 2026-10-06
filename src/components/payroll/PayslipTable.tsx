// src/components/payroll/PayslipTable.tsx — tableau détaillé d'un bulletin (aperçu écran et A4).
// Toutes les lignes viennent du moteur de paie (src/lib/payroll.ts) : aucun taux écrit en dur.
import React from 'react';
import type { PayslipExportData } from '../../utils/exportUtils';

interface PayslipTableProps {
  data: PayslipExportData;
  variant?: 'dark' | 'light';
}

const fmt = (amount: number, currency: string) =>
  currency === 'USD'
    ? `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`
    : `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} CDF`;

export const PayslipTable: React.FC<PayslipTableProps> = ({ data, variant = 'dark' }) => {
  const light = variant === 'light';
  const c = {
    table: light ? 'border border-slate-300 text-slate-900' : 'border border-slate-800 text-slate-200',
    head: light ? 'bg-slate-100 text-slate-800 border-b border-slate-300' : 'bg-slate-950 text-slate-400 border-b border-slate-800',
    rows: light ? 'divide-y divide-slate-200' : 'divide-y divide-slate-800/60',
    label: light ? 'text-slate-900' : 'text-white',
    base: light ? 'text-slate-500' : 'text-slate-400',
    gain: light ? 'text-emerald-700' : 'text-emerald-400',
    ded: light ? 'text-rose-700' : 'text-rose-400',
    emp: light ? 'text-slate-700' : 'text-indigo-400',
    total: light ? 'bg-slate-50 font-bold' : 'bg-slate-950/60 font-bold',
  };
  const cur = data.currency;

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-xs text-left rounded-xl overflow-hidden ${c.table}`}>
        <thead className={`font-semibold ${c.head}`}>
          <tr>
            <th className="p-2.5">Rubrique</th>
            <th className="p-2.5 text-right">Base / taux</th>
            <th className="p-2.5 text-right">Gains (+)</th>
            <th className="p-2.5 text-right">Retenues (−)</th>
            <th className="p-2.5 text-right">Part patronale</th>
          </tr>
        </thead>
        <tbody className={`font-mono ${c.rows}`}>
          {(data.earnings || []).map((l, i) => (
            <tr key={`g-${i}`}>
              <td className={`p-2.5 font-sans font-medium ${c.label}`}>{l.label}</td>
              <td className={`p-2.5 text-right font-sans ${c.base}`}>{l.base}</td>
              <td className={`p-2.5 text-right font-bold ${c.gain}`}>+{fmt(l.amount, cur)}</td>
              <td className="p-2.5 text-right">—</td>
              <td className="p-2.5 text-right">—</td>
            </tr>
          ))}
          {(data.deductions || []).map((l, i) => (
            <tr key={`d-${i}`}>
              <td className={`p-2.5 font-sans ${c.label}`}>{l.label}</td>
              <td className={`p-2.5 text-right font-sans ${c.base}`}>{l.base}</td>
              <td className="p-2.5 text-right">—</td>
              <td className={`p-2.5 text-right font-bold ${c.ded}`}>−{fmt(l.amount, cur)}</td>
              <td className="p-2.5 text-right">—</td>
            </tr>
          ))}
          {(data.employerLines || []).map((l, i) => (
            <tr key={`e-${i}`}>
              <td className={`p-2.5 font-sans ${c.base}`}>{l.label}</td>
              <td className={`p-2.5 text-right font-sans ${c.base}`}>{l.base}</td>
              <td className="p-2.5 text-right">—</td>
              <td className="p-2.5 text-right">—</td>
              <td className={`p-2.5 text-right ${c.emp}`}>+{fmt(l.amount, cur)}</td>
            </tr>
          ))}
          <tr className={c.total}>
            <td className={`p-2.5 font-sans ${c.label}`}>Totaux</td>
            <td className="p-2.5 text-right font-sans">Brut : {fmt(data.grossSalary, cur)}</td>
            <td className={`p-2.5 text-right ${c.gain}`}>+{fmt(data.grossSalary, cur)}</td>
            <td className={`p-2.5 text-right ${c.ded}`}>−{fmt(data.totalDeductions, cur)}</td>
            <td className={`p-2.5 text-right ${c.emp}`}>+{fmt(data.totalEmployerCost - data.grossSalary, cur)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const formatPayslipMoney = fmt;
