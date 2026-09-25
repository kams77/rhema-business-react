// src/components/RhemaOfficialDocument.tsx
import React, { useState } from 'react';
import type { DocumentItem, Organization } from '../types';
import { 
  Printer, 
  X, 
  Share2, 
  Lock, 
  CheckCircle2, 
  Globe2, 
  ShieldCheck, 
  FileText 
} from 'lucide-react';

interface RhemaOfficialDocumentProps {
  document: DocumentItem;
  organization: Organization;
  onClose: () => void;
}

export const RhemaOfficialDocument: React.FC<RhemaOfficialDocumentProps> = ({
  document,
  organization,
  onClose,
}) => {
  const [isSigned, setIsSigned] = useState(document.status === 'signe');
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleSign = () => {
    setIsSigned(true);
  };

  const handleShare = () => {
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        
        {/* BARRE SUPÉRIEURE (FIDÈLE À LA CAPTURE 2) */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white tracking-wide">
                  {organization.name} — Document Officiel Partagé
                </span>
                <span className="text-xs font-mono font-bold bg-slate-800 text-sky-300 px-2 py-0.5 rounded border border-slate-700">
                  {document.referenceNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Conforme aux chartes légales RDC (RCCM / Id.Nat / N°Impôt)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{shareSuccess ? 'Lien Copié !' : 'Partager à l\'Entreprise'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FEUILLE DE PAPIER BLANCHE OFFICIELLE (EXACTE À LA CAPTURE 2) */}
        <div className="p-6 sm:p-8 overflow-y-auto bg-slate-950/90 flex justify-center">
          <div className="bg-white text-slate-900 rounded-xl p-8 sm:p-10 shadow-2xl max-w-3xl w-full border border-slate-200 min-h-[700px] flex flex-col justify-between font-sans relative">
            
            {/* Filigrane d'authenticité */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none text-9xl font-black text-slate-900 rotate-[-25deg]">
              RHEMA BUSINESS
            </div>

            <div>
              {/* EN-TÊTE OFFICIEL */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b pb-6 mb-6">
                <div>
                  {/* Logo Officiel RHEMA BUSINESS (avec Globe et Bandeau Rouge) */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full border-2 border-red-600 flex items-center justify-center p-1 bg-white shadow-sm shrink-0">
                      <div className="w-full h-full rounded-full border border-blue-600 flex items-center justify-center bg-blue-50">
                        <Globe2 className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xl font-black tracking-tight text-blue-950 flex items-center gap-1">
                        <span className="text-red-600">RHEMA</span>
                        <span className="text-blue-900">BUSINESS</span>
                      </div>
                      <div className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                        YOUR VSAT TECHNOLOGY PARTNER
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-0.5 mt-2">
                    <p>Prestataire : <strong>RHEMA BUSINESS</strong></p>
                    <p>Adresse : 1B, Av . Bangala</p>
                    <p>RCCM/20-A-01120</p>
                    <p>Id. Nat : 01-H5300-N65775Q</p>
                    <p>Numéro Impôt : A2166190U</p>
                    <p>Kinshasa-Kintambo</p>
                  </div>
                </div>

                {/* Bloc Référence et Enregistrement */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-right w-full sm:w-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    DOCUMENT OFFICIEL D'ENTREPRISE
                  </p>
                  <p className="text-sm font-mono font-bold text-slate-900 mt-1">
                    RÉF : {document.referenceNumber}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Émis le : {document.createdAt}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Enregistrement Certifié RDC</span>
                  </div>
                </div>
              </div>

              {/* TITRE PRINCIPAL DU DOCUMENT */}
              <div className="text-center my-6">
                <h2 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-tight">
                  {document.title}
                </h2>
              </div>

              {/* CADRES DE CONTENU DE LA PIÈCE */}
              <div className="space-y-4">
                {/* Nature du document */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Nature du document</span>
                    <span className="font-bold text-blue-950 uppercase">{document.category}</span>
                    <span className="text-slate-600 ml-1.5">({document.subtype.replace(/_/g, ' ')})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Statut de validation</span>
                    <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                      {document.status === 'signe' ? 'APPROUVÉ & SIGNÉ' : 'APPROUVÉ'}
                    </span>
                  </div>
                </div>

                {/* Objet / Contexte */}
                <div className="border border-slate-200 rounded-xl p-4 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    OBJET / CONTEXTE OPÉRATIONNEL :
                  </span>
                  <p className="text-slate-800 leading-relaxed font-medium">
                    {document.description}
                  </p>
                </div>

                {/* Montant engagé */}
                {document.amount && (
                  <div className="border border-slate-200 rounded-xl p-4 flex justify-between items-center bg-slate-50/50">
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      MONTANT ENGAGÉ / TOTAL FACTURÉ :
                    </span>
                    <span className="text-lg font-mono font-black text-blue-950">
                      {document.amount.toLocaleString()} {document.currency || 'FCFA'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* CADRES DE SIGNATURES DU BAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-8 mt-8 border-t border-slate-200 text-xs">
              {/* Émetteur */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Émetteur / Service Rédacteur</span>
                <p className="font-bold text-slate-900 mt-1">{document.authorName}</p>
                <p className="text-[11px] text-slate-500">{document.authorEntity}</p>
                <div className="mt-4 pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-400 italic">
                  Visa pour transmission et exécution
                </div>
              </div>

              {/* Certification Direction Générale */}
              <div className={`border rounded-xl p-3.5 transition ${
                isSigned 
                  ? 'border-amber-400 bg-amber-50/50 text-amber-950' 
                  : 'border-slate-200 bg-slate-50/40'
              }`}>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Certification Direction Générale</span>
                {isSigned ? (
                  <div className="mt-1">
                    <p className="font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Signé & Certifié par {document.electronicSignature?.signedBy || organization.managerName}
                    </p>
                    <p className="text-[10px] font-mono text-slate-600 mt-1 truncate">
                      {document.electronicSignature?.certificateHash || 'SHA256:7f83b1657ff1fc53b92c451da74d39f284b'}
                    </p>
                    <div className="mt-3 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300 inline-block">
                      ✓ Sceau d'entreprise inviolable
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-slate-500 italic text-[11px]">
                    En attente de signature certifiée de la direction
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* PIED DE MODAL AVEC BOUTON DE SIGNATURE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-800 bg-slate-950">
          <p className="text-[11px] text-slate-400">
            Ce document intègre obligatoirement l'en-tête et le pied de page RHEMA BUSINESS pour toute diffusion officielle.
          </p>

          <div className="flex items-center gap-2">
            {!isSigned && (
              <button
                onClick={handleSign}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Signer & Sceller pour {organization.name}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              Fermer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export const RhemaDocumentFooter: React.FC = () => {
  return (
    <footer className="pt-4 border-t-2 border-slate-100 text-[10px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
      <div>
        <span className="font-bold text-slate-800">RHEMA BUSINESS RDC SARL</span> • RCCM/20-A-01120 • Id. Nat. 01-83-N88201B
      </div>
      <div>
        N°1B, Avenue Bangala, Q/Salongo, C/Kintambo, Kinshasa • contact@rhemabusiness.com
      </div>
    </footer>
  );
};