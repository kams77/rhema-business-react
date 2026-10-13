// Exports PDF avec l'identité visuelle de l'organisation : logo, papier à en-tête, pied de page.
// Usage (depuis la racine du projet) :
//   esbuild src/lib/__tests__/pdf-branding.test.ts --bundle --platform=node --format=esm \
//     --define:import.meta.env={} --outfile=/tmp/pdf-branding.test.mjs && node /tmp/pdf-branding.test.mjs
// Les PDF produits sont écrits dans le dossier PDF_OUT (par défaut /tmp/pdf-branding) pour les relire.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import type { Organization } from '../../types';
import {
  exportApprovalSlipToPDF,
  exportAuditLogsToPDF,
  exportOfficialDocumentToPDF,
  exportPayrollRunToPDF,
  exportPayslipToPDF,
} from '../../utils/exportUtils';
// @ts-ignore — module JavaScript partagé avec le serveur
import { isSafeImageDataUrl, LOGO_MAX_CHARS, BANNER_MAX_CHARS } from '../../../shared/branding.mjs';

let passed = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); passed++; console.log(`✓ ${msg}`); };

const OUT = process.env.PDF_OUT || '/tmp/pdf-branding';
fs.mkdirSync(OUT, { recursive: true });
// Dans Node, « save » écrit le PDF dans OUT au lieu de le télécharger.
(jsPDF.prototype as any).save = function save(this: jsPDF, name: string) {
  fs.writeFileSync(path.join(OUT, name), Buffer.from(this.output('arraybuffer')));
  return this;
};

const FIX = path.join(process.cwd(), 'src/lib/__tests__/fixtures');
const dataUrl = (file: string, type: string) => `data:${type};base64,${fs.readFileSync(path.join(FIX, file)).toString('base64')}`;
const logo = dataUrl('logo.png', 'image/png');
const headerImage = dataUrl('entete.jpg', 'image/jpeg');
const footerImage = dataUrl('pied.jpg', 'image/jpeg');
ok(isSafeImageDataUrl(logo, LOGO_MAX_CHARS) && isSafeImageDataUrl(headerImage, BANNER_MAX_CHARS) && isSafeImageDataUrl(footerImage, BANNER_MAX_CHARS),
  'images d\'exemple acceptées par le contrôle du serveur');

const base: Organization = {
  id: 'o', name: 'KIVU LOGISTIQUE SARL', type: 'entreprise', registrationNumber: 'CD/GOM/RCCM/24-B-00123',
  rccm: 'CD/GOM/RCCM/24-B-00123', idNat: '19-H5300-N12345K', numImpot: 'A2400123X', headquarters: '45, av. du Lac, Goma',
  email: 'contact@kivu-logistique.example', phone: '+243 990 000 000', hasDepartements: true, hasDirections: true,
  hasDivisions: true, hasServices: true, description: '', createdAt: '2026-10-13',
};
const auto: Organization = { ...base, logo, branding: { slogan: 'Transport • Entreposage • Dédouanement', color: '#0d6e6e', footerText: 'Siège : 45, av. du Lac, Goma • Tél. +243 990 000 000\nRCCM CD/GOM/RCCM/24-B-00123 • Id. Nat 19-H5300-N12345K • N° Impôt A2400123X' } };
const letterhead: Organization = { ...base, logo, branding: { color: '#0d6e6e', headerImage, footerImage } };
const plain: Organization = { ...base, name: 'ENTREPRISE SANS LOGO' };

const docItem: any = {
  id: 'd1', title: 'Note de service n° 12 — Horaires de fin d\'année', referenceNumber: 'NS-2026-012', category: 'administratif_general',
  subtype: 'note_service', status: 'signe', authorName: 'Aline Kahindo', authorEntity: 'Direction des Ressources Humaines',
  createdAt: '2026-10-13', description: 'Les bureaux fermeront à 15 h du 24 au 31 décembre.\n'.repeat(4),
  electronicSignature: { signedBy: 'Jean Bahati (Directeur Général)', signedAt: '13/10/2026 10:12', certificateHash: 'a'.repeat(64) },
};

const pagesOf = (file: string) => (fs.readFileSync(path.join(OUT, file), 'latin1').match(/\/Type \/Page\b/g) || []).length;
const imagesOf = (file: string) => (fs.readFileSync(path.join(OUT, file), 'latin1').match(/\/Subtype \/Image/g) || []).length;

exportOfficialDocumentToPDF(docItem, letterhead, 'document-papier-entete.pdf');
ok(imagesOf('document-papier-entete.pdf') >= 2, 'document officiel : papier à en-tête et image de pied de page intégrés');
exportOfficialDocumentToPDF(docItem, auto, 'document-entete-auto.pdf');
ok(imagesOf('document-entete-auto.pdf') >= 1, 'document officiel : en-tête automatique avec le logo');
exportOfficialDocumentToPDF(docItem, plain, 'document-sans-logo.pdf');
ok(imagesOf('document-sans-logo.pdf') === 0 && pagesOf('document-sans-logo.pdf') === 1, 'document officiel : sans logo, initiales et coordonnées');

const logs = Array.from({ length: 70 }, (_, i) => ({
  id: `l${i}`, timestamp: `2026-10-13 09:${String(i % 60).padStart(2, '0')}:00`, userName: 'Aline Kahindo', userRole: 'DRH',
  action: i % 9 ? 'Consultation d\'un document' : 'Alerte : accès refusé', category: i % 9 ? 'document' : 'security',
  details: 'Détail de l\'événement', ip: '10.0.0.4', hash: 'b'.repeat(64),
})) as any;
exportAuditLogsToPDF(logs, letterhead, 'journal-audit.pdf');
ok(pagesOf('journal-audit.pdf') >= 3, 'journal d\'audit : plusieurs pages, pied de page sur chacune');
exportAuditLogsToPDF(logs.slice(0, 3), 'Organisation texte seul', 'journal-audit-nom-seul.pdf');
ok(pagesOf('journal-audit-nom-seul.pdf') === 1, 'journal d\'audit : appel avec le seul nom toujours accepté');

exportApprovalSlipToPDF({
  id: 't1', title: 'Achat de 4 pneus pour le camion GO-1234', description: '', priority: 'haute', dueDate: '2026-10-20',
  initiator: 'Service Parc Auto', assignedEntity: 'Département Logistique',
  steps: [{ id: 's1', label: 'Visa du chef de service', completed: true, validatedBy: 'P. Mumbere' }, { id: 's2', label: 'Approbation DG', completed: false }],
  intervenants: [{ name: 'P. Mumbere', roleTitle: 'Chef de service', roleBadge: 'chef_service' }],
  electronicSignature: null,
}, auto, 'bordereau-visa.pdf');
ok(fs.existsSync(path.join(OUT, 'bordereau-visa.pdf')), 'bordereau de visa : en-tête de l\'organisation');

const run: any = { id: 'r', month: '2026-09', title: 'Paie Septembre 2026', currency: 'USD', status: 'valide_drh' };
const rows = Array.from({ length: 45 }, (_, i) => ({
  contract: { matricule: `MAT-${100 + i}`, employeeCode: `E${i}`, categoryPro: 'Agent', contractType: 'CDI', paymentMode: 'virement' },
  user: { name: `Agent ${i + 1}`, roleTitle: 'Magasinier' },
  payslip: { currency: 'USD', baseSalary: 500, totalAllowances: 50, seniorityBonus: 10, overtimeAmount: 0, grossSalary: 560, totalEmployeeContributions: 28, totalTaxes: 40, advanceDeduction: 0, netSalary: 492, totalEmployerContributions: 70, totalEmployerCost: 630 },
})) as any;
exportPayrollRunToPDF(run, rows, letterhead, 'livre-paie.pdf');
ok(pagesOf('livre-paie.pdf') >= 2, 'livre de paie : en-tête image et pagination');

const payslip: any = {
  orgName: base.name, rccm: base.rccm, idNat: base.idNat, numImpot: base.numImpot, headquarters: base.headquarters,
  ref: 'BP-2026-09-001', period: 'Septembre 2026', date: '30/09/2026', employeeName: 'Aline Kahindo', matricule: 'MAT-001',
  roleTitle: 'DRH', currency: 'USD', baseSalary: 1500, seniorityBonus: 50, allowances: 200, overtimeAmount: 0, grossSalary: 1750,
  socialDeductionCNSS: 87.5, taxDeductionIPR: 210, advanceDeduction: 0, totalDeductions: 297.5, netSalary: 1452.5, counterValueCDF: 4100000,
  employerCNSS: 157.5, employerINPP: 35, employerONEM: 3.5, totalEmployerCost: 1946,
  earnings: [{ label: 'Salaire de base', base: '1 500', amount: 1500 }], deductions: [{ label: 'CNSS 5 %', base: '1 750', amount: 87.5 }], employerLines: [],
};
exportPayslipToPDF(payslip, false, 'bulletin.pdf', auto);
exportPayslipToPDF(payslip, true, 'bulletin-specimen.pdf');
ok(imagesOf('bulletin.pdf') >= 1 && fs.existsSync(path.join(OUT, 'bulletin-specimen.pdf')), 'bulletin de paie : logo de l\'organisation (et sans organisation fournie)');

console.log(`\n${passed} vérifications des en-têtes et pieds de page PDF réussies (fichiers dans ${OUT}).`);
