// Tests des utilitaires de données : montants, CSV, numérotation, dates, pointages, taux de change.
// Usage : esbuild src/lib/__tests__/donnees.test.ts --bundle --platform=node --format=esm --outfile=/tmp/donnees.test.mjs && node /tmp/donnees.test.mjs
import assert from 'node:assert/strict';
import { parseAmount, round2, usdToCdf, cdfToUsd, sameAmount } from '../money';
import { parseCsv, cellGetter, parseDateCell, parseMonthCell, csvEscape } from '../csv';
import { nextReference, nextReferences, secureDigits, maskSecret } from '../sequence';
import { toLocalISODate, addDaysLocal, workingDaysBetween, parseLocalDate } from '../dates';
import { summarizeAttendance, periodStartForWorkingDays, workedSeconds, type AttendancePunch } from '../attendance';
import { normalizeRateSetting, rateAgeDays, isValidRate } from '../exchangeRateModel';

let passed = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); passed++; console.log(`✓ ${msg}`); };
const eq = (a: unknown, b: unknown, msg: string) => { assert.deepEqual(a, b, msg); passed++; console.log(`✓ ${msg}`); };

// --- Montants ---------------------------------------------------------------
eq(parseAmount('1200,50'), 1200.5, 'montant : virgule décimale (Excel FR)');
eq(parseAmount('1 200,50'), 1200.5, 'montant : espace des milliers');
eq(parseAmount('1 200,50'), 1200.5, 'montant : espace fine insécable');
eq(parseAmount('1.200,50'), 1200.5, 'montant : point des milliers + virgule décimale');
eq(parseAmount('1,200.50'), 1200.5, 'montant : format anglais');
eq(parseAmount('1,200,000'), 1200000, 'montant : virgules des milliers');
eq(parseAmount('$ 950'), 950, 'montant : symbole monétaire ignoré');
eq(parseAmount('0'), 0, 'montant : un vrai 0 reste 0');
eq(parseAmount(''), null, 'montant : cellule vide = null (pas de valeur inventée)');
eq(parseAmount('abc'), null, 'montant : texte illisible = null');
eq(round2(0.1 + 0.2), 0.3, 'arrondi au centime');
eq(usdToCdf(9576.6, 2850), 27293310, 'conversion USD -> CDF arrondie au franc');
eq(cdfToUsd(2850, 2850), 1, 'conversion CDF -> USD');
ok(sameAmount(100, 100.004) && !sameAmount(100, 100.01), 'comparaison au centime près');

// --- CSV --------------------------------------------------------------------
const csv = parseCsv('﻿Nom;Entité;Salaire\n"Mbuyi, Jean";"Service N\'Sele";"1 200,50"\n"Kasa ""Junior""";Compta;950\n\n');
eq(csv.separator, ';', 'CSV : séparateur « ; » détecté');
eq(csv.headers, ['nom', 'entite', 'salaire'], 'CSV : en-têtes normalisés (accents retirés)');
eq(csv.rows[0], ['Mbuyi, Jean', "Service N'Sele", '1 200,50'], 'CSV : virgule et apostrophe dans un champ entre guillemets');
eq(csv.rows[1][0], 'Kasa "Junior"', 'CSV : guillemets doublés');
eq(csv.rows.length, 2, 'CSV : lignes vides ignorées');
eq(cellGetter(csv.headers, csv.rows[0])(['entité']), "Service N'Sele", 'CSV : accès par nom de colonne accentué');
eq(parseCsv('a,b\n1,"x\ny"').rows[0][1], 'x\ny', 'CSV : retour à la ligne dans un champ');
eq(parseDateCell('15/01/2025'), '2025-01-15', 'date JJ/MM/AAAA');
eq(parseDateCell('2024-02-30'), null, 'date impossible refusée');
eq(parseMonthCell('08/2026'), '2026-08', 'période MM/AAAA');
eq(csvEscape('a;b'), '"a;b"', 'export CSV : échappement');

// --- Numérotation -----------------------------------------------------------
eq(nextReference('FAC-VSAT', ['FAC-VSAT-2026-001', 'FAC-VSAT-2026-007', 'FAC-VSAT-2025-099'], 3, 2026), 'FAC-VSAT-2026-008', 'référence : plus grand numéro de l\'année + 1');
eq(nextReference('FAC-VSAT', ['FAC-VSAT-2026-001', 'FAC-VSAT-2026-003'], 3, 2026), 'FAC-VSAT-2026-004', 'référence : pas de doublon après une suppression');
eq(nextReference('MAT', ['FAC-2027-010'], 3, 2027), 'MAT-2027-001', 'référence : repart à 1 chaque année');
eq(nextReferences('INV', [], 2).length, 2, 'références multiples');
ok(new Set(nextReferences('INV', [], 50)).size === 50, 'références multiples toutes différentes');
ok(/^[1-9]\d{9}$/.test(secureDigits(10)), 'clé de 10 chiffres sans zéro initial');
eq(maskSecret('4812345621'), '48••••••21', 'clé masquée dans les journaux');

// --- Dates ------------------------------------------------------------------
eq(toLocalISODate(new Date(2026, 9, 6, 0, 30)), '2026-10-06', 'date locale à 00h30 (pas la veille)');
eq(addDaysLocal(30, '2026-10-06'), '2026-11-05', 'ajout de jours');
eq(workingDaysBetween('2026-10-05', '2026-10-11'), 6, 'jours ouvrables : lundi → dimanche = 6');
eq(workingDaysBetween('2026-10-10', '2026-10-05'), 0, 'plage inversée = 0');
eq(periodStartForWorkingDays(6, '2026-10-10'), '2026-10-05', 'début de période sur 6 jours ouvrables');

// --- Pointages --------------------------------------------------------------
const at = (d: string, h: number, m = 0) => { const x = parseLocalDate(d)!; x.setHours(h, m, 0, 0); return x.toISOString(); };
const punches: AttendancePunch[] = [
  { id: '1', userId: 'u', userName: 'U', date: '2026-10-05', arrivalAt: at('2026-10-05', 8), departureAt: at('2026-10-05', 17), breaks: [{ start: at('2026-10-05', 12), end: at('2026-10-05', 13) }] },
  { id: '2', userId: 'u', userName: 'U', date: '2026-10-06', arrivalAt: at('2026-10-06', 14), departureAt: at('2026-10-06', 24), breaks: [] },
  { id: '3', userId: 'u', userName: 'U', date: '2026-10-11', arrivalAt: at('2026-10-11', 9), departureAt: at('2026-10-11', 12), breaks: [] },
  { id: '4', userId: 'u', userName: 'U', date: '2026-10-07', arrivalAt: at('2026-10-07', 8), breaks: [] },
  { id: '5', userId: 'autre', userName: 'A', date: '2026-10-05', arrivalAt: at('2026-10-05', 8), departureAt: at('2026-10-05', 20), breaks: [] },
];
eq(workedSeconds(punches[0]) / 3600, 8, 'temps effectif : pause déduite');
const sum = summarizeAttendance(punches, 'u', '2026-10-05', '2026-10-11');
eq(sum.daysWorked, 3, 'jours pointés complets');
eq(sum.normalHours, 16, 'heures normales plafonnées à 8 h/jour');
eq(sum.overtimeNight, 2, 'heures sup. de nuit (22 h – minuit)');
eq(sum.overtimeDay, 0, 'heures sup. de jour');
eq(sum.overtimeHoliday, 3, 'heures du dimanche');
eq(sum.incompleteDays, 1, 'jour sans départ signalé, non compté');

// --- Taux de change ---------------------------------------------------------
eq(normalizeRateSetting(2900), { rate: 2900, date: null }, 'taux : reprise de l\'ancien format (nombre)');
eq(normalizeRateSetting({ rate: -1 }).rate, 2850, 'taux invalide remplacé par la valeur par défaut');
ok(isValidRate(2850) && !isValidRate(0) && !isValidRate(NaN), 'validation du taux');
eq(rateAgeDays({ rate: 2850, date: '2026-10-01' }, new Date(2026, 9, 6)), 5, 'âge du taux en jours');

console.log(`\n${passed} vérifications des données réussies.`);
