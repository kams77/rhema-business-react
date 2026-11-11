// src/utils/exportUtils.ts
import { jsPDF } from 'jspdf';
import type { AuditLog, Organization, DocumentItem } from '../types';
import type { BrandSource } from './branding';
import { drawPdfFooters, drawPdfHeader, pdfFooterReserve } from './pdfBranding';

/**
 * Cellule CSV sûre : guillemets doublés et neutralisation des formules.
 * Un texte saisi par un utilisateur et commençant par = + - @ (ou une tabulation) serait exécuté
 * comme une formule par Excel / LibreOffice à l'ouverture du fichier (injection de formule) :
 * on le préfixe d'une apostrophe. Les nombres restent des nombres.
 */
export function csvCell(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Ligne CSV (séparateur « ; » par défaut, celui d'Excel en français). */
export const csvRow = (cells: unknown[], sep = ';') => cells.map(csvCell).join(sep);

/** Télécharge un fichier CSV (UTF-8 avec BOM) à partir de ses lignes. */
export function downloadCsv(lines: string[], filename: string) {
  downloadBlob(lines.join('\r\n'), filename);
}

/**
 * Téléchargement helper pour fichiers texte / CSV avec encodage UTF-8 BOM
 * Garantit l'affichage correct des caractères accentués dans Excel & LibreOffice
 */
function downloadBlob(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// 1. EXPORT DES JOURNAUX D'AUDIT (CSV & PDF)
// ============================================================================

/** Espace fine insécable (séparateur de milliers français) absente des polices PDF standard : espace simple. */
const pdfNumber = (text: string) => text.replace(/[\u202f\u00a0]/g, ' ');

export function exportAuditLogsToCSV(logs: AuditLog[], filename?: string) {
  const headers = ['ID', 'Horodatage', 'Opérateur', 'Rôle', 'Action', 'Catégorie', 'Détails', 'Adresse IP', 'Empreinte Cryptographique SHA-256'];
  const rows = logs.map(l => csvRow([l.id, l.timestamp, l.userName, l.userRole, l.action, l.category, l.details, l.ip, l.hash]));
  const targetName = filename || `journal_audit_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv([csvRow(headers), ...rows], targetName);
}

export function exportAuditLogsToPDF(
  logs: AuditLog[],
  organization: BrandSource | string = 'Organisation',
  filename?: string
) {
  const org: BrandSource = typeof organization === 'string' ? { name: organization } : organization;
  const orgName = org.name;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const footerLine = `Document certifié inaltérable • ${orgName} • Archivage légal SHA-256`;
  const bottomLimit = pageHeight - pdfFooterReserve(doc, org, footerLine) - 8;

  // En-tête officiel de l'organisation
  let currentY = drawPdfHeader(doc, org, {
    y: 12,
    margin,
    subtitle: 'Journal d\'audit (empreintes SHA-256 chaînées)',
    details: `Extrait du journal d'audit • Généré le ${new Date().toLocaleString('fr-FR')} • Événements archivés : ${logs.length}`,
  });

  // Table header
  const colX = {
    horodate: margin,
    user: margin + 30,
    role: margin + 75,
    action: margin + 120,
    details: margin + 175,
    hash: margin + 235
  };

  const drawTableHeader = () => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('HORODATAGE / IP', colX.horodate + 2, currentY + 4.8);
    doc.text('COLLABORATEUR', colX.user + 2, currentY + 4.8);
    doc.text('FONCTION / RÔLE', colX.role + 2, currentY + 4.8);
    doc.text('ACTION EXÉCUTÉE', colX.action + 2, currentY + 4.8);
    doc.text('DÉTAILS OPÉRATIONNELS', colX.details + 2, currentY + 4.8);
    doc.text('SCELLÉ SHA-256', colX.hash + 2, currentY + 4.8);
    currentY += 8;
  };

  drawTableHeader();

  logs.forEach((log, index) => {
    // Check if new page is needed
    if (currentY > bottomLimit) {
      doc.addPage();
      currentY = 14;
      drawTableHeader();
    }

    // Zebra striping
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, pageWidth - margin * 2, 7.5, 'F');
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    // Horodate + IP
    doc.setFont('courier', 'bold');
    doc.text(`${log.timestamp}`, colX.horodate + 2, currentY + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${log.ip}`, colX.horodate + 2, currentY + 6.5);

    // User
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(log.userName, 42)[0] || '', colX.user + 2, currentY + 5);

    // Role
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(log.userRole, 42)[0] || '', colX.role + 2, currentY + 5);

    // Action
    const isSecurityAlert = log.category === 'security' || log.action.toLowerCase().includes('verrouill') || log.action.toLowerCase().includes('alerte');
    if (isSecurityAlert) {
      doc.setTextColor(190, 18, 60); // rose-700
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
    }
    doc.text(doc.splitTextToSize(log.action, 50)[0] || '', colX.action + 2, currentY + 5);

    // Details
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    const truncatedDetails = doc.splitTextToSize(log.details, 58)[0] || '';
    doc.text(truncatedDetails, colX.details + 2, currentY + 5);

    // Hash
    doc.setTextColor(79, 70, 229);
    doc.setFont('courier', 'bold');
    doc.text(doc.splitTextToSize(log.hash, 32)[0] || '', colX.hash + 2, currentY + 5);

    currentY += 8;
  });

  // Pied de page de l'organisation sur chaque page
  drawPdfFooters(doc, org, { margin, extraLine: footerLine });

  const targetName = filename || `journal_audit_immuable_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(targetName);
}

// ============================================================================
// 4. EXPORT DES DOCUMENTS OFFICIELS D'ENTREPRISE (PDF & CSV)
// ============================================================================

export function exportOfficialDocumentToCSV(docItem: DocumentItem, orgName = 'Organisation') {
  const lines = [
    ['ORGANISATION', orgName],
    ['TITRE DOCUMENT', docItem.title],
    ['NUMÉRO DE RÉFÉRENCE', docItem.referenceNumber],
    ['CATÉGORIE', docItem.category],
    ['SOUS-TYPE', docItem.subtype],
    ['AUTEUR', `${docItem.authorName} (${docItem.authorEntity})`],
    ['DATE DE CRÉATION', docItem.createdAt],
    ['STATUT', docItem.status],
    ['MONTANT ASSOCIÉ', docItem.amount ? `${docItem.amount} ${docItem.currency || 'USD'}` : 'N/A'],
    ['DESCRIPTION', docItem.description || ''],
    ['SIGNATAIRE ÉLECTRONIQUE', docItem.electronicSignature?.signedBy || 'En attente'],
    ['HORODATAGE SIGNATURE', docItem.electronicSignature?.signedAt || 'N/A'],
    ['EMPREINTE SHA-256', docItem.electronicSignature?.certificateHash || 'Non signé'],
  ].map(cells => csvRow(cells));

  const targetName = `${docItem.referenceNumber}_archivage.csv`.replace(/[\\/:*?"<>|]+/g, '_');
  downloadCsv(lines, targetName);
}

export function exportOfficialDocumentToPDF(
  docItem: DocumentItem,
  org: Organization,
  filename?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let currentY = drawPdfHeader(doc, org, { y: 12, margin, subtitle: 'Document officiel' });
  currentY += 2;

  // Title Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(doc.splitTextToSize(docItem.title, pageWidth - margin * 2 - 40), margin + 6, currentY + 7);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229);
  doc.text(`RÉF : ${docItem.referenceNumber}`, margin + 6, currentY + 13);

  currentY += 22;

  // Metadata Table
  const meta = [
    { k: 'Catégorie Opérationnelle :', v: docItem.category.replace('_', ' ').toUpperCase() },
    { k: 'Sous-type :', v: docItem.subtype.replace(/_/g, ' ') },
    { k: 'Auteur / Émetteur :', v: `${docItem.authorName} (${docItem.authorEntity})` },
    { k: 'Date de Création :', v: docItem.createdAt },
    { k: 'Statut du Document :', v: docItem.status.toUpperCase() },
    ...(docItem.amount ? [{ k: 'Montant Financier :', v: `${pdfNumber(docItem.amount.toLocaleString('fr-FR'))} ${docItem.currency || 'USD'}` }] : [])
  ];

  meta.forEach((m, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(m.k, margin + 4, currentY + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(m.v, margin + 55, currentY + 4.8);
    currentY += 7;
  });

  currentY += 6;

  // Description / Contenu
  const descLines = doc.splitTextToSize(docItem.description || 'Document officiel validé dans le cadre des activités opérationnelles de l\'entreprise.', pageWidth - margin * 2 - 8);
  const descBoxHeight = Math.max(34, descLines.length * 4.5 + 15);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, descBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('CORPS DESCRIPTIF OFFICIEL & DISPOSITIF DE LA PIÈCE :', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(descLines, margin + 4, currentY + 13);

  currentY += descBoxHeight + 8;

  // Signature électronique
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('CERTIFICAT DE SIGNATURE ÉLECTRONIQUE (SHA-256)', margin + 6, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Signé par : ${docItem.electronicSignature?.signedBy || 'En attente de signature'}`, margin + 6, currentY + 12);
  doc.text(`Horodatage certifié : ${docItem.electronicSignature?.signedAt || 'Non signé'}`, margin + 6, currentY + 17);

  doc.setFont('courier', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(`EMPREINTE SHA-256 : ${docItem.electronicSignature?.certificateHash || 'Document non signé'}`, margin + 6, currentY + 23);

  // Inclusion de l'empreinte graphique de la signature si présente
  if (docItem.electronicSignature?.signatureImage) {
    try {
      doc.addImage(docItem.electronicSignature.signatureImage, 'PNG', pageWidth - margin - 46, currentY + 3, 40, 15);
    } catch (_e) {
      // Ignorer si non rendu
    }
  }

  // Pied de page de l'organisation
  drawPdfFooters(doc, org, { margin, extraLine: `Copie certifiée conforme • Réf. ${docItem.referenceNumber}` });

  const targetName = filename || `${docItem.referenceNumber}_officiel.pdf`;
  doc.save(targetName);
}

// ============================================================================
// 5. EXPORT BORDEREAU DE VISA & APPROBATION HIÉRARCHIQUE (PDF)
// ============================================================================

export function exportApprovalSlipToPDF(
  task: {
    id: string;
    title: string;
    description: string;
    category?: string;
    priority?: string;
    dueDate?: string;
    initiator?: string;
    assignedEntity?: string;
    steps?: { id: string; label: string; completed: boolean; validatedBy?: string }[];
    intervenants?: { name: string; roleTitle: string; roleBadge: string }[];
    electronicSignature?: { signedBy: string; signedAt: string; hash: string } | null;
  },
  org: Organization,
  filename?: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let currentY = drawPdfHeader(doc, org, { y: 12, margin, subtitle: 'Circuit de visa & approbations hiérarchiques' });
  currentY += 2;

  // Title Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('BORDEREAU D\'APPROBATION & DE VISA HIÉRARCHIQUE', margin + 6, currentY + 6.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(79, 70, 229);
  doc.text(`RÉF : WF-${task.id.toUpperCase()} • Priorité : ${(task.priority || 'NORMALE').toUpperCase()}`, margin + 6, currentY + 12.5);

  currentY += 21;

  // Metadata block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('INTITULÉ DE L\'OPÉRATION :', margin + 4, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(doc.splitTextToSize(task.title, pageWidth - margin * 2 - 8), margin + 4, currentY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Émetteur : ${task.initiator || 'Service Opérationnel'}`, margin + 4, currentY + 20);
  doc.text(`Périmètre Assigné : ${task.assignedEntity || 'Direction Générale'}`, margin + 85, currentY + 20);
  doc.text(`Échéance : ${task.dueDate || 'Non définie'}`, margin + 4, currentY + 25);

  currentY += 33;

  // Intervenants
  if (task.intervenants && task.intervenants.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('CHAÎNE DE DÉCISION & INTERVENANTS ASSIGNÉS :', margin, currentY);
    currentY += 4;

    task.intervenants.forEach(it => {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 6.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(it.name, margin + 4, currentY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`(${it.roleTitle})`, margin + 55, currentY + 4.5);
      doc.setFont('courier', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(`[${it.roleBadge.toUpperCase()}]`, pageWidth - margin - 35, currentY + 4.5);
      currentY += 7.5;
    });

    currentY += 3;
  }

  // Jalons / Étapes
  if (task.steps && task.steps.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('JALONS & CONTRÔLES OPÉRATIONNELS D\'INSTRUCTION :', margin, currentY);
    currentY += 4;

    task.steps.forEach((st, idx) => {
      doc.setFillColor(st.completed ? 240 : 254, st.completed ? 253 : 242, st.completed ? 244 : 242);
      doc.setDrawColor(st.completed ? 187 : 254, st.completed ? 247 : 202, st.completed ? 208 : 202);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(st.completed ? 22 : 185, st.completed ? 101 : 28, st.completed ? 52 : 28);
      doc.text(`${idx + 1}. [${st.completed ? 'VALIDÉ' : 'EN ATTENTE'}]`, margin + 3, currentY + 5.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(doc.splitTextToSize(st.label, 120), margin + 25, currentY + 5.2);

      if (st.validatedBy) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(71, 85, 105);
        doc.text(st.validatedBy, pageWidth - margin - 45, currentY + 5.2);
      }
      currentY += 9;
    });

    currentY += 4;
  }

  // Scellement / Signature
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('VISA ÉLECTRONIQUE ET SCELLÉ HIÉRARCHIQUE (SHA-256)', margin + 6, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    task.electronicSignature 
      ? `Visa certifié émis par : ${task.electronicSignature.signedBy}` 
      : 'Statut : Circuit d\'instruction et visa en cours d\'enregistrement.', 
    margin + 6, 
    currentY + 12
  );
  doc.text(
    task.electronicSignature 
      ? `Horodatage scellé : ${task.electronicSignature.signedAt}` 
      : `Dernière mise à jour : ${new Date().toLocaleString('fr-FR')}`, 
    margin + 6, 
    currentY + 17
  );

  doc.setFont('courier', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(
    `EMPREINTE SHA-256 : ${task.electronicSignature?.hash || 'Non signé'}`, 
    margin + 6, 
    currentY + 23
  );

  // Pied de page de l'organisation
  drawPdfFooters(doc, org, { margin, extraLine: 'Registre officiel des circuits de visa et d\'approbation' });

  const targetName = filename || `bordereau_visa_${task.id}.pdf`;
  doc.save(targetName);
}
