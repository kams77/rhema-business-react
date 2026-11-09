// Paramètres du module (feuille PARAMETRES du classeur) : types de mouvement et leur sens,
// libellés des catégories, délai d'alerte des transferts, devise.
import React, { useState } from 'react';
import { Plus, RotateCcw, Save } from 'lucide-react';
import type { StockMovementTypeSetting, StockSettings } from '../../types';
import type { StockContext } from './StockHubsModule';
import { CATEGORY_IDS, btnPrimary, btnSecondary, card, input, label, td, th } from './stockUi';
import { DEFAULT_STOCK_SETTINGS } from '../../../shared/stock.mjs';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const StockSettingsPanel: React.FC<StockContext> = ctx => {
  const { settings, canManage, movements } = ctx;
  const [draft, setDraft] = useState<StockSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [newLabel, setNewLabel] = useState('');
  const [newSign, setNewSign] = useState<1 | -1>(-1);
  const used = new Set(movements.map(m => m.type));
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const setType = (id: string, patch: Partial<StockMovementTypeSetting>) =>
    setDraft({ ...draft, movementTypes: draft.movementTypes.map(t => (t.id === id ? { ...t, ...patch } : t)) });

  const addType = () => {
    const lbl = newLabel.trim();
    if (!lbl) return;
    let id = slug(lbl) || 'type';
    while (draft.movementTypes.some(t => t.id === id) || id === 'transfert_inter_hub') id = `${id}_2`;
    setDraft({ ...draft, movementTypes: [...draft.movementTypes, { id, label: lbl, sign: newSign, active: true }] });
    setNewLabel('');
  };

  const errors = [
    draft.movementTypes.some(t => !t.label.trim()) && 'Chaque type doit avoir un libellé.',
    !draft.movementTypes.some(t => t.active && t.sign > 0) && 'Gardez au moins un type d\'entrée actif.',
    !draft.movementTypes.some(t => t.active && t.sign < 0) && 'Gardez au moins un type de sortie actif.',
    (!Number.isInteger(Number(draft.transitAlertDays)) || draft.transitAlertDays < 1) && 'Délai d\'alerte : nombre entier de jours ≥ 1.',
    !draft.currency.trim() && 'Indiquez la devise.',
    CATEGORY_IDS.some(c => !(draft.categoryLabels[c] || '').trim()) && 'Chaque catégorie doit avoir un libellé.',
  ].filter(Boolean) as string[];

  const ro = !canManage;

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap justify-between items-center gap-2`}>
        <div>
          <h3 className="text-sm font-bold text-white">Paramètres des stocks</h3>
          <p className="text-[11px] text-slate-400">
            {ro ? 'Lecture seule : géré par les responsables de la logistique.' : 'Les modifications sont tracées dans le journal d\'audit.'}
          </p>
        </div>
        {!ro && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(JSON.parse(JSON.stringify(settings)))} className={btnSecondary} disabled={!dirty}><RotateCcw className="w-3.5 h-3.5" /> Annuler les changements</button>
            <button type="button" onClick={() => ctx.onUpdateStockSettings({ ...draft, currency: draft.currency.trim().toUpperCase(), transitAlertDays: Number(draft.transitAlertDays) })} className={btnPrimary} disabled={!dirty || errors.length > 0}>
              <Save className="w-4 h-4" /> Enregistrer
            </button>
          </div>
        )}
      </div>
      {errors.length > 0 && <p className="text-xs font-semibold text-rose-400">⚠ {errors[0]}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${card} lg:col-span-2 !p-0 overflow-x-auto`}>
          <div className="px-4 pt-4 pb-2">
            <h4 className="text-xs font-bold text-white">Types de mouvement</h4>
            <p className="text-[11px] text-slate-400">Le sens indique si le type ajoute (+1) ou retire (−1) du stock du site. Un type déjà utilisé peut être désactivé mais pas changer de sens.</p>
          </div>
          <table className="w-full text-left border-collapse">
            <thead><tr className="border-y border-slate-800 bg-slate-950/50"><th className={th}>Libellé</th><th className={th}>Sens</th><th className={th}>Actif</th><th className={th}>Utilisé</th></tr></thead>
            <tbody className="divide-y divide-slate-800/70">
              {draft.movementTypes.map(t => (
                <tr key={t.id} className={t.active ? '' : 'opacity-50'}>
                  <td className={td}><input value={t.label} onChange={e => setType(t.id, { label: e.target.value })} disabled={ro} className={input} aria-label={`Libellé ${t.id}`} /></td>
                  <td className={td}>
                    <select value={t.sign} onChange={e => setType(t.id, { sign: Number(e.target.value) as 1 | -1 })} disabled={ro || used.has(t.id) || t.id === 'stock_initial'} className={`${input} !w-28`} aria-label={`Sens ${t.id}`}>
                      <option value={1}>+1 Entrée</option>
                      <option value={-1}>−1 Sortie</option>
                    </select>
                  </td>
                  <td className={td}><input type="checkbox" checked={t.active} onChange={e => setType(t.id, { active: e.target.checked })} disabled={ro} aria-label={`Actif ${t.id}`} /></td>
                  <td className={`${td} text-[11px] ${used.has(t.id) ? 'text-slate-300' : 'text-slate-600'}`}>{used.has(t.id) ? 'Oui' : 'Non'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ro && (
            <div className="flex flex-wrap gap-2 items-end p-4 border-t border-slate-800">
              <div className="flex-1 min-w-[12rem]"><label className={label}>Nouveau type</label><input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="ex. Sortie – Don" className={input} aria-label="Nouveau type" /></div>
              <select value={newSign} onChange={e => setNewSign(Number(e.target.value) as 1 | -1)} className={`${input} !w-32`} aria-label="Sens du nouveau type">
                <option value={1}>+1 Entrée</option>
                <option value={-1}>−1 Sortie</option>
              </select>
              <button type="button" onClick={addType} className={btnSecondary} disabled={!newLabel.trim()}><Plus className="w-3.5 h-3.5" /> Ajouter</button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className={`${card} space-y-3`}>
            <h4 className="text-xs font-bold text-white">Catégories</h4>
            {CATEGORY_IDS.map(c => (
              <div key={c}>
                <label className={label}>{(DEFAULT_STOCK_SETTINGS.categoryLabels as Record<string, string>)[c]}</label>
                <input value={draft.categoryLabels[c] || ''} onChange={e => setDraft({ ...draft, categoryLabels: { ...draft.categoryLabels, [c]: e.target.value } })} disabled={ro} className={input} aria-label={`Libellé catégorie ${c}`} />
              </div>
            ))}
          </div>
          <div className={`${card} space-y-3`}>
            <h4 className="text-xs font-bold text-white">Alertes et devise</h4>
            <div>
              <label className={label}>Transfert en retard au-delà de (jours)</label>
              <input type="number" min={1} step={1} value={draft.transitAlertDays} onChange={e => setDraft({ ...draft, transitAlertDays: Number(e.target.value) })} disabled={ro} className={input} aria-label="Délai d'alerte transit" />
            </div>
            <div>
              <label className={label}>Devise des prix</label>
              <input value={draft.currency} onChange={e => setDraft({ ...draft, currency: e.target.value })} disabled={ro} maxLength={5} className={`${input} uppercase`} aria-label="Devise" />
            </div>
            <p className="text-[10.5px] text-slate-500">Seuil d'alerte : réglé article par article dans le Catalogue ; il s'applique à chaque site.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
