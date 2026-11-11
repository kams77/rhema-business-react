// src/components/branding/Letterhead.tsx
// En-tête et pied de page officiels d'une organisation, tels qu'imprimés sur ses documents.
// - En-tête : le papier à en-tête (image) s'il est fourni, sinon logo + nom + slogan + mentions légales.
// - Pied de page : image et/ou texte fournis, sinon les coordonnées de l'organisation.
import React from 'react';
import { orgInitials } from '../../config';
import { brandColor, footerLines, type BrandSource } from '../../utils/branding';

export { DEFAULT_BRAND_COLOR, type BrandSource } from '../../utils/branding';

export const LogoMark: React.FC<{ org: BrandSource; size?: number }> = ({ org, size = 48 }) =>
  org.logo ? (
    <img src={org.logo} alt={`Logo ${org.name}`} style={{ width: size, height: size }} className="object-contain shrink-0" />
  ) : (
    <div
      style={{ width: size, height: size, background: brandColor(org), fontSize: size * 0.36 }}
      className="rounded-lg text-white font-black flex items-center justify-center shrink-0"
      aria-hidden="true"
    >
      {orgInitials(org.name)}
    </div>
  );

export const DocumentLetterhead: React.FC<{ organization: BrandSource }> = ({ organization: org }) => {
  const color = brandColor(org);
  if (org.branding?.headerImage) {
    return (
      <div className="pb-3 mb-4 border-b border-slate-200">
        <img src={org.branding.headerImage} alt={`En-tête de ${org.name}`} className="w-full max-h-44 object-contain object-left" />
      </div>
    );
  }
  const legal = [
    org.headquarters,
    org.rccm || org.registrationNumber ? `RCCM : ${org.rccm || org.registrationNumber}` : '',
    org.idNat ? `Id. Nat : ${org.idNat}` : '',
    org.numImpot ? `N° Impôt : ${org.numImpot}` : '',
  ].filter(Boolean);
  return (
    <div className="flex items-center gap-3 pb-3 mb-4 border-b-2" style={{ borderColor: color }}>
      <LogoMark org={org} size={52} />
      <div className="min-w-0">
        <div className="text-lg font-black tracking-tight uppercase leading-tight" style={{ color }}>{org.name}</div>
        {org.branding?.slogan && <div className="text-[11px] font-semibold text-slate-600">{org.branding.slogan}</div>}
        {legal.length > 0 && <div className="text-[10px] text-slate-500 mt-0.5">{legal.join(' • ')}</div>}
      </div>
    </div>
  );
};

export const DocumentPageFooter: React.FC<{ organization: BrandSource }> = ({ organization: org }) => (
  <footer className="pt-3 mt-6 border-t border-slate-200 text-[10px] text-slate-500 text-center space-y-0.5">
    {org.branding?.footerImage && (
      <img src={org.branding.footerImage} alt={`Pied de page de ${org.name}`} className="w-full max-h-24 object-contain mb-1" />
    )}
    {(!org.branding?.footerImage || org.branding?.footerText) && footerLines(org).map((l, i) => <p key={i}>{l}</p>)}
  </footer>
);
