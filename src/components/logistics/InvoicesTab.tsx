// src/components/logistics/InvoicesTab.tsx
import React, { useState } from 'react';
import type { ProformaInvoiceItem, NetToPayInvoiceItem, User, Organization, PurchaseOrderItem } from '../../types';
import { 
  FileText, 
  Plus, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Eye, 
  Printer, 
  CreditCard, 
  Building2, 
  X,
  FileCheck,
  ShieldCheck,
  RefreshCw,
  Landmark
} from 'lucide-react';

interface Props {
  proformas: ProformaInvoiceItem[];
  invoices: NetToPayInvoiceItem[];
  currentUser: User;
  organization: Organization;
  onCreateProforma: (proforma: ProformaInvoiceItem) => void;
  onConvertProforma: (proformaId: string, target: 'order' | 'invoice') => void;
  onCreateNetInvoice: (invoice: NetToPayInvoiceItem) => void;
  onRegisterPayment: (invoiceId: string, amountUSD: number, ref: string, method: string) => void;
  onPrintInvoice: (invoice: NetToPayInvoiceItem | ProformaInvoiceItem, type: 'proforma' | 'invoice') => void;
}

export const InvoicesTab: React.FC<Props> = ({
  proformas,
  invoices,
  currentUser,
  organization,
  onCreateProforma,
  onConvertProforma,
  onCreateNetInvoice,
  onRegisterPayment,
  onPrintInvoice
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'proforma' | 'net_to_pay'>('net_to_pay');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProforma, setSelectedProforma] = useState<ProformaInvoiceItem | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<NetToPayInvoiceItem | null>(null);

  // Modal paiement
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'virement_rawbank' | 'virement_equity' | 'cheque'>('virement_rawbank');

  // Modal création Proforma
  const [showCreateProformaModal, setShowCreateProformaModal] = useState(false);
  const [proformaClient, setProformaClient] = useState('');
  const [proformaProject, setProformaProject] = useState('Projet Minier Katanga');
  const [proformaTerms, setProformaTerms] = useState('50% à la commande, 50% après recette');

  // Modal création Facture Net à Payer
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [invClient, setInvClient] = useState('');
  const [invClientTax, setInvClientTax] = useState('RCCM: CD/KN/RCCM/20-B-001 | IdNat: 01-83-N44100');
  const [invSubtotal, setInvSubtotal] = useState<number>(10000);
  const [invAdvance, setInvAdvance] = useState<number>(2000);
  const [invBank, setInvBank] = useState<'rawbank' | 'equity'>('rawbank');

  const filteredProformas = proformas.filter(p => 
    p.proformaNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.clientOrSupplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.projectOrSite.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvoices = invoices.filter(i => 
    i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.proformaReference && i.proformaReference.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || paymentAmount <= 0) return;
    onRegisterPayment(selectedInvoice.id, paymentAmount, paymentRef || `VIR-${Date.now().toString().slice(-6)}`, paymentMethod);
    setShowPaymentModal(false);
  };

  const handleCreateProformaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newProforma: ProformaInvoiceItem = {
      id: `pro-${Date.now()}`,
      proformaNumber: `PRO-2026-VSAT-${String(proformas.length + 1).padStart(3, '0')}`,
      organizationId: organization.id,
      date: new Date().toISOString().split('T')[0],
      validityDate: '2026-11-15',
      clientOrSupplierName: proformaClient || 'Client Entreprise RDC',
      clientType: 'projet_minier',
      contactPerson: 'Direction Commerciale & Approvisionnements',
      contactEmail: 'achats@client.cd',
      contactPhone: '+243 81 000 0000',
      projectOrSite: proformaProject,
      category: 'vsat',
      items: [
        {
          designation: 'Station VSAT Ku-Band Complète & Kit Panneaux Solaires',
          category: 'vsat',
          specs: 'Antenne 1.8m + BUC 8W + Modem iDirect + Générateur 5kWc',
          quantity: 1,
          unitPriceUSD: 8500,
          totalUSD: 8500
        }
      ],
      subtotalHT_USD: 8500,
      vatRate: 0.16,
      vatAmount_USD: 1360,
      totalTTC_USD: 9860,
      paymentTerms: proformaTerms,
      deliveryLeadTime: '15 jours après confirmation',
      status: 'soumise',
      preparedByAgentId: currentUser.id,
      preparedByAgentName: `${currentUser.name} (Agent Exécutant)`,
      serviceName: currentUser.departmentName || 'Service Facturation Télécoms',
      notes: 'Devis proforma officiel avec conditions de garantie 24 mois.'
    };
    onCreateProforma(newProforma);
    setShowCreateProformaModal(false);
  };

  const handleCreateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vat = invSubtotal * 0.16;
    const netUSD = invSubtotal + vat - invAdvance;
    const newInv: NetToPayInvoiceItem = {
      id: `fac-${Date.now()}`,
      invoiceNumber: `FAC-2026-VSAT-${String(invoices.length + 1).padStart(3, '0')}`,
      organizationId: organization.id,
      date: new Date().toISOString().split('T')[0],
      dueDate: '2026-11-15',
      clientName: invClient || 'Entreprise Minière & Télécoms RDC',
      clientTaxId: invClientTax,
      clientAddress: 'Kinshasa / Lubumbashi - RD CONGO',
      category: 'vsat',
      items: [
        {
          designation: 'Prestation Déploiement Équipements & Fourniture Station',
          specs: 'Conforme cahier des charges',
          quantity: 1,
          unitPriceUSD: invSubtotal,
          totalUSD: invSubtotal
        }
      ],
      subtotalHT_USD: invSubtotal,
      vatRate: 0.16,
      vatAmount_USD: vat,
      advancePaymentDeduction_USD: invAdvance,
      withholdingTaxDeduction_USD: 0,
      otherDeductions_USD: 0,
      netToPayUSD: netUSD,
      netToPayCDF: netUSD * 2850,
      currencyRate: 2850,
      bankDetails: invBank === 'rawbank' ? {
        bankName: 'RAWBANK KINSHASA (Siège Gombe)',
        accountNumberUSD: '05100-01004419201-88 USD',
        accountNumberCDF: '05100-01004419201-99 CDF',
        swiftBic: 'RAWBCDZX',
        ibanOrRib: 'CD68 0510 0010 0441 9201 88'
      } : {
        bankName: 'EQUITY BCDC RDC (Agence Libération)',
        accountNumberUSD: '00012-44100982-14 USD',
        accountNumberCDF: '00012-44100982-15 CDF',
        swiftBic: 'BCDCCDKI',
        ibanOrRib: 'CD68 0001 2441 0098 2140 12'
      },
      paymentStatus: invAdvance > 0 ? 'partiellement_payee' : 'en_attente',
      paidAmountUSD: invAdvance,
      remainingBalanceUSD: netUSD,
      paymentRecords: invAdvance > 0 ? [
        {
          id: `pay-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          amountUSD: invAdvance,
          amountCDF: invAdvance * 2850,
          paymentMethod: 'virement_rawbank',
          reference: 'VIR-ACOMPTE-INITIAL',
          registeredByAgent: currentUser.name
        }
      ] : [],
      electronicSealHash: `sha256-fac-${Date.now()}-rhema-cert`,
      preparedByAgentId: currentUser.id,
      preparedByAgentName: `${currentUser.name} (Agent de Service)`,
      serviceName: currentUser.departmentName || 'Service Facturation',
      isOfficialDocumentEmitted: true
    };

    onCreateNetInvoice(newInv);
    setShowCreateInvoiceModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Sélecteur de sous-volet & recherche */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveSubTab('net_to_pay')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'net_to_pay' 
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Factures Net à Payer ({invoices.length})
            </button>
            <button
              onClick={() => setActiveSubTab('proforma')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                activeSubTab === 'proforma' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              Factures Proforma ({proformas.length})
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher facture, client, réf..."
              className="pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-56"
            />
          </div>
        </div>

        {activeSubTab === 'net_to_pay' ? (
          <button
            onClick={() => setShowCreateInvoiceModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-amber-600/30 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            Émettre Facture Net à Payer
          </button>
        ) : (
          <button
            onClick={() => setShowCreateProformaModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Facture Proforma
          </button>
        )}
      </div>

      {/* TABLEAU DES FACTURES NET À PAYER */}
      {activeSubTab === 'net_to_pay' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Réf. Facture & Date</th>
                  <th className="py-3 px-4">Client Débiteur</th>
                  <th className="py-3 px-4">Total Brut HT & TVA 16%</th>
                  <th className="py-3 px-4">Déduction Acompte</th>
                  <th className="py-3 px-4">NET À PAYER (USD / CDF)</th>
                  <th className="py-3 px-4">Statut Règlement</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Aucune facture net à payer enregistrée.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-400" />
                          <span>{inv.invoiceNumber}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">Émise le : {inv.date}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{inv.clientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs">{inv.clientTaxId}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div>${inv.subtotalHT_USD.toLocaleString()} HT</div>
                        <div className="text-[10px] text-indigo-400">+ TVA 16%: ${inv.vatAmount_USD.toLocaleString()}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-400">
                        {inv.advancePaymentDeduction_USD > 0 ? (
                          <span>-${inv.advancePaymentDeduction_USD.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-500">0.00</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-emerald-400 text-sm">
                          ${inv.remainingBalanceUSD.toLocaleString()} USD
                        </div>
                        <div className="text-[10px] text-slate-400">
                          ~ {(inv.remainingBalanceUSD * 2850).toLocaleString()} CDF
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          inv.paymentStatus === 'payee_net'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : inv.paymentStatus === 'partiellement_payee'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-red-500/20 text-red-300 border border-red-500/40'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {inv.paymentStatus.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Voir Décompte Complet"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPaymentAmount(inv.remainingBalanceUSD);
                              setShowPaymentModal(true);
                            }}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-white transition"
                            title="Enregistrer un Paiement"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onPrintInvoice(inv, 'invoice')}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-white transition"
                            title="Imprimer Facture Officielle"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLEAU DES FACTURES PROFORMA */}
      {activeSubTab === 'proforma' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Réf. Proforma</th>
                  <th className="py-3 px-4">Client & Projet</th>
                  <th className="py-3 px-4">Validité de l'offre</th>
                  <th className="py-3 px-4">Montant TTC (USD)</th>
                  <th className="py-3 px-4">Agent Exécutant</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Actions de Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProformas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Aucune facture proforma trouvée.
                    </td>
                  </tr>
                ) : (
                  filteredProformas.map(pro => (
                    <tr key={pro.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-400" />
                          <span>{pro.proformaNumber}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">Date : {pro.date}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{pro.clientOrSupplierName}</div>
                        <div className="text-[10px] text-slate-400">{pro.projectOrSite}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-amber-400 font-medium">Jusqu'au {pro.validityDate}</span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-white">${pro.totalTTC_USD.toLocaleString()} TTC</div>
                        <div className="text-[10px] text-slate-400">HT: ${pro.subtotalHT_USD.toLocaleString()}</div>
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        <div className="text-slate-200">{pro.preparedByAgentName}</div>
                        <div className="text-[10px] text-slate-500">{pro.serviceName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          pro.status === 'acceptee_convertie'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        }`}>
                          {pro.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedProforma(pro)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Consulter"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onPrintInvoice(pro, 'proforma')}
                            className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white transition"
                            title="Imprimer Proforma"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {pro.status !== 'acceptee_convertie' && (
                            <button
                              onClick={() => onConvertProforma(pro.id, 'invoice')}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition shadow-sm"
                              title="Convertir en Facture Définitive Net à Payer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Convertir Facture
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Détail Facture Net à Payer */}
      {selectedInvoice && !showPaymentModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                  Facture Net à Payer : {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-400">Client : {selectedInvoice.clientName}</p>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Décompte net à payer précis RDC */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 font-mono text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Montant Brut HT :</span>
                <span>${selectedInvoice.subtotalHT_USD.toLocaleString()} USD</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>TVA Légale RDC (16%) :</span>
                <span className="text-indigo-400">+${selectedInvoice.vatAmount_USD.toLocaleString()} USD</span>
              </div>
              <div className="flex justify-between text-amber-400">
                <span>Déduction Acompte déjà versé :</span>
                <span>-${selectedInvoice.advancePaymentDeduction_USD.toLocaleString()} USD</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Retenue à la source (le cas échéant) :</span>
                <span>-${selectedInvoice.withholdingTaxDeduction_USD.toLocaleString()} USD</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-bold text-emerald-400">
                <span>NET TOTAL À PAYER :</span>
                <span className="text-base">${selectedInvoice.netToPayUSD.toLocaleString()} USD</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Contre-valeur au taux officiel :</span>
                <span className="text-amber-300">~{selectedInvoice.netToPayCDF.toLocaleString()} CDF (Taux {selectedInvoice.currencyRate})</span>
              </div>
            </div>

            {/* Coordonnées bancaires RDC */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 mb-4 text-xs">
              <div className="flex items-center gap-1.5 text-slate-200 font-bold mb-2">
                <Landmark className="w-4 h-4 text-amber-400" />
                Coordonnées Bancaires Officielles pour Règlement :
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400 font-mono text-[11px]">
                <div>Établissement : <strong className="text-white">{selectedInvoice.bankDetails.bankName}</strong></div>
                <div>Code SWIFT / BIC : <strong className="text-white">{selectedInvoice.bankDetails.swiftBic}</strong></div>
                <div>Compte USD : <strong className="text-emerald-400">{selectedInvoice.bankDetails.accountNumberUSD}</strong></div>
                <div>Compte CDF : <strong className="text-amber-400">{selectedInvoice.bankDetails.accountNumberCDF}</strong></div>
              </div>
            </div>

            {/* Historique des règlements */}
            {selectedInvoice.paymentRecords.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Règlements Déjà Enregistrés ({selectedInvoice.paymentRecords.length})
                </h4>
                <div className="space-y-1.5 border border-slate-800 rounded-xl p-3 bg-slate-950/40 text-xs">
                  {selectedInvoice.paymentRecords.map(pr => (
                    <div key={pr.id} className="flex justify-between items-center py-1 border-b border-slate-800/60 last:border-0 font-mono">
                      <div>
                        <span className="text-slate-300">{pr.date}</span>
                        <span className="text-slate-500 mx-2">|</span>
                        <span className="text-slate-400">{pr.reference}</span>
                      </div>
                      <span className="font-bold text-emerald-400">+${pr.amountUSD.toLocaleString()} USD</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center border-t border-slate-800 pt-4">
              <div className="text-xs text-slate-400">
                Solde restant à solder : <strong className="text-emerald-400 font-mono">${selectedInvoice.remainingBalanceUSD.toLocaleString()} USD</strong>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPaymentAmount(selectedInvoice.remainingBalanceUSD);
                    setShowPaymentModal(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
                >
                  Enregistrer un Règlement
                </button>
                <button
                  onClick={() => onPrintInvoice(selectedInvoice, 'invoice')}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer Facture Conforme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enregistrement Règlement */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handlePaymentSubmit} className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-2">
              Enregistrement d'un Règlement Bancaire
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Facture : <strong className="text-white">{selectedInvoice.invoiceNumber}</strong> (Client : {selectedInvoice.clientName})
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Montant Encaissé (USD)</label>
                <input 
                  type="number"
                  min="1"
                  max={selectedInvoice.remainingBalanceUSD}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Mode de Règlement</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="virement_rawbank">Virement Bancaire RAWBANK RDC</option>
                  <option value="virement_equity">Virement Bancaire EQUITY BCDC</option>
                  <option value="cheque">Chèque Certifié de Banque</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Référence Bordereau / Transaction</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: VIR-RAW-2026-99014"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
              >
                Valider le Règlement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Création Proforma */}
      {showCreateProformaModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateProformaSubmit} className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-3">
              Nouvelle Facture Proforma Équipements
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Nom du Client</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Entreprise Minière Kamoa, Vodacom..."
                  value={proformaClient}
                  onChange={(e) => setProformaClient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Projet / Site</label>
                <input 
                  type="text"
                  value={proformaProject}
                  onChange={(e) => setProformaProject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Conditions de Paiement</label>
                <input 
                  type="text"
                  value={proformaTerms}
                  onChange={(e) => setProformaTerms(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowCreateProformaModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
              >
                Émettre la Proforma
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Création Facture Net à Payer */}
      {showCreateInvoiceModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateInvoiceSubmit} className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-3">
              Émettre une Facture Net à Payer
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Client Débiteur</label>
                <input 
                  type="text"
                  required
                  placeholder="Nom du client"
                  value={invClient}
                  onChange={(e) => setInvClient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Montant Brut HT ($)</label>
                <input 
                  type="number"
                  min="1"
                  required
                  value={invSubtotal}
                  onChange={(e) => setInvSubtotal(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Acompte à Déduire ($)</label>
                <input 
                  type="number"
                  min="0"
                  value={invAdvance}
                  onChange={(e) => setInvAdvance(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Banque de Règlement RDC</label>
                <select
                  value={invBank}
                  onChange={(e) => setInvBank(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="rawbank">RAWBANK KINSHASA</option>
                  <option value="equity">EQUITY BCDC RDC</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowCreateInvoiceModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl"
              >
                Créer la Facture Net à Payer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
