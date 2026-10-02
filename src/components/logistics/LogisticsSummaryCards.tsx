// src/components/logistics/LogisticsSummaryCards.tsx
import React from 'react';
import type { PurchaseOrderItem, DeliveryNoteItem, ShipmentTracking, NetToPayInvoiceItem } from '../../types';
import { Package, Truck, FileText, CheckCircle2, ShieldAlert, DollarSign } from 'lucide-react';

interface Props {
  orders: PurchaseOrderItem[];
  deliveryNotes: DeliveryNoteItem[];
  shipments: ShipmentTracking[];
  invoices: NetToPayInvoiceItem[];
  onSelectTab: (tab: 'orders' | 'delivery' | 'shipments' | 'invoices') => void;
}

export const LogisticsSummaryCards: React.FC<Props> = ({
  orders,
  deliveryNotes,
  shipments,
  invoices,
  onSelectTab,
}) => {
  const totalOrdersAmount = orders.reduce((sum, o) => sum + o.totalTTC_USD, 0);
  const pendingOrders = orders.filter(o => o.status !== 'receptionne_conforme' && o.status !== 'annule').length;
  const inTransitShipments = shipments.filter(s => s.currentStatus !== 'livre_sur_site').length;
  const pendingDeliveries = deliveryNotes.filter(d => d.status !== 'livre_conforme').length;
  const totalNetToPay = invoices.reduce((sum, i) => sum + i.remainingBalanceUSD, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      <div 
        onClick={() => onSelectTab('orders')}
        className="cursor-pointer bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-2xl transition-all shadow-md group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Bons de Commande (BC)</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20">
            <Package className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-white mt-2 font-mono">
          {orders.length} <span className="text-xs text-indigo-400 font-normal">({pendingOrders} actifs)</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
          <span>Engagements :</span>
          <span className="text-slate-200 font-mono font-semibold">${totalOrdersAmount.toLocaleString()} TTC</span>
        </div>
      </div>

      <div 
        onClick={() => onSelectTab('delivery')}
        className="cursor-pointer bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 p-4 rounded-2xl transition-all shadow-md group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Bons de Livraison (BL)</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-white mt-2 font-mono">
          {deliveryNotes.length} <span className="text-xs text-emerald-400 font-normal">BL émis</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
          <span>Contrôle technique :</span>
          <span className="text-emerald-300 font-medium">N° de Série & Recettes</span>
        </div>
      </div>

      <div 
        onClick={() => onSelectTab('shipments')}
        className="cursor-pointer bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 p-4 rounded-2xl transition-all shadow-md group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Suivi Expéditions Fret</span>
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20">
            <Truck className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-white mt-2 font-mono">
          {shipments.length} <span className="text-xs text-sky-400 font-normal">({inTransitShipments} en transit)</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
          <span>Modes :</span>
          <span className="text-sky-300">LTA Aérien + B/L Maritime</span>
        </div>
      </div>

      <div 
        onClick={() => onSelectTab('invoices')}
        className="cursor-pointer bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 p-4 rounded-2xl transition-all shadow-md group"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Factures Net à Payer</span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold text-white mt-2 font-mono">
          ${totalNetToPay.toLocaleString()} <span className="text-xs text-amber-400 font-normal">USD</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
          <span>Solde à encaisser :</span>
          <span className="text-amber-300 font-mono">~{(totalNetToPay * 2850).toLocaleString()} CDF</span>
        </div>
      </div>
    </div>
  );
};
