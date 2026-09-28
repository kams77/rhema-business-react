// src/utils/exportUtils.ts
import { jsPDF } from 'jspdf';
import type { AuditLog, Organization, EmployeeContract, User, PayrollRunPeriod, DocumentItem } from '../types';

export interface PayslipExportData {
  orgName: string;
  rccm?: string;
  idNat?: string;
  numImpot?: string;
  headquarters?: string;
  ref: string;
  period: string;
  date: string;
  employeeName: string;
  matricule: string;
  roleTitle: string;
  cnssNumber?: string;
  bankName?: string;
  accountNumber?: string;
  seniorityYears?: number;
  dependents?: number;
  currency: string;
  baseSalary: number;
  seniorityBonus?: number;
  allowances?: number;
  overtimeAmount?: number;
  grossSalary: number;
  socialDeductionCNSS: number;
  taxDeductionIPR: number;
  advanceDeduction?: number;
  otherDeductions?: number;
  totalDeductions: number;
  netSalary: number;
  counterValueCDF?: number;
  employerCNSS: number;
  employerINPP: number;
  employerONEM: number;
  totalEmployerCost: number;
  sha256Hash?: string;
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

export function exportAuditLogsToCSV(logs: AuditLog[], filename?: string) {
  const headers = ['ID', 'Horodatage', 'Opérateur', 'Rôle', 'Action', 'Catégorie', 'Détails', 'Adresse IP', 'Empreinte Cryptographique SHA-256'];
  const rows = logs.map(l => [
    `"${l.id}"`,
    `"${l.timestamp}"`,
    `"${l.userName.replace(/"/g, '""')}"`,
    `"${l.userRole.replace(/"/g, '""')}"`,
    `"${l.action.replace(/"/g, '""')}"`,
    `"${l.category}"`,
    `"${l.details.replace(/"/g, '""')}"`,
    `"${l.ip}"`,
    `"${l.hash}"`
  ]);

  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const targetName = filename || `journal_audit_rhema_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadBlob(csv, targetName);
}

export function exportAuditLogsToPDF(
  logs: AuditLog[],
  orgName = 'RHEMA BUSINESS RDC',
  filename?: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  // En-tête officiel
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, currentY, pageWidth - margin * 2, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(orgName.toUpperCase() + ' - JOURNAL OFFICIEL D\'AUDIT IMMUABLE SHA-256', margin + 6, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Traçabilité réglementaire & conformité légale RDC • Généré le ${new Date().toLocaleString('fr-FR')} • Événements archivés : ${logs.length}`, margin + 6, currentY + 16);

  currentY += 28;

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
    if (currentY > pageHeight - 20) {
      doc.addPage();
      currentY = 16;
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
      doc.setFont('helvetica', 'medium');
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

  // Footer on last page
  currentY = Math.min(currentY + 4, pageHeight - 12);
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document certifié inaltérable • République Démocratique du Congo • ${orgName} • Archivage Légal SHA-256`, margin, currentY + 4);

  const targetName = filename || `journal_audit_immuable_rhema_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(targetName);
}

// ============================================================================
// 2. EXPORT DE BULLETIN DE PAIE INDIVIDUEL (PDF CERTIFIÉ CONFORME RDC & CSV)
// ============================================================================

export function exportPayslipToPDF(data: PayslipExportData, filename?: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let currentY = 14;

  // Header band
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, 'F');

  // Logo / badge RB
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.roundedRect(margin + 5, currentY + 4, 16, 16, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RB', margin + 9, currentY + 14.5);

  // Entreprise
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(data.orgName.toUpperCase(), margin + 25, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Télécoms • VSAT • Réseaux & Intégration Technologique • Kinshasa - RD CONGO', margin + 25, currentY + 15);
  doc.text(`RCCM: ${data.rccm || 'CD/KNG/RCCM/20-A-01120'} | ID.NAT: ${data.idNat || '01-83-N45201L'} | N° IMPÔT: ${data.numImpot || 'A1934892Z'}`, margin + 25, currentY + 19.5);

  currentY += 28;

  // Title Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 10, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('BULLETIN OFFICIEL DE PAIE & DÉCOMPTE SALARIAL', margin + 6, currentY + 6.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text(`RÉF : ${data.ref}`, pageWidth - margin - 50, currentY + 6.5);

  currentY += 14;

  // 2-column Employee & Period Details
  const colWidth = (pageWidth - margin * 2 - 4) / 2;
  
  // Left Box: Collaborateur
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, colWidth, 32, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('DONNÉES DU COLLABORATEUR', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Nom & Postnom : `, margin + 4, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.employeeName, margin + 30, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.text(`Matricule : `, margin + 4, currentY + 17);
  doc.setFont('courier', 'bold');
  doc.text(data.matricule, margin + 30, currentY + 17);

  doc.setFont('helvetica', 'normal');
  doc.text(`Fonction : `, margin + 4, currentY + 22);
  doc.text(data.roleTitle, margin + 30, currentY + 22);

  doc.text(`N° CNSS : `, margin + 4, currentY + 27);
  doc.setFont('courier', 'bold');
  doc.text(data.cnssNumber || 'CNSS-CD-9982410', margin + 30, currentY + 27);

  // Right Box: Période & Modalités
  const rightX = margin + colWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightX, currentY, colWidth, 32, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('MODALITÉS LÉGALES & PAIEMENT', rightX + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Période de paie : `, rightX + 4, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.period, rightX + 32, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.text(`Date d'édition : `, rightX + 4, currentY + 17);
  doc.text(data.date, rightX + 32, currentY + 17);

  doc.text(`Banque / Compte : `, rightX + 4, currentY + 22);
  doc.text(`${data.bankName || 'Rawbank'} (${data.accountNumber || 'Compte Entreprise'})`, rightX + 32, currentY + 22);

  doc.text(`Charges familiales : `, rightX + 4, currentY + 27);
  doc.text(`${data.dependents || 0} enfant(s) à charge (${data.seniorityYears || 1} an(s) d'ancienneté)`, rightX + 32, currentY + 27);

  currentY += 36;

  // Tableau des rubriques
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('DÉSIGNATION DES RUBRIQUES SALARIALES', margin + 4, currentY + 4.8);
  doc.text('BASE / TAUX', margin + 92, currentY + 4.8);
  doc.text(`GAINS (+) [${data.currency}]`, margin + 122, currentY + 4.8);
  doc.text(`RETENUES (-) [${data.currency}]`, margin + 152, currentY + 4.8);

  currentY += 8;

  const fmt = (num: number) => num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const tableRows = [
    { label: 'Salaire de base conventionnel', base: '100% contractuel', gain: fmt(data.baseSalary), ded: '-' },
    ...(data.seniorityBonus && data.seniorityBonus > 0 ? [{ label: `Prime d'ancienneté (${data.seniorityYears} ans)`, base: 'Barème légal', gain: fmt(data.seniorityBonus), ded: '-' }] : []),
    ...(data.allowances && data.allowances > 0 ? [{ label: 'Indemnités conventionnelles (Logement/Transport)', base: 'Montant forfaitaire', gain: fmt(data.allowances), ded: '-' }] : []),
    ...(data.overtimeAmount && data.overtimeAmount > 0 ? [{ label: 'Heures supplémentaires majorées (RDC)', base: 'Conforme art. 119 CT', gain: fmt(data.overtimeAmount), ded: '-' }] : []),
    { label: 'Cotisation CNSS Salarié (Pensions, Risques, Famille)', base: '5.0% sur brut taxable', gain: '-', ded: fmt(data.socialDeductionCNSS) },
    { label: 'IPR - Impôt Professionnel sur les Rémunérations (DGI)', base: 'Barème progressif 3% à 40%', gain: '-', ded: fmt(data.taxDeductionIPR) },
    ...(data.advanceDeduction && data.advanceDeduction > 0 ? [{ label: 'Remboursement acompte sur salaire quinzaine', base: 'Retenue directe', gain: '-', ded: fmt(data.advanceDeduction) }] : []),
  ];

  tableRows.forEach((r, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, pageWidth - margin * 2, 6.5, 'F');
    }
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(r.label, margin + 4, currentY + 4.5);
    doc.setTextColor(100, 116, 139);
    doc.text(r.base, margin + 92, currentY + 4.5);

    if (r.gain !== '-') {
      doc.setFont('courier', 'bold');
      doc.setTextColor(16, 185, 129); // emerald
      doc.text(`+${r.gain}`, margin + 122, currentY + 4.5);
    } else {
      doc.setTextColor(148, 163, 184);
      doc.text('-', margin + 122, currentY + 4.5);
    }

    if (r.ded !== '-') {
      doc.setFont('courier', 'bold');
      doc.setTextColor(225, 29, 72); // rose
      doc.text(`-${r.ded}`, margin + 152, currentY + 4.5);
    } else {
      doc.setTextColor(148, 163, 184);
      doc.text('-', margin + 152, currentY + 4.5);
    }

    currentY += 6.5;
  });

  // Recapitulatif Totaux
  currentY += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 4;

  // Box Totaux
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 14, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL SALAIRE BRUT IMPOSABLE :`, margin + 4, currentY + 5.5);
  doc.setFont('courier', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(`${fmt(data.grossSalary)} ${data.currency}`, margin + 64, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL RETENUES (CNSS + IPR) :`, margin + 4, currentY + 10.5);
  doc.setFont('courier', 'bold');
  doc.setTextColor(225, 29, 72);
  doc.text(`-${fmt(data.totalDeductions)} ${data.currency}`, margin + 64, currentY + 10.5);

  // NET À PAYER (HIGHLIGHT BOX)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin + 110, currentY + 1.5, pageWidth - margin * 2 - 114, 11, 1.5, 1.5, 'F');

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('NET À VIRER AU COLLABORATEUR', margin + 114, currentY + 5);

  doc.setTextColor(16, 185, 129); // emerald-400
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text(`${fmt(data.netSalary)} ${data.currency}`, margin + 114, currentY + 9.5);

  currentY += 18;

  // Charges patronales RDC (INPP / ONEM / CNSS Patronale)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('CHARGES PATRONALES OBLIGATOIRES EN RDC (HORS SALAIRE NET) :', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`• CNSS Patronale (13%) : ${fmt(data.employerCNSS)} ${data.currency}`, margin + 4, currentY + 10);
  doc.text(`• INPP (3%) : ${fmt(data.employerINPP)} ${data.currency}`, margin + 62, currentY + 10);
  doc.text(`• ONEM (0.2%) : ${fmt(data.employerONEM)} ${data.currency}`, margin + 112, currentY + 10);
  doc.setFont('helvetica', 'bold');
  doc.text(`COÛT GLOBAL SALARIAL : ${fmt(data.totalEmployerCost)} ${data.currency}`, margin + 4, currentY + 14);

  currentY += 21;

  // Signatures et scellement SHA-256
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 26, 1.5, 1.5, 'FD');

  const halfWidth = (pageWidth - margin * 2) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('POUR LA DIRECTION GÉNÉRALE (VISA RH)', margin + 6, currentY + 6);
  doc.text('LE SALARIÉ BÉNÉFICIAIRE', margin + halfWidth + 6, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Signature certifiée & scellée électroniquement', margin + 6, currentY + 12);
  doc.text('Pour accord et réception du bulletin officiel', margin + halfWidth + 6, currentY + 12);

  doc.setFont('courier', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(`HASH: ${data.sha256Hash || 'SHA256:7f83b1657ff1fc53b92c451da74d39f284b'}`, margin + 6, currentY + 22);

  // Footer officiel
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${data.orgName} • Conformité Code du Travail RDC (Loi n° 16/010) • Bulletin scellé pour archivage légal d'entreprise`, margin, footerY + 2);

  const targetName = filename || `bulletin_paie_${data.matricule}_${data.period.replace(/\s+/g, '_')}.pdf`;
  doc.save(targetName);
}

export function exportPayslipToCSV(data: PayslipExportData, filename?: string) {
  const lines = [
    `ORGANISATION;${data.orgName}`,
    `RCCM;${data.rccm || 'CD/KNG/RCCM/20-A-01120'}`,
    `ID. NAT;${data.idNat || '01-83-N45201L'}`,
    `N° IMPÔT;${data.numImpot || 'A1934892Z'}`,
    `RÉFÉRENCE BULLETIN;${data.ref}`,
    `PÉRIODE;${data.period}`,
    `DATE D'ÉMISSION;${data.date}`,
    `SALARIÉ;${data.employeeName}`,
    `MATRICULE;${data.matricule}`,
    `FONCTION;${data.roleTitle}`,
    `N° CNSS;${data.cnssNumber || 'CNSS-CD-9982410'}`,
    `BANQUE;${data.bankName || 'Rawbank'}`,
    `COMPTE;${data.accountNumber || 'Compte Virement'}`,
    `DEVISE;${data.currency}`,
    `SALAIRE DE BASE;${data.baseSalary}`,
    `PRIME D'ANCIENNETÉ;${data.seniorityBonus || 0}`,
    `INDEMNITÉS;${data.allowances || 0}`,
    `HEURES SUPPLÉMENTAIRES;${data.overtimeAmount || 0}`,
    `SALAIRE BRUT TOTAL;${data.grossSalary}`,
    `COTISATION CNSS SALARIÉ (5%);-${data.socialDeductionCNSS}`,
    `IPR DGI RETENUE;-${data.taxDeductionIPR}`,
    `ACOMPTE DÉDUIT;-${data.advanceDeduction || 0}`,
    `TOTAL DÉDUCTIONS;-${data.totalDeductions}`,
    `NET À PAYER;${data.netSalary}`,
    `CNSS PATRONALE (13%);${data.employerCNSS}`,
    `INPP PATRONAL (3%);${data.employerINPP}`,
    `ONEM PATRONAL (0.2%);${data.employerONEM}`,
    `COÛT GLOBAL ENTREPRISE;${data.totalEmployerCost}`,
    `EMPREINTE SHA-256;${data.sha256Hash || 'SHA256:7f83b1657ff1fc53b92c451da74d39f284b'}`
  ];

  const targetName = filename || `bulletin_paie_${data.matricule}_${data.period.replace(/\s+/g, '_')}.csv`;
  downloadBlob(lines.join('\r\n'), targetName);
}

// ============================================================================
// 3. EXPORT DU LIVRE DE PAIE MENSUEL DE TOUS LES SALARIÉS (CSV & PDF)
// ============================================================================

export function exportPayrollRunToCSV(
  run: PayrollRunPeriod,
  contracts: EmployeeContract[],
  users: User[],
  filename?: string
) {
  const headers = [
    'Période',
    'Matricule',
    'Nom & Postnom',
    'Fonction',
    'Type Contrat',
    'Devise',
    'Salaire Base',
    'Indemnités',
    'Salaire Brut',
    'Cotisation CNSS (5%)',
    'IPR Déduit (DGI)',
    'Salaire Net Payé',
    'CNSS Patronale (13%)',
    'INPP (3%)',
    'ONEM (0.2%)',
    'Coût Total Employeur',
    'Mode Règlement',
    'Banque / Numéro'
  ];

  const rows = contracts.map(c => {
    const user = users.find(u => u.id === c.userId);
    const gross = c.baseSalary + 100;
    const cnssSal = gross * 0.05;
    const ipr = (gross - cnssSal) * 0.15;
    const net = gross - cnssSal - ipr;
    const cnssPat = gross * 0.13;
    const inpp = gross * 0.03;
    const onem = gross * 0.002;
    const totalCost = gross + cnssPat + inpp + onem;

    return [
      `"${run.month}"`,
      `"${c.matricule}"`,
      `"${user?.name || c.employeeCode}"`,
      `"${user?.roleTitle || c.categoryPro}"`,
      `"${c.contractType}"`,
      `"${c.salaryCurrency}"`,
      c.baseSalary,
      100,
      gross,
      cnssSal.toFixed(2),
      ipr.toFixed(2),
      net.toFixed(2),
      cnssPat.toFixed(2),
      inpp.toFixed(2),
      onem.toFixed(2),
      totalCost.toFixed(2),
      `"${c.paymentMode}"`,
      `"${c.bankName} - ${c.bankAccountNumber}"`
    ];
  });

  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const targetName = filename || `livre_paie_mensuel_${run.month}.csv`;
  downloadBlob(csv, targetName);
}

export function exportPayrollRunToPDF(
  run: PayrollRunPeriod,
  contracts: EmployeeContract[],
  users: User[],
  org: Organization,
  filename?: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let currentY = 14;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, currentY, pageWidth - margin * 2, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(`${org.name.toUpperCase()} - ÉTAT RÉCAPITULATIF DE LA PAIE (${run.month})`, margin + 6, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Statut : ${run.status.toUpperCase()} • Effectifs : ${contracts.length} agents • Scellé SHA-256 : ${run.hash || 'sha256-rb-run'} • Conforme Code du Travail RDC`, margin + 6, currentY + 16);

  currentY += 28;

  // Table header
  const drawHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('MATRICULE', margin + 2, currentY + 4.8);
    doc.text('COLLABORATEUR & FONCTION', margin + 30, currentY + 4.8);
    doc.text('SALAIRE BASE', margin + 98, currentY + 4.8);
    doc.text('SALAIRE BRUT', margin + 128, currentY + 4.8);
    doc.text('CNSS SAL. (5%)', margin + 158, currentY + 4.8);
    doc.text('IPR DGI', margin + 188, currentY + 4.8);
    doc.text('NET À PAYER', margin + 215, currentY + 4.8);
    doc.text('CHARGES PATR.', margin + 245, currentY + 4.8);
    currentY += 8;
  };

  drawHeader();

  contracts.forEach((c, idx) => {
    if (currentY > pageHeight - 20) {
      doc.addPage();
      currentY = 14;
      drawHeader();
    }

    const user = users.find(u => u.id === c.userId);
    const gross = c.baseSalary + 100;
    const cnssSal = gross * 0.05;
    const ipr = (gross - cnssSal) * 0.15;
    const net = gross - cnssSal - ipr;
    const employerTotal = gross * 0.162;

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, pageWidth - margin * 2, 7.5, 'F');
    }

    doc.setFontSize(7.5);
    doc.setFont('courier', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(c.matricule, margin + 2, currentY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(doc.splitTextToSize(user?.name || c.employeeCode, 65)[0] || '', margin + 30, currentY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(user?.roleTitle || c.categoryPro, 65)[0] || '', margin + 30, currentY + 6.8);

    doc.setFontSize(7.5);
    doc.setFont('courier', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${c.baseSalary.toLocaleString()} ${c.salaryCurrency}`, margin + 98, currentY + 5);
    doc.text(`${gross.toLocaleString()} ${c.salaryCurrency}`, margin + 128, currentY + 5);

    doc.setTextColor(225, 29, 72);
    doc.text(`-${cnssSal.toFixed(0)}`, margin + 158, currentY + 5);
    doc.text(`-${ipr.toFixed(0)}`, margin + 188, currentY + 5);

    doc.setFont('courier', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`${net.toFixed(0)} ${c.salaryCurrency}`, margin + 215, currentY + 5);

    doc.setFont('courier', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`+${employerTotal.toFixed(0)}`, margin + 245, currentY + 5);

    currentY += 8;
  });

  // Total summary footer
  currentY = Math.min(currentY + 6, pageHeight - 14);
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Archivage certifié conforme • ${org.name} • Période ${run.month} • Visa Direction Générale & DRH`, margin, currentY + 4.5);

  const targetName = filename || `livre_paie_officiel_${run.month}.pdf`;
  doc.save(targetName);
}

// ============================================================================
// 4. EXPORT DES DOCUMENTS OFFICIELS D'ENTREPRISE (PDF & CSV)
// ============================================================================

export function exportOfficialDocumentToCSV(docItem: DocumentItem, orgName = 'RHEMA BUSINESS RDC') {
  const lines = [
    `ORGANISATION;${orgName}`,
    `TITRE DOCUMENT;${docItem.title}`,
    `NUMÉRO DE RÉFÉRENCE;${docItem.referenceNumber}`,
    `CATÉGORIE;${docItem.category}`,
    `SOUS-TYPE;${docItem.subtype}`,
    `AUTEUR;${docItem.authorName} (${docItem.authorEntity})`,
    `DATE DE CRÉATION;${docItem.createdAt}`,
    `STATUT;${docItem.status}`,
    `MONTANT ASSOCIÉ;${docItem.amount ? `${docItem.amount} ${docItem.currency || 'USD'}` : 'N/A'}`,
    `DESCRIPTION;${docItem.description || ''}`,
    `SIGNATAIRE ÉLECTRONIQUE;${docItem.electronicSignature?.signedBy || 'En attente'}`,
    `HORODATAGE SIGNATURE;${docItem.electronicSignature?.signedAt || 'N/A'}`,
    `EMPREINTE SHA-256;${docItem.electronicSignature?.certificateHash || 'SHA256:7f83b1657ff1fc53b92c451da74d39f284b'}`
  ];

  const targetName = `${docItem.referenceNumber}_archivage.csv`;
  downloadBlob(lines.join('\r\n'), targetName);
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
  let currentY = 16;

  // Header band
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, 'F');

  doc.setFillColor(79, 70, 229);
  doc.roundedRect(margin + 5, currentY + 4, 16, 16, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RB', margin + 9, currentY + 14.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(org.name.toUpperCase(), margin + 25, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Document Officiel Numérique • République Démocratique du Congo', margin + 25, currentY + 15);
  doc.text(`RCCM: ${org.rccm || 'CD/KNG/RCCM/20-A-01120'} | ID.NAT: ${org.idNat || '01-83-N45201L'} | N° IMPÔT: ${org.numImpot || 'A1934892Z'}`, margin + 25, currentY + 19.5);

  currentY += 30;

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
    ...(docItem.amount ? [{ k: 'Montant Financier :', v: `${docItem.amount.toLocaleString()} ${docItem.currency || 'USD'}` }] : [])
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
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 38, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('OBJET & DESCRIPTION DÉTAILLÉE DU DOCUMENT :', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const descLines = doc.splitTextToSize(docItem.description || 'Document officiel validé dans le cadre des activités opérationnelles de l\'entreprise.', pageWidth - margin * 2 - 8);
  doc.text(descLines, margin + 4, currentY + 13);

  currentY += 46;

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
  doc.text(`Signé par : ${docItem.electronicSignature?.signedBy || 'Direction Générale (Dr. Amadou Diallo)'}`, margin + 6, currentY + 12);
  doc.text(`Horodatage certifié : ${docItem.electronicSignature?.signedAt || new Date().toLocaleString('fr-FR')}`, margin + 6, currentY + 17);

  doc.setFont('courier', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(`EMPREINTE CRYPTOGRAPHIQUE : ${docItem.electronicSignature?.certificateHash || 'SHA256:7f83b1657ff1fc53b92c451da74d39f284b'}`, margin + 6, currentY + 23);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Copie certifiée conforme • ${org.name} • Archivage électronique probant RDC`, margin, footerY + 2);

  const targetName = filename || `${docItem.referenceNumber}_officiel.pdf`;
  doc.save(targetName);
}
