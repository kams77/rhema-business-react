// src/utils/branding.ts — éléments communs de l'en-tête et du pied de page d'une organisation
// (aperçu à l'écran, documents officiels et exports PDF).
import type { Organization } from '../types';

export const DEFAULT_BRAND_COLOR = '#1e3a8a';

/** Champs de l'organisation utiles à l'en-tête et au pied de page. */
export type BrandSource = Pick<Organization, 'name'> &
  Partial<Pick<Organization, 'logo' | 'branding' | 'headquarters' | 'rccm' | 'registrationNumber' | 'idNat' | 'numImpot' | 'email' | 'phone'>>;

export const brandColor = (org: BrandSource) => org.branding?.color || DEFAULT_BRAND_COLOR;

/** Lignes du pied de page par défaut (sans texte personnalisé). */
export function defaultFooterLines(org: BrandSource): string[] {
  const legal = [
    org.rccm || org.registrationNumber ? `RCCM : ${org.rccm || org.registrationNumber}` : '',
    org.idNat ? `Id. Nat : ${org.idNat}` : '',
    org.numImpot ? `N° Impôt : ${org.numImpot}` : '',
  ].filter(Boolean).join(' • ');
  const contact = [org.headquarters, org.phone, org.email].filter(Boolean).join(' • ');
  return [[org.name, legal].filter(Boolean).join(' • '), contact].filter(Boolean);
}

export const footerLines = (org: BrandSource): string[] =>
  org.branding?.footerText ? org.branding.footerText.split('\n').filter(l => l.trim()) : defaultFooterLines(org);
