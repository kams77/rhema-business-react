// src/utils/imageUpload.ts
// Lecture d'une image choisie par l'utilisateur (logo, papier à en-tête, pied de page).
//
// L'image est redessinée dans un canevas puis ré-encodée en PNG ou JPEG : le fichier d'origine
// n'est jamais conservé tel quel (métadonnées, données cachées et formats exotiques sont éliminés).
// Le résultat est une « data URL » acceptée par le serveur (shared/branding.mjs).
import { BANNER_MAX_CHARS, LOGO_MAX_CHARS, isSafeImageDataUrl } from '../../shared/branding.mjs';

export type ImageKind = 'logo' | 'banner';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
/** Types proposés par le sélecteur de fichiers (pas de SVG). */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

const SETTINGS: Record<ImageKind, { maxW: number; maxH: number; maxChars: number; format: 'image/png' | 'image/jpeg' }> = {
  // Logo : PNG pour garder la transparence.
  logo: { maxW: 512, maxH: 512, maxChars: LOGO_MAX_CHARS, format: 'image/png' },
  // Bannière (en-tête / pied) : JPEG sur fond blanc, largeur d'une page A4 à ~240 ppp.
  banner: { maxW: 2000, maxH: 700, maxChars: BANNER_MAX_CHARS, format: 'image/jpeg' },
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible : choisissez un fichier PNG ou JPEG.')); };
    img.src = url;
  });
}

function encode(img: HTMLImageElement, width: number, height: number, format: string, quality: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Le navigateur ne peut pas traiter cette image.');
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL(format, quality);
}

/** Lit, redimensionne et ré-encode une image. Lève une erreur au message lisible si elle ne convient pas. */
export async function readImageFile(file: File, kind: ImageKind): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Format non accepté : utilisez une image PNG ou JPEG (le SVG n\'est pas accepté).');
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error('Image trop lourde (10 Mo au maximum).');
  const s = SETTINGS[kind];
  const img = await loadImage(file);
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image vide ou illisible.');

  let scale = Math.min(1, s.maxW / img.naturalWidth, s.maxH / img.naturalHeight);
  let quality = 0.9;
  for (let attempt = 0; attempt < 8; attempt++) {
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const dataUrl = encode(img, w, h, s.format, quality);
    if (isSafeImageDataUrl(dataUrl, s.maxChars)) return dataUrl;
    // Trop lourde : on baisse la qualité (JPEG) puis la taille.
    if (s.format === 'image/jpeg' && quality > 0.6) quality -= 0.1;
    else scale *= 0.8;
  }
  throw new Error('Impossible de réduire suffisamment cette image : essayez une image plus simple.');
}
