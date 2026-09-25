// src/components/DocumentsView.tsx
import React, { useState } from 'react';
import type { DocumentItem, Organization, User, HierarchicalEntity, DocumentCategory, DocumentSubtype, UserRole } from '../types';
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
  AlertTriangle
} from 'lucide-react';
import { RhemaOfficialDocument } from './RhemaOfficialDocument';
import { canUserViewDocument } from '../utils/rbac';

interface DocumentsViewProps {
  documents: DocumentItem[];
  organization: Organization;
  currentUser: User;
  entities?: HierarchicalEntity[];
  onAddDocument: (doc: Omit<DocumentItem, 'id'>) => void;
}

export type AccreditationLevel = 
  | 'public_entreprise' 
  | 'perimetre_entite' 
  | 'direction_dg_only' 
  | 'strict_confidentiel';

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  organization,
  currentUser,
  entities = [],
  onAddDocument,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'financier' | 'logistique' | 'rh'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Formulaire de publication avec accréditation
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('financier_comptable');
  const [selectedSubtype, setSelectedSubtype] = useState<DocumentSubtype>('facture_client');
  const [title, setTitle] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [accreditationLevel, setAccreditationLevel] = useState<AccreditationLevel>('perimetre_entite');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState('');

  // Séparation des entités par niveau pour l'arborescence du select
  const departements = entities.filter(e => e.level === 'departement');
  const directions = entities.filter(e => e.level === 'direction');
  const divisions = entities.filter(e => e.level === 'division');
  const services = entities.filter(e => e.level === 'service');

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

  const currentAccreditationDetails = getRolesByAccreditation(accreditationLevel);

  const filteredDocs = documents.filter(doc => {
    const matchSearch = doc.title.toLowerCase().includes(search.toLowerCase()) || 
                        doc.referenceNumber.toLowerCase().includes(search.toLowerCase());
    if (categoryFilter === 'financier') return matchSearch && doc.category === 'financier_comptable';
    if (categoryFilter === 'logistique') return matchSearch && doc.category === 'chaine_logistique_commerciale';
    if (categoryFilter === 'rh') return matchSearch && doc.category === 'ressources_humaines';
    return matchSearch;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const matchedEntity = entities.find(e => e.id === selectedEntityId);
    const numAmount = amount ? parseFloat(amount.replace(/\s/g, '')) : undefined;
    const isPayslip = selectedSubtype === 'bulletin_de_paie' || accreditationLevel === 'strict_confidentiel';
    const acc = getRolesByAccreditation(accreditationLevel);

    onAddDocument({
      title: title.trim(),
      referenceNumber: `DOC-2026-${Math.floor(100 + Math.random() * 900)}`,
      category: selectedCategory,
      subtype: selectedSubtype,
      organizationId: organization.id,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorEntity: currentUser.roleTitle,
      targetEntityId: selectedEntityId || undefined,
      targetEntityName: matchedEntity?.name,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'signe',
      size: '1.4 Mo',
      fileType: 'PDF',
      amount: numAmount,
      currency: 'FCFA',
      isConfidentialPayslip: isPayslip,
      description: description.trim() || 'Document certifié émis depuis la plateforme.',
      electronicSignature: {
        signedBy: `${currentUser.name} (${currentUser.roleTitle})`,
        signedAt: new Date().toLocaleTimeString(),
        role: currentUser.roleTitle,
        certificateHash: `SHA256:7f83b1657ff1fc53b${Math.random().toString(36).substring(2, 8)}`,
      },
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
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. BANNIÈRE SUPÉRIEURE */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 uppercase tracking-wider border border-emerald-500/30">
              MODULE 1 : PUBLICATION & WORKFLOWS
            </span>
            <span className="text-xs text-slate-400 font-medium">Contrôle d'accès & Signatures</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Gestion Électronique des Documents & Habilitations
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Publication sécurisée des documents financiers, logistiques et RH. Les droits d'accès (voir, éditer, signer) sont régis par l'échelle hiérarchique avec cloisonnement strict des bulletins de paie.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Publier un Document</span>
        </button>
      </div>

      {/* 2. ONGLETS DE FILTRES ET RECHERCHE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              categoryFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Tous les Documents ({documents.length})
          </button>

          <button
            onClick={() => setCategoryFilter('financier')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              categoryFilter === 'financier'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>$ Financier & Comptable</span>
          </button>

          <button
            onClick={() => setCategoryFilter('logistique')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              categoryFilter === 'logistique'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>📦 Logistique & Commercial</span>
          </button>

          <button
            onClick={() => setCategoryFilter('rh')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              categoryFilter === 'rh'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>👥 Ressources Humaines (RH)</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par titre, ref..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 3. BANDEAU DE CONFIDENTIALITÉ */}
      <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 flex items-start gap-2.5 text-xs leading-relaxed">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-emerald-400">Règle Stricte de Confidentialité RH :</strong> Conformément à la directive d'authentification, lorsqu'un <em>Bulletin de Paie</em> est publié, seuls <em>l'agent titulaire</em>, le <em>Directeur des Ressources Humaines (DRH)</em> et le <em>Service Traitement de la Paie</em> peuvent l'ouvrir et en examiner les montants. Les autres collaborateurs et directeurs d'autres branches en sont rigoureusement exclus.
        </div>
      </div>

      {/* 4. GRILLE DES DOCUMENTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map(doc => {
          const perm = canUserViewDocument(currentUser, doc, entities);
          const isSigned = doc.status === 'signe';

          return (
            <div
              key={doc.id}
              className={`bg-slate-900/90 border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition hover:border-slate-700 ${
                perm.allowed ? 'border-slate-800' : 'border-slate-800/50 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {doc.referenceNumber}
                  </span>

                  {isSigned ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 uppercase tracking-wider">
                      <Lock className="w-2.5 h-2.5 text-amber-400" /> E-Signé
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                      {doc.status === 'en_revue' ? 'En revue' : 'Approuvé'}
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-1">
                  {doc.subtype.replace(/_/g, ' ')}
                </div>

                <h3 className="text-sm font-bold text-white mb-1.5 leading-snug line-clamp-2">
                  {doc.title}
                </h3>

                <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                  {doc.description}
                </p>

                {doc.targetEntityName && (
                  <div className="mb-3 text-[11px] bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 truncate">
                    Rattaché à : <strong className="text-white">{doc.targetEntityName}</strong>
                  </div>
                )}

                {doc.amount && (
                  <div className="flex items-center justify-between text-xs mb-3 pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400">Montant :</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {doc.amount.toLocaleString()} {doc.currency || 'FCFA'}
                    </span>
                  </div>
                )}

                {isSigned && (
                  <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-[11px] space-y-1 mb-3">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>Signé par {doc.electronicSignature?.signedBy || organization.managerName}</span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-400 truncate">
                      Hash : {doc.electronicSignature?.certificateHash || 'SHA256:7f83b1657ff1fc53b...'}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px] truncate max-w-[150px]">
                  Par {doc.authorName}
                </span>

                {perm.allowed ? (
                  <button
                    onClick={() => setSelectedDoc(doc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Consulter</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-red-400 font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Accès restreint
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DU DOCUMENT OFFICIEL PARTAGÉ */}
      {selectedDoc && (
        <RhemaOfficialDocument
          document={selectedDoc}
          organization={organization}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. MODALE PUBLIER UN NOUVEAU DOCUMENT AVEC ACCRÉDITATION & ENTITÉS         */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 my-8">
            
            {/* En-tête */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FilePlus2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Publier un Nouveau Document
                </h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              {/* Catégorie Principale */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Catégorie Principale
                </label>
                <select
                  value={selectedCategory}
                  onChange={e => handleCategoryChange(e.target.value as DocumentCategory)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="financier_comptable">Documents et fichiers financiers et comptables</option>
                  <option value="chaine_logistique_commerciale">Chaîne logistique et commerciale</option>
                  <option value="ressources_humaines">Ressources Humaines et Paie</option>
                </select>
              </div>

              {/* Type Spécifique */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Type Spécifique de Document
                </label>
                <select
                  value={selectedSubtype}
                  onChange={e => setSelectedSubtype(e.target.value as DocumentSubtype)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {subtypeOptions[selectedCategory].map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Titre */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Titre du Document
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Facture N° FC-2026-104 ou Bulletin Paie Septembre"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Deux Colonnes : Entité Rattachée (Groupée) + Montant */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1.5">
                    Entité Rattachée (Département / Direction / Division / Service)
                  </label>
                  <select
                    value={selectedEntityId}
                    onChange={e => setSelectedEntityId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- Toute l'entreprise (Transversal) --</option>

                    {departements.length > 0 && (
                      <optgroup label="🏢 DÉPARTEMENTS GÉNAUX">
                        {departements.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {directions.length > 0 && (
                      <optgroup label="📁 DIRECTIONS OPÉRATIONNELLES">
                        {directions.map(dir => (
                          <option key={dir.id} value={dir.id}>
                            └─ {dir.name} ({dir.code})
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {divisions.length > 0 && (
                      <optgroup label="📑 DIVISIONS">
                        {divisions.map(div => (
                          <option key={div.id} value={div.id}>
                            └── {div.name} ({div.code})
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {services.length > 0 && (
                      <optgroup label="🏷️ SERVICES & POSTES">
                        {services.map(srv => (
                          <option key={srv.id} value={srv.id}>
                            └─── Service {srv.name} ({srv.code})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-medium block mb-1.5">
                    Montant / Valeur (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Montant en FCFA"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* NOUVEAU : NIVEAU D'ACCRÉDITATION & SÉCURITÉ */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <label className="text-slate-300 font-bold block text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sky-400">
                    <ShieldCheck className="w-4 h-4" /> Niveau d'Accréditation & Visibilité
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Gestion des habilitations</span>
                </label>

                <select
                  value={accreditationLevel}
                  onChange={e => setAccreditationLevel(e.target.value as AccreditationLevel)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-sky-500"
                >
                  <option value="public_entreprise">🌐 Public Entreprise (Tous les agents de l'entreprise)</option>
                  <option value="perimetre_entite">🏢 Périmètre de l'Entité (Agents de cette entité et Direction Générale)</option>
                  <option value="direction_dg_only">🔒 Direction & DG Uniquement (Cadres dirigeants N+1 et DG)</option>
                  <option value="strict_confidentiel">🛡️ Confidentiel Strict (Titulaire, DRH et DG exclusivement)</option>
                </select>

                {/* Panneau Qui peut voir / Qui ne peut pas voir */}
                <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-emerald-950/20 border border-emerald-500/20 p-2 rounded-lg text-emerald-300">
                    <span className="font-bold flex items-center gap-1 mb-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Qui PEUT voir :
                    </span>
                    <p className="text-[10px] text-emerald-200/90 leading-tight">
                      {currentAccreditationDetails.description}
                    </p>
                  </div>

                  <div className="bg-red-950/20 border border-red-500/20 p-2 rounded-lg text-red-300">
                    <span className="font-bold flex items-center gap-1 mb-0.5">
                      <Lock className="w-3.5 h-3.5 text-red-400" /> Qui NE PEUT PAS voir :
                    </span>
                    <p className="text-[10px] text-red-200/90 leading-tight">
                      {currentAccreditationDetails.prohibited}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description / Contexte */}
              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Description / Contexte
                </label>
                <textarea
                  rows={2}
                  placeholder="Objet, justification financière ou légale..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Boutons d'action */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
                >
                  <FilePlus2 className="w-4 h-4" />
                  <span>Publier en Workflow</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};