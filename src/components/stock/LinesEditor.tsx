// Lignes d'articles d'un bon (mouvement ou transfert) : article, quantité, numéros de série.
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { LogisticsItem, StockSettings } from '../../types';
import { categoryLabel, input, label } from './stockUi';

export interface Line {
  itemId: string;
  quantity: string;
  serials: string;
}

export const emptyLine = (): Line => ({ itemId: '', quantity: '', serials: '' });

interface Props {
  lines: Line[];
  onChange: (lines: Line[]) => void;
  catalog: LogisticsItem[];
  settings: StockSettings;
  /** Quantité disponible par article (sorties et transferts) ; absent pour une entrée. */
  available?: (itemId: string) => number;
}

export const parseSerials = (s: string) => s.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);

/** Erreurs d'une ligne (quantité entière > 0, disponible suffisant, numéros de série cohérents). */
export function lineErrors(line: Line, available?: (itemId: string) => number): string[] {
  const errors: string[] = [];
  if (!line.itemId) errors.push('Choisissez un article.');
  const q = Number(line.quantity);
  if (!line.quantity || !Number.isInteger(q) || q <= 0) errors.push('Quantité entière supérieure à 0.');
  if (line.itemId && available && Number.isInteger(q) && q > available(line.itemId)) errors.push(`Stock insuffisant : ${available(line.itemId)} disponible(s).`);
  const sns = parseSerials(line.serials);
  if (sns.length && Number.isInteger(q) && sns.length > q) errors.push('Plus de numéros de série que de quantité.');
  if (new Set(sns).size !== sns.length) errors.push('Numéro de série en double.');
  return errors;
}

export const LinesEditor: React.FC<Props> = ({ lines, onChange, catalog, settings, available }) => {
  const set = (i: number, patch: Partial<Line>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const used = new Set(lines.map(l => l.itemId));
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const errors = line.itemId || line.quantity ? lineErrors(line, available) : [];
        const item = catalog.find(c => c.id === line.itemId);
        return (
          <div key={i} className="grid grid-cols-12 gap-2 items-start bg-slate-950/40 border border-slate-800 rounded-xl p-2.5">
            <div className="col-span-12 md:col-span-5">
              <label className={label}>Article {i + 1}</label>
              <select value={line.itemId} onChange={e => set(i, { itemId: e.target.value })} className={input} aria-label={`Article ${i + 1}`}>
                <option value="">— Choisir un article —</option>
                {catalog.map(c => (
                  <option key={c.id} value={c.id} disabled={used.has(c.id) && c.id !== line.itemId}>
                    {c.sku} — {c.name} ({categoryLabel(settings, c.category)})
                  </option>
                ))}
              </select>
              {item && available && (
                <p className="text-[10.5px] mt-1 text-slate-400">Disponible : <strong className="text-white font-mono">{available(item.id)}</strong> {item.unit}(s)</p>
              )}
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className={label}>Quantité</label>
              <input type="number" min={1} step={1} inputMode="numeric" value={line.quantity} onChange={e => set(i, { quantity: e.target.value })} className={input} aria-label={`Quantité ${i + 1}`} />
            </div>
            <div className="col-span-7 md:col-span-4">
              <label className={label}>N° de série / Kit ID (facultatif)</label>
              <input value={line.serials} onChange={e => set(i, { serials: e.target.value })} placeholder="SN-001, SN-002…" className={input} aria-label={`Numéros de série ${i + 1}`} />
            </div>
            <div className="col-span-1 pt-5 flex justify-end">
              {lines.length > 1 && (
                <button type="button" onClick={() => onChange(lines.filter((_, j) => j !== i))} className="p-2 rounded-lg text-rose-300 hover:bg-rose-500/10" aria-label={`Retirer la ligne ${i + 1}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {errors.length > 0 && <p className="col-span-12 text-[10.5px] font-semibold text-rose-400">⚠ {errors.join(' ')}</p>}
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...lines, emptyLine()])} className="text-xs font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1">
        <Plus className="w-3.5 h-3.5" /> Ajouter un article
      </button>
    </div>
  );
};
