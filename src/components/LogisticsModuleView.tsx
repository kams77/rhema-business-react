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
  DocumentItem,
  LogisticsHub,
  HubStockItem,
  StockMovementItem
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
  Barcode,
  Warehouse,
  Boxes,
  Activity,
  Calculator,
  Scan,
  Award,
  FileSpreadsheet
} from 'lucide-react';
import { LogisticsSummaryCards } from './logistics/LogisticsSummaryCards';
import { PurchaseOrdersTab } from './logistics/PurchaseOrdersTab';
import { DeliveryNotesTab } from './logistics/DeliveryNotesTab';
import { ShipmentTrackingTab } from './logistics/ShipmentTrackingTab';
import { InvoicesTab } from './logistics/InvoicesTab';
import { HubsStockManagementTab } from './logistics/HubsStockManagementTab';
import { HubsStockChartDashboard } from './logistics/HubsStockChartDashboard';
import { SolarVsatCalculatorTab } from './logistics/SolarVsatCalculatorTab';
import { UniversalSerialTrackerTab } from './logistics/UniversalSerialTrackerTab';
import { SuppliersScorecardTab } from './logistics/SuppliersScorecardTab';
import { LogisticsReportsAndExportsTab } from './logistics/LogisticsReportsAndExportsTab';
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
  hubs: LogisticsHub[];
  stocks: HubStockItem[];
  movements: StockMovementItem[];
  onAddHub: (hub: LogisticsHub) => void;
  onAddMovement: (mvt: StockMovementItem) => void;
  onApproveMovement: (mvtId: string) => void;
  onReceiveTransfer: (mvtId: string) => void;
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
  hubs,
  stocks,
  movements,
  onAddHub,
  onAddMovement,
  onApproveMovement,
  onReceiveTransfer,
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
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'hubs' | 'calculator' | 'serial_tracker' | 'orders' | 'delivery' | 'shipments' | 'invoices' | 'suppliers' | 'export_center'
  >('dashboard');
  
  // Alertes de stock calculées en temps réel
  const stockAlertsCount = React.useMemo(() => {
    return stocks.filter(s => s.quantityAvailable <= s.minAlertThreshold || s.status === 'rupture' || s.status === 'alerte_basse').length;
  }, [stocks]);

  const immediateRupturesCount = React.useMemo(() => {
    return stocks.filter(s => s.quantityAvailable === 0 || s.status === 'rupture').length;
  }, [stocks]);

  // Document pour visualisation officielle imprimable
  const [printableDoc, setPrintableDoc] = useState<DocumentItem | null>(null);

  const isAgent = currentUser.role === 'agent';
  const roleTitle = currentUser.roleTitle || (isAgent ? 'Agent Opérationnel' : 'Superviseur / Direction');

  // Convertit une demande de rapport technique en DocumentItem imprimable
  const handlePrintCustomDoc = (title: string, desc: string, refNum: string, amount: number) => {
    const docItem: DocumentItem = {
      id: `doc-log-${Date.now()}`,
      title,
      referenceNumber: refNum,
      category: 'chaine_logistique_commerciale',
      subtype: 'bon_livraison',
      organizationId: organization.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorEntity: currentUser.departmentName || 'Département Logistique & Opérations',
      createdAt: new Date().toISOString().split('T')[0],
      status: 'signe',
      size: '320 KB',
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
        certificateHash: `sha256-cert-log-rdc-${Date.now()}`
      }
    };
    setPrintableDoc(docItem);
    if (onLogAction) {
      onLogAction('Émission Rapport Logistique Certifié', `Document ${refNum} (${title}) imprimé.`, 'document');
    }
  };

  // Convertit un objet logistique en DocumentItem compatible avec RhemaOfficialDocument
  const handlePrintItem = (
    item: PurchaseOrderItem | DeliveryNoteItem | ProformaInvoiceItem | NetToPayInvoiceItem | StockMovementItem,
    type: 'bc' | 'bl' | 'proforma' | 'invoice' | 'bes' | 'bss' | 'otih'
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
    } else if (type === 'bes') {
      const mvt = item as StockMovementItem;
      title = `Bon d'Entrée en Stock : ${mvt.movementNumber}`;
      refNum = mvt.movementNumber;
      subtype = 'bon_livraison';
      amount = mvt.totalValueUSD;
      desc = `Entrée et prise en charge physique des équipements au ${mvt.destinationHubName || 'Hub Provincial'}. Réf Source: ${mvt.referenceDocumentNumber}. Articles : ${mvt.items.map(i => `${i.quantity}x ${i.name} (S/N: ${i.serialNumbers.join(', ') || 'N/A'})`).join(' ; ')}. ${mvt.notes}`;
    } else if (type === 'bss') {
      const mvt = item as StockMovementItem;
      title = `Bon de Sortie & Mise en Service : ${mvt.movementNumber}`;
      refNum = mvt.movementNumber;
      subtype = 'bon_livraison';
      amount = mvt.totalValueUSD;
      desc = `Sortie du matériel depuis le ${mvt.sourceHubName || 'Hub'} pour déploiement direct sur site : ${mvt.destinationClientSite}. Matériels déstockés : ${mvt.items.map(i => `${i.quantity}x ${i.name} [S/N: ${i.serialNumbers.join(', ') || 'N/A'}]`).join(' ; ')}. ${mvt.notes}`;
    } else if (type === 'otih') {
      const mvt = item as StockMovementItem;
      title = `Ordre de Transfert Inter-Hubs : ${mvt.movementNumber}`;
      refNum = mvt.movementNumber;
      subtype = 'bon_livraison';
      amount = mvt.totalValueUSD;
      desc = `Régulation logistique inter-provinces : Expédié de ${mvt.sourceHubName} à destination de ${mvt.destinationHubName}. Convoi / Fret sous scellé. Matériels transférés : ${mvt.items.map(i => `${i.quantity}x ${i.name} (S/N: ${i.serialNumbers.join(', ') || 'N/A'})`).join(' ; ')}. ${mvt.notes}`;
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

          {/* BADGE D'EXÉCUTANT DU SERVICE ET ACCÈS RAPIDE GRAPHIQUES */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition shadow-lg ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-amber-500/25'
                  : 'bg-slate-950/80 hover:bg-slate-900 text-slate-200 border-slate-800'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                <Activity className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold text-slate-400">Supervision</div>
                <div className="text-xs font-black flex items-center gap-1">
                  <span>Recharts</span>
                  {immediateRupturesCount > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[9px] animate-pulse">
                      {immediateRupturesCount} Rupt.
                    </span>
                  ) : null}
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('calculator')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition shadow-lg ${
                activeTab === 'calculator'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-amber-500/25'
                  : 'bg-slate-950/80 hover:bg-slate-900 text-slate-200 border-slate-800'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400">
                <Calculator className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold text-slate-400">Ingénierie</div>
                <div className="text-xs font-black">Dimensionneur</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('serial_tracker')}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition shadow-lg ${
                activeTab === 'serial_tracker'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-extrabold shadow-sky-500/25'
                  : 'bg-slate-950/80 hover:bg-slate-900 text-slate-200 border-slate-800'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
                <Scan className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold text-slate-400">Scanner</div>
                <div className="text-xs font-black">S/N & Codes</div>
              </div>
            </button>

            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs shrink-0 flex items-center gap-2.5">
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
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'dashboard'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>1. Graphiques Stocks & Ruptures</span>
          {immediateRupturesCount > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-black animate-pulse">
              {immediateRupturesCount} Rupture{immediateRupturesCount > 1 ? 's' : ''}
            </span>
          ) : stockAlertsCount > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-500/50 font-mono text-[10px] font-bold">
              {stockAlertsCount} Alertes
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
              Optimal
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('hubs')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'hubs'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Warehouse className="w-4 h-4" />
          <span>2. Stocks & Hubs Provinciaux ({hubs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('calculator')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'calculator'
              ? 'bg-orange-500 text-slate-950 shadow-md shadow-orange-500/25 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calculator className="w-4 h-4 text-orange-400" />
          <span>3. Dimensionneur Solaire & Kits VSAT</span>
        </button>

        <button
          onClick={() => setActiveTab('serial_tracker')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'serial_tracker'
              ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25 font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Scan className="w-4 h-4 text-sky-400" />
          <span>4. Traçabilité S/N & Scanner Codes</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'orders'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>5. Bons de Commande ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('delivery')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'delivery'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>6. Bons de Livraison & S/N ({deliveryNotes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('shipments')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'shipments'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>7. Suivi Fret & DGDA ({shipments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'invoices'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>8. Factures Proforma & Net ({invoices.length + proformas.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'suppliers'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Award className="w-4 h-4 text-indigo-400" />
          <span>9. Fournisseurs & Transporteurs</span>
        </button>

        <button
          onClick={() => setActiveTab('export_center')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'export_center'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>10. Exports & Rapports DGDA</span>
        </button>
      </div>

      {/* CONTENU SELON L'ONGLET ACTIF */}
      {activeTab === 'dashboard' && (
        <HubsStockChartDashboard
          currentUser={currentUser}
          hubs={hubs}
          stocks={stocks}
          catalog={catalog}
          movements={movements}
          onSelectHub={() => setActiveTab('hubs')}
          onRequestTransfer={() => setActiveTab('hubs')}
          onRequestOrder={() => setActiveTab('orders')}
        />
      )}
      {activeTab === 'hubs' && (
        <HubsStockManagementTab
          currentUser={currentUser}
          organization={organization}
          entities={entities}
          catalog={catalog}
          hubs={hubs}
          stocks={stocks}
          movements={movements}
          onAddHub={onAddHub}
          onAddMovement={onAddMovement}
          onApproveMovement={onApproveMovement}
          onReceiveTransfer={onReceiveTransfer}
          onPrintDocument={(mvt, type) => handlePrintItem(mvt, type)}
          onLogAction={onLogAction}
        />
      )}

      {activeTab === 'calculator' && (
        <SolarVsatCalculatorTab
          currentUser={currentUser}
          organization={organization}
          catalog={catalog}
          hubs={hubs}
          stocks={stocks}
          onCreateOrder={onCreateOrder}
          onNavigateToTab={(target) => setActiveTab(target)}
          onPrintOfficialDoc={(title, desc, ref, amount) => handlePrintCustomDoc(title, desc, ref, amount)}
          onLogAction={onLogAction}
        />
      )}

      {activeTab === 'serial_tracker' && (
        <UniversalSerialTrackerTab
          stocks={stocks}
          hubs={hubs}
          deliveryNotes={deliveryNotes}
          orders={orders}
          currentUser={currentUser}
          onNavigateToTab={(target) => setActiveTab(target)}
          onLogAction={onLogAction}
        />
      )}

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

      {activeTab === 'suppliers' && (
        <SuppliersScorecardTab
          currentUser={currentUser}
          orders={orders}
          shipments={shipments}
          onSelectSupplierForOrder={(supplierName) => {
            setActiveTab('orders');
          }}
          onLogAction={onLogAction}
        />
      )}

      {activeTab === 'export_center' && (
        <LogisticsReportsAndExportsTab
          currentUser={currentUser}
          organization={organization}
          hubs={hubs}
          stocks={stocks}
          movements={movements}
          orders={orders}
          deliveryNotes={deliveryNotes}
          onPrintOfficialDoc={(title, desc, ref, amount) => handlePrintCustomDoc(title, desc, ref, amount)}
          onLogAction={onLogAction}
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
