// src/components/branding/A4Sheet.tsx
// Feuille A4 officielle (210 × 297 mm) : en-tête de l'organisation en haut, pied de page sur toute
// la largeur du bas de la page. Même rendu à l'écran et à l'impression :
// - écran : une page A4 ; le pied de page reste collé en bas de la feuille ;
// - impression : format A4 sans marge (@page dans index.css), le pied de page est répété en bas de
//   CHAQUE page imprimée et une réserve de même hauteur évite que le texte passe dessous.
import React, { useEffect, useRef } from 'react';
import { brandColor, footerLines, type BrandSource } from '../../utils/branding';
import { LogoMark } from './Letterhead';

const legalLine = (org: BrandSource) =>
  [
    org.headquarters,
    org.rccm || org.registrationNumber ? `RCCM : ${org.rccm || org.registrationNumber}` : '',
    org.idNat ? `Id. Nat : ${org.idNat}` : '',
    org.numImpot ? `N° Impôt : ${org.numImpot}` : '',
  ].filter(Boolean).join(' • ');

/** En-tête : papier à en-tête (image, toute la largeur) ou en-tête automatique. */
export const A4Header: React.FC<{ organization: BrandSource }> = ({ organization: org }) => {
  const color = brandColor(org);
  if (org.branding?.headerImage) {
    return (
      <header className="a4-header">
        <img src={org.branding.headerImage} alt={`En-tête de ${org.name}`} className="block w-full h-auto max-h-[60mm] object-cover object-top" />
      </header>
    );
  }
  const legal = legalLine(org);
  return (
    <header className="a4-header">
      <div className="h-[3mm] w-full" style={{ background: color }} />
      <div className="flex items-center gap-[4mm] px-[15mm] pt-[6mm] pb-[4mm] border-b-2" style={{ borderColor: color }}>
        <LogoMark org={org} size={58} />
        <div className="min-w-0">
          <div className="text-[17px] font-black tracking-tight uppercase leading-tight" style={{ color }}>{org.name}</div>
          {org.branding?.slogan && <div className="text-[11px] font-semibold text-slate-600">{org.branding.slogan}</div>}
          {legal && <div className="text-[10px] text-slate-500 mt-0.5">{legal}</div>}
        </div>
      </div>
    </header>
  );
};

/** Pied de page : image (toute la largeur) et/ou texte, sur un bandeau qui occupe tout le bas de la page. */
export const A4Footer: React.FC<{ organization: BrandSource; extraLine?: string }> = ({ organization: org, extraLine }) => {
  const color = brandColor(org);
  const image = org.branding?.footerImage;
  const lines = image && !org.branding?.footerText ? [] : footerLines(org);
  return (
    <footer className="a4-footer w-full bg-white">
      {(lines.length > 0 || extraLine) && (
        <div className="px-[15mm] pt-[2.5mm] pb-[2mm] text-center text-[9.5px] leading-snug text-slate-600 border-t-2" style={{ borderColor: color, background: image ? undefined : `${color}0d` }}>
          {lines.map((l, i) => <p key={i}>{l}</p>)}
          {extraLine && <p className="italic text-slate-400">{extraLine}</p>}
        </div>
      )}
      {image ? (
        <img src={image} alt={`Pied de page de ${org.name}`} className="block w-full h-auto max-h-[45mm] object-cover object-bottom" />
      ) : (
        <div className="h-[3mm] w-full" style={{ background: color }} />
      )}
    </footer>
  );
};

interface A4SheetProps {
  organization: BrandSource;
  children: React.ReactNode;
  /** Ligne supplémentaire du pied de page (ex. « Copie certifiée conforme • Réf. … »). */
  footerExtra?: string;
  /** Contenu superposé (filigrane…). */
  overlay?: React.ReactNode;
  className?: string;
  /** Classe ajoutée pour l'impression (par défaut : la feuille est la seule chose imprimée). */
  printable?: boolean;
}

export const A4Sheet: React.FC<A4SheetProps> = ({ organization, children, footerExtra, overlay, className = '', printable = true }) => {
  const sheet = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLDivElement>(null);

  // Hauteur réelle du pied de page : réservée en bas de chaque page imprimée.
  useEffect(() => {
    const el = footer.current;
    if (!el || !sheet.current) return;
    const apply = () => sheet.current?.style.setProperty('--a4-footer-h', `${el.offsetHeight}px`);
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  return (
    <div
      ref={sheet}
      className={`a4-sheet ${printable ? 'print-sheet' : ''} relative bg-white text-slate-900 shadow-2xl flex flex-col font-sans overflow-hidden shrink-0 ${className}`}
    >
      {/* Le filigrane reste dans la feuille : rien ne doit dépasser la largeur A4, sinon le navigateur réduit la page. */}
      {overlay && <div className="a4-overlay absolute inset-0 overflow-hidden pointer-events-none">{overlay}</div>}
      <table className="a4-flow w-full border-collapse">
        <tbody>
          <tr>
            <td className="p-0 align-top">
              <A4Header organization={organization} />
              <div className="a4-body px-[15mm] pt-[6mm] pb-[8mm]">{children}</div>
            </td>
          </tr>
        </tbody>
        <tfoot className="a4-repeat-foot"><tr><td className="p-0"><div className="a4-foot-spacer" /></td></tr></tfoot>
      </table>
      <div ref={footer} className="a4-footer-slot mt-auto">
        <A4Footer organization={organization} extraLine={footerExtra} />
      </div>
    </div>
  );
};
