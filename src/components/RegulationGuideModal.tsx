// src/components/RegulationGuideModal.tsx
// Guide des normes RDC, du cloisonnement RBAC, de la sécurité et des workflows.
import React, { useState } from 'react';
import { ShieldAlert, HelpCircle, X, Layers, Scale, FileCheck2 } from 'lucide-react';

type HelpTab = 'rdc_payroll' | 'rbac' | 'security' | 'workflows';

interface RegulationGuideModalProps {
  onClose: () => void;
}

export const RegulationGuideModal: React.FC<RegulationGuideModalProps> = ({ onClose }) => {
  const [helpActiveTab, setHelpActiveTab] = useState<HelpTab>('rdc_payroll');

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Guide des Normes & Logique Hiérarchique RHEMA BUSINESS</h3>
              <p className="text-xs text-slate-400">Documentation technique et conformité au Code du Travail de la RD CONGO</p>
            </div>
          </div>
          <button
            onClick={() => onClose()}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Onglets d'aide */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {[
            { id: 'rdc_payroll', label: 'Paie & Fiscalité RDC', icon: Scale },
            { id: 'rbac', label: 'Cloisonnement RBAC', icon: Layers },
            { id: 'security', label: 'Anti-Intrusion & Récidive', icon: ShieldAlert },
            { id: 'workflows', label: 'Workflows & Hash SHA-256', icon: FileCheck2 },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setHelpActiveTab(tab.id as HelpTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      helpActiveTab === tab.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contenu onglet */}
        <div className="text-xs leading-relaxed text-slate-300 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {helpActiveTab === 'rdc_payroll' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                  <Scale className="w-4 h-4" /> Devises Légales & Taux de Change
                </h4>
                <p>
                  Conformément à la réglementation de la Banque Centrale du Congo (BCC), les calculs salariaux s'effectuent strictement en <strong>USD ($)</strong> ou en <strong>Francs Congolais (CDF)</strong> au taux de référence officiel (ex: 2 850 CDF = 1 USD).
                </p>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-indigo-400">Cotisations Sociales Salarié & Employeur :</h4>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                  <li><strong>CNSS Salariale (5%) :</strong> Branche des pensions de vieillesse et retraite légale.</li>
                  <li><strong>CNSS Patronale (13%) :</strong> 5% pensions + 4% risques professionnels + 4% prestations familiales.</li>
                  <li><strong>INPP Patronal (3%) :</strong> Institut National de Préparation Professionnelle (formation continue).</li>
                  <li><strong>ONEM Patronal (0.2%) :</strong> Office National de l'Emploi pour la régulation du marché du travail.</li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-amber-400">Barème Progressif IPR (Impôt Professionnel sur les Rémunérations) :</h4>
                <p className="text-slate-400">Tranches d'imposition sur le salaire net imposable avec abattement par charge de famille (enfants) :</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">0 à 200 $ : <strong>3%</strong></div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">200 à 600 $ : <strong>10%</strong></div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">600 à 1 500 $ : <strong>20%</strong></div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">1 500 à 3 000 $ : <strong>30%</strong></div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 col-span-2 sm:col-span-1">&gt; 3 000 $ : <strong>40%</strong></div>
                </div>
              </div>
            </div>
          )}

          {helpActiveTab === 'rbac' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-purple-400">1. Direction Générale (DG / PDG)</h4>
                <p>Habilitation globale sans aucune restriction sur l'ensemble des départements, bilans comptables, fiches de paie et alertes de sécurité.</p>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-blue-400">2. Chefs de Départements & Directeurs</h4>
                <p>Administration déconcentrée : ils ont autorité exclusive sur leurs divisions et services subordonnés (ex: le DAF ne peut pas modifier les ordres techniques du DOP).</p>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-cyan-400">3. Chefs de Services & Agents Opérationnels</h4>
                <p>Accès strictement confiné à leur cellule de rattachement. Les documents des autres services apparaissent floutés ou bloqués.</p>
              </div>
            </div>
          )}

          {helpActiveTab === 'security' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-red-950/20 rounded-xl border border-red-500/30 space-y-2 text-red-200">
                <h4 className="font-bold text-red-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Politique Anti-Intrusion & Blocage Récidive
                </h4>
                <p>
                  Dès qu'un collaborateur essaie d'ouvrir un document hors de son périmètre d'habilitation (par exemple un agent réseau essayant de lire les journaux de paie DAF) :
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-slate-300">
                  <li><strong>1ère tentative :</strong> Émission instantanée d'une Alerte de Sécurité au tableau de bord DG et horodatage de l'adresse IP.</li>
                  <li><strong>2ème tentative (Récidive) :</strong> Verrouillage immédiat du compte de l'opérateur, suspension des sessions et convocation disciplinaire programmée.</li>
                </ol>
              </div>
            </div>
          )}

          {helpActiveTab === 'workflows' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-bold text-cyan-400">Traçabilité Cryptographique SHA-256</h4>
                <p>
                  Chaque validation de tâche, visa de dépense ou approbation de bon de commande génère un sceau d'intégrité non falsifiable calculé à partir de la clé publique de l'agent signataire, de l'adresse IP et de l'horodatage précis.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            onClick={() => onClose()}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
          >
            Fermer le Guide
          </button>
        </div>
      </div>
    </div>
  );
};
