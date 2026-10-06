// src/components/logistics/ShipmentTrackingTab.tsx
import React, { useState } from 'react';
import { addDaysLocal, localDateTime, todayLocal } from '../../lib/dates';
import { nextReference } from '../../lib/sequence';
import type { ShipmentTracking, User, Organization, ShipmentWorkflowStep } from '../../types';
import { 
  Plane, 
  Ship, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  FileText, 
  Eye, 
  X, 
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Building2,
  DollarSign
} from 'lucide-react';

interface Props {
  shipments: ShipmentTracking[];
  currentUser: User;
  organization: Organization;
  onUpdateShipmentStep: (shipmentId: string, newStep: ShipmentWorkflowStep) => void;
  onCreateShipment: (shipment: ShipmentTracking) => void;
}

export const ShipmentTrackingTab: React.FC<Props> = ({
  shipments,
  currentUser,
  organization,
  onUpdateShipmentStep,
  onCreateShipment
}) => {
  const [filterType, setFilterType] = useState<'all' | 'aerien' | 'maritime'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<ShipmentTracking | null>(null);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Formulaire d'ajout d'étape par l'agent
  const [newStepStatus, setNewStepStatus] = useState<ShipmentWorkflowStep['status']>('dedouanement_dgda');
  const [newStepLabel, setNewStepLabel] = useState('Passage Douane DGDA & Guichet SEGUCE');
  const [newStepLocation, setNewStepLocation] = useState('Bureau DGDA Kinshasa N\'djili');
  const [newStepComment, setNewStepComment] = useState('Liquidation quittance et bon à enlever délivré.');

  // Formulaire nouvelle expédition
  const [freightType, setFreightType] = useState<'aerien' | 'maritime' | 'routier_convoi'>('aerien');
  const [title, setTitle] = useState('');
  const [carrierName, setCarrierName] = useState('Ethiopian Cargo');
  const [supplierOrigin, setSupplierOrigin] = useState('Hub Cargo Dubai DWC');
  const [destinationFinal, setDestinationFinal] = useState('Kinshasa N\'djili -> Kolwezi');
  const [relatedOrderNumber, setRelatedOrderNumber] = useState('');
  const [trackingNumberInput, setTrackingNumberInput] = useState('');

  const filteredShipments = shipments.filter(s => {
    const matchType = filterType === 'all' || s.freightType === filterType;
    const matchSearch = 
      s.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.carrierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.airWaybillDetails && s.airWaybillDetails.awbNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.oceanBillOfLadingDetails && s.oceanBillOfLadingDetails.blNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchType && matchSearch;
  });

  const handleAddStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    const step: ShipmentWorkflowStep = {
      id: `step-${Date.now()}`,
      status: newStepStatus,
      label: newStepLabel,
      location: newStepLocation,
      timestamp: localDateTime(),
      executedByAgent: currentUser.name,
      agentRole: `${currentUser.roleTitle} (Exécutant Service)`,
      comment: newStepComment,
      completed: true
    };

    onUpdateShipmentStep(selectedShipment.id, step);
    setSelectedShipment(prev => prev ? {
      ...prev,
      currentStatus: newStepStatus,
      workflowSteps: [...prev.workflowSteps, step]
    } : null);
    setShowAddStepModal(false);
  };

  const handleCreateShipment = (e: React.FormEvent) => {
    e.preventDefault();
    const newShipment: ShipmentTracking = {
      id: `exp-${Date.now()}`,
      trackingNumber: trackingNumberInput || nextReference(`EXP-${freightType === 'aerien' ? 'AIR' : 'MAR'}`, shipments.map(s => s.trackingNumber)),
      title: title || `Expédition Équipements ${freightType === 'aerien' ? 'Fret Aérien' : 'Fret Maritime'}`,
      freightType,
      category: 'vsat',
      relatedOrderNumber,
      supplierOrigin,
      destinationFinal,
      carrierName,
      currentStatus: 'depart_fournisseur',
      estimatedDeliveryDate: addDaysLocal(freightType === 'aerien' ? 7 : 45),
      workflowSteps: [
        {
          id: `step-${Date.now()}`,
          status: 'depart_fournisseur',
          label: 'Prise en charge expédition & Scellés',
          location: supplierOrigin,
          timestamp: todayLocal(),
          executedByAgent: currentUser.name,
          agentRole: currentUser.roleTitle,
          comment: 'Dossier fret initialisé par l\'agent de service.',
          completed: true
        }
      ],
      totalLogisticsCostUSD: freightType === 'aerien' ? 3200 : 7500,
      assignedAgentId: currentUser.id,
      assignedAgentName: currentUser.name,
      serviceName: currentUser.departmentName || 'Service Logistique & Déploiement',
      qrTrackingCode: `QR-EXP-${Date.now()}`
    };

    onCreateShipment(newShipment);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Barre de commande et filtres */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="N° Expédition, AWB, B/L maritime..."
              className="pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-64"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterType === 'all' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tous ({shipments.length})
            </button>
            <button
              onClick={() => setFilterType('aerien')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterType === 'aerien' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              Fret Aérien (LTA)
            </button>
            <button
              onClick={() => setFilterType('maritime')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterType === 'maritime' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Ship className="w-3.5 h-3.5" />
              Fret Maritime (B/L)
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-600/30 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Enregistrer une Expédition Fret
        </button>
      </div>

      {/* Cartes Expéditions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredShipments.map(shipment => {
          const isAir = shipment.freightType === 'aerien';

          return (
            <div 
              key={shipment.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition shadow-lg flex flex-col justify-between"
            >
              <div>
                {/* En-tête carte */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${
                      isAir ? 'bg-sky-500/15 text-sky-400' : 'bg-indigo-500/15 text-indigo-400'
                    }`}>
                      {isAir ? <Plane className="w-5 h-5" /> : <Ship className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">{shipment.trackingNumber}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          isAir ? 'bg-sky-500/20 text-sky-300' : 'bg-indigo-500/20 text-indigo-300'
                        }`}>
                          {isAir ? 'Fret Aérien (LTA)' : 'Fret Maritime (B/L)'}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-slate-300 mt-0.5">{shipment.title}</h4>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    ${shipment.totalLogisticsCostUSD.toLocaleString()} USD
                  </span>
                </div>

                {/* Détails du fret aérien ou maritime */}
                {isAir && shipment.airWaybillDetails && (
                  <div className="mb-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lettre de Transport (AWB) :</span>
                      <span className="font-mono text-sky-400 font-bold">{shipment.airWaybillDetails.awbNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Trajet & Compagnie :</span>
                      <span className="text-slate-200">{shipment.airWaybillDetails.originAirport} ➔ {shipment.airWaybillDetails.destinationAirport}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Poids & Colis :</span>
                      <span className="text-slate-300 font-mono">{shipment.airWaybillDetails.grossWeightKg} kg ({shipment.airWaybillDetails.numberOfColis} colis)</span>
                    </div>
                  </div>
                )}

                {!isAir && shipment.oceanBillOfLadingDetails && (
                  <div className="mb-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Connaissement Maritime (B/L) :</span>
                      <span className="font-mono text-indigo-400 font-bold">{shipment.oceanBillOfLadingDetails.blNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ports & Armateur :</span>
                      <span className="text-slate-200">{shipment.oceanBillOfLadingDetails.portOfLoading} ➔ {shipment.oceanBillOfLadingDetails.portOfDischarge}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Conteneur & Scellé :</span>
                      <span className="text-slate-300 font-mono">{shipment.oceanBillOfLadingDetails.containerNumber} ({shipment.oceanBillOfLadingDetails.containerType})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fiche FERI OGEFREM RDC :</span>
                      <span className="text-emerald-400 font-semibold">✓ Validée conforme</span>
                    </div>
                  </div>
                )}

                {/* Workflow : Progression visuelle */}
                <div className="my-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                    <span>Statut actuel :</span>
                    <span className="font-bold text-sky-400 uppercase">
                      {shipment.currentStatus.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-6 gap-1 h-2 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                    {['depart_fournisseur', 'fret_en_transit', 'arrivee_douane', 'dedouanement_dgda', 'transit_national', 'livre_sur_site'].map((st, i) => {
                      const statuses = ['depart_fournisseur', 'fret_en_transit', 'arrivee_douane', 'dedouanement_dgda', 'transit_national', 'livre_sur_site'];
                      const currentIndex = statuses.indexOf(shipment.currentStatus);
                      const isPastOrCurrent = i <= currentIndex;
                      return (
                        <div 
                          key={st}
                          className={`rounded-full transition-all ${
                            isPastOrCurrent ? 'bg-sky-500' : 'bg-slate-800'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Dernier jalon enregistré */}
                {shipment.workflowSteps.length > 0 && (
                  <div className="text-xs bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 mt-2">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">
                      Dernier Événement ({shipment.workflowSteps[shipment.workflowSteps.length - 1].timestamp}) :
                    </span>
                    <p className="text-slate-300 line-clamp-1">
                      {shipment.workflowSteps[shipment.workflowSteps.length - 1].label} — {shipment.workflowSteps[shipment.workflowSteps.length - 1].location}
                    </p>
                  </div>
                )}
              </div>

              {/* Pied de carte avec actions */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-4">
                <div className="text-[11px] text-slate-400">
                  Agent : <strong className="text-slate-200">{shipment.assignedAgentName}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedShipment(shipment);
                      setShowAddStepModal(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-semibold transition"
                  >
                    + Jalon Workflow
                  </button>
                  <button
                    onClick={() => setSelectedShipment(shipment)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Dossier de Frais
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Détails & Lettre de Frais complète */}
      {selectedShipment && !showAddStepModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-sky-500/15 text-sky-400">
                  {selectedShipment.freightType === 'aerien' ? <Plane className="w-6 h-6" /> : <Ship className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {selectedShipment.trackingNumber} — {selectedShipment.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Transporteur : {selectedShipment.carrierName} | Destination : {selectedShipment.destinationFinal}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedShipment(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* VOLET LETTRE DE FRAIS AÉRIEN OU MARITIME */}
            {selectedShipment.freightType === 'aerien' && selectedShipment.airWaybillDetails && (
              <div className="mb-5 bg-slate-950 p-4 rounded-xl border border-sky-500/30">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4" />
                    Lettre de Frais de Transport Aérien (LTA / Air Waybill)
                  </span>
                  <span className="font-mono text-xs font-bold text-white">
                    AWB : {selectedShipment.airWaybillDetails.awbNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-4">
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Taux Fret Aérien / kg :</span>
                    <span className="font-mono font-bold text-white">${selectedShipment.airWaybillDetails.airFreightRatePerKg} / kg</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Poids Facturable :</span>
                    <span className="font-mono font-bold text-white">{selectedShipment.airWaybillDetails.chargeableWeightKg} kg</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Surcharge Carburant (FSC) :</span>
                    <span className="font-mono font-bold text-amber-400">${selectedShipment.airWaybillDetails.fuelSurchargeUSD}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Sûreté Aéroportuaire (SCC) :</span>
                    <span className="font-mono font-bold text-white">${selectedShipment.airWaybillDetails.securitySurchargeUSD}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Manutention Magasin Fret RVA :</span>
                    <span className="font-mono font-bold text-white">${selectedShipment.airWaybillDetails.handlingAirportUSD}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Caution Transit DGDA :</span>
                    <span className="font-mono font-bold text-white">${selectedShipment.airWaybillDetails.dgdaCustomsBondUSD}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-sky-950/40 p-3 rounded-xl border border-sky-500/20 text-xs font-mono">
                  <span className="text-sky-300 font-sans font-semibold">TOTAL COÛTS FRET AÉRIEN :</span>
                  <span className="text-base font-bold text-emerald-400">${selectedShipment.airWaybillDetails.totalAirCostUSD.toLocaleString()} USD</span>
                </div>
              </div>
            )}

            {selectedShipment.freightType === 'maritime' && selectedShipment.oceanBillOfLadingDetails && (
              <div className="mb-5 bg-slate-950 p-4 rounded-xl border border-indigo-500/30">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4" />
                    Lettre de Frais de Transport Maritime (Connaissement B/L & Port Matadi)
                  </span>
                  <span className="font-mono text-xs font-bold text-white">
                    B/L : {selectedShipment.oceanBillOfLadingDetails.blNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs mb-4">
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Fret de base Ocean (O/F) :</span>
                    <span className="font-mono font-bold text-white">${selectedShipment.oceanBillOfLadingDetails.oceanFreightBaseUSD}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Surcharge BAF (Bunker) :</span>
                    <span className="font-mono font-bold text-amber-400">${selectedShipment.oceanBillOfLadingDetails.bunkerAdjustmentBAF_USD}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Surcharge CAF (Currency) :</span>
                    <span className="font-mono font-bold text-white">${selectedShipment.oceanBillOfLadingDetails.currencyAdjustmentCAF_USD}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">THC Débarquement Matadi :</span>
                    <span className="font-mono font-bold text-sky-400">${selectedShipment.oceanBillOfLadingDetails.terminalHandlingTHC_MatadiUSD}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Frais Agence LMC RDC :</span>
                    <span className="font-mono font-bold text-white">${selectedShipment.oceanBillOfLadingDetails.lmcAgencyFeeUSD}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Fiche FERI OGEFREM RDC :</span>
                    <span className="font-mono font-bold text-emerald-400">${selectedShipment.oceanBillOfLadingDetails.ogefremFeriFeeUSD}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg sm:col-span-2">
                    <span className="text-slate-400 block text-[10px]">Droits d'Entrée DGDA (Tarif Solaire) :</span>
                    <span className="font-mono font-bold text-emerald-300">${selectedShipment.oceanBillOfLadingDetails.dgdaDutiesEstimateUSD} (Taux préférentiel)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/20 text-xs font-mono">
                  <span className="text-indigo-300 font-sans font-semibold">TOTAL COÛTS FRET MARITIME & DÉDOUANEMENT :</span>
                  <span className="text-base font-bold text-emerald-400">${selectedShipment.oceanBillOfLadingDetails.totalOceanCostUSD.toLocaleString()} USD</span>
                </div>
              </div>
            )}

            {/* TIMELINE DES ÉTAPES DU WORKFLOW */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Journal du Workflow d'Expédition (Jalons Horodatés)
                </span>
                <button
                  onClick={() => setShowAddStepModal(true)}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg"
                >
                  + Ajouter un jalon terrain
                </button>
              </div>

              <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {selectedShipment.workflowSteps.map((step, idx) => (
                  <div key={idx} className="relative pl-8 text-xs">
                    <div className="absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full bg-sky-500 border-2 border-slate-900"></div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white">{step.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{step.timestamp}</span>
                      </div>
                      <div className="text-[11px] text-sky-400 flex items-center gap-1 mb-1">
                        <MapPin className="w-3 h-3" />
                        {step.location}
                      </div>
                      <p className="text-slate-300 italic">{step.comment}</p>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Opérateur : {step.executedByAgent} ({step.agentRole})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout Jalon Workflow par l'agent */}
      {showAddStepModal && selectedShipment && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddStepSubmit} className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-3">
              Ajouter un Événement / Jalon au Suivi Fret
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Agent exécutant : <span className="text-emerald-400">{currentUser.name}</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Statut du Jalon</label>
                <select
                  value={newStepStatus}
                  onChange={(e) => {
                    const st = e.target.value as any;
                    setNewStepStatus(st);
                    if (st === 'arrivee_douane') setNewStepLabel('Arrivée Douane N\'djili / Port Matadi');
                    if (st === 'dedouanement_dgda') setNewStepLabel('Quittance DGDA & SEGUCE Validée');
                    if (st === 'transit_national') setNewStepLabel('Acheminement convoi routier sécurisé');
                    if (st === 'livre_sur_site') setNewStepLabel('Livraison sur site & recette contradictoire');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="fret_en_transit">Fret en Transit (En vol / En mer)</option>
                  <option value="arrivee_douane">Arrivée Frontière / Port / Aéroport</option>
                  <option value="dedouanement_dgda">Dédouanement DGDA & Guichet Unique</option>
                  <option value="transit_national">Transit National (Route / Convoi)</option>
                  <option value="livre_sur_site">Livré sur Site Minier / Télécoms</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Intitulé du Jalon</label>
                <input 
                  type="text"
                  required
                  value={newStepLabel}
                  onChange={(e) => setNewStepLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Lieu / Poste de Contrôle</label>
                <input 
                  type="text"
                  required
                  value={newStepLocation}
                  onChange={(e) => setNewStepLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Commentaires & Références</label>
                <textarea 
                  rows={3}
                  value={newStepComment}
                  onChange={(e) => setNewStepComment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowAddStepModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl"
              >
                Enregistrer l'étape
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Création Expédition */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateShipment} className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-4">
              Enregistrer une Nouvelle Expédition Fret
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Mode de Fret</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFreightType('aerien');
                      setCarrierName('Ethiopian Cargo');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      freightType === 'aerien' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Plane className="w-3.5 h-3.5" />
                    Fret Aérien (LTA)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFreightType('maritime');
                      setCarrierName('MSC Shipping / LMC');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                      freightType === 'maritime' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Ship className="w-3.5 h-3.5" />
                    Fret Maritime (B/L)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Intitulé de la cargaison</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Antennes VSAT et modems haute fréquence"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Compagnie / Armateur</label>
                <input 
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-300 font-semibold block mb-1">Origine</label>
                  <input 
                    type="text"
                    value={supplierOrigin}
                    onChange={(e) => setSupplierOrigin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-300 font-semibold block mb-1">Destination finale</label>
                  <input 
                    type="text"
                    value={destinationFinal}
                    onChange={(e) => setDestinationFinal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl"
              >
                Enregistrer l'expédition
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
