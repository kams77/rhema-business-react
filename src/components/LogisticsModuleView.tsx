// src/components/LogisticsModuleView.tsx
import React, { useState } from 'react';
import type { 
  User, 
  Organization, 
  HierarchicalEntity, 
  PurchaseOrderItem, 
  DeliveryNoteItem, 
  ShipmentTracking, 
  ProformaInvoiceItem, 
  NetToPayInvoiceItem,
  LogisticsItem,
  ShipmentWorkflowStep,
  DocumentItem
} from '../types';
import { 
  Truck, 
  Package, 
  CheckCircle2, 
  FileText, 
  DollarSign, 
  Radio, 
  Sun, 
  ShieldCheck, 
  Printer, 
  X, 
  Info,
  Clock,
  Sparkles,
  Barcode
} from 'lucide-react';
import { LogisticsSummaryCards } from './logistics/LogisticsSummaryCards';
import { PurchaseOrdersTab } from './logistics/PurchaseOrdersTab';
import { DeliveryNotesTab } from './logistics/DeliveryNotesTab';
import { ShipmentTrackingTab } from './logistics/ShipmentTrackingTab';
import { InvoicesTab } from './logistics/InvoicesTab';
import { RhemaOfficialDocument } from './RhemaOfficialDocument';

interface LogisticsModuleViewProps {
  currentUser: User;
  organization: Organization;
  entities: HierarchicalEntity[];
  catalog: LogisticsItem[];
  orders: PurchaseOrderItem[];
  deliveryNotes: DeliveryNoteItem[];
  shipments: ShipmentTracking[];
  proformas: ProformaInvoiceItem[];
  invoices: NetToPayInvoiceItem[];
  onCreateOrder: (order: PurchaseOrderItem) => void;
  onApproveOrder: (orderId: string) => void;
  onCreateDeliveryNote: (bl: DeliveryNoteItem) => void;
  onSignDeliveryNote: (blId: string, recipientName: string) => void;
  onUpdateShipmentStep: (shipmentId: string, step: ShipmentWorkflowStep) => void;
  onCreateShipment: (shipment: ShipmentTracking) => void;
  onCreateProforma: (proforma: ProformaInvoiceItem) => void;
  onConvertProforma: (proformaId: string, target: 'order' | 'invoice') => void;
  onCreateNetInvoice: (invoice: NetToPayInvoiceItem) => void;
  onRegisterPayment: (invoiceId: string, amountUSD: number, ref: string, method: string) => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

export const LogisticsModuleView: React.FC<LogisticsModuleViewProps> = ({
  currentUser,
  organization,
  entities,
  catalog,
  orders,
  deliveryNotes,
  shipments,
  proformas,
  invoices,
  onCreateOrder,
  onApproveOrder,
  onCreateDeliveryNote,
  onSignDeliveryNote,
  onUpdateShipmentStep,
  onCreateShipment,
  onCreateProforma,
  onConvertProforma,
  onCreateNetInvoice,
  onRegisterPayment,
  onLogAction,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'delivery' | 'shipments' | 'invoices'>('orders');
  
  // Document pour visualisation officielle imprimable
  const [printableDoc, setPrintableDoc] = useState<DocumentItem | null>(null);

  const isAgent = currentUser.role === 'agent';
  const roleTitle = currentUser.roleTitle || (isAgent ? 'Agent Opérationnel' : 'Superviseur / Direction');

  // Convertit un objet logistique en DocumentItem compatible avec RhemaOfficialDocument
  const handlePrintItem = (
    item: PurchaseOrderItem | DeliveryNoteItem | ProformaInvoiceItem | NetToPayInvoiceItem,
    type: 'bc' | 'bl' | 'proforma' | 'invoice'
  ) => {
    let title = '';
    let refNum = '';
    let subtype: any = 'bon_commande_client';
    let amount = 0;
    let desc = '';

    if (type === 'bc') {
      const bc = item as PurchaseOrderItem;
      title = `Bon de Commande : ${bc.orderNumber} (${bc.supplierName})`;
      refNum = bc.orderNumber;
      subtype = 'bon_commande_client';
      amount = bc.totalTTC_USD;
      desc = `Fourniture matériel ${bc.category.toUpperCase()} pour le site de ${bc.destinationSite}. Émis par l'agent ${bc.createdByAgentName}.`;
    } else if (type === 'bl') {
      const bl = item as DeliveryNoteItem;
      title = `Bon de Livraison : ${bl.deliveryNumber} (${bl.transporterName})`;
      refNum = bl.deliveryNumber;
      subtype = 'bon_livraison';
      amount = 0;
      desc = `Matériels livrés avec numéros de série S/N vérifiés. Destination : ${bl.destinationSite}.`;
    } else if (type === 'proforma') {
      const pro = item as ProformaInvoiceItem;
      title = `Facture Proforma : ${pro.proformaNumber} (${pro.clientOrSupplierName})`;
      refNum = pro.proformaNumber;
      subtype = 'devis';
      amount = pro.totalTTC_USD;
      desc = `Offre technique chiffrée pour ${pro.projectOrSite}. Validité : ${pro.validityDate}.`;
    } else if (type === 'invoice') {
      const inv = item as NetToPayInvoiceItem;
      title = `Facture Définitive Net à Payer : ${inv.invoiceNumber}`;
      refNum = inv.invoiceNumber;
      subtype = 'facture_client';
      amount = inv.remainingBalanceUSD;
      desc = `Total Brut HT: $${inv.subtotalHT_USD.toLocaleString()} + TVA 16%: $${inv.vatAmount_USD.toLocaleString()} - Acompte: $${inv.advancePaymentDeduction_USD.toLocaleString()}. Net à Payer: $${inv.netToPayUSD.toLocaleString()} USD (~${inv.netToPayCDF.toLocaleString()} CDF).`;
    }

    const docItem: DocumentItem = {
      id: `doc-log-${Date.now()}`,
      title,
      referenceNumber: refNum,
      category: 'chaine_logistique_commerciale',
      subtype,
      organizationId: organization.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorEntity: currentUser.departmentName || 'Service Logistique',
      createdAt: new Date().toISOString().split('T')[0],
      status: 'signe',
      size: '280 KB',
      fileType: 'PDF',
      amount,
      currency: 'USD',
      description: desc,
      allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
      permissions: {
        viewRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
        editRoles: ['dg', 'chef_departement', 'directeur', 'chef_service', 'agent'],
        validateRoles: ['dg', 'chef_departement', 'directeur', 'chef_service'],
        signRoles: ['dg', 'chef_departement', 'directeur', 'chef_service']
      },
      electronicSignature: {
        signedBy: currentUser.name,
        signedAt: new Date().toISOString(),
        role: currentUser.roleTitle,
        certificateHash: `sha256-rhema-${Date.now()}-cert-conforme-rdc`
      }
    };

    setPrintableDoc(docItem);
    if (onLogAction) {
      onLogAction('Génération Document Officiel Logistique', `Document ${refNum} (${type.toUpperCase()}) généré au format officiel certifié.`, 'document');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* BANNIÈRE DE CONFORMITÉ & RÈGLE MÉTIER DES EXÉCUTANTS */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Gestion Logistique : Équipements VSAT & Énergie Solaire
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/40">
                  RDC CONFORME 2026
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Bons de commande, réceptions avec numéros de série (S/N), suivi du fret aérien (LTA) et maritime (B/L Matadi), facturation Proforma et décompte Net à Payer avec TVA 16%.
              </p>
            </div>
          </div>

          {/* BADGE D'EXÉCUTANT DU SERVICE (RÈGLE MÉTIER FORMELLE) */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs shrink-0 flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isAgent ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                {isAgent ? 'Exécutant Habilité du Service' : 'Superviseur Hiérarchique'}
              </div>
              <div className="font-bold text-white flex items-center gap-1.5">
                <span>{currentUser.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isAgent ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'
                }`}>
                  {isAgent ? 'AGENT EXÉCUTANT' : currentUser.role.toUpperCase()}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {currentUser.departmentName || 'Service Opérationnel'} — Saisie & certification active
              </div>
            </div>
          </div>
        </div>

        {/* Note d'information pour conformité RDC */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span>Matériel VSAT : Ku/C-Band, BUC 8-16W, Modems iDirect, Antennes 1.8-2.4m</span>
            <span className="text-slate-600 mx-1">|</span>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Solaire : Panneaux 550W Tier-1, Onduleurs Victron 5-10kVA, Batteries LiFePO4</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-emerald-400">
            <Barcode className="w-3.5 h-3.5" />
            <span>Traçabilité S/N & Dédouanement DGDA</span>
          </div>
        </div>
      </div>

      {/* CARTES STATISTIQUES RÉCAPITULATIVES */}
      <LogisticsSummaryCards
        orders={orders}
        deliveryNotes={deliveryNotes}
        shipments={shipments}
        invoices={invoices}
        onSelectTab={setActiveTab}
      />

      {/* ONGLETS PRINCIPAUX DU MODULE LOGISTIQUE */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto select-none">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'orders'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Package className="w-4 h-4" />
          1. Bons de Commande ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('delivery')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'delivery'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          2. Bons de Livraison & S/N ({deliveryNotes.length})
        </button>

        <button
          onClick={() => setActiveTab('shipments')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'shipments'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Truck className="w-4 h-4" />
          3. Suivi Expéditions Fret ({shipments.length})
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'invoices'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          4. Factures Proforma & Net à Payer ({invoices.length + proformas.length})
        </button>
      </div>

      {/* CONTENU SELON L'ONGLET ACTIF */}
      {activeTab === 'orders' && (
        <PurchaseOrdersTab
          orders={orders}
          catalog={catalog}
          currentUser={currentUser}
          organization={organization}
          onCreateOrder={onCreateOrder}
          onApproveOrder={onApproveOrder}
          onPrintOrder={(o) => handlePrintItem(o, 'bc')}
        />
      )}

      {activeTab === 'delivery' && (
        <DeliveryNotesTab
          deliveryNotes={deliveryNotes}
          orders={orders}
          currentUser={currentUser}
          organization={organization}
          onCreateDeliveryNote={onCreateDeliveryNote}
          onSignDeliveryNote={onSignDeliveryNote}
          onPrintDeliveryNote={(bl) => handlePrintItem(bl, 'bl')}
        />
      )}

      {activeTab === 'shipments' && (
        <ShipmentTrackingTab
          shipments={shipments}
          currentUser={currentUser}
          organization={organization}
          onUpdateShipmentStep={onUpdateShipmentStep}
          onCreateShipment={onCreateShipment}
        />
      )}

      {activeTab === 'invoices' && (
        <InvoicesTab
          proformas={proformas}
          invoices={invoices}
          currentUser={currentUser}
          organization={organization}
          onCreateProforma={onCreateProforma}
          onConvertProforma={onConvertProforma}
          onCreateNetInvoice={onCreateNetInvoice}
          onRegisterPayment={onRegisterPayment}
          onPrintInvoice={(item, type) => handlePrintItem(item as any, type)}
        />
      )}

      {/* MODAL DU DOCUMENT OFFICIEL PARTAGÉ & IMPRIMABLE (RHEMA CONFORME RDC) */}
      {printableDoc && (
        <RhemaOfficialDocument
          document={printableDoc}
          organization={organization}
          currentUser={currentUser}
          entities={entities}
          onClose={() => setPrintableDoc(null)}
        />
      )}
    </div>
  );
};
