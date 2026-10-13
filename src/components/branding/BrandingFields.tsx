// src/components/branding/BrandingFields.tsx
// Saisie de l'identité visuelle : logo, papier à en-tête, pied de page, slogan et couleur,
// avec un aperçu de page A4. Utilisé dans l'assistant de création et la fenêtre « Identité & Logo ».
import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2, Info } from 'lucide-react';
import type { OrganizationBranding } from '../../types';
import { IMAGE_ACCEPT, readImageFile, type ImageKind } from '../../utils/imageUpload';
import { DEFAULT_BRAND_COLOR, DocumentLetterhead, DocumentPageFooter, type BrandSource } from './Letterhead';

export interface BrandingValue {
  logo?: string;
  branding: OrganizationBranding;
}

interface BrandingFieldsProps {
  value: BrandingValue;
  onChange: (next: BrandingValue) => void;
  /** Identité de l'organisation (nom, adresse, RCCM…) pour l'aperçu. */
  identity: BrandSource;
  disabled?: boolean;
}

const ImagePicker: React.FC<{
  label: string;
  hint: string;
  kind: ImageKind;
  image?: string;
  disabled?: boolean;
  onPick: (dataUrl: string | undefined) => void;
  previewClass: string;
}> = ({ label, hint, kind, image, disabled, onPick, previewClass }) => {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onPick(await readImageFile(file, kind));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image refusée.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="text-slate-300 font-semibold block">{label}</span>
      <div className="flex items-center gap-3">
        <div className={`rounded-xl border border-dashed border-slate-700 bg-white/95 flex items-center justify-center overflow-hidden shrink-0 ${previewClass}`}>
          {image
            ? <img src={image} alt={label} className="max-w-full max-h-full object-contain" />
            : <ImagePlus className="w-5 h-5 text-slate-400" aria-hidden="true" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <input
            ref={input}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            aria-label={label}
            disabled={disabled}
            onChange={e => void choose(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => input.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1"
          >
            <ImagePlus className="w-3.5 h-3.5" /> {busy ? 'Traitement…' : image ? 'Remplacer' : 'Joindre une image'}
          </button>
          {image && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(undefined)}
              className="px-2.5 py-1.5 rounded-lg text-rose-300 hover:bg-rose-500/10 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Retirer
            </button>
          )}
        </div>
      </div>
      <p className="text-[10.5px] text-slate-500">{hint}</p>
      {error && <p role="alert" className="text-[11px] font-semibold text-rose-400">{error}</p>}
    </div>
  );
};

export const BrandingFields: React.FC<BrandingFieldsProps> = ({ value, onChange, identity, disabled }) => {
  const b = value.branding;
  const setBranding = (patch: Partial<OrganizationBranding>) => onChange({ ...value, branding: { ...b, ...patch } });
  const preview: BrandSource = { ...identity, logo: value.logo, branding: b };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 text-xs">
      <div className="space-y-4">
        <ImagePicker
          label="Logo de l'entreprise"
          hint="PNG (fond transparent conseillé) ou JPEG. Affiché à la connexion, dans le bandeau et sur les documents."
          kind="logo"
          image={value.logo}
          disabled={disabled}
          onPick={logo => onChange({ ...value, logo })}
          previewClass="w-16 h-16 p-1"
        />

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <label className="block">
            <span className="text-slate-300 font-semibold block mb-1">Slogan ou activité (sous le nom)</span>
            <input
              type="text"
              maxLength={120}
              disabled={disabled}
              value={b.slogan || ''}
              onChange={e => setBranding({ slogan: e.target.value })}
              placeholder="Ex. Télécoms, VSAT & Intégration"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
            />
          </label>
          <label className="block">
            <span className="text-slate-300 font-semibold block mb-1">Couleur</span>
            <input
              type="color"
              disabled={disabled}
              value={b.color || DEFAULT_BRAND_COLOR}
              onChange={e => setBranding({ color: e.target.value })}
              className="h-9 w-16 bg-slate-950 border border-slate-700 rounded-xl p-1 cursor-pointer"
            />
          </label>
        </div>

        <ImagePicker
          label="Papier à en-tête (optionnel)"
          hint="Image de votre en-tête officiel, en largeur (ex. 2000 × 300 px). Elle remplace l'en-tête automatique (logo + nom + mentions légales)."
          kind="banner"
          image={b.headerImage}
          disabled={disabled}
          onPick={headerImage => setBranding({ headerImage })}
          previewClass="w-40 h-12 p-0.5"
        />

        <div className="space-y-1.5">
          <label className="block">
            <span className="text-slate-300 font-semibold block mb-1">Texte du pied de page (3 lignes au plus)</span>
            <textarea
              rows={3}
              maxLength={600}
              disabled={disabled}
              value={b.footerText || ''}
              onChange={e => setBranding({ footerText: e.target.value.split('\n').slice(0, 3).join('\n') })}
              placeholder={'Ex. Siège : 12, avenue …, Kinshasa/Gombe • Tél. +243 …\nRCCM … • Id. Nat … • N° Impôt …\nwww.votre-entreprise.cd'}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
            />
          </label>
          <p className="text-[10.5px] text-slate-500">Laissé vide : nom, RCCM, Id. Nat, adresse et contacts de l'organisation.</p>
        </div>

        <ImagePicker
          label="Image de pied de page (optionnel)"
          hint="Bandeau de bas de page (adresses, agences, certifications…), en largeur. Le texte ci-dessus s'affiche sous l'image s'il est rempli."
          kind="banner"
          image={b.footerImage}
          disabled={disabled}
          onPick={footerImage => setBranding({ footerImage })}
          previewClass="w-40 h-10 p-0.5"
        />

        <p className="flex items-start gap-1.5 text-[10.5px] text-slate-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px text-sky-400" />
          Les images sont redimensionnées et enregistrées dans l'application (aucun lien vers un autre site). Seule la Direction Générale peut les modifier.
        </p>
      </div>

      {/* Aperçu d'une page A4 */}
      <div className="space-y-1.5">
        <span className="text-slate-300 font-semibold block">Aperçu d'un document</span>
        <div className="w-[238px] h-[336px] overflow-hidden rounded-lg border border-slate-700 bg-white shadow-xl" aria-label="Aperçu d'un document officiel">
          <div className="origin-top-left scale-[0.4] w-[595px] h-[842px] p-8 flex flex-col text-slate-900">
            <DocumentLetterhead organization={preview} />
            <div className="text-center font-black uppercase text-base my-3">Note de service</div>
            <div className="space-y-2 flex-1">
              {[92, 100, 85, 97, 60, 0, 88, 95, 70].map((w, i) => (
                <div key={i} className="h-2.5 rounded bg-slate-200" style={{ width: `${w}%`, opacity: w ? 1 : 0 }} />
              ))}
            </div>
            <DocumentPageFooter organization={preview} />
          </div>
        </div>
      </div>
    </div>
  );
};
