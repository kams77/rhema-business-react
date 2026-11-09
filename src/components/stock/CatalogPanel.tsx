// Catalogue des articles (feuille CATALOGUE du classeur) : code unique, catégorie, désignation,
// unité, seuil d'alerte par site, prix. Modifiable par les responsables de la logistique.
import React, { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Download, Pencil, Plus, Search } from 'lucide-react';
import type { EquipmentCategory, LogisticsItem } from '../../types';
import type { StockContext } from './StockHubsModule';
import { CATEGORY_IDS, Empty, Modal, btnPrimary, btnSecondary, card, categoryLabel, downloadCsvRows, fmt, input, label, td, th } from './stockUi';
import { normalizeCategory } from '../../../shared/stock.mjs';

const UNITS: LogisticsItem['unit'][] = ['piece', 'kit', 'metre', 'lot', 'rouleau'];
const UNIT_LABEL: Record<string, string> = { piece: 'Pièce', kit: 'Kit', metre: 'Mètre', lot: 'Lot', rouleau: 'Rouleau' };

export const CatalogPanel: React.FC<StockContext> = ctx => {
  const { catalog, settings, canManage, stocks } = ctx;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<LogisticsItem | 'new' | null>(null);

  const network = useMemo(() => {
    const map = new Map<string, number>();
    stocks.forEach(s => map.set(s.catalogItemId, (map.get(s.catalogItemId) || 0) + s.quantityAvailable));
    return map;
  }, [stocks]);

  const rows = catalog
    .filter(c => showArchived || !c.archived)
    .filter(c => !cat || normalizeCategory(c.category) === cat)
    .filter(c => !q.trim() || `${c.sku} ${c.name} ${c.brand} ${c.subcategory}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => normalizeCategory(a.category).localeCompare(normalizeCategory(b.category)) || a.sku.localeCompare(b.sku));

  const exportCsv = () => downloadCsvRows([
    ['Code article', 'Catégorie', 'Désignation', 'Marque', 'Unité', 'Seuil alerte (par site)', `Prix unitaire (${settings.currency})`, 'Stock réseau', 'Fournisseur', 'Statut', 'Remarques'],
    ...rows.map(c => [c.sku, categoryLabel(settings, c.category), c.name, c.brand, UNIT_LABEL[c.unit] || c.unit, c.minAlertThreshold ?? 0, c.unitPriceUSD, network.get(c.id) || 0, c.defaultSupplier || '', c.archived ? 'Archivé' : 'Actif', c.notes || '']),
  ], `catalogue-${ctx.today}.csv`);

  return (
    <div className="space-y-4">
      <div className={`${card} space-y-3`}>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Catalogue des articles</h3>
            <p className="text-[11px] text-slate-400">Le seuil d'alerte s'applique à chaque site : en dessous, l'article passe en « stock bas ».{!canManage && ' Lecture seule : géré par les responsables de la logistique.'}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={exportCsv} className={btnSecondary}><Download className="w-3.5 h-3.5" /> Exporter (CSV)</button>
            {canManage && <button type="button" onClick={() => setEditing('new')} className={btnPrimary}><Plus className="w-4 h-4" /> Nouvel article</button>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Code, désignation, marque…" className={`${input} pl-8`} aria-label="Rechercher" />
          </div>
          <select value={cat} onChange={e => setCat(e.target.value)} className={`${input} !w-auto`} aria-label="Catégorie">
            <option value="">Toutes les catégories</option>
            {CATEGORY_IDS.map(c => <option key={c} value={c}>{categoryLabel(settings, c)}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Afficher les articles archivés</label>
        </div>
      </div>

      <div className={`${card} !p-0 overflow-x-auto`}>
        {rows.length === 0 ? <div className="p-4"><Empty>Aucun article.</Empty></div> : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50">
                <th className={th}>Code</th><th className={th}>Catégorie</th><th className={th}>Désignation</th><th className={th}>Unité</th>
                <th className={`${th} text-right`}>Seuil / site</th><th className={`${th} text-right`}>Prix ({settings.currency})</th>
                <th className={`${th} text-right`}>Stock réseau</th><th className={th}>Remarques</th>{canManage && <th className={th}>Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map(c => (
                <tr key={c.id} className={c.archived ? 'opacity-50' : ''}>
                  <td className={`${td} font-mono font-bold`}>{c.sku}</td>
                  <td className={td}>{categoryLabel(settings, c.category)}</td>
                  <td className={td}><div className="font-semibold">{c.name}</div><div className="text-[10.5px] text-slate-500">{[c.brand, c.subcategory].filter(Boolean).join(' · ')}</div></td>
                  <td className={td}>{UNIT_LABEL[c.unit] || c.unit}</td>
                  <td className={`${td} text-right font-mono`}>{c.minAlertThreshold ?? 0}</td>
                  <td className={`${td} text-right font-mono`}>{fmt(c.unitPriceUSD, 2)}</td>
                  <td className={`${td} text-right font-mono font-bold`}>{fmt(network.get(c.id) || 0)}</td>
                  <td className={`${td} text-slate-400 max-w-[14rem] truncate`} title={c.notes}>{c.notes || '—'}</td>
                  {canManage && (
                    <td className={td}>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setEditing(c)} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800" aria-label={`Modifier ${c.sku}`} title="Modifier"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => ctx.onUpsertCatalogItem({ ...c, archived: !c.archived })} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800" aria-label={c.archived ? `Réactiver ${c.sku}` : `Archiver ${c.sku}`} title={c.archived ? 'Réactiver' : 'Archiver (reste dans l\'historique)'}>
                          {c.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <ItemModal ctx={ctx} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
};

const ItemModal: React.FC<{ ctx: StockContext; item: LogisticsItem | null; onClose: () => void }> = ({ ctx, item, onClose }) => {
  const { settings, catalog } = ctx;
  const [f, setF] = useState({
    sku: item?.sku || '',
    category: normalizeCategory(item?.category || 'vsat'),
    name: item?.name || '',
    brand: item?.brand || '',
    subcategory: item?.subcategory || '',
    unit: item?.unit || 'piece',
    threshold: String(item?.minAlertThreshold ?? 0),
    price: String(item?.unitPriceUSD ?? ''),
    supplier: item?.defaultSupplier || '',
    notes: item?.notes || '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const sku = f.sku.trim().toUpperCase();
  const errors = [
    !sku && 'Le code article est obligatoire.',
    sku && catalog.some(c => c.sku.toUpperCase() === sku && c.id !== item?.id) && `Le code ${sku} existe déjà.`,
    !f.name.trim() && 'La désignation est obligatoire.',
    (!Number.isInteger(Number(f.threshold)) || Number(f.threshold) < 0) && 'Seuil : nombre entier ≥ 0.',
    (f.price === '' || !(Number(f.price) >= 0)) && 'Prix : nombre ≥ 0.',
  ].filter(Boolean) as string[];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length) return;
    ctx.onUpsertCatalogItem({
      ...(item || { id: `item-${Date.now().toString(36)}`, specs: '', stockAvailable: 0 }),
      sku,
      category: f.category as EquipmentCategory,
      name: f.name.trim(),
      brand: f.brand.trim(),
      subcategory: f.subcategory.trim(),
      unit: f.unit as LogisticsItem['unit'],
      minAlertThreshold: Number(f.threshold),
      unitPriceUSD: Number(f.price),
      defaultSupplier: f.supplier.trim() || undefined,
      notes: f.notes.trim() || undefined,
    } as LogisticsItem);
    onClose();
  };

  return (
    <Modal title={item ? `Modifier l'article ${item.sku}` : 'Nouvel article'} onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div><label className={label}>Code article (unique)</label><input value={f.sku} onChange={set('sku')} className={`${input} font-mono uppercase`} aria-label="Code article" /></div>
        <div>
          <label className={label}>Catégorie</label>
          <select value={f.category} onChange={set('category')} className={input} aria-label="Catégorie">
            {CATEGORY_IDS.map(c => <option key={c} value={c}>{categoryLabel(settings, c)}</option>)}
          </select>
        </div>
        <div className="col-span-2"><label className={label}>Désignation</label><input value={f.name} onChange={set('name')} className={input} aria-label="Désignation" /></div>
        <div><label className={label}>Marque</label><input value={f.brand} onChange={set('brand')} className={input} aria-label="Marque" /></div>
        <div><label className={label}>Sous-catégorie</label><input value={f.subcategory} onChange={set('subcategory')} className={input} aria-label="Sous-catégorie" /></div>
        <div>
          <label className={label}>Unité</label>
          <select value={f.unit} onChange={set('unit')} className={input} aria-label="Unité">
            {UNITS.map(u => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
          </select>
        </div>
        <div><label className={label}>Seuil d'alerte (par site)</label><input type="number" min={0} step={1} value={f.threshold} onChange={set('threshold')} className={input} aria-label="Seuil d'alerte" /></div>
        <div><label className={label}>Prix unitaire ({settings.currency})</label><input type="number" min={0} step="0.01" value={f.price} onChange={set('price')} className={input} aria-label="Prix unitaire" /></div>
        <div><label className={label}>Fournisseur habituel</label><input value={f.supplier} onChange={set('supplier')} className={input} aria-label="Fournisseur" /></div>
        <div className="col-span-2"><label className={label}>Remarques</label><textarea value={f.notes} onChange={set('notes')} rows={2} className={input} aria-label="Remarques" /></div>
        {errors.length > 0 && <p className="col-span-2 text-xs font-semibold text-rose-400">⚠ {errors[0]}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" className={btnPrimary} disabled={errors.length > 0}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
};
