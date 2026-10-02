// src/components/logistics/DeliveryNotesTab.tsx
import React, { useState } from 'react';
import type { DeliveryNoteItem, PurchaseOrderItem, User, Organization } from '../../types';
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  Barcode, 
  Eye, 
  Printer, 
  Radio, 
  Sun,
  X,
  ShieldCheck,
  ClipboardCheck,
  FileCheck
} from 'lucide-react';

interface Props {
  deliveryNotes: DeliveryNoteItem[];
  orders: PurchaseOrderItem[];
  currentUser: User;
  organization: Organization;
  onCreateDeliveryNote: (bl: DeliveryNoteItem) => void;
  onSignDeliveryNote: (blId: string, recipientName: string) => void;
  onPrintDeliveryNote: (bl: DeliveryNoteItem) => void;
}

export const DeliveryNotesTab: React.FC<Props> = ({
  deliveryNotes,
  orders,
  currentUser,
  organization,
  onCreateDeliveryNote,
  onSignDeliveryNote,
  onPrintDeliveryNote
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'vsat' | 'energie_solaire'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBL, setSelectedBL] = useState<DeliveryNoteItem | null>(null);

  // Formulaire création
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [transporterName, setTransporterName] = useState('AGL Logistics RDC (Ex-Bolloré)');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [destinationSite, setDestinationSite] = useState('Dépôt Central Rhema Kinshasa');
  const [category, setCategory] = useState<'vsat' | 'energie_solaire' | 'hybride'>('vsat');
  const [recipientName, setRecipientName] = useState(currentUser.name);
  const [recipientTitle, setRecipientTitle] = useState(currentUser.roleTitle);
  const [remarks, setRemarks] = useState('');

  // Articles du BL avec leurs numéros de série
  const [itemsList, setItemsList] = useState<{
    designation: string;
    sku: string;
    orderedQty: number;
    deliveredQty: number;
    serialNumbersStr: string; // S/N séparés par virgules
    condition: 'conforme' | 'avarie_mineure' | 'non_conforme' | 'manquant';
    inspectionRemarks?: string;
  }[]>([
    {
      designation: 'Émetteur BUC Ku-Band 8W Terrasat',
      sku: 'BUC-KU-08W-TERRA',
      orderedQty: 2,
      deliveredQty: 2,
      serialNumbersStr: 'IBUC2-08W-9901, IBUC2-08W-9902',
      condition: 'conforme',
      inspectionRemarks: 'Scellés intacts, testé ok.'
    }
  ]);

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setDestinationSite(order.destinationSite);
      setCategory(order.category);
      setItemsList(order.items.map(it => ({
        designation: it.designation,
        sku: it.sku,
        orderedQty: it.quantity,
        deliveredQty: it.quantity,
        serialNumbersStr: Array.from({ length: it.quantity }, (_, i) => `${it.sku}-SN${i + 1}`).join(', '),
        condition: 'conforme',
        inspectionRemarks: 'Matériel inspecté à réception.'
      })));
    }
  };

  const handleCreateBL = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedItems = itemsList.map(item => ({
      designation: item.designation,
      sku: item.sku,
      orderedQty: Number(item.orderedQty),
      deliveredQty: Number(item.deliveredQty),
      serialNumbers: item.serialNumbersStr.split(',').map(s => s.trim()).filter(Boolean),
      condition: item.condition,
      inspectionRemarks: item.inspectionRemarks
    }));

    const newBL: DeliveryNoteItem = {
      id: `bl-${Date.now()}`,
      deliveryNumber: `BL-${category === 'vsat' ? 'VSAT' : 'SOLAR'}-2026-${String(deliveryNotes.length + 1).padStart(3, '0')}`,
      purchaseOrderId: selectedOrderId || undefined,
      purchaseOrderNumber: orders.find(o => o.id === selectedOrderId)?.orderNumber,
      organizationId: organization.id,
      date: new Date().toISOString().split('T')[0],
      transporterName,
      driverName,
      vehiclePlateNumber,
      sealNumber,
      destinationSite,
      category,
      items: formattedItems,
      status: 'livre_conforme',
      recipientName,
      recipientTitle,
      recipientSignatureDate: `${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString().slice(0, 5)}`,
      isRecipientSigned: true,
      preparedByAgentId: currentUser.id,
      preparedByAgentName: `${currentUser.name} (Agent Service Exécutant)`,
      serviceName: currentUser.departmentName || 'Service Opérationnel',
      technicalReceiptCertificate: {
        isConform: true,
        testPassed: true,
        technicianNotes: 'Contrôle métrologique et audit physique validés.',
        testedAt: new Date().toISOString().split('T')[0],
        testedBy: currentUser.name
      },
      remarks
    };

    onCreateDeliveryNote(newBL);
    setShowCreateModal(false);
  };

  const filteredBLs = deliveryNotes.filter(bl => {
    const matchCat = filterCategory === 'all' || bl.category === filterCategory;
    const matchSearch = 
      bl.deliveryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bl.transporterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bl.destinationSite.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bl.purchaseOrderNumber && bl.purchaseOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-4">
      {/* Barre de recherche et actions */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher N° BL, transporteur, site..."
              className="pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-64"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterCategory === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tous ({deliveryNotes.length})
            </button>
            <button
              onClick={() => setFilterCategory('vsat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterCategory === 'vsat' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              VSAT
            </button>
            <button
              onClick={() => setFilterCategory('energie_solaire')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterCategory === 'energie_solaire' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              Solaire
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nouveau Bon de Livraison (BL)
        </button>
      </div>

      {/* Tableau des Bons de Livraison */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Réf. Bon de Livraison</th>
                <th className="py-3 px-4">Rattaché au BC</th>
                <th className="py-3 px-4">Transporteur & Scellé</th>
                <th className="py-3 px-4">Site de Destination</th>
                <th className="py-3 px-4">N° de Série & Matériels</th>
                <th className="py-3 px-4">Réceptionnaire & Visa</th>
                <th className="py-3 px-4">Conformité</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredBLs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Aucun bon de livraison enregistré.
                  </td>
                </tr>
              ) : (
                filteredBLs.map(bl => {
                  const isVSAT = bl.category === 'vsat';
                  const totalSerialCount = bl.items.reduce((acc, it) => acc + it.serialNumbers.length, 0);

                  return (
                    <tr key={bl.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>{bl.deliveryNumber}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">Date: {bl.date}</span>
                      </td>
                      <td className="py-3 px-4">
                        {bl.purchaseOrderNumber ? (
                          <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 text-[11px]">
                            {bl.purchaseOrderNumber}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Livraison directe</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{bl.transporterName}</div>
                        {bl.sealNumber && (
                          <div className="text-[10px] text-amber-400 font-mono">
                            Scellé: {bl.sealNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-300 font-medium truncate max-w-xs">{bl.destinationSite}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Barcode className="w-3.5 h-3.5 text-sky-400" />
                          <span className="font-mono text-white font-semibold">{totalSerialCount} S/N</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{bl.items.length} lignes d'équipements</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium">{bl.recipientName}</div>
                        <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          {bl.isRecipientSigned ? 'Décharge signée' : 'En attente signature'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          bl.status === 'livre_conforme'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {bl.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedBL(bl)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Consulter le Bon de Livraison"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onPrintDeliveryNote(bl)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-white transition"
                            title="Imprimer BL Officiel"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
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

      {/* Modal Détails d'un Bon de Livraison */}
      {selectedBL && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedBL.deliveryNumber}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {selectedBL.category.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Transporteur : {selectedBL.transporterName}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedBL(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Infos clés */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">Date livraison :</span>
                <span className="font-semibold text-slate-200">{selectedBL.date}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Véhicule / Chauffeur :</span>
                <span className="font-semibold text-slate-200">{selectedBL.driverName || 'N/A'} ({selectedBL.vehiclePlateNumber || 'Plaque'})</span>
              </div>
              <div>
                <span className="text-slate-500 block">N° Scellé Sécurité :</span>
                <span className="font-mono font-semibold text-amber-400">{selectedBL.sealNumber || 'Non scellé'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Réceptionnaire :</span>
                <span className="font-semibold text-emerald-300">{selectedBL.recipientName}</span>
              </div>
            </div>

            {/* Tableau des matériels et S/N */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Matériels Réceptionnés & Numéros de Série Relevés
              </h4>
              <div className="space-y-3">
                {selectedBL.items.map((it, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="font-bold text-white text-sm">{it.designation}</span>
                        <span className="ml-2 font-mono text-[11px] text-slate-400">SKU: {it.sku}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Qté livrée : <strong className="text-white font-mono">{it.deliveredQty} / {it.orderedQty}</strong></span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          {it.condition.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Badge des numéros de série */}
                    <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block mb-1.5 flex items-center gap-1">
                        <Barcode className="w-3 h-3 text-sky-400" />
                        Numéros de Série (S/N) Relevés sur étiquettes :
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {it.serialNumbers.map((sn, sIdx) => (
                          <span key={sIdx} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] text-sky-300">
                            {sn}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Certificat de Recette Technique */}
            {selectedBL.technicalReceiptCertificate && (
              <div className="mt-4 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase mb-1">
                  <ClipboardCheck className="w-4 h-4" />
                  Procès-Verbal de Recette Technique & Conformité Matériel
                </div>
                <p className="text-xs text-slate-300 italic mb-2">
                  "{selectedBL.technicalReceiptCertificate.technicianNotes}"
                </p>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Testé par : <strong className="text-slate-200">{selectedBL.technicalReceiptCertificate.testedBy}</strong></span>
                  <span>Date du test : {selectedBL.technicalReceiptCertificate.testedAt}</span>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                onClick={() => onPrintDeliveryNote(selectedBL)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
              >
                <Printer className="w-4 h-4" />
                Imprimer le Bon de Livraison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Création BL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateBL} className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  Émission Nouveau Bon de Livraison (BL) & Saisie des N° de Série
                </h3>
                <p className="text-xs text-slate-400">
                  Agent exécutant : <span className="text-emerald-400 font-semibold">{currentUser.name}</span>
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

            {/* Liaison Bon de commande */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 mb-4">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Lier à un Bon de Commande (Pré-remplissage automatique des équipements) :
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => handleOrderSelect(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-indigo-300"
              >
                <option value="">-- Aucun (Création de BL direct sans BC) --</option>
                {orders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber} - {o.supplierName} - {o.destinationSite} (${o.totalTTC_USD.toLocaleString()} TTC)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Transporteur</label>
                <input 
                  type="text"
                  required
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Chauffeur & N° Plaque</label>
                <input 
                  type="text"
                  placeholder="Ex: Justin Mwamba / Plaque KN-9021"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">N° de Scellé de Sécurité</label>
                <input 
                  type="text"
                  placeholder="Ex: SEAL-AGL-88201"
                  value={sealNumber}
                  onChange={(e) => setSealNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono"
                />
              </div>
            </div>

            {/* Articles et numéros de série */}
            <div className="mb-4">
              <span className="text-xs font-bold text-white uppercase tracking-wider block mb-2">
                Équipements Livrés et Saisie des Numéros de Série (S/N)
              </span>
              <div className="space-y-3 border border-slate-800 rounded-xl p-3 bg-slate-950/50">
                {itemsList.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        type="text"
                        placeholder="Désignation"
                        value={item.designation}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemsList(prev => prev.map((l, i) => i === idx ? { ...l, designation: val } : l));
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                      <input 
                        type="text"
                        placeholder="SKU"
                        value={item.sku}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemsList(prev => prev.map((l, i) => i === idx ? { ...l, sku: val } : l));
                        }}
                        className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">Qté :</span>
                        <input 
                          type="number"
                          min="1"
                          value={item.deliveredQty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setItemsList(prev => prev.map((l, i) => i === idx ? { ...l, deliveredQty: val } : l));
                          }}
                          className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white text-right font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-sky-400 font-mono block mb-1">
                        Numéros de Série (S/N) scannés / saisis (séparés par des virgules) :
                      </label>
                      <input 
                        type="text"
                        placeholder="Ex: IBUC2-08W-110, IBUC2-08W-111, MAC:00:1B:54:..."
                        value={item.serialNumbersStr}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItemsList(prev => prev.map((l, i) => i === idx ? { ...l, serialNumbersStr: val } : l));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-sky-300 font-mono"
                      />
                    </div>
                  </div>
                ))}
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30"
              >
                Émettre le Bon de Livraison Certifié
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
