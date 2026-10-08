// src/components/DocumentsView.tsx — Documents & Workflows : publication, circuit de validation, signature.
import React, { useMemo, useState } from 'react';
import { shortHash } from '../lib/integrity';
import type {
  DocumentItem,
  Organization,
  User,
  HierarchicalEntity,
  DocumentCategory,
  DocumentSubtype,
} from '../types';
import {
  FileText,
  Plus,
  Search,
  Eye,
  ShieldCheck,
  CheckCircle2,
  FilePlus2,
  X,
  AlertTriangle,
  Download,
  Clock,
  Send,
  Stamp,
  PenLine,
  RotateCcw,
  Trash2,
  History,
  FileCheck2,
  Info,
} from 'lucide-react';
import { RhemaOfficialDocument } from './RhemaOfficialDocument';
import { canUserViewDocument, getEntitiesInUserScope, isPayrollStaff } from '../utils/rbac';
import { exportOfficialDocumentToPDF, exportOfficialDocumentToCSV } from '../utils/exportUtils';
import { ElectronicSignatureModal } from './ElectronicSignatureModal';
import { ApprovalChips, ApprovalTimeline, HistoryList } from './workflow/ApprovalTimeline';
import {
  DOCUMENT_CATEGORIES,
  buildDocumentChain,
  canActOnDocument,
  canDeleteDocument,
  createDocument,
  currentStep,
  documentType,
  documentTypesFor,
  waitingFor,
  workflowSummary,
} from '../lib/workflow';
import type { DocumentAction } from '../lib/workflow';

export type DocumentWorkflowFilter = 'all' | 'to_act' | 'mine' | 'in_progress' | 'rejected' | 'final';

/** Types qu'un agent exécutant ne publie pas (directives, contrats, pièces confidentielles). */
const AGENT_FORBIDDEN: DocumentSubtype[] = [
  'note_service', 'communique', 'contrat_commercial', 'contrat_travail', 'fiche_poste',
  'bilan_comptable', 'declaration_sociale', 'bulletin_de_paie',
];

const STATUS_BADGE: Record<DocumentItem['status'], { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon (privé)', cls: 'bg-slate-800 text-slate-300 border-slate-700' },
  en_revue: { label: 'En circuit de validation', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  approuve: { label: 'Approuvé', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  signe: { label: 'Validé & signé', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  rejete: { label: 'Rejeté — à corriger', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
};

const TEMPLATES: { label: string; text: string }[] = [
  { label: 'Note de service', text: "Par la présente note, la Direction informe les agents concernés des dispositions opérationnelles suivantes : …\nL'exécution prend effet à compter du … sous la supervision du chef de service." },
  { label: 'Rapport', text: "Objet : …\nContexte : …\nActions réalisées : …\nRésultats et constats : …\nRecommandations : …" },
  { label: 'Procès-verbal', text: "L'an …, le …, à …, il a été procédé à la réception / recette de … en présence de …\nConstats : …\nRéserves : néant / …" },
  { label: 'Demande', text: "Objet de la demande : …\nJustification : …\nMontant estimé : … (joindre les cotations)\nImputation budgétaire : …" },
];

interface DocumentsViewProps {
  documents: DocumentItem[];
  organization: Organization;
  currentUser: User;
  entities?: HierarchicalEntity[];
  users?: User[];
  onCreateDocument: (doc: DocumentItem) => void;
  onDocumentAction: (docId: string, action: DocumentAction) => DocumentItem | null;
}

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500';

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  organization,
  currentUser,
  entities = [],
  users = [],
  onCreateDocument,
  onDocumentAction,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [signingDoc, setSigningDoc] = useState<DocumentItem | null>(null);
  const [viewingCertificateDoc, setViewingCertificateDoc] = useState<DocumentItem | null>(null);
  const [historyDoc, setHistoryDoc] = useState<DocumentItem | null>(null);
  const [visaDoc, setVisaDoc] = useState<DocumentItem | null>(null);
  const [visaComment, setVisaComment] = useState('');
  const [rejectDoc, setRejectDoc] = useState<DocumentItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [fixDoc, setFixDoc] = useState<DocumentItem | null>(null);
  const [fixTitle, setFixTitle] = useState('');
  const [fixDescription, setFixDescription] = useState('');
  const [fixAmount, setFixAmount] = useState('');
  const [search, setSearch] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState<DocumentWorkflowFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | DocumentCategory>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Formulaire de publication
  const isAgent = currentUser.role === 'agent';
  const allowedTypes = (cat: DocumentCategory) => documentTypesFor(cat).filter(t =>
    !(isAgent && AGENT_FORBIDDEN.includes(t.value)) &&
    !(t.value === 'bulletin_de_paie' && !isPayrollStaff(currentUser)) &&
    !(t.confidential && isAgent));
  const categories = (Object.keys(DOCUMENT_CATEGORIES) as DocumentCategory[]).filter(c => allowedTypes(c).length > 0);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>(categories[0] || 'administratif_general');
  const [selectedSubtype, setSelectedSubtype] = useState<DocumentSubtype>(allowedTypes(categories[0] || 'administratif_general')[0]?.value || 'rapport_activite');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<'perimetre' | 'public' | 'direction'>('perimetre');
  const [targetEntityId, setTargetEntityId] = useState('');
  const [includeAmount, setIncludeAmount] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const [formError, setFormError] = useState('');

  const selectedType = documentType(selectedSubtype);
  const amountRule = selectedType.amount;
  const scopeEntities = useMemo(() => getEntitiesInUserScope(currentUser, entities), [currentUser, entities]);
  const parsedAmount = amount.trim() ? Number(amount.replace(/\s/g, '').replace(',', '.')) : undefined;
  const effectiveAmount = amountRule === 'requis' || (amountRule === 'facultatif' && includeAmount) ? parsedAmount : undefined;

  /** Aperçu du circuit calculé pour le type, le montant et la position de l'émetteur. */
  const previewChain = useMemo(
    () => buildDocumentChain({ subtype: selectedSubtype, amount: effectiveAmount, currency }, currentUser, entities, users),
    [selectedSubtype, effectiveAmount, currency, currentUser, entities, users],
  );

  const handleCategoryChange = (cat: DocumentCategory) => {
    setSelectedCategory(cat);
    const first = allowedTypes(cat)[0];
    if (first) setSelectedSubtype(first.value);
    setIncludeAmount(false);
    if (first?.confidential) setAudience('direction');
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAmount('');
    setIncludeAmount(false);
    setTargetEntityId('');
    setFormError('');
  };

  // ------------------------------------------------------------------ filtres
  const visibleDocs = useMemo(
    () => documents.filter(doc => canUserViewDocument(currentUser, doc, entities).allowed),
    [documents, currentUser, entities],
  );
  const toAct = visibleDocs.filter(d => canActOnDocument(currentUser, d));
  const counts = {
    all: visibleDocs.length,
    to_act: toAct.length,
    mine: visibleDocs.filter(d => d.authorId === currentUser.id).length,
    in_progress: visibleDocs.filter(d => d.status === 'en_revue').length,
    rejected: visibleDocs.filter(d => d.status === 'rejete').length,
    final: visibleDocs.filter(d => d.status === 'signe' || d.status === 'approuve').length,
  };

  const q = search.trim().toLowerCase();
  const filteredDocs = visibleDocs.filter(doc => {
    if (q && ![doc.title, doc.referenceNumber, doc.authorName, doc.description || '', documentType(doc.subtype).label]
      .some(v => v.toLowerCase().includes(q))) return false;
    if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
    switch (workflowFilter) {
      case 'to_act': return canActOnDocument(currentUser, doc);
      case 'mine': return doc.authorId === currentUser.id;
      case 'in_progress': return doc.status === 'en_revue';
      case 'rejected': return doc.status === 'rejete';
      case 'final': return doc.status === 'signe' || doc.status === 'approuve';
      default: return true;
    }
  });

  // ------------------------------------------------------------------ actions
  const handleCreate = (submit: boolean) => {
    setFormError('');
    if (!title.trim()) return setFormError("L'intitulé du document est requis.");
    if (description.trim().length < 10) return setFormError('Le corps du document est obligatoire (10 caractères minimum).');
    if (amountRule === 'requis' && !(parsedAmount && parsedAmount > 0)) return setFormError(`Le montant est obligatoire pour un document « ${selectedType.label} ».`);
    if (amountRule === 'facultatif' && includeAmount && !(parsedAmount && parsedAmount > 0)) return setFormError('Saisissez un montant valide ou décochez la case.');
    const doc = createDocument({
      title,
      subtype: selectedSubtype,
      description,
      author: currentUser,
      organizationId: organization.id,
      entities,
      users,
      existingDocuments: documents,
      targetEntityId: audience === 'perimetre' ? (targetEntityId || undefined) : undefined,
      amount: effectiveAmount,
      currency,
      audience: selectedType.confidential ? 'direction' : audience,
      source: { module: 'documents', kind: selectedSubtype, refId: currentUser.id },
      submit,
    });
    onCreateDocument(doc);
    setShowAddModal(false);
    resetForm();
  };

  const openVisa = (doc: DocumentItem) => {
    const step = currentStep(doc.workflow);
    if (step?.kind === 'signature') setSigningDoc(doc);
    else { setVisaDoc(doc); setVisaComment(''); }
  };

  const openFix = (doc: DocumentItem) => {
    setFixDoc(doc);
    setFixTitle(doc.title);
    setFixDescription(doc.description || '');
    setFixAmount(doc.amount !== undefined ? String(doc.amount) : '');
  };

  const submitFix = () => {
    if (!fixDoc) return;
    const rule = documentType(fixDoc.subtype).amount;
    const value = fixAmount.trim() ? Number(fixAmount.replace(/\s/g, '').replace(',', '.')) : undefined;
    if (rule === 'requis' && !(value && value > 0)) return;
    const res = onDocumentAction(fixDoc.id, {
      type: 'resubmit',
      updates: {
        title: fixTitle.trim() || fixDoc.title,
        description: fixDescription.trim() || fixDoc.description,
        amount: rule === 'aucun' ? undefined : value,
        currency: rule === 'aucun' || value === undefined ? undefined : (fixDoc.currency || 'USD'),
      },
    });
    if (res) setFixDoc(null);
  };

  const filterButton = (id: DocumentWorkflowFilter, label: string, icon?: React.ReactNode, accent = 'bg-indigo-600') => (
    <button
      key={id}
      onClick={() => setWorkflowFilter(id)}
      className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
        workflowFilter === id ? `${accent} text-white shadow-md` : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
      }`}
    >
      {icon}
      <span>{label} ({counts[id]})</span>
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. BANNIÈRE */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Circuit de validation par rôle</span>
            </span>
            {counts.to_act > 0 && (
              <button
                onClick={() => setWorkflowFilter('to_act')}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>{counts.to_act} document(s) attendent votre visa</span>
              </button>
            )}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Documents officiels & circuit de visa</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Chaque type de document suit son propre circuit, calculé depuis la position de l'émetteur dans l'organigramme :
            les visas se donnent un par un, dans l'ordre, et la dernière étape est la signature électronique.
            Le montant n'est demandé que si le type de document l'exige.
          </p>
        </div>

        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau document</span>
        </button>
      </div>

      {/* 2. FILTRES */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filterButton('all', 'Tous')}
          {filterButton('to_act', 'À mon visa', <Clock className="w-3.5 h-3.5" />, 'bg-rose-600')}
          {filterButton('mine', 'Mes documents')}
          {filterButton('in_progress', 'En circuit', undefined, 'bg-amber-600')}
          {filterButton('rejected', 'Rejetés', undefined, 'bg-rose-600')}
          {filterButton('final', 'Validés & signés', <ShieldCheck className="w-3.5 h-3.5" />, 'bg-emerald-600')}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['all', ...Object.keys(DOCUMENT_CATEGORIES)] as ('all' | DocumentCategory)[]).map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                  categoryFilter === c ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {c === 'all' ? 'Toutes catégories' : DOCUMENT_CATEGORIES[c]}
              </button>
            ))}
          </div>
          <div className="relative sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              placeholder="Référence, titre, type, émetteur…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 3. GRILLE DES DOCUMENTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 space-y-2">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-bold text-sm text-slate-300">Aucun document dans cette vue</p>
            <p className="text-xs text-slate-500">
              {workflowFilter === 'to_act' ? "Rien n'attend votre visa pour le moment." : 'Changez de filtre ou publiez un nouveau document.'}
            </p>
          </div>
        ) : (
          filteredDocs.map(doc => {
            const type = documentType(doc.subtype);
            const badge = STATUS_BADGE[doc.status] || STATUS_BADGE.brouillon;
            const summary = workflowSummary(doc);
            const step = currentStep(doc.workflow);
            const canAct = canActOnDocument(currentUser, doc);
            const isAuthor = doc.authorId === currentUser.id;
            const isSigned = doc.status === 'signe';
            const rejection = doc.workflow?.rejection;

            return (
              <article
                key={doc.id}
                className={`bg-slate-900/90 border rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-4 transition ${
                  canAct ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/40 border border-sky-500/30 px-2 py-0.5 rounded-lg">
                      {doc.referenceNumber}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.cls}`}>
                      {isSigned && <CheckCircle2 className="w-3 h-3" />}
                      {doc.status === 'en_revue' && <Clock className="w-3 h-3" />}
                      {doc.status === 'rejete' && <X className="w-3 h-3" />}
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">{type.label}</div>
                    <h3 className="font-bold text-sm text-white line-clamp-2 mt-0.5" title={doc.title}>{doc.title}</h3>
                    {doc.description && <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed whitespace-pre-line">{doc.description}</p>}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Émetteur</span>
                      <span className="text-slate-200 truncate max-w-[180px]">{doc.authorName}</span>
                    </div>
                    {(doc.originEntityName || doc.targetEntityName) && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500">{doc.targetEntityName ? 'Destination' : 'Entité'}</span>
                        <span className="text-slate-300 truncate max-w-[180px]">{doc.targetEntityName || doc.originEntityName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Montant</span>
                      {typeof doc.amount === 'number' && doc.amount > 0
                        ? <span className="font-mono font-bold text-emerald-400">{doc.amount.toLocaleString('fr-FR')} {doc.currency || 'USD'}</span>
                        : <span className="text-slate-400 italic">{type.amount === 'aucun' ? 'Sans objet pour ce type' : 'Non renseigné'}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500">Émis le</span>
                      <span className="font-mono text-slate-300">{doc.createdAt}</span>
                    </div>
                  </div>

                  {/* Circuit */}
                  {doc.workflow && doc.workflow.steps.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold uppercase tracking-wider">Circuit {doc.workflow.cycle > 1 ? `(cycle ${doc.workflow.cycle})` : ''}</span>
                        <span className="font-mono">{summary.done}/{summary.total}</span>
                      </div>
                      <ApprovalChips steps={doc.workflow.steps} />
                      {doc.status === 'en_revue' && step && (
                        <p className={`text-[11px] ${canAct ? 'text-amber-300 font-semibold' : 'text-slate-400'}`}>
                          {canAct ? `À vous : ${step.kind === 'signature' ? 'signature finale' : 'visa'} attendu.` : `En attente de ${waitingFor(step)}.`}
                        </p>
                      )}
                      {doc.status === 'brouillon' && (
                        <p className="text-[11px] text-slate-400">Circuit prévu — le document reste privé tant qu'il n'est pas soumis.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">Ancien document : circuit simplifié (une validation).</p>
                  )}

                  {rejection && doc.status === 'rejete' && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300">
                      <strong>Rejeté par {rejection.by}</strong> : « {rejection.reason} »
                    </div>
                  )}

                  {isSigned && doc.electronicSignature && (
                    <button
                      onClick={() => setViewingCertificateDoc(doc)}
                      className="w-full p-2 rounded-lg bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/20 text-[10px] text-emerald-300 font-mono flex items-center justify-between gap-1.5 transition"
                      title="Inspecter le certificat de signature"
                    >
                      <span className="truncate">✓ Signé par {doc.electronicSignature.signedBy} • {shortHash(doc.electronicSignature.certificateHash)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">Certificat</span>
                    </button>
                  )}
                </div>

                {/* Actions selon le rôle et l'étape */}
                <div className="space-y-2 pt-3 border-t border-slate-800">
                  {canAct && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openVisa(doc)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        {step?.kind === 'signature' ? <PenLine className="w-3.5 h-3.5" /> : <Stamp className="w-3.5 h-3.5" />}
                        <span>{step?.kind === 'signature' ? 'Signer' : 'Viser'}</span>
                      </button>
                      <button
                        onClick={() => { setRejectDoc(doc); setRejectReason(''); }}
                        className="px-3 py-2 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold transition"
                      >
                        Rejeter
                      </button>
                    </div>
                  )}

                  {isAuthor && doc.status === 'brouillon' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onDocumentAction(doc.id, { type: 'submit' })}
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Soumettre au circuit</span>
                      </button>
                      {canDeleteDocument(currentUser, doc) && (
                        <button
                          onClick={() => onDocumentAction(doc.id, { type: 'delete' })}
                          title="Supprimer ce brouillon"
                          className="p-2 rounded-xl border border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-500/40 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {isAuthor && doc.status === 'rejete' && (
                    <button
                      onClick={() => openFix(doc)}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Corriger et renvoyer</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Consulter</span>
                    </button>
                    {doc.workflow && (
                      <button
                        onClick={() => setHistoryDoc(doc)}
                        title="Circuit détaillé et historique"
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      >
                        <History className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    )}
                    <button
                      onClick={() => exportOfficialDocumentToPDF(doc, organization)}
                      title="Télécharger en PDF A4"
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-400" />
                    </button>
                    <button
                      onClick={() => exportOfficialDocumentToCSV(doc, organization.name)}
                      title="Exporter les métadonnées en CSV"
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* CONSULTATION */}
      {selectedDoc && (
        <RhemaOfficialDocument
          document={selectedDoc}
          organization={organization}
          currentUser={currentUser}
          entities={entities}
          onClose={() => setSelectedDoc(null)}
          onSignDocument={(docId, sigData) => {
            const res = onDocumentAction(docId, { type: 'approve', signature: sigData });
            if (res) setSelectedDoc(res);
          }}
        />
      )}

      {/* SIGNATURE ÉLECTRONIQUE (dernière étape du circuit) */}
      {signingDoc && (
        <ElectronicSignatureModal
          document={signingDoc}
          organization={organization}
          currentUser={currentUser}
          onClose={() => setSigningDoc(null)}
          onSignComplete={(docId, sigData) => {
            onDocumentAction(docId, { type: 'approve', signature: sigData });
            setSigningDoc(null);
          }}
        />
      )}

      {/* VISA (étape intermédiaire) */}
      {visaDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2"><Stamp className="w-4 h-4 text-emerald-400" /> Viser « {visaDoc.title} »</h3>
            <p className="text-xs text-slate-400">
              Étape : <strong className="text-slate-200">{currentStep(visaDoc.workflow)?.label}</strong>.
              Après votre visa, le document passe à l'étape suivante du circuit.
            </p>
            <textarea
              rows={3}
              placeholder="Observation (facultative) : réserve, précision, consigne…"
              value={visaComment}
              onChange={e => setVisaComment(e.target.value)}
              className={inputCls}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setVisaDoc(null)} className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">Annuler</button>
              <button
                onClick={() => { onDocumentAction(visaDoc.id, { type: 'approve', comment: visaComment.trim() || undefined }); setVisaDoc(null); }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
              >
                Apposer mon visa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJET (motif obligatoire) */}
      {rejectDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-3">
            <h3 className="font-bold text-sm text-rose-400">Rejeter « {rejectDoc.title} »</h3>
            <p className="text-xs text-slate-400">Le circuit s'arrête et l'émetteur est invité à corriger. Le motif est obligatoire et reste dans l'historique.</p>
            <textarea
              rows={3}
              placeholder="Motif du rejet…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className={inputCls}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setRejectDoc(null)} className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">Annuler</button>
              <button
                disabled={!rejectReason.trim()}
                onClick={() => { onDocumentAction(rejectDoc.id, { type: 'reject', comment: rejectReason.trim() }); setRejectDoc(null); }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CORRECTION APRÈS REJET */}
      {fixDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-lg w-full space-y-3 my-8">
            <h3 className="font-bold text-sm text-white flex items-center gap-2"><RotateCcw className="w-4 h-4 text-amber-400" /> Corriger et renvoyer</h3>
            {fixDoc.workflow?.rejection && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300">
                Motif du rejet ({fixDoc.workflow.rejection.by}) : « {fixDoc.workflow.rejection.reason} »
              </div>
            )}
            <label className="block text-xs text-slate-300 font-medium">Intitulé
              <input value={fixTitle} onChange={e => setFixTitle(e.target.value)} className={`${inputCls} mt-1`} />
            </label>
            <label className="block text-xs text-slate-300 font-medium">Corps du document
              <textarea rows={6} value={fixDescription} onChange={e => setFixDescription(e.target.value)} className={`${inputCls} mt-1 leading-relaxed`} />
            </label>
            {documentType(fixDoc.subtype).amount !== 'aucun' && (
              <label className="block text-xs text-slate-300 font-medium">
                Montant ({fixDoc.currency || 'USD'}){documentType(fixDoc.subtype).amount === 'requis' ? ' *' : ' — facultatif'}
                <input value={fixAmount} onChange={e => setFixAmount(e.target.value)} inputMode="decimal" className={`${inputCls} mt-1 font-mono`} />
              </label>
            )}
            <p className="text-[11px] text-slate-400">Le circuit repart du début (nouveau cycle) ; l'historique du rejet est conservé.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setFixDoc(null)} className="px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300">Annuler</button>
              <button onClick={submitFix} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold">Renvoyer dans le circuit</button>
            </div>
          </div>
        </div>
      )}

      {/* CIRCUIT DÉTAILLÉ & HISTORIQUE */}
      {historyDoc && historyDoc.workflow && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-lg w-full space-y-4 my-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-white">{historyDoc.title}</h3>
                <p className="text-[11px] text-slate-400">{historyDoc.referenceNumber} — {documentType(historyDoc.subtype).label}</p>
              </div>
              <button onClick={() => setHistoryDoc(null)} className="p-1 text-slate-400 hover:text-white" aria-label="Fermer"><X className="w-4 h-4" /></button>
            </div>
            <ApprovalTimeline steps={historyDoc.workflow.steps} />
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Historique</div>
              <HistoryList entries={historyDoc.workflow.history || []} />
            </div>
          </div>
        </div>
      )}

      {/* CERTIFICAT */}
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

      {/* PUBLICATION D'UN DOCUMENT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-3xl w-full shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm tracking-wide">
                <FilePlus2 className="w-4 h-4 text-emerald-400" />
                <span>Nouveau document</span>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 text-xs">
              {/* Colonne formulaire */}
              <div className="lg:col-span-3 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-slate-300 font-medium">Catégorie
                    <select value={selectedCategory} onChange={e => handleCategoryChange(e.target.value as DocumentCategory)} className={`${inputCls} mt-1`}>
                      {categories.map(c => <option key={c} value={c}>{DOCUMENT_CATEGORIES[c]}</option>)}
                    </select>
                  </label>
                  <label className="block text-slate-300 font-medium">Type de document
                    <select value={selectedSubtype} onChange={e => { setSelectedSubtype(e.target.value as DocumentSubtype); setIncludeAmount(false); }} className={`${inputCls} mt-1`}>
                      {allowedTypes(selectedCategory).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                </div>
                {selectedType.hint && (
                  <p className="text-[11px] text-slate-400 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />{selectedType.hint}</p>
                )}

                {formError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <label className="block text-slate-300 font-medium">Intitulé *
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ex. Note relative au déploiement VSAT de Tenke" className={`${inputCls} mt-1`} />
                </label>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-slate-300 font-medium">Corps du document *</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {TEMPLATES.map(t => (
                        <button key={t.label} type="button" onClick={() => setDescription(t.text)} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea rows={6} value={description} onChange={e => setDescription(e.target.value)} placeholder="Objet, contexte, dispositions, clauses…" className={`${inputCls} leading-relaxed`} />
                  <div className="text-[10px] text-slate-500 text-right font-mono">{description.trim().length} caractère(s)</div>
                </div>

                {/* Diffusion */}
                {!selectedType.confidential ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-slate-300 font-medium">Diffusion une fois validé
                      <select value={audience} onChange={e => setAudience(e.target.value as typeof audience)} className={`${inputCls} mt-1`}>
                        <option value="perimetre">Mon entité / une entité ciblée</option>
                        {!isAgent && <option value="public">Toute l'entreprise</option>}
                        {!isAgent && <option value="direction">Cadres dirigeants uniquement</option>}
                      </select>
                    </label>
                    {audience === 'perimetre' && (
                      <label className="block text-slate-300 font-medium">Entité destinataire
                        <select value={targetEntityId} onChange={e => setTargetEntityId(e.target.value)} className={`${inputCls} mt-1`}>
                          <option value="">— Mon entité de rattachement —</option>
                          {scopeEntities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                    Document confidentiel : visible uniquement par le circuit, le destinataire et la Direction.
                  </p>
                )}

                {/* Montant selon le type */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-300">Montant</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      amountRule === 'requis' ? 'bg-amber-500/20 text-amber-300' : amountRule === 'facultatif' ? 'bg-slate-800 text-slate-400' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {amountRule === 'requis' ? 'OBLIGATOIRE' : amountRule === 'facultatif' ? 'FACULTATIF' : 'SANS OBJET'}
                    </span>
                  </div>
                  {amountRule === 'aucun' && <p className="text-[11px] text-slate-500 italic">Ce type de document ne comporte pas de prix ni de montant.</p>}
                  {amountRule === 'facultatif' && (
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                      <input type="checkbox" checked={includeAmount} onChange={e => setIncludeAmount(e.target.checked)} className="rounded border-slate-700 bg-slate-900" />
                      Mentionner un montant sur ce document
                    </label>
                  )}
                  {(amountRule === 'requis' || (amountRule === 'facultatif' && includeAmount)) && (
                    <div className="grid grid-cols-3 gap-2">
                      <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="ex. 15000" className={`${inputCls} col-span-2 font-mono`} />
                      <select value={currency} onChange={e => setCurrency(e.target.value as 'USD' | 'CDF')} className={`${inputCls} font-mono`}>
                        <option value="USD">USD</option>
                        <option value="CDF">CDF</option>
                      </select>
                    </div>
                  )}
                  {selectedType.dgAbove && (
                    <p className="text-[10px] text-slate-500">Au-delà de {selectedType.dgAbove.toLocaleString('fr-FR')} USD, la Direction Générale est ajoutée au circuit.</p>
                  )}
                </div>
              </div>

              {/* Colonne circuit */}
              <aside className="lg:col-span-2 space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <ApprovalTimeline steps={previewChain} title="Circuit qui sera suivi" />
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Calculé d'après votre poste ({currentUser.roleTitle}). Un poste vacant est remplacé par le responsable au-dessus.
                    Vous ne pouvez pas viser votre propre document.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Qui le verra, et quand</div>
                  <p>• Brouillon : vous seul.</p>
                  <p>• Dans le circuit : vous, les valideurs et la hiérarchie concernée.</p>
                  <p>• Validé : les destinataires choisis ci-contre.</p>
                </div>
              </aside>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">Annuler</button>
              <button type="button" onClick={() => handleCreate(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
                Enregistrer en brouillon
              </button>
              <button type="button" onClick={() => handleCreate(true)} className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5">
                <Send className="w-4 h-4" />
                <span>Soumettre au circuit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
