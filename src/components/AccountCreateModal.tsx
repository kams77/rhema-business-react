import React, { useState, useRef } from 'react';
import { Organization, OrganizationType, User } from '../types';
import { 
  Building2, 
  GraduationCap, 
  HeartHandshake, 
  Upload, 
  Sparkles, 
  ShieldCheck, 
  X, 
  Image as ImageIcon,
  UserCheck
} from 'lucide-react';

interface AccountCreateModalProps {
  onClose: () => void;
  onCreateOrg: (org: Organization, creatorUser?: User) => void;
}

const PRESET_CREATION_LOGOS = [
  {
    name: 'Hexagone Tech & Innovation',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="c1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%234f46e5"/><stop offset="100%" stop-color="%2306b6d4"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23c1)"/><path d="M28 32 L50 20 L72 32 L72 68 L50 80 L28 68 Z" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="50" r="10" fill="white"/></svg>',
  },
  {
    name: 'Blason Établissement',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="c2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%237c3aed"/><stop offset="100%" stop-color="%23ec4899"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23c2)"/><path d="M50 24 L80 38 L50 52 L20 38 Z" fill="white"/><path d="M30 46 L30 64 C30 72 50 78 50 78 C50 78 70 72 70 64 L70 46" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/></svg>',
  },
  {
    name: 'Alliance & Solidarité ONG',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="c3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23059669"/><stop offset="100%" stop-color="%2310b981"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23c3)"/><circle cx="50" cy="50" r="34" fill="none" stroke="white" stroke-width="5"/><path d="M50 28 C42 40 38 48 38 56 C38 64 43 70 50 70 C57 70 62 64 62 56 C62 48 58 40 50 28 Z" fill="white"/></svg>',
  },
  {
    name: 'Holding & Finance Apex',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="c4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d97706"/><stop offset="100%" stop-color="%23f59e0b"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23c4)"/><polygon points="50,20 60,40 82,42 66,57 71,78 50,67 29,78 34,57 18,42 40,40" fill="white"/></svg>',
  },
];

export const AccountCreateModal: React.FC<AccountCreateModalProps> = ({
  onClose,
  onCreateOrg,
}) => {
  const [type, setType] = useState<OrganizationType>('entreprise');

  // Responsable / Dirigeant Légal
  const [managerName, setManagerName] = useState('Dr. Michel Kamga');
  const [managerRoleTitle, setManagerRoleTitle] = useState('Président Directeur Général (PDG)');
  const [managerEmail, setManagerEmail] = useState('dg@sahel-logistics.com');
  const [managerPhone, setManagerPhone] = useState('+237 690 12 34 56');

  // Identité de l'entreprise
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string>(PRESET_CREATION_LOGOS[0].svg);
  const [customLogoUrl, setCustomLogoUrl] = useState('');

  // Paramètres administratifs
  const [regNumber, setRegNumber] = useState('');
  const [headquarters, setHeadquarters] = useState('Douala - Bonanjo');
  const [description, setDescription] = useState('');

  // Configuration hiérarchique initiale
  const [hasDepartements, setHasDepartements] = useState(true);
  const [hasDirections, setHasDirections] = useState(true);
  const [hasDivisions, setHasDivisions] = useState(true);
  const [hasServices, setHasServices] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image valide.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setLogo(res);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyLogoUrl = () => {
    if (customLogoUrl.trim()) {
      setLogo(customLogoUrl.trim());
      setCustomLogoUrl('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const orgId = `org-${Date.now()}`;
    const newOrg: Organization = {
      id: orgId,
      name: name.trim(),
      type,
      registrationNumber: regNumber || `REG-${Date.now().toString().slice(-5)}`,
      headquarters: headquarters || 'Siège Social',
      email: managerEmail || `contact@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      phone: managerPhone,
      logo: logo || PRESET_CREATION_LOGOS[0].svg,
      managerName: managerName.trim() || 'Responsable Légal (DG)',
      managerRole: managerRoleTitle.trim() || 'Directeur Général (DG)',
      managerEmail: managerEmail.trim(),
      hasDepartements,
      hasDirections,
      hasDivisions,
      hasServices,
      description: description || 'Organisation paramétrée selon sa propre politique structurelle et son identité scellée.',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    // Auto-create and link the Responsable DG account
    const newManagerUser: User = {
      id: `user-dg-${Date.now()}`,
      name: managerName.trim() || 'Directeur Général',
      email: managerEmail.trim() || `dg@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      role: 'dg',
      roleTitle: managerRoleTitle.trim() || 'Directeur Général (DG)',
      organizationId: orgId,
      status: 'actif',
      failedAccessAttempts: 0,
      phone: managerPhone,
      canCreateSubAgents: true,
      lastLogin: 'À l’instant',
    };

    onCreateOrg(newOrg, newManagerUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Créer une Organisation & Définir son Identité
              </h3>
              <p className="text-xs text-slate-400">
                Ouverture d'un compte avec désignation du Responsable Légal
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Governance Highlight Banner */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/30 text-xs flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-indigo-200 flex items-center gap-2">
              <span>Règle Fondamentale de Gouvernance</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] uppercase font-mono border border-indigo-500/40">
                Droit Exclusif
              </span>
            </div>
            <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
              Lors de la création d'une organisation, <strong>seul le Responsable (Directeur Général / Représentant Légal)</strong> a le droit de <strong>définir le nom officiel de l'entreprise</strong> et de <strong>configurer leur propre logo</strong>. Les collaborateurs et sous-agents n'auront accès qu'à l'identité scellée par le dirigeant.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Section 1 : Désignation du Responsable Légal */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
              <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                1. Le Responsable de l'Organisation (Seul habilité à définir l'identité)
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Privilège Super-Admin / DG</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nom & Prénom du Responsable Légal (DG / PDG) *
                </label>
                <input
                  type="text"
                  required
                  value={managerName || ''}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="ex: Dr. Amadou Diallo"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Titre / Mandat officiel *
                </label>
                <input
                  type="text"
                  required
                  value={managerRoleTitle || ''}
                  onChange={(e) => setManagerRoleTitle(e.target.value)}
                  placeholder="ex: Président Directeur Général (PDG)"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Email Direction Générale *
                </label>
                <input
                  type="email"
                  required
                  value={managerEmail || ''}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  placeholder="dg@organisation.com"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Téléphone direct du Responsable
                </label>
                <input
                  type="text"
                  value={managerPhone || ''}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  placeholder="+237 690 00 00 00"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2 : Nom de l'Entreprise & Définition du Propre Logo */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                2. Définition du Nom de l'Entreprise & de son Propre Logo
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold">Exclusivité Responsable</span>
            </div>

            {/* Type selector */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">
                Type d'Organisation
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setType('entreprise');
                    setHasDepartements(true);
                    setHasDirections(true);
                    setHasDivisions(true);
                    setHasServices(true);
                  }}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    type === 'entreprise'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 mb-1.5 text-indigo-400" />
                  <div className="text-xs">Entreprise</div>
                  <div className="text-[10px] text-slate-400 font-normal">Société commerciale</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setType('etablissement');
                    setHasDepartements(true);
                    setHasDirections(true);
                    setHasDivisions(false);
                    setHasServices(true);
                  }}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    type === 'etablissement'
                      ? 'bg-purple-600/20 border-purple-500 text-white font-semibold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 mb-1.5 text-purple-400" />
                  <div className="text-xs">Établissement</div>
                  <div className="text-[10px] text-slate-400 font-normal">Public, santé ou école</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setType('ong');
                    setHasDepartements(true);
                    setHasDirections(false);
                    setHasDivisions(false);
                    setHasServices(true);
                  }}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    type === 'ong'
                      ? 'bg-emerald-600/20 border-emerald-500 text-white font-semibold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <HeartHandshake className="w-4 h-4 mb-1.5 text-emerald-400" />
                  <div className="text-xs">ONG</div>
                  <div className="text-[10px] text-slate-400 font-normal">Humanitaire / Asbl</div>
                </button>
              </div>
            </div>

            {/* Nom de l'entreprise */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">
                  Nom officiel / Raison Sociale de l'entreprise *
                </label>
                <span className="text-[10px] text-emerald-400 font-medium">Scellé par le DG</span>
              </div>
              <input
                type="text"
                required
                value={name || ''}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Sahel Logistique & Manutention SA"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white font-semibold text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Définir leur propre logo */}
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-slate-200 font-semibold flex items-center gap-1.5 text-xs">
                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                    Définir votre Propre Logo d'Entreprise
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Importez votre logo ou choisissez un emblème représentatif.
                  </p>
                </div>

                {/* Live Logo Preview */}
                <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center p-1 shadow-md overflow-hidden shrink-0">
                  {logo ? (
                    <img src={logo} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                  ) : (
                    <Building2 className="w-6 h-6 text-slate-500" />
                  )}
                </div>
              </div>

              {/* Upload or URL */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Importer mon fichier Logo
                </button>

                <span className="text-[11px] text-slate-400">ou sélectionnez un emblème :</span>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {PRESET_CREATION_LOGOS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLogo(preset.svg)}
                    className={`p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      logo === preset.svg
                        ? 'bg-indigo-600/30 border-indigo-400 ring-2 ring-indigo-500/40'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center">
                      <img src={preset.svg} alt={preset.name} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[9px] text-slate-300 truncate max-w-[60px]">
                      {preset.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>

              {/* URL input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="url"
                  placeholder="Ou URL externe de l'image de votre logo..."
                  value={customLogoUrl || ''}
                  onChange={(e) => setCustomLogoUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleApplyLogoUrl}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium"
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>

          {/* Section 3 : Échelons Hiérarchiques */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="text-slate-200 font-semibold mb-0.5">
              3. Configuration de l'Organigramme Hiérarchique
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Activez ou désactivez les échelons structurels selon les statuts de votre organisation :
            </p>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDepartements}
                  onChange={(e) => setHasDepartements(e.target.checked)}
                  className="rounded bg-slate-800 text-indigo-600 border-slate-700"
                />
                <span>Départements</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDirections}
                  onChange={(e) => setHasDirections(e.target.checked)}
                  className="rounded bg-slate-800 text-indigo-600 border-slate-700"
                />
                <span>Directions</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDivisions}
                  onChange={(e) => setHasDivisions(e.target.checked)}
                  className="rounded bg-slate-800 text-indigo-600 border-slate-700"
                />
                <span>Divisions</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasServices}
                  onChange={(e) => setHasServices(e.target.checked)}
                  className="rounded bg-slate-800 text-indigo-600 border-slate-700"
                />
                <span>Services & Agents</span>
              </label>
            </div>
          </div>

          {/* Section 4 : Système de Paie Initial (Modèle Standard Proposé par l'Application) */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
              <div className="text-slate-200 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>4. Système de Paie Initial (Modèle Standard Proposé)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono">
                Modèle Standard Proposé
              </span>
            </div>

            <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-500/30 space-y-1.5 text-[11px] text-slate-300">
              <div className="font-semibold text-sky-300 flex items-center gap-1">
                <span>Modèle légal pré-paramétré après la création :</span>
              </div>
              <ul className="list-disc list-inside text-slate-300 space-y-0.5 text-[11px]">
                <li>Base horaire légale mensuelle : 173.33 h (base 40 h / semaine).</li>
                <li>Primes conventionnelles : Indemnité légale de transport, prime de logement (15%), prime de panier.</li>
                <li>Cotisations sociales légales : CNPS Retraite (4.2% salarial / 8.4% patronal), Prestations familiales (7%), Accidents du travail (2.5%), Assurance maladie (2%/3.5%).</li>
                <li>Fiscalité : Barème IRPP progressif et crédit d'impôt pour charges de famille.</li>
              </ul>
              <div className="pt-1.5 border-t border-sky-500/20 text-[10px] text-sky-200">
                ⚡ <strong>Prérogative RH :</strong> Dès la création de l'entreprise, le <strong>Département des Ressources Humaines (DRH)</strong> aura la pleine possibilité de <strong>définir son propre système de paie</strong> (ajouter des primes sur-mesure, ajuster les taux de cotisation ou réinitialiser au modèle standard).
              </div>
            </div>
          </div>

          {/* Section 5 : Données Légales */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">N° Immatriculation / Registre</label>
              <input
                type="text"
                placeholder="ex: RC/DLA/2026/B/890"
                value={regNumber || ''}
                onChange={(e) => setRegNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Siège Social / Ville</label>
              <input
                type="text"
                placeholder="ex: Douala / Yaoundé"
                value={headquarters || ''}
                onChange={(e) => setHeadquarters(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Description sommaire</label>
            <textarea
              rows={2}
              placeholder="Secteur d'activité, objet social..."
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              id="btn-submit-create-org-identity"
              className="px-5 py-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Créer l'Organisation & Sceller l'Identité
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
