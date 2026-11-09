// Rapport de site (A4 portrait) : en-tête et pied de page de l'organisation sur chaque page.
import { jsPDF } from 'jspdf';
import type { BrandSource } from './branding';
import { drawPdfFooters, drawPdfHeader, pdfFooterReserve } from './pdfBranding';

export interface SiteReportPdfRow {
  sku: string;
  name: string;
  category: string;
  opening: number;
  entries: number;
  exits: number;
  received: number;
  sent: number;
  closing: number;
  threshold: number;
  inTransit: number;
  status: string;
}

const nf = (n: number) => n.toLocaleString('fr-FR').replace(/[  ]/g, ' ');

export function exportSiteReportPdf(org: BrandSource, opts: {
  siteName: string;
  siteDetails: string;
  from: string;
  to: string;
  rows: SiteReportPdfRow[];
  generatedBy: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const footerLine = `Rapport de stock — ${opts.siteName} — ${opts.from} au ${opts.to}`;
  const bottom = pageH - pdfFooterReserve(doc, org, footerLine) - 4;
  let y = drawPdfHeader(doc, org, {
    y: 12,
    margin,
    subtitle: `Rapport de stock du site ${opts.siteName}`,
    details: `Période du ${opts.from} au ${opts.to} • ${opts.siteDetails} • Établi par ${opts.generatedBy} le ${new Date().toLocaleString('fr-FR')}`,
  });

  // Colonnes (largeur utile 186 mm)
  const cols: { k: keyof SiteReportPdfRow | 'article'; t: string; w: number; right?: boolean }[] = [
    { k: 'article', t: 'Article', w: 54 },
    { k: 'opening', t: 'Ouverture', w: 15, right: true },
    { k: 'entries', t: 'Entrées', w: 14, right: true },
    { k: 'exits', t: 'Sorties', w: 14, right: true },
    { k: 'received', t: 'Reçus', w: 13, right: true },
    { k: 'sent', t: 'Envoyés', w: 14, right: true },
    { k: 'closing', t: 'Clôture', w: 15, right: true },
    { k: 'threshold', t: 'Seuil', w: 12, right: true },
    { k: 'inTransit', t: 'Transit', w: 13, right: true },
    { k: 'status', t: 'Statut', w: 22 },
  ];
  const head = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, pageW - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let x = margin;
    for (const c of cols) {
      doc.text(c.t.toUpperCase(), c.right ? x + c.w - 1.5 : x + 1.5, y + 4.7, { align: c.right ? 'right' : 'left' });
      x += c.w;
    }
    y += 8;
  };
  head();

  const totals = { opening: 0, entries: 0, exits: 0, received: 0, sent: 0, closing: 0, inTransit: 0 };
  opts.rows.forEach((r, i) => {
    if (y + 9 > bottom) {
      doc.addPage();
      y = 14;
      head();
    }
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 1, pageW - margin * 2, 8.5, 'F');
    }
    let x = margin;
    for (const c of cols) {
      if (c.k === 'article') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 23, 42);
        doc.text(doc.splitTextToSize(r.name, c.w - 3)[0] || '', x + 1.5, y + 2.8);
        doc.setFont('courier', 'normal');
        doc.setFontSize(6.3);
        doc.setTextColor(100, 116, 139);
        doc.text(`${r.sku} · ${r.category}`.slice(0, 48), x + 1.5, y + 6.1);
      } else if (c.k === 'status') {
        const color: [number, number, number] = r.status === 'OK' ? [5, 150, 105] : r.status === 'STOCK BAS' ? [217, 119, 6] : [220, 38, 38];
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...color);
        doc.text(r.status, x + 1.5, y + 4.4);
      } else {
        const v = r[c.k] as number;
        doc.setFont('helvetica', c.k === 'closing' ? 'bold' : 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(v < 0 ? 220 : 30, v < 0 ? 38 : 41, v < 0 ? 38 : 59);
        doc.text(c.k === 'threshold' && !v ? '—' : nf(v), x + c.w - 1.5, y + 4.4, { align: 'right' });
      }
      x += c.w;
    }
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r[k];
    y += 8.5;
  });

  if (y + 9 > bottom) { doc.addPage(); y = 14; }
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 1;
  let x = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  for (const c of cols) {
    if (c.k === 'article') doc.text('TOTAL SITE', x + 1.5, y + 4.4);
    else if (c.k in totals) doc.text(nf(totals[c.k as keyof typeof totals]), x + c.w - 1.5, y + 4.4, { align: 'right' });
    x += c.w;
  }
  y += 14;

  // Signatures
  if (y + 24 > bottom) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const half = (pageW - margin * 2) / 2;
  doc.text('Responsable du site', margin, y);
  doc.text('Responsable logistique', margin + half, y);
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y + 16, margin + half - 10, y + 16);
  doc.line(margin + half, y + 16, pageW - margin, y + 16);

  drawPdfFooters(doc, org, { margin, extraLine: footerLine });
  const safe = opts.siteName.normalize('NFD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-');
  doc.save(`rapport-stock-${safe}-${opts.from}-${opts.to}.pdf`);
}
