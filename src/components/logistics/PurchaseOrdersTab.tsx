// src/components/logistics/PurchaseOrdersTab.tsx
import React, { useState } from 'react';
import { addDaysLocal, todayLocal } from '../../lib/dates';
import { useRate } from '../../lib/exchangeRate';
import { formatCDF, round2, usdToCdf } from '../../lib/money';
import { nextReference } from '../../lib/sequence';
import type { PurchaseOrderItem, LogisticsItem, User, Organization } from '../../types';
import { 
  Plus, 
  Search, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Eye, 
  Printer, 
  ShieldCheck, 
  Radio, 
  Sun,
  X,
  Trash2
} from 'lucide-react';

interface Props {
  orders: PurchaseOrderItem[];
  catalog: LogisticsItem[];
  currentUser: User;
  organization: Organization;
  onCreateOrder: (order: PurchaseOrderItem) => void;
  onApproveOrder: (orderId: string) => void;
  onPrintOrder: (order: PurchaseOrderItem) => void;
}

export const PurchaseOrdersTab: React.FC<Props> = ({
  orders,
  catalog,
  currentUser,
  organization,
  onCreateOrder,
  onApproveOrder,
  onPrintOrder
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'vsat' | 'energie_solaire'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderItem | null>(null);

  // Formulaire de création
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [destinationSite, setDestinationSite] = useState('Site Minier Tenke Fungurume (Lualaba)');
  const [category, setCategory] = useState<'vsat' | 'energie_solaire' | 'hybride'>('vsat');
  const rate = useRate();
  const [deliveryDueDate, setDeliveryDueDate] = useState(() => addDaysLocal(21));
  const [paymentTerms, setPaymentTerms] = useState('50% à la commande par virement, 50% après recette');
  const [notes, setNotes] = useState('');
  
  // Articles sélectionnés
  const [orderLines, setOrderLines] = useState<{
    itemId?: string;
    designation: string;
    category: 'vsat' | 'energie_solaire';
    sku: string;
    specs: string;
    quantity: number;
    unitPriceUSD: number;
    totalUSD: number;
  }[]>([
    {
      itemId: catalog[0]?.id,
      designation: catalog[0]?.name || 'Antenne Parabolique Ku-Band 1.8m',
      category: 'vsat',
      sku: catalog[0]?.sku || 'ANT-KU-180',
      specs: catalog[0]?.specs || 'Standard',
      quantity: 2,
      unitPriceUSD: catalog[0]?.unitPriceUSD || 2450,
      totalUSD: (catalog[0]?.unitPriceUSD || 2450) * 2
    }
  ]);

  const filteredOrders = orders.filter(o => {
    const matchCat = filterCategory === 'all' || o.category === filterCategory;
    const matchSearch = 
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.destinationSite.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleAddLine = (catItem?: LogisticsItem) => {
    if (catItem) {
      setOrderLines(prev => [
        ...prev,
        {
          itemId: catItem.id,
          designation: catItem.name,
          category: catItem.category as any,
          sku: catItem.sku,
          specs: catItem.specs,
          quantity: 1,
          unitPriceUSD: catItem.unitPriceUSD,
          totalUSD: catItem.unitPriceUSD
        }
      ]);
    } else {
      setOrderLines(prev => [
        ...prev,
        {
          designation: '',
          category: category === 'hybride' ? 'vsat' : category,
          sku: `SKU-${Date.now().toString().slice(-4)}`,
          specs: '',
          quantity: 1,
          unitPriceUSD: 0,
          totalUSD: 0
        }
      ]);
    }
  };

  const handleUpdateLine = (index: number, field: string, value: any) => {
    setOrderLines(prev => prev.map((line, idx) => {
      if (idx !== index) return line;
      const updated = { ...line, [field]: value };
      if (field === 'quantity' || field === 'unitPriceUSD') {
        const qty = field === 'quantity' ? Number(value) : line.quantity;
        const price = field === 'unitPriceUSD' ? Number(value) : line.unitPriceUSD;
        updated.totalUSD = qty * price;
      }
      return updated;
    }));
  };

  const handleRemoveLine = (index: number) => {
    setOrderLines(prev => prev.filter((_, idx) => idx !== index));
  };

  const currentTotalHT = round2(orderLines.reduce((acc, l) => acc + l.totalUSD, 0));
  const currentVAT = round2(currentTotalHT * 0.16);
  const currentTotalTTC = round2(currentTotalHT + currentVAT);

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderLines.length === 0) return;

    const newOrder: PurchaseOrderItem = {
      id: `bc-${Date.now()}`,
      orderNumber: nextReference(`BC-${category === 'vsat' ? 'VSAT' : category === 'energie_solaire' ? 'SOLAR' : 'HYB'}`, orders.map(o => o.orderNumber)),
      organizationId: organization.id,
      date: todayLocal(),
      deliveryDueDate,
      category,
      supplierName: supplierName || 'Fournisseur Agréé RDC',
      supplierContact,
      supplierEmail,
      supplierAddress,
      destinationSite,
      items: orderLines,
      totalHT_USD: currentTotalHT,
      vatRate: 0.16,
      vatAmount_USD: currentVAT,
      totalTTC_USD: currentTotalTTC,
      currency: 'USD',
      exchangeRate: rate,
      paymentTerms,
      status: currentUser.role === 'agent' ? 'en_attente_approbation' : 'approuve',
      createdByAgentId: currentUser.id,
      createdByAgentName: currentUser.name,
      createdByServiceName: currentUser.departmentName || 'Service Opérationnel',
      notes
    };

    onCreateOrder(newOrder);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Barre de commande & filtres */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher N° BC, fournisseur, site..."
              className="pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterCategory === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tous ({orders.length})
            </button>
            <button
              onClick={() => setFilterCategory('vsat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterCategory === 'vsat' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              VSAT
            </button>
            <button
              onClick={() => setFilterCategory('energie_solaire')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterCategory === 'energie_solaire' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              Solaire
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nouveau Bon de Commande (BC)
        </button>
      </div>

      {/* Tableau des Bons de Commande */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Réf. Bon de Commande</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Fournisseur & Destination</th>
                <th className="py-3 px-4">Date & Échéance</th>
                <th className="py-3 px-4">Total HT / TTC (USD)</th>
                <th className="py-3 px-4">Exécutant Service</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Aucun bon de commande trouvé.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isVSAT = order.category === 'vsat';
                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-400" />
                          <span>{order.orderNumber}</span>
                        </div>
                        {order.proformaReference && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            Réf. Proforma: {order.proformaReference}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isVSAT 
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' 
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          {isVSAT ? <Radio className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                          {order.category.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{order.supplierName}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{order.destinationSite}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>{order.date}</div>
                        <div className="text-[10px] text-indigo-400">Échéance: {order.deliveryDueDate}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-white">${order.totalTTC_USD.toLocaleString()} TTC</div>
                        <div className="text-[10px] text-slate-400">${order.totalHT_USD.toLocaleString()} HT (+TVA 16%)</div>
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        <div className="text-slate-200 font-medium">{order.createdByAgentName}</div>
                        <div className="text-slate-400 text-[10px]">{order.createdByServiceName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          order.status === 'approuve' || order.status === 'receptionne_conforme'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : order.status === 'en_attente_approbation'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {order.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Détails du Bon de Commande"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onPrintOrder(order)}
                            className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white transition"
                            title="Imprimer Document Officiel RDC"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {order.status === 'en_attente_approbation' && currentUser.role !== 'agent' && (
                            <button
                              onClick={() => onApproveOrder(order.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition"
                            >
                              Viser
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Détails d'un Bon de Commande */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedOrder.orderNumber}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {selectedOrder.category.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Fournisseur: {selectedOrder.supplierName}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">Date émission :</span>
                <span className="font-semibold text-slate-200">{selectedOrder.date}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Livraison prévue :</span>
                <span className="font-semibold text-indigo-300">{selectedOrder.deliveryDueDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Site destination :</span>
                <span className="font-semibold text-slate-200 truncate block">{selectedOrder.destinationSite}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Agent Exécutant :</span>
                <span className="font-semibold text-emerald-300 truncate block">{selectedOrder.createdByAgentName}</span>
              </div>
            </div>

            {/* Articles */}
            <div className="mt-4">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Équipements Commandés ({selectedOrder.items.length})
              </h4>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Désignation</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">Qté</th>
                      <th className="py-2.5 px-3 text-right">P.U (USD)</th>
                      <th className="py-2.5 px-3 text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {selectedOrder.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-white">{item.designation}</div>
                          <div className="text-[10px] text-slate-400">{item.specs}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{item.sku}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">${item.unitPriceUSD.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">${item.totalUSD.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Décompte financier */}
            <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-end">
              <div className="space-y-1.5 text-xs text-right w-64 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Total Brut HT :</span>
                  <span>${selectedOrder.totalHT_USD.toLocaleString()} USD</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>TVA Légale RDC (16%) :</span>
                  <span>${selectedOrder.vatAmount_USD.toLocaleString()} USD</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-emerald-400 border-t border-slate-800 pt-1.5">
                  <span>NET TOTAL TTC :</span>
                  <span>${selectedOrder.totalTTC_USD.toLocaleString()} USD</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  ~ {formatCDF(usdToCdf(selectedOrder.totalTTC_USD, selectedOrder.exchangeRate || rate))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-between items-center border-t border-slate-800 pt-4">
              <div className="text-[11px] text-slate-400">
                Paiement : {selectedOrder.paymentTerms}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onPrintOrder(selectedOrder)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  <Printer className="w-4 h-4" />
                  Générer Document Officiel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Création d'un Bon de Commande */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitOrder} className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-400" />
                  Émission Nouveau Bon de Commande (Équipements VSAT / Solaire)
                </h3>
                <p className="text-xs text-slate-400">
                  Exécutant : <span className="text-emerald-400 font-semibold">{currentUser.name}</span> ({currentUser.departmentName || 'Agent Opérationnel'})
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Catégorie Matériel</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="vsat">Équipements VSAT (Télécoms)</option>
                  <option value="energie_solaire">Énergie Solaire Photovoltaïque</option>
                  <option value="hybride">Solution Hybride (VSAT + Solaire)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Nom du Fournisseur</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Gilat Satellite, Victron Energy..."
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Site de Destination en RDC</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Site Minier Tenke Fungurume, Hub N'sele..."
                  value={destinationSite}
                  onChange={(e) => setDestinationSite(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Date d'Échéance Livraison</label>
                <input 
                  type="date"
                  value={deliveryDueDate}
                  onChange={(e) => setDeliveryDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Modalités de Paiement</label>
                <input 
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* Articles du Bon de Commande */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Articles & Équipements Spécifiés
                </span>
                <div className="flex items-center gap-1.5">
                  <select 
                    onChange={(e) => {
                      const item = catalog.find(c => c.id === e.target.value);
                      if (item) handleAddLine(item);
                    }}
                    defaultValue=""
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs text-indigo-300"
                  >
                    <option value="" disabled>+ Choisir dans le catalogue</option>
                    {catalog.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        [{cat.category.toUpperCase()}] {cat.name} (${cat.unitPriceUSD})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAddLine()}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl"
                  >
                    + Ligne libre
                  </button>
                </div>
              </div>

              <div className="space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950/50">
                {orderLines.map((line, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pb-2 border-b border-slate-800/60 last:border-0 last:pb-0">
                    <input 
                      type="text"
                      placeholder="Désignation matériel"
                      value={line.designation}
                      onChange={(e) => handleUpdateLine(idx, 'designation', e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <input 
                      type="text"
                      placeholder="SKU"
                      value={line.sku}
                      onChange={(e) => handleUpdateLine(idx, 'sku', e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-mono"
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Qté:</span>
                        <input 
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleUpdateLine(idx, 'quantity', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">P.U ($):</span>
                        <input 
                          type="number"
                          min="0"
                          value={line.unitPriceUSD}
                          onChange={(e) => handleUpdateLine(idx, 'unitPriceUSD', e.target.value)}
                          className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white text-right font-mono"
                        />
                      </div>
                      <span className="w-24 text-right font-mono font-bold text-emerald-400 text-xs">
                        ${line.totalUSD.toLocaleString()}
                      </span>
                      <button 
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Récapitulatif financier */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs font-mono mb-4">
              <span className="text-slate-400 font-sans">Calculs conformes RDC :</span>
              <div className="flex gap-4">
                <span>HT: <strong className="text-white">${currentTotalHT.toLocaleString()}</strong></span>
                <span>TVA (16%): <strong className="text-indigo-400">${currentVAT.toLocaleString()}</strong></span>
                <span>TTC: <strong className="text-emerald-400">${currentTotalTTC.toLocaleString()} USD</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30"
              >
                Valider et Émettre le Bon de Commande
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
