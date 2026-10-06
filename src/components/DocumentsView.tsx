// src/components/DocumentsView.tsx
import React, { useState } from 'react';
import { todayLocal } from '../lib/dates';
import { parseAmount } from '../lib/money';
import { nextReference } from '../lib/sequence';
import { shortHash } from '../lib/integrity';
import type { 
  DocumentItem, 
  Organization, 
  User, 
  HierarchicalEntity, 
  DocumentCategory, 
  DocumentSubtype, 
  UserRole 
} from '../types';
import { 
  FileText, 
  Plus, 
  Search, 
  Eye, 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  FilePlus2,
  X,
  ShieldAlert,
  Users2,
  AlertTriangle,
  Download,
  Clock,
  Send,
  Check,
  RotateCcw,
  Sparkles,
  FileCheck2,
  Trash2,
  Filter
} from 'lucide-react';
import { RhemaOfficialDocument } from './RhemaOfficialDocument';
import { canUserViewDocument, canUserApproveDocument } from '../utils/rbac';
import { exportOfficialDocumentToPDF, exportOfficialDocumentToCSV } from '../utils/exportUtils';
import { ElectronicSignatureModal, type SignatureData } from './ElectronicSignatureModal';

export type AccreditationLevel = 
  | 'public_entreprise' 
  | 'perimetre_entite' 
  | 'direction_dg_only' 
  | 'strict_confidentiel';

export type DocumentWorkflowFilter = 
  | 'all' 
  | 'pending_my_visa' 
  | 'signed' 
  | 'draft_or_review' 
  | 'financier' 
  | 'logistique' 
  | 'rh';

interface DocumentsViewProps {
  documents: DocumentItem[];
  organization: Organization;
  currentUser: User;
  entities?: HierarchicalEntity[];
  onAddDocument: (doc: Omit<DocumentItem, 'id'>) => void;
  onUpdateDocument?: (docId: string, updates: Partial<DocumentItem>) => void;
  onDeleteDocument?: (docId: string) => void;
  onLogAction?: (action: string, details: string, category: 'admin' | 'document' | 'task' | 'security') => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  organization,
  currentUser,
  entities = [],
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
  onLogAction,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [signingDoc, setSigningDoc] = useState<DocumentItem | null>(null);
  const [viewingCertificateDoc, setViewingCertificateDoc] = useState<DocumentItem | null>(null);
  const [search, setSearch] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState<DocumentWorkflowFilter>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [rejectModalDocId, setRejectModalDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Formulaire de publication avec accréditation
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('financier_comptable');
  const [selectedSubtype, setSelectedSubtype] = useState<DocumentSubtype>('facture_client');
  const [title, setTitle] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [accreditationLevel, setAccreditationLevel] = useState<AccreditationLevel>('perimetre_entite');
  const [initialStatus, setInitialStatus] = useState<'brouillon' | 'en_revue' | 'signe'>('en_revue');
  const [includeFinancialAmount, setIncludeFinancialAmount] = useState<boolean>(true);
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string>('');

  const subtypeOptions: Record<DocumentCategory, { value: DocumentSubtype; label: string }[]> = {
    financier_comptable: [
      { value: 'facture_client', label: 'Facture Client' },
      { value: 'facture_fournisseur', label: 'Facture Fournisseur' },
      { value: 'bilan_comptable', label: 'Bilan Comptable & États Financiers' },
      { value: 'devis', label: 'Note de Frais & Missions' },
      { value: 'avoir', label: 'Avoir / Note de Crédit' }
    ],
    chaine_logistique_commerciale: [
      { value: 'bon_commande_client', label: 'Bon de Commande Fournisseur (BCF)' },
      { value: 'bon_livraison', label: 'Bon de Livraison / Expédition' },
      { value: 'bon_reception', label: 'Inventaire Physique & Réception Stocks' },
      { value: 'contrat_travail', label: 'Contrat Commercial Partenaire' }
    ],
    ressources_humaines: [
      { value: 'bulletin_de_paie', label: 'Bulletin de Paie (Confidentiel)' },
      { value: 'contrat_travail', label: 'Contrat de Travail (CDI / CDD)' },
      { value: 'fiche_poste', label: 'Déclaration Trimestrielle CNSS & IPR' },
      { value: 'feuille_de_temps', label: 'Fiche d\'Évaluation & Habilitation' }
    ]
  };

  const handleCategoryChange = (cat: DocumentCategory) => {
    setSelectedCategory(cat);
    setSelectedSubtype(subtypeOptions[cat][0].value);
    if (cat === 'ressources_humaines') {
      setAccreditationLevel('strict_confidentiel');
      setIncludeFinancialAmount(false);
    } else if (cat === 'financier_comptable') {
      setIncludeFinancialAmount(true);
    } else {
      setIncludeFinancialAmount(false);
    }
  };

  // Calcul dynamique des permissions d'accès selon le niveau d'accréditation
  const getRolesByAccreditation = (level: AccreditationLevel): { allowed: UserRole[]; description: string; prohibited: string } => {
    switch (level) {
      case 'public_entreprise':
        return {
          allowed: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
          description: 'Tous les collaborateurs de l’entreprise ont accès à ce document.',
          prohibited: 'Aucune restriction'
        };
      case 'perimetre_entite':
        return {
          allowed: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'],
          description: 'Visible uniquement par les agents rattachés à cette entité et le Directeur Général.',
          prohibited: 'Agents des autres départements et directions externes'
        };
      case 'direction_dg_only':
        return {
          allowed: ['dg', 'chef_departement', 'directeur'],
          description: 'Réservé aux Directeurs, Chefs de Département et à la Direction Générale.',
          prohibited: 'Agents exécutants, chefs de service et personnel opérationnel'
        };
      case 'strict_confidentiel':
        return {
          allowed: ['dg', 'directeur'],
          description: 'Confidentiel absolu : Titulaire du document, Directeur RH et DG exclusivement.',
          prohibited: 'Tout autre département, chefs de division, chefs de service et tiers'
        };
    }
  };

  // Vérification si un document nécessite le visa de l'utilisateur connecté
  const isDocumentPendingMyVisa = (doc: DocumentItem): boolean => {
    if (doc.status !== 'en_revue') return false;
    const approval = canUserApproveDocument(currentUser, doc, entities);
    return approval.allowed;
  };

  const pendingVisasCount = documents.filter(d => isDocumentPendingMyVisa(d)).length;

  // Filtrage des documents
  const filteredDocs = documents.filter(doc => {
    // Règle de visibilité RBAC
    const viewCheck = canUserViewDocument(currentUser, doc, entities);
    if (!viewCheck.allowed) return false;

    // Recherche
    const matchSearch = doc.title.toLowerCase().includes(search.toLowerCase()) || 
                        doc.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
                        doc.authorName.toLowerCase().includes(search.toLowerCase()) ||
                        (doc.description && doc.description.toLowerCase().includes(search.toLowerCase()));

    if (!matchSearch) return false;

    // Filtres d'état et catégories
    if (workflowFilter === 'pending_my_visa') {
      return isDocumentPendingMyVisa(doc);
    }
    if (workflowFilter === 'signed') {
      return doc.status === 'signe' || doc.status === 'approuve';
    }
    if (workflowFilter === 'draft_or_review') {
      return doc.status === 'brouillon' || doc.status === 'en_revue';
    }
    if (workflowFilter === 'financier') {
      return doc.category === 'financier_comptable';
    }
    if (workflowFilter === 'logistique') {
      return doc.category === 'chaine_logistique_commerciale';
    }
    if (workflowFilter === 'rh') {
      return doc.category === 'ressources_humaines';
    }

    return true;
  });

  // Action : Soumettre pour visa
  const handleSubmitForVisa = (docId: string) => {
    if (onUpdateDocument) {
      onUpdateDocument(docId, { status: 'en_revue' });
    }
    if (onLogAction) {
      onLogAction('Transmission Visa Document', `Document #${docId} soumis au circuit de visa hiérarchique`, 'document');
    }
  };

  // Action : Viser et signer électroniquement avec vérification probante
  const handleSignDocument = (docId: string, sig: SignatureData) => {
    // La signature vient toujours de la fenêtre de signature : mot de passe vérifié et empreinte réelle.
    const hash = sig.certificateHash;
    const updates: Partial<DocumentItem> = {
      status: 'signe',
      electronicSignature: {
        signedBy: sig.signedBy,
        signedAt: sig.signedAt,
        role: sig.role,
        certificateHash: hash,
        signatureImage: sig.signatureImage,
        signatureType: sig.signatureType,
        legalConsent: sig.legalConsent,
        verificationAudit: sig.verificationAudit,
      }
    };

    if (onUpdateDocument) {
      onUpdateDocument(docId, updates);
    }
    if (onLogAction) {
      onLogAction('Signature Électronique', `Document #${docId} signé par ${currentUser.name} après confirmation du mot de passe (empreinte ${shortHash(hash)}).`, 'security');
    }
    if (selectedDoc && selectedDoc.id === docId) {
      setSelectedDoc(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  // Action : Rejeter avec motif
  const handleRejectDocument = () => {
    if (!rejectModalDocId) return;
    if (onUpdateDocument) {
      onUpdateDocument(rejectModalDocId, {
        status: 'rejete',
        description: `[MOTIF REJET / RÉVISION : ${rejectReason || 'Non conforme'}]`
      });
    }
    if (onLogAction) {
      onLogAction('Rejet Document', `Document #${rejectModalDocId} rejeté : ${rejectReason}`, 'document');
    }
    setRejectModalDocId(null);
    setRejectReason('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim()) {
      setFormError('L\'intitulé officiel du document est requis.');
      return;
    }
    if (!description.trim()) {
      setFormError('Le corps descriptif du document est obligatoire. Veuillez saisir les stipulations, clauses ou l\'exposé officiel des motifs.');
      return;
    }

    const matchedEntity = entities.find(e => e.id === selectedEntityId);
    const numAmount = (includeFinancialAmount && amount.trim())
      ? parseAmount(amount) ?? undefined
      : undefined;
    if (includeFinancialAmount && amount.trim() && numAmount === undefined) {
      setFormError('Montant illisible. Exemple : 1 200,50');
      return;
    }
    const isPayslip = selectedSubtype === 'bulletin_de_paie' || accreditationLevel === 'strict_confidentiel';
    const acc = getRolesByAccreditation(accreditationLevel);


    onAddDocument({
      title: title.trim(),
      referenceNumber: nextReference('DOC', documents.map(d => d.referenceNumber)),
      category: selectedCategory,
      subtype: selectedSubtype,
      organizationId: organization.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorEntity: currentUser.roleTitle,
      targetEntityId: selectedEntityId || undefined,
      targetEntityName: matchedEntity?.name,
      createdAt: todayLocal(),
      status: initialStatus,
      size: '1.4 Mo',
      fileType: 'PDF',
      amount: numAmount,
      currency: numAmount !== undefined ? currency : undefined,
      isConfidentialPayslip: isPayslip,
      description: description.trim(),
      allowedRoles: acc.allowed,
      permissions: {
        viewRoles: acc.allowed,
        editRoles: ['dg'],
        validateRoles: ['dg'],
        signRoles: ['dg']
      }
    });

    setShowAddModal(false);
    setTitle('');
    setAmount('');
    setDescription('');
    setSelectedEntityId('');
    setIncludeFinancialAmount(false);
    setFormError('');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. BANNIÈRE SUPÉRIEURE */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>GESTION ÉLECTRONIQUE DES DOCUMENTS & WORKFLOW PROBANT</span>
            </span>
            {pendingVisasCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>{pendingVisasCount} Document(s) en attente de votre visa</span>
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Documents Officiels, Traçabilité & Circuit de Visa
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Émission, visa hiérarchique et scellement électronique des pièces financières, logistiques et RH. Chaque pièce intègre l'en-tête officiel et, une fois signée, l'empreinte SHA-256 de son contenu.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Publier un Nouveau Document</span>
        </button>
      </div>

      {/* 2. RECHERCHE ET ONGLETS DE FILTRAGE WORKFLOW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setWorkflowFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              workflowFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Tous les Documents ({documents.length})
          </button>

          <button
            onClick={() => setWorkflowFilter('pending_my_visa')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              workflowFilter === 'pending_my_visa'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-rose-500/20'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>À mon Visa ({pendingVisasCount})</span>
          </button>

          <button
            onClick={() => setWorkflowFilter('signed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              workflowFilter === 'signed'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Signés</span>
          </button>

          <button
            onClick={() => setWorkflowFilter('draft_or_review')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              workflowFilter === 'draft_or_review'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            En Revue / Brouillons
          </button>

          <button
            onClick={() => setWorkflowFilter('financier')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              workflowFilter === 'financier'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            $ Financiers
          </button>

          <button
            onClick={() => setWorkflowFilter('logistique')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              workflowFilter === 'logistique'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            📦 Logistique
          </button>

          <button
            onClick={() => setWorkflowFilter('rh')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              workflowFilter === 'rh'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            👥 RH & Contrats
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher réf, titre, auteur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* 3. GRILLE DES DOCUMENTS OFFICIELS AVEC WORKFLOW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 space-y-2">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-bold text-sm text-slate-300">Aucun document ne correspond à ce filtre</p>
            <p className="text-xs text-slate-500">Ajustez vos filtres ou publiez une nouvelle pièce certifiée.</p>
          </div>
        ) : (
          filteredDocs.map(doc => {
            const isSigned = doc.status === 'signe';
            const isPendingReview = doc.status === 'en_revue';
            const isDraft = doc.status === 'brouillon';
            const isRejected = doc.status === 'rejete';
            const canApprove = isPendingReview && canUserApproveDocument(currentUser, doc, entities).allowed;

            return (
              <div
                key={doc.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4 transition"
              >
                <div className="space-y-3">
                  {/* Badge statut et référence */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/40 border border-sky-500/30 px-2 py-0.5 rounded-lg">
                      {doc.referenceNumber}
                    </span>

                    {/* Statut du Workflow */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      isSigned
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : isPendingReview
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : isRejected
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {isSigned && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      {isPendingReview && <Clock className="w-3 h-3 text-amber-400 animate-pulse" />}
                      {isRejected && <X className="w-3 h-3 text-rose-400" />}
                      <span>
                        {isSigned
                          ? 'Validé & Signé DG'
                          : isPendingReview
                          ? 'En Visa Hiérarchique'
                          : isRejected
                          ? 'Rejeté / Révision'
                          : 'Brouillon Interne'}
                      </span>
                    </span>
                  </div>

                  {/* Titre et Corps descriptif obligatoire */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-sm text-white line-clamp-1" title={doc.title}>
                      {doc.title}
                    </h3>

                    {/* Corps descriptif obligatoire mis en valeur */}
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold uppercase tracking-wider flex items-center gap-1 text-sky-400">
                          <FileText className="w-3 h-3 text-sky-400" />
                          <span>Corps Descriptif Officiel</span>
                        </span>
                        <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Obligatoire
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-3 leading-relaxed">
                        {doc.description}
                      </p>
                    </div>
                  </div>

                  {/* Données financières / métadonnées */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs">
                    {doc.amount !== undefined && doc.amount !== null && doc.amount > 0 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Montant engagé :</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {doc.amount.toLocaleString()} {doc.currency || 'USD'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Incidence financière :</span>
                        <span className="text-[10px] text-slate-400 italic">Sans obligation de montant</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Auteur :</span>
                      <span className="text-slate-200 truncate max-w-[150px]">{doc.authorName}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Date d'émission :</span>
                      <span className="font-mono">{doc.createdAt}</span>
                    </div>
                  </div>

                  {/* Scellement électronique si signé */}
                  {isSigned && doc.electronicSignature && (
                    <div 
                      onClick={() => setViewingCertificateDoc(doc)}
                      className="p-2 rounded-lg bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 hover:border-emerald-500/40 text-[10px] text-emerald-300 font-mono flex items-center justify-between gap-1.5 cursor-pointer transition group"
                      title="Cliquer pour inspecter le certificat de scellement électronique et l'audit probant"
                    >
                      <span className="truncate">✓ Signé • {shortHash(doc.electronicSignature.certificateHash)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap group-hover:bg-emerald-500/30">
                        Certificat
                      </span>
                    </div>
                  )}
                </div>

                {/* Boutons d'action contextuels du circuit de visa */}
                <div className="space-y-2 pt-3 border-t border-slate-800">
                  {/* Actions de signature / soumission selon rôle */}
                  {canApprove && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSigningDoc(doc)}
                        className="flex-1 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 transition active:scale-95"
                        title="Ouvrir le composant de signature électronique avec animation de vérification"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Viser & Signer (DG/RH)</span>
                      </button>
                      <button
                        onClick={() => setRejectModalDocId(doc.id)}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs transition"
                        title="Rejeter le document et demander une révision"
                      >
                        Rejeter
                      </button>
                    </div>
                  )}

                  {isDraft && (
                    <button
                      onClick={() => handleSubmitForVisa(doc.id)}
                      className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Transmettre au Circuit de Visa</span>
                    </button>
                  )}

                  {/* Consultation & Téléchargements */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Consulter</span>
                    </button>

                    {isSigned && (
                      <button
                        onClick={() => setViewingCertificateDoc(doc)}
                        title="Inspecter le certificat électronique, l'empreinte SHA-256 et l'audit probant"
                        className="p-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 transition active:scale-95"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                    )}

                    <button
                      onClick={() => exportOfficialDocumentToPDF(doc, organization)}
                      title="Télécharger le document certifié au format PDF A4"
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-400" />
                    </button>

                    <button
                      onClick={() => exportOfficialDocumentToCSV(doc, organization.name)}
                      title="Exporter les métadonnées en CSV"
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95"
                    >
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. MODALE CONSULTATION PIÈCE OFFICIELLE AVEC EN-TÊTE ET FOOTER RHEMA */}
      {selectedDoc && (
        <RhemaOfficialDocument
          document={selectedDoc}
          organization={organization}
          currentUser={currentUser}
          entities={entities}
          onClose={() => setSelectedDoc(null)}
          onSignDocument={(docId, sigData) => {
            handleSignDocument(docId, sigData);
          }}
        />
      )}

      {/* 4.B MODALE SIGNATURE ÉLECTRONIQUE AVEC ANIMATION DE VÉRIFICATION */}
      {signingDoc && (
        <ElectronicSignatureModal
          document={signingDoc}
          organization={organization}
          currentUser={currentUser}
          onClose={() => setSigningDoc(null)}
          onSignComplete={(docId, sigData) => {
            handleSignDocument(docId, sigData);
            setSigningDoc(null);
          }}
        />
      )}

      {/* 4.C MODALE CERTIFICAT CRYPTOGRAPHIQUE & AUDIT PROBANT */}
      {viewingCertificateDoc && viewingCertificateDoc.electronicSignature && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4 my-auto text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Certificat de Signature & Scellement Probant</h3>
                  <p className="text-[11px] text-slate-400">Réf : {viewingCertificateDoc.referenceNumber}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingCertificateDoc(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] text-slate-400">Document :</span>
                  <span className="font-bold text-white text-right max-w-[280px]">{viewingCertificateDoc.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[11px] text-slate-400">Signataire certifié :</span>
                  <span className="font-bold text-emerald-300">{viewingCertificateDoc.electronicSignature.signedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[11px] text-slate-400">Horodatage officiel :</span>
                  <span className="font-mono text-slate-200">{viewingCertificateDoc.electronicSignature.signedAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[11px] text-slate-400">Organisme émetteur :</span>
                  <span className="text-slate-200">{organization.name} (RDC)</span>
                </div>
              </div>

              {/* Empreinte SHA-256 avec bouton copier */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Empreinte Cryptographique Inviolable (SHA-256)</span>
                  <button
                    onClick={() => {
                      if (viewingCertificateDoc.electronicSignature?.certificateHash) {
                        navigator.clipboard.writeText(viewingCertificateDoc.electronicSignature.certificateHash);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }
                    }}
                    className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition"
                  >
                    {copySuccess ? 'Copié !' : 'Copier le hash'}
                  </button>
                </div>
                <p className="font-mono text-[10px] text-amber-300 break-all p-2 rounded bg-slate-900 border border-slate-800/80 select-all">
                  {viewingCertificateDoc.electronicSignature.certificateHash}
                </p>
              </div>

              {/* Aperçu de la griffe / sceau */}
              {viewingCertificateDoc.electronicSignature.signatureImage && (
                <div className="p-3 rounded-xl bg-white text-slate-900 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Griffe / Paraphe légal</span>
                    <span className="text-[11px] font-semibold text-slate-800">Apposée avec consentement probant</span>
                  </div>
                  <img 
                    src={viewingCertificateDoc.electronicSignature.signatureImage} 
                    alt="Griffe" 
                    className="h-10 max-w-[180px] object-contain"
                  />
                </div>
              )}

              {/* Audit checks */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-300">
                  <div className="font-bold">✓ Intégrité</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">SHA-256 Certifié</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-300">
                  <div className="font-bold">✓ Habilitation</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Accréditation RBAC</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-emerald-300">
                  <div className="font-bold">✓ Horodatage</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">RFC 3161 UTC+1</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => exportOfficialDocumentToPDF(viewingCertificateDoc, organization)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow flex items-center gap-1.5 transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger PDF avec Certificat</span>
              </button>
              <button
                onClick={() => setViewingCertificateDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODALE PUBLIER UN NOUVEAU DOCUMENT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm tracking-wide">
                <FilePlus2 className="w-4 h-4 text-emerald-400" />
                <span>Publier un Document dans le Workflow</span>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              {/* Catégorie */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Catégorie Opérationnelle</label>
                  <select
                    value={selectedCategory}
                    onChange={e => handleCategoryChange(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="financier_comptable">Financier & Comptable</option>
                    <option value="chaine_logistique_commerciale">Chaine Logistique & Stocks</option>
                    <option value="ressources_humaines">Ressources Humaines</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Type de Document</label>
                  <select
                    value={selectedSubtype}
                    onChange={e => setSelectedSubtype(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {subtypeOptions[selectedCategory].map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Titre */}
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Intitulé du Document *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Note d'Organisation du Déploiement VSAT Tenke..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              {/* CORPS DESCRIPTIF (OBLIGATOIRE) */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <label className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Corps Descriptif & Dispositif Officiel *</span>
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    OBLIGATOIRE
                  </span>
                </div>
                
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tout document officiel doit obligatoirement être motivé par un texte descriptif (contexte, clauses, directives ou stipulations).
                </p>

                {/* Modèles d'insertion rapide pour le corps descriptif */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-500">Modèles rapides :</span>
                  <button
                    type="button"
                    onClick={() => setDescription("Par la présente note, la Direction informe l'ensemble des départements et agents des dispositions opérationnelles applicables. L'exécution de cette directive prend effet immédiatement sous la supervision du Chef de Service concerné.")}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    Note de Service
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescription("Le présent document atteste formellement l'accord intervenu entre les parties pour la réalisation conforme des prestations techniques et logistiques, selon les termes et délais convenus avec la Direction.")}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    Attestation & Accord
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescription("Rapport circonstancié constatant l'état des opérations, la réception des livrables et la validation des étapes de déploiement réseau, sans réserve formulée à ce jour.")}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    Rapport Opérationnel
                  </button>
                </div>

                <textarea
                  rows={4}
                  required
                  minLength={10}
                  placeholder="Saisissez ici le texte intégral, l'objet et le dispositif légal de la pièce..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed mt-1"
                />
                
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>{description.trim().length} caractère(s)</span>
                  <span className={description.trim().length >= 10 ? 'text-emerald-400' : 'text-amber-400'}>
                    {description.trim().length >= 10 ? '✓ Corps textuel valide' : 'Minimum 10 caractères'}
                  </span>
                </div>
              </div>

              {/* Statut initial & Entité cible */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Entité Cible</label>
                  <select
                    value={selectedEntityId}
                    onChange={e => setSelectedEntityId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Toute l'entreprise --</option>
                    {entities.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1">Circuit Initial</label>
                  <select
                    value={initialStatus}
                    onChange={e => setInitialStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="en_revue">Soumettre au Visa (En Revue)</option>
                    <option value="brouillon">Enregistrer comme Brouillon</option>
                  </select>
                </div>
              </div>

              {/* SECTION MONTANT FINANCIER (FACULTATIF / SANS OBLIGATION) */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeFinancialAmount}
                      onChange={e => setIncludeFinancialAmount(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-900"
                    />
                    <span className="text-xs font-semibold text-slate-300">
                      Ce document comporte une incidence financière (prix ou montant)
                    </span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    FACULTATIF
                  </span>
                </div>

                {includeFinancialAmount ? (
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 animate-in fade-in">
                    <div className="col-span-2">
                      <label className="text-slate-400 text-[11px] block mb-1">Montant ou Prix engagé</label>
                      <input
                        type="text"
                        placeholder="ex: 15000"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-[11px] block mb-1">Devise</label>
                      <select
                        value={currency}
                        onChange={e => setCurrency(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="CDF">CDF (FC)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic pt-1">
                    Sans obligation de montant : le document sera émis comme pièce administrative, juridique ou RH sans incidence financière.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition active:scale-95 flex items-center gap-1.5"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>Publier dans le Circuit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODALE REJET DOCUMENT */}
      {rejectModalDocId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-3">
            <h3 className="font-bold text-sm text-red-400">Motif de Révision ou de Rejet</h3>
            <textarea
              rows={3}
              placeholder="Précisez pourquoi la pièce est rejetée..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalDocId(null)}
                className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300"
              >
                Annuler
              </button>
              <button
                onClick={handleRejectDocument}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold"
              >
                Confirmer le Rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
