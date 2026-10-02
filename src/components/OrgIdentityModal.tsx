import React, { useState, useRef } from 'react';
import { Organization, User } from '../types';
import { 
  Building2, 
  Upload, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Lock, 
  Image as ImageIcon,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

interface OrgIdentityModalProps {
  organization: Organization;
  currentUser: User;
  onClose: () => void;
  onUpdateIdentity: (updatedName: string, updatedLogo: string, updatedDescription?: string) => void;
  onTriggerUnauthorizedAttempt?: (reason: string) => void;
}

// Preset vector logos for quick selection
const PRESET_LOGOS = [
  {
    name: 'Hexagone Tech & Innovation',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="p1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%234f46e5"/><stop offset="100%" stop-color="%2306b6d4"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23p1)"/><path d="M28 32 L50 20 L72 32 L72 68 L50 80 L28 68 Z" fill="none" stroke="white" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="50" r="10" fill="white"/></svg>',
  },
  {
    name: 'Blason Établissement & Savoir',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="p2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%237c3aed"/><stop offset="100%" stop-color="%23ec4899"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23p2)"/><path d="M50 24 L80 38 L50 52 L20 38 Z" fill="white"/><path d="M30 46 L30 64 C30 72 50 78 50 78 C50 78 70 72 70 64 L70 46" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/></svg>',
  },
  {
    name: 'Émeraude ONG & Humanitaire',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="p3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23059669"/><stop offset="100%" stop-color="%2310b981"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23p3)"/><circle cx="50" cy="50" r="34" fill="none" stroke="white" stroke-width="5"/><path d="M50 28 C42 40 38 48 38 56 C38 64 43 70 50 70 C57 70 62 64 62 56 C62 48 58 40 50 28 Z" fill="white"/></svg>',
  },
  {
    name: 'Gold Finance & Audit',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="p4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d97706"/><stop offset="100%" stop-color="%23f59e0b"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23p4)"/><polygon points="50,20 60,40 82,42 66,57 71,78 50,67 29,78 34,57 18,42 40,40" fill="white"/></svg>',
  },
  {
    name: 'Industrie & Énergie Apex',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="p5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230284c7"/><stop offset="100%" stop-color="%232563eb"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(%23p5)"/><path d="M30 75 L50 25 L70 75 Z" fill="none" stroke="white" stroke-width="6"/><path d="M40 55 L60 55" stroke="white" stroke-width="5"/></svg>',
  },
  {
    name: 'Monogramme Minimaliste',
    svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="%231e293b"/><text x="50" y="62" font-family="sans-serif" font-size="34" font-weight="900" fill="%2338bdf8" text-anchor="middle">ORG</text></svg>',
  },
];

export const OrgIdentityModal: React.FC<OrgIdentityModalProps> = ({
  organization,
  currentUser,
  onClose,
  onUpdateIdentity,
  onTriggerUnauthorizedAttempt,
}) => {
  const isManager = currentUser.role === 'dg';

  const [companyName, setCompanyName] = useState(organization.name);
  const [logoData, setLogoData] = useState<string>(organization.logo || '');
  const [description, setDescription] = useState(organization.description || '');
  const [customUrl, setCustomUrl] = useState('');
  const [securityBlockedMessage, setSecurityBlockedMessage] = useState<string | null>(null);
  const [successSaved, setSuccessSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isManager) {
      handleUnauthorizedAction('Tentative de téléversement de logo par un non-responsable');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setLogoData(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!isManager) {
      handleUnauthorizedAction("Tentative d'application d'URL de logo par un non-responsable");
      return;
    }
    if (customUrl.trim()) {
      setLogoData(customUrl.trim());
      setCustomUrl('');
    }
  };

  const handleUnauthorizedAction = (reason: string) => {
    setSecurityBlockedMessage(
      `Violation de Sécurité : Seul le Responsable (DG) a le droit de définir ou modifier le nom et le logo de l'entreprise. Votre rôle "${currentUser.roleTitle}" n'a pas cette habilitation.`
    );
    if (onTriggerUnauthorizedAttempt) {
      onTriggerUnauthorizedAttempt(reason);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) {
      handleUnauthorizedAction("Tentative de soumission de modification d'identité");
      return;
    }

    if (!companyName.trim()) return;

    onUpdateIdentity(companyName.trim(), logoData, description);
    setSuccessSaved(true);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">
                Identité & Logo de l'Entreprise
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Raison sociale officielle, emblème et blason de l'organisation
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Governance Rule Banner */}
        <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
          isManager 
            ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-200' 
            : 'bg-red-950/40 border-red-800/50 text-red-200'
        }`}>
          {isManager ? (
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          ) : (
            <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>Règle de Gouvernance & Privilège Exclusif</span>
              {isManager ? (
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold text-[10px] border border-emerald-500/40">
                  Vous êtes Responsable (DG)
                </span>
              ) : (
                <span className="px-1.5 py-0.2 bg-red-500/20 text-red-300 rounded font-semibold text-[10px] border border-red-500/40">
                  Accès Restreint
                </span>
              )}
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {isManager ? (
                <>En tant que <strong>Directeur Général / Représentant Légal</strong>, vous détenez le droit exclusif de définir et modifier le <strong>Nom officiel de l'entreprise</strong> et son <strong>Logo officiel</strong>.</>
              ) : (
                <>Seul le <strong>Responsable (Directeur Général)</strong> a le droit de définir le nom de l'entreprise et de configurer son propre logo. Votre compte actuel (<strong>{currentUser.name}</strong> - <em>{currentUser.roleTitle}</em>) est en consultation seule.</>
              )}
            </p>
          </div>
        </div>

        {securityBlockedMessage && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-600 text-red-100 text-xs flex items-start gap-2.5 animate-in shake">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Alerte Sécurité Sentinelle Déclenchée !</div>
              <p className="text-[11px] mt-0.5">{securityBlockedMessage}</p>
            </div>
          </div>
        )}

        {successSaved && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-100 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold">Nom et Logo de l'entreprise mis à jour avec succès !</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Company Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                Nom officiel / Raison Sociale
                {!isManager && <Lock className="w-3.5 h-3.5 text-slate-500" />}
              </label>
              <span className="text-[10px] text-slate-400">
                {isManager ? 'Modifiable par le DG' : 'Verrouillé par le Responsable'}
              </span>
            </div>
            <input
              type="text"
              required
              disabled={!isManager}
              value={companyName || ''}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ex: Sahel Logistique & Industries"
              className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-white focus:outline-none transition-colors ${
                isManager 
                  ? 'border-slate-800 focus:border-indigo-500' 
                  : 'border-slate-800/80 text-slate-400 cursor-not-allowed bg-slate-950/60'
              }`}
            />
          </div>

          {/* Logo Section */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-slate-200 font-semibold flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-indigo-400" />
                  Logo Officiel de l'Entreprise
                  {!isManager && <Lock className="w-3.5 h-3.5 text-slate-500" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Visible dans l'en-tête de l'application et sur tous les documents officiels.
                </p>
              </div>

              {/* Logo Preview */}
              <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center p-1.5 shadow-inner overflow-hidden shrink-0">
                {logoData ? (
                  <img src={logoData} alt="Aperçu Logo" className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <Building2 className="w-7 h-7 text-slate-600" />
                )}
              </div>
            </div>

            {isManager ? (
              <div className="space-y-3 pt-2">
                {/* Upload Button */}
                <div className="flex flex-wrap items-center gap-2">
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
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-md shadow-indigo-600/20"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Téléverser un logo (Fichier Image)
                  </button>

                  {logoData && (
                    <button
                      type="button"
                      onClick={() => setLogoData('')}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                    >
                      Effacer le logo
                    </button>
                  )}
                </div>

                {/* Preset Emblems */}
                <div>
                  <label className="block text-[11px] text-slate-400 font-medium mb-1.5">
                    Ou sélectionner un emblème vectoriel haute définition :
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PRESET_LOGOS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setLogoData(preset.svg)}
                        title={preset.name}
                        className={`p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                          logoData === preset.svg
                            ? 'bg-indigo-600/30 border-indigo-400 shadow-md ring-2 ring-indigo-500/40'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                          <img src={preset.svg} alt={preset.name} className="w-full h-full object-contain" />
                        </div>
                        <span className="text-[9px] text-slate-300 truncate max-w-[65px]">
                          {preset.name.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom URL Option */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="url"
                    placeholder="Ou collez une URL d'image (https://...)"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium transition-colors"
                  >
                    Appliquer URL
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-slate-400 text-xs">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-1">
                  <Lock className="w-3.5 h-3.5" />
                  Logo protégé contre toute altération non autorisée
                </div>
                <p className="text-[11px] text-slate-400">
                  Le logo de l'organisation a été scellé par le Responsable (<strong>{organization.managerName || 'Le DG'}</strong>). Les autres utilisateurs n'ont pas l'autorisation de le remplacer.
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Mission & Activité de l'organisation
            </label>
            <textarea
              rows={2}
              disabled={!isManager}
              value={description || ''}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Activité principale de la structure..."
              className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white focus:outline-none ${
                isManager ? 'border-slate-800 focus:border-indigo-500' : 'border-slate-800/80 text-slate-400 cursor-not-allowed'
              }`}
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            {!isManager ? (
              <button
                type="button"
                id="btn-simulate-unauthorized-org-edit"
                onClick={() => handleUnauthorizedAction("Tentative forcée de modification de nom/logo par un agent non-DG")}
                className="px-3 py-2 rounded-xl bg-red-950/60 border border-red-800 hover:bg-red-900/40 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Tester Sentinelle (Tentative de forçage)
              </button>
            ) : (
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Signé par le Responsable légal
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Fermer
              </button>
              {isManager && (
                <button
                  type="submit"
                  id="btn-save-org-identity"
                  className="px-4 py-2 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all"
                >
                  Enregistrer l'Identité & Logo
                </button>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
