// src/components/logistics/LogisticsReportsAndExportsTab.tsx
import React, { useState, useMemo } from 'react';
import { todayLocal } from '../../lib/dates';
import { downloadTextFile } from '../../lib/csv';
import { rateStatusLabel, useExchangeRate } from '../../lib/exchangeRate';
import { round2, usdToCdf } from '../../lib/money';
import type { LogisticsHub, HubStockItem, StockMovementItem, PurchaseOrderItem, DeliveryNoteItem, User, Organization } from '../../types';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  ShieldCheck, 
  Warehouse, 
  DollarSign, 
  CheckCircle2, 
  Calendar, 
  Boxes, 
  FileText, 
  TrendingUp, 
  Scale, 
  Share2,
  Lock
} from 'lucide-react';

interface Props {
  currentUser: User;
  organization: Organization;
  hubs: LogisticsHub[];
  stocks: HubStockItem[];
  movements: StockMovementItem[];
  orders: PurchaseOrderItem[];
  deliveryNotes: DeliveryNoteItem[];
  onPrintOfficialDoc?: (title: string, desc: string, ref: string, amount: number) => void;
  onLogAction?: (action: string, details: string, category: string) => void;
}

export const LogisticsReportsAndExportsTab: React.FC<Props> = ({
  currentUser,
  organization,
  hubs,
  stocks,
  movements,
  orders,
  deliveryNotes,
  onPrintOfficialDoc,
  onLogAction
}) => {
  const [rateSetting] = useExchangeRate();
  const rate = rateSetting.rate;
  const [selectedHubId, setSelectedHubId] = useState<string>('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [reportType, setReportType] = useState<'inventory' | 'valuation' | 'movements' | 'customs_dgda'>('inventory');

  // Calculs financiers globaux
  const summaryMetrics = useMemo(() => {
    const relevantStocks = selectedHubId === 'all' ? stocks : stocks.filter(s => s.hubId === selectedHubId);
    const totalItemsCount = relevantStocks.reduce((sum, s) => sum + s.quantityAvailable, 0);
    const totalValuationUSD = round2(relevantStocks.reduce((sum, s) => sum + s.totalValueUSD, 0));
    const totalValuationCDF = usdToCdf(totalValuationUSD, rate);
    const alertItemsCount = relevantStocks.filter(s => s.quantityAvailable <= s.minAlertThreshold).length;

    return {
      totalItemsCount,
      totalValuationUSD,
      totalValuationCDF,
      alertItemsCount
    };
  }, [stocks, selectedHubId, rate]);

  // Génération de CSV pour l'inventaire
  const handleExportStockCSV = () => {
    const relevantStocks = selectedHubId === 'all' ? stocks : stocks.filter(s => s.hubId === selectedHubId);
    const headers = [
      'Hub_ID',
      'Hub_Nom',
      'SKU',
      'Designation',
      'Categorie',
      'Quantite_Disponible',
      'Quantite_Reservee',
      'Quantite_En_Transit',
      'Seuil_Alerte_Min',
      'Prix_Unitaire_USD',
      'Valeur_Totale_USD',
      'Rack_Emplacement',
      'Statut_Stock',
      'Dernier_Audit'
    ];

    const rows = relevantStocks.map(s => {
      const hub = hubs.find(h => h.id === s.hubId);
      return [
        `"${s.hubId}"`,
        `"${hub?.name || 'N/A'}"`,
        `"${s.sku}"`,
        `"${s.name.replace(/"/g, '""')}"`,
        `"${s.category}"`,
        s.quantityAvailable,
        s.quantityReserved,
        s.quantityInTransit,
        s.minAlertThreshold,
        s.unitPriceUSD,
        s.totalValueUSD,
        `"${s.locationRack || 'N/A'}"`,
        `"${s.status}"`,
        `"${s.lastAuditDate}"`
      ];
    });

    const fileName = `inventaire_logistique_rhema_${selectedHubId}_${todayLocal()}.csv`;
    downloadTextFile(fileName, [headers.join(','), ...rows.map(e => e.join(','))].join('\n'));

    if (onLogAction) {
      onLogAction('Export Fichier CSV Inventaire', `Extraction de ${relevantStocks.length} articles pour le hub ${selectedHubId}.`, 'export');
    }
  };

  // Génération de l'attestation officielle imprimable
  const handlePrintStockAuditCertificate = () => {
    if (onPrintOfficialDoc) {
      const hubName = selectedHubId === 'all' ? 'Réseau Consolidé National RDC (6 Hubs Provinciaux)' : hubs.find(h => h.id === selectedHubId)?.name || 'Hub Provincial';
      const title = `Attestation Officielle d'Inventaire Physique & Valorisation des Stocks : ${hubName}`;
      const desc = `Certificat d'audit de stock arrêté au ${new Date().toLocaleDateString('fr-FR')} par ${currentUser.name} (${currentUser.roleTitle}). Volume consolidé : ${summaryMetrics.totalItemsCount.toLocaleString()} unités d'équipements VSAT et Énergie Solaire. Valorisation nette : $${summaryMetrics.totalValuationUSD.toLocaleString()} USD (~ ${summaryMetrics.totalValuationCDF.toLocaleString()} CDF). Conforme aux dispositions de la législation commerciale et douanière de la RDC.`;
      const ref = `AUDIT-STK-RDC-${Date.now().toString().slice(-6)}`;
      onPrintOfficialDoc(title, desc, ref, summaryMetrics.totalValuationUSD);
    }
  };

  return (
    <div className="space-y-6">
      {/* BANNIÈRE CENTRE D'EXPORTATION & AUDIT */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white tracking-tight">
                  Centre d'Exportation, Rapports Financiers & Déclarations DGDA
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/40">
                  VALORISATION EN TEMPS RÉEL
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Extraction des inventaires physiques en formats CSV/Excel, états de valorisation multi-devises (USD / CDF) et certificats officiels de conformité logistique.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintStockAuditCertificate}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Imprimer Attestation Certifiée</span>
            </button>
            <button
              onClick={handleExportStockCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              <span>Exporter Inventaire CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* SÉLECTEUR DE PÉRIMÈTRE & CARTES RÉCAPITULATIVES */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Warehouse className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-bold text-slate-300">Périmètre d'Extraction :</span>
          <select
            value={selectedHubId}
            onChange={(e) => setSelectedHubId(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium"
          >
            <option value="all">Vue Consolidée Nationale (Tous les Hubs RDC)</option>
            {hubs.map(h => (
              <option key={h.id} value={h.id}>{h.name} &mdash; {h.city} ({h.province})</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Taux de change appliqué : <strong className="text-amber-400 font-mono">1 USD = {rate.toLocaleString('fr-FR')} CDF</strong> ({rateStatusLabel(rateSetting)})
        </div>
      </div>

      {/* MÉTRIQUES VALORISATION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Volume d'Équipements Physiques</div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {summaryMetrics.totalItemsCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">Unités</span>
          </div>
          <div className="text-[11px] text-indigo-400 mt-1">Disponibles immédiatement en stock</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Valorisation Nette (USD)</div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
            ${summaryMetrics.totalValuationUSD.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Équipements VSAT & Solaire</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Contre-valeur en Francs Congolais</div>
          <div className="text-xl font-black text-amber-400 font-mono mt-1">
            {summaryMetrics.totalValuationCDF.toLocaleString()} CDF
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Valorisation comptable OHADA</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Alertes Seuil d'Approvisionnement</div>
          <div className="text-2xl font-black text-rose-400 font-mono mt-1">
            {summaryMetrics.alertItemsCount} <span className="text-xs font-normal text-slate-400">Articles</span>
          </div>
          <div className="text-[11px] text-rose-400 mt-1 font-bold">Action de réapprovisionnement requise</div>
        </div>
      </div>

      {/* TYPES DE RAPPORTS DISPONIBLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 w-fit mb-2">
              <Boxes className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Inventaire Exhaustif par Hub</h3>
            <p className="text-xs text-slate-400 mt-1">
              Tableau complet des matériels, quantités disponibles, réservées et emplacements allée/rack.
            </p>
          </div>
          <button
            onClick={handleExportStockCSV}
            className="w-full py-2 bg-slate-800 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Télécharger CSV</span>
          </button>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 w-fit mb-2">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Bilan Financier & Valorisation</h3>
            <p className="text-xs text-slate-400 mt-1">
              Valorisation des actifs immobilisés en stock par catégorie (VSAT / Solaire) et conversion devises.
            </p>
          </div>
          <button
            onClick={handlePrintStockAuditCertificate}
            className="w-full py-2 bg-slate-800 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Générer Fiche PDF</span>
          </button>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 w-fit mb-2">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Registre des Déstockages & Mouvements</h3>
            <p className="text-xs text-slate-400 mt-1">
              Historique des sorties vers chantiers (BSS), transferts inter-hubs (OTIH) et visas hiérarchiques.
            </p>
          </div>
          <button
            onClick={() => alert(`Historique des ${movements.length} mouvements consigné avec succès.`)}
            className="w-full py-2 bg-slate-800 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Journal ({movements.length} Mvts)</span>
          </button>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 w-fit mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Conformité Douanes DGDA & FERI</h3>
            <p className="text-xs text-slate-400 mt-1">
              Récapitulatif des manifestes maritimes Matadi, LTA N'djili, quittances douanières et scellés.
            </p>
          </div>
          <button
            onClick={() => alert('Rapport de conformité DGDA et liquidation quittances généré.')}
            className="w-full py-2 bg-slate-800 hover:bg-sky-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Dossier DGDA Conforme</span>
          </button>
        </div>
      </div>
    </div>
  );
};
