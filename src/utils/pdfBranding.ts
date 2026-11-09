// src/utils/pdfBranding.ts
// En-tête et pied de page de l'organisation dans les exports PDF (jsPDF).
// - En-tête : papier à en-tête (image) s'il existe, sinon bandeau couleur + logo + nom + mentions.
// - Pied de page : sur CHAQUE page, image et/ou texte de l'organisation, et numéro de page.
import type { jsPDF } from 'jspdf';
import { orgInitials } from '../config';
import { brandColor, footerLines, type BrandSource } from './branding';

type Rgb = [number, number, number];

const imageFormat = (dataUrl: string) => (dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG');

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Vrai si la couleur est foncée (texte blanc lisible dessus). */
const isDark = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b < 150;

/** Taille d'une image qui tient dans le cadre maxW × maxH sans être déformée. */
function fitImage(doc: jsPDF, dataUrl: string, maxW: number, maxH: number) {
  const p = doc.getImageProperties(dataUrl);
  const ratio = p.width / p.height || 1;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { w, h };
}

function safeAddImage(doc: jsPDF, dataUrl: string, x: number, y: number, w: number, h: number) {
  try {
    doc.addImage(dataUrl, imageFormat(dataUrl), x, y, w, h);
    return true;
  } catch {
    return false;
  }
}

const legalLine = (org: BrandSource) =>
  [
    `RCCM : ${org.rccm || org.registrationNumber || 'N/A'}`,
    `ID.NAT : ${org.idNat || 'N/A'}`,
    `N° IMPÔT : ${org.numImpot || 'N/A'}`,
  ].join(' | ');

/**
 * Dessine l'en-tête de la première page à partir de `y` et renvoie la position sous l'en-tête.
 * `subtitle` = nature du document (ex. « Journal d'audit »), `details` = ligne d'information.
 */
export function drawPdfHeader(
  doc: jsPDF,
  org: BrandSource,
  opts: { y: number; margin: number; subtitle: string; details?: string },
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const { margin } = opts;
  const width = pageWidth - margin * 2;
  const color = hexToRgb(brandColor(org));
  let y = opts.y;

  const header = org.branding?.headerImage;
  if (header) {
    // Papier à en-tête : toute la largeur de la page, depuis le bord supérieur.
    const { w, h } = fitImage(doc, header, pageWidth, 50);
    if (safeAddImage(doc, header, (pageWidth - w) / 2, 0, w, h)) {
      y = Math.max(y, h + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...color);
      doc.text(opts.subtitle.toUpperCase(), margin, y + 1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(opts.details || legalLine(org), margin, y + 5.5);
      doc.setDrawColor(...color);
      doc.setLineWidth(0.4);
      doc.line(margin, y + 8, pageWidth - margin, y + 8);
      doc.setLineWidth(0.2);
      return y + 12;
    }
  }

  // En-tête automatique : bandeau à la couleur de l'organisation.
  // Bandeau sur toute la largeur de la page, depuis le bord supérieur.
  const dark = isDark(color);
  y = 0;
  doc.setFillColor(...color);
  doc.rect(0, 0, pageWidth, 28, 'F');
  y = 2;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + 4, y + 3, 18, 18, 1.5, 1.5, 'F');
  const logoDrawn = !!org.logo && (() => {
    const { w, h } = fitImage(doc, org.logo!, 16, 16);
    return safeAddImage(doc, org.logo!, margin + 5 + (16 - w) / 2, y + 4 + (16 - h) / 2, w, h);
  })();
  if (!logoDrawn) {
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(orgInitials(org.name), margin + 13, y + 14, { align: 'center' });
  }

  const text: Rgb = dark ? [255, 255, 255] : [15, 23, 42];
  const soft: Rgb = dark ? [226, 232, 240] : [51, 65, 85];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(...text);
  doc.text(doc.splitTextToSize(org.name.toUpperCase(), width - 32)[0] || '', margin + 26, y + 8.5);
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize([opts.subtitle.toUpperCase(), org.branding?.slogan].filter(Boolean).join('  •  '), width - 32)[0] || '', margin + 26, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...soft);
  doc.text(doc.splitTextToSize(opts.details || legalLine(org), width - 32)[0] || '', margin + 26, y + 19.5);
  return 34;
}

const FOOTER_IMAGE_MAX_H = 40;
const LINE_H = 3.1;

/** Taille de l'image de pied de page : toute la largeur de la page. */
const footerImageSize = (doc: jsPDF, image?: string) =>
  image ? fitImage(doc, image, doc.internal.pageSize.getWidth(), FOOTER_IMAGE_MAX_H) : null;

/** Hauteur (mm) réservée en bas de chaque page au pied de page de l'organisation. */
export function pdfFooterReserve(doc: jsPDF, org: BrandSource, extraLine?: string): number {
  const img = footerImageSize(doc, org.branding?.footerImage);
  const lines = footerTextLines(org, extraLine).length;
  return (img ? img.h : 2.5) + lines * LINE_H + 6;
}

function footerTextLines(org: BrandSource, extraLine?: string): string[] {
  const own = org.branding?.footerImage && !org.branding.footerText ? [] : footerLines(org);
  return [...own, ...(extraLine ? [extraLine] : [])].slice(0, 4);
}

/**
 * Pied de page sur CHAQUE page : il occupe tout le bas de la page (image ou bandeau sur toute la
 * largeur), avec le texte de l'organisation juste au-dessus et « Page n / N ».
 */
export function drawPdfFooters(doc: jsPDF, org: BrandSource, opts: { margin: number; extraLine?: string }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { margin } = opts;
  const width = pageWidth - margin * 2;
  const lines = footerTextLines(org, opts.extraLine);
  const image = org.branding?.footerImage;
  const imageSize = footerImageSize(doc, image);
  const total = doc.getNumberOfPages();
  const color = hexToRgb(brandColor(org));
  const bottomH = imageSize ? imageSize.h : 2.5;
  const textH = lines.length * LINE_H + 4;

  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    const textTop = pageHeight - bottomH - textH;
    // Bandeau de texte sur toute la largeur.
    if (!image) {
      doc.setFillColor(Math.round(255 - (255 - color[0]) * 0.06), Math.round(255 - (255 - color[1]) * 0.06), Math.round(255 - (255 - color[2]) * 0.06));
      doc.rect(0, textTop, pageWidth, textH, 'F');
    }
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    doc.line(0, textTop, pageWidth, textTop);
    doc.setLineWidth(0.2);
    lines.forEach((line, i) => {
      const isExtra = !!opts.extraLine && i === lines.length - 1;
      doc.setFont('helvetica', isExtra ? 'italic' : 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(isExtra ? 148 : 71, isExtra ? 163 : 85, isExtra ? 184 : 105);
      doc.text(doc.splitTextToSize(line, width - 26)[0] || '', pageWidth / 2, textTop + 3.6 + i * LINE_H, { align: 'center' });
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${page} / ${total}`, pageWidth - margin, textTop + 3.6, { align: 'right' });
    // Bas de page : image sur toute la largeur, sinon filet de couleur.
    if (image && imageSize) {
      safeAddImage(doc, image, (pageWidth - imageSize.w) / 2, pageHeight - imageSize.h, imageSize.w, imageSize.h);
    } else {
      doc.setFillColor(...color);
      doc.rect(0, pageHeight - bottomH, pageWidth, bottomH, 'F');
    }
  }
}
