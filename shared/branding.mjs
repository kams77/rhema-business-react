// shared/branding.mjs — contrôle de l'identité visuelle d'une organisation (logo, en-tête, pied de page).
//
// Utilisé par le serveur (toute écriture de « currentOrg » / « organizations », installation,
// restauration) et par le navigateur (mode local). Seules des images PNG ou JPEG intégrées
// (« data URL ») sont acceptées : pas de SVG (qui peut contenir du script), pas de lien vers
// un site extérieur (qui révélerait l'adresse des agents à ce site à chaque affichage).

/** Taille maximale (en caractères) d'une image intégrée. */
export const LOGO_MAX_CHARS = 400_000; // ≈ 300 Ko
export const BANNER_MAX_CHARS = 1_500_000; // ≈ 1,1 Mo
export const SLOGAN_MAX = 120;
export const FOOTER_TEXT_MAX = 600;

const DATA_URL_RE = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;
// Premiers octets réels du fichier, encodés en base64 : PNG « \x89PNG », JPEG « \xFF\xD8\xFF ».
const MAGIC = { png: 'iVBORw0KGgo', jpeg: '/9j/' };

/** Vrai si `value` est une image PNG/JPEG intégrée, cohérente avec son type et sous la limite. */
export function isSafeImageDataUrl(value, maxChars) {
  if (typeof value !== 'string' || value.length > maxChars) return false;
  const m = DATA_URL_RE.exec(value);
  return !!m && m[2].startsWith(MAGIC[m[1]]);
}

const cleanText = (v, max) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';

/** Identité visuelle nettoyée (champs inconnus ou invalides retirés), ou undefined si vide. */
export function sanitizeBranding(branding) {
  if (!branding || typeof branding !== 'object' || Array.isArray(branding)) return undefined;
  const out = {};
  const slogan = cleanText(branding.slogan, SLOGAN_MAX);
  if (slogan) out.slogan = slogan;
  if (typeof branding.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(branding.color)) out.color = branding.color.toLowerCase();
  if (isSafeImageDataUrl(branding.headerImage, BANNER_MAX_CHARS)) out.headerImage = branding.headerImage;
  if (isSafeImageDataUrl(branding.footerImage, BANNER_MAX_CHARS)) out.footerImage = branding.footerImage;
  const footerText = cleanText(branding.footerText, FOOTER_TEXT_MAX).split(/\r?\n/).slice(0, 3).join('\n');
  if (footerText) out.footerText = footerText;
  return Object.keys(out).length ? out : undefined;
}

/** Organisation dont le logo et l'identité visuelle sont sûrs. Les autres champs sont inchangés. */
export function sanitizeOrganization(org) {
  if (!org || typeof org !== 'object' || Array.isArray(org)) return org;
  const out = { ...org };
  if (!isSafeImageDataUrl(out.logo, LOGO_MAX_CHARS)) delete out.logo;
  const branding = sanitizeBranding(out.branding);
  if (branding) out.branding = branding;
  else delete out.branding;
  return out;
}

/** Applique le contrôle à la valeur d'une clé de données ; les autres clés sont rendues telles quelles. */
export function sanitizeOrgData(key, value) {
  if (key === 'currentOrg') return sanitizeOrganization(value);
  if (key === 'organizations' && Array.isArray(value)) return value.map(sanitizeOrganization);
  return value;
}
