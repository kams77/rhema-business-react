// Tests du moteur de stock (logique du classeur « Suivi des stocks & transferts inter-sites »).
// Usage : node shared/__tests__/stock.test.mjs
import assert from 'node:assert/strict';
import {
  hubOrgIssues, hubOrgWriteProblem, hubPortalWriteProblem, hubsOfUser, isHubMember, movementTouchesHub,
  availableForExit,
  computeBalances,
  deriveHubStocks,
  isLateTransfer,
  ledgerWriteProblems,
  migrateLegacyStocks,
  monthlyTracking,
  movementIssues,
  negativeKeys,
  siteReport,
  stockStatus,
  transferGap,
  transitDays,
} from '../stock.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`✓ ${name}`); };

const hubs = [{ id: 'gom', name: 'Hub Goma', code: 'GOM' }, { id: 'buk', name: 'Hub Bukavu', code: 'BUK' }, { id: 'kin', name: 'Hub Kinshasa', code: 'KIN' }];
const catalog = [
  { id: 'ant', sku: 'ANT-180', name: 'Antenne 1,8 m', category: 'vsat', unitPriceUSD: 2000, minAlertThreshold: 2 },
  { id: 'pan', sku: 'PAN-450', name: 'Panneau 450 W', category: 'energie_solaire', unitPriceUSD: 150, minAlertThreshold: 5 },
];
const item = (id, quantity, extra = {}) => ({ catalogItemId: id, sku: id, name: id, quantity, unitPriceUSD: 0, serialNumbers: [], ...extra });
const mv = (id, type, sign, hubId, items, date, status = 'valide', extra = {}) => ({
  id, movementNumber: id, type, sign, ...(sign > 0 ? { destinationHubId: hubId } : { sourceHubId: hubId }), items, date, status, ...extra,
});
const tr = (id, from, to, items, date, status, extra = {}) => ({ id, movementNumber: id, type: 'transfert_inter_hub', sourceHubId: from, destinationHubId: to, items, date, status, ...extra });

const base = [
  mv('si-gom', 'stock_initial', 1, 'gom', [item('ant', 10), item('pan', 40)], '2026-01-05'),
  mv('si-buk', 'stock_initial', 1, 'buk', [item('ant', 2)], '2026-01-05'),
  mv('e1', 'entree_fournisseur', 1, 'gom', [item('pan', 20)], '2026-02-10'),
  mv('s1', 'sortie_vente', -1, 'gom', [item('ant', 3)], '2026-02-12'),
  mv('s2', 'sortie_perte', -1, 'gom', [item('pan', 1)], '2026-03-01'),
  mv('s-wait', 'sortie_deploiement', -1, 'gom', [item('ant', 2)], '2026-03-02', 'en_attente_visa'),
  mv('s-rej', 'sortie_deploiement', -1, 'gom', [item('ant', 5)], '2026-03-02', 'rejete'),
];

test('stock = entrées − sorties validées (bons au visa et rejetés sans effet)', () => {
  const b = computeBalances(base);
  assert.equal(b.get('gom', 'ant'), 7);
  assert.equal(b.get('gom', 'pan'), 59);
  assert.equal(b.get('buk', 'ant'), 2);
});

test('disponible pour une sortie = stock − bons encore au visa', () => {
  assert.equal(availableForExit(base, undefined, 'gom', 'ant'), 5);
});

test('transfert : source débitée dès l\'envoi, destination créditée à la réception (quantité reçue)', () => {
  const t = tr('t1', 'gom', 'buk', [item('ant', 4)], '2026-03-05', 'en_transit', { sentAt: '2026-03-05' });
  let b = computeBalances([...base, t]);
  assert.equal(b.get('gom', 'ant'), 3);
  assert.equal(b.get('buk', 'ant'), 2);
  assert.equal(b.inTransit('buk', 'ant'), 4);
  const recu = { ...t, status: 'receptionne', receivedAt: '2026-03-09', receivedQuantities: { ant: 3 } };
  b = computeBalances([...base, recu]);
  assert.equal(b.get('gom', 'ant'), 3);
  assert.equal(b.get('buk', 'ant'), 5);
  assert.equal(b.inTransit('buk', 'ant'), 0);
  assert.equal(transferGap(recu), 1);
  assert.equal(transitDays(recu, '2026-04-01'), 4);
});

test('transfert annulé : aucun effet ; transfert au visa : stock réservé à la source', () => {
  const annule = tr('t2', 'gom', 'buk', [item('ant', 4)], '2026-03-05', 'annule');
  assert.equal(computeBalances([...base, annule]).get('gom', 'ant'), 7);
  const attente = tr('t3', 'gom', 'buk', [item('ant', 4)], '2026-03-05', 'en_attente_visa');
  assert.equal(availableForExit([...base, attente], undefined, 'gom', 'ant'), 1);
});

test('transfert en retard au-delà du délai d\'alerte (15 jours par défaut)', () => {
  const t = tr('t4', 'gom', 'kin', [item('pan', 2)], '2026-03-01', 'en_transit', { sentAt: '2026-03-01' });
  assert.equal(isLateTransfer(t, undefined, '2026-03-16'), false);
  assert.equal(isLateTransfer(t, undefined, '2026-03-17'), true);
  assert.equal(isLateTransfer(t, { transitAlertDays: 30 }, '2026-03-17'), false);
});

test('contrôles : source = destination, reçu > envoyé, réception avant envoi, quantité invalide, stock négatif', () => {
  const ctx = { catalog, hubs };
  assert.ok(movementIssues(tr('x', 'gom', 'gom', [item('ant', 1)], '2026-03-01', 'en_transit'), ctx).includes('Source = Destination'));
  const r = tr('y', 'gom', 'buk', [item('ant', 2)], '2026-03-05', 'receptionne', { sentAt: '2026-03-05', receivedAt: '2026-03-04', receivedQuantities: { ant: 3 } });
  const issues = movementIssues(r, ctx);
  assert.ok(issues.includes('Réception avant envoi') && issues.some(i => i.startsWith('Reçu > Envoyé')));
  assert.ok(movementIssues(mv('z', 'sortie_vente', -1, 'gom', [item('ant', 0)], '2026-03-01'), ctx).some(i => i.startsWith('Quantité invalide')));
  const trop = [...base, mv('s3', 'sortie_vente', -1, 'buk', [item('ant', 5)], '2026-03-03')];
  const neg = negativeKeys(trop);
  assert.ok(movementIssues(trop.at(-1), { ...ctx, negatives: neg }).includes('Stock négatif'));
  assert.deepEqual(movementIssues(base[2], { ...ctx, negatives: neg }), []);
});

test('serveur : refuse une écriture qui rend un stock négatif, accepte le reste', () => {
  const after = [...base, mv('s4', 'sortie_vente', -1, 'buk', [item('ant', 3)], '2026-03-03')];
  assert.equal(ledgerWriteProblems(base, after).length, 1);
  assert.deepEqual(ledgerWriteProblems(base, [...base, mv('s5', 'sortie_vente', -1, 'buk', [item('ant', 2)], '2026-03-03')]), []);
  const bad = [...base, tr('t9', 'gom', 'buk', [item('ant', 1)], '2026-03-05', 'receptionne', { receivedAt: '2026-03-06', receivedQuantities: { ant: 2 } })];
  assert.ok(ledgerWriteProblems(base, bad).some(p => p.includes('Reçu > Envoyé')));
});

test('rapport de site : ouverture, entrées, sorties, transferts, clôture et statut', () => {
  const t = tr('t5', 'gom', 'buk', [item('pan', 10)], '2026-03-05', 'receptionne', { sentAt: '2026-03-05', receivedAt: '2026-03-08' });
  const rows = siteReport([...base, t], catalog, undefined, 'gom', '2026-02-01', '2026-03-31');
  const pan = rows.find(r => r.itemId === 'pan');
  assert.deepEqual([pan.opening, pan.entries, pan.exits, pan.sent, pan.received, pan.closing], [40, 20, 1, 10, 0, 49]);
  const ant = rows.find(r => r.itemId === 'ant');
  assert.equal(ant.closing, 7);
  assert.equal(ant.status, 'OK');
  assert.equal(stockStatus(1, 2), 'STOCK BAS');
  assert.equal(stockStatus(0, 2), 'RUPTURE');
  assert.equal(stockStatus(-1, 2), 'NÉGATIF');
});

test('suivi mensuel : entrées et sorties par catégorie, sans le stock initial', () => {
  const months = monthlyTracking(base, catalog, undefined, 2026, undefined);
  assert.equal(months[0].entries, 0);
  assert.equal(months[1].entries, 20);
  assert.equal(months[1].byCategory.vsat.exits, 3);
  assert.equal(months[2].exits, 1);
});

test('reprise des anciens stocks : les quantités ne changent pas, les transferts en cours se réceptionnent', () => {
  const legacy = [
    { hubId: 'gom', catalogItemId: 'ant', sku: 'ANT-180', name: 'Antenne', quantityAvailable: 6, quantityInTransit: 0, minAlertThreshold: 3, unitPriceUSD: 2000, serialNumbers: ['A1', 'A2'] },
    { hubId: 'buk', catalogItemId: 'ant', sku: 'ANT-180', name: 'Antenne', quantityAvailable: 1, quantityInTransit: 2, minAlertThreshold: 2, unitPriceUSD: 2000, serialNumbers: [] },
  ];
  const old = [
    mv('old-e', 'entree_fournisseur', 1, 'gom', [item('ant', 4)], '2025-12-01'),
    tr('old-t', 'gom', 'buk', [item('ant', 2)], '2025-12-03', 'en_transit', { approvedAt: '2025-12-03 10:00' }),
    mv('old-w', 'sortie_deploiement', -1, 'gom', [item('ant', 1)], '2025-12-04', 'en_attente_visa'),
  ];
  const { movements, thresholds } = migrateLegacyStocks(legacy, old, hubs, '2026-01-01');
  assert.equal(thresholds.ant, 3);
  let b = computeBalances(movements);
  assert.equal(b.get('gom', 'ant'), 6);
  assert.equal(b.get('buk', 'ant'), 1);
  assert.equal(b.inTransit('buk', 'ant'), 2);
  const received = movements.map(m => (m.id === 'old-t' ? { ...m, status: 'receptionne', receivedAt: '2026-01-02' } : m));
  b = computeBalances(received);
  assert.equal(b.get('gom', 'ant'), 6);
  assert.equal(b.get('buk', 'ant'), 3);
  const validatedLater = movements.map(m => (m.id === 'old-w' ? { ...m, status: 'valide' } : m));
  assert.equal(computeBalances(validatedLater).get('gom', 'ant'), 5);
  const rows = deriveHubStocks(movements, catalog, hubs, undefined, legacy, '2026-01-01');
  const g = rows.find(r => r.hubId === 'gom' && r.catalogItemId === 'ant');
  assert.equal(g.quantityAvailable, 6);
  assert.deepEqual(g.serialNumbers.sort(), ['A1', 'A2']);
  assert.equal(g.quantityReserved, 1);
  assert.equal(rows.find(r => r.hubId === 'buk').quantityInTransit, 2);
});

test('portails des hubs : équipe, saisie et réception limitées au site', () => {
  const hubsP = [{ id: 'gom', name: 'Goma', managerId: 'u-chef', staffIds: ['u-mag'] }, { id: 'buk', name: 'Bukavu', managerId: 'u-buk' }];
  const mag = { id: 'u-mag' };
  assert.ok(isHubMember(mag, hubsP[0]) && !isHubMember(mag, hubsP[1]));
  assert.deepEqual(hubsOfUser({ id: 'u-chef' }, hubsP).map(h => h.id), ['gom']);
  const sortieGom = mv('s1', 'sortie_vente', -1, 'gom', [item('ant', 1)], '2026-03-01', 'en_attente_visa');
  const sortieBuk = mv('s2', 'sortie_vente', -1, 'buk', [item('ant', 1)], '2026-03-01', 'en_attente_visa');
  assert.equal(hubPortalWriteProblem(mag, [], [sortieGom], hubsP), null);
  assert.match(hubPortalWriteProblem(mag, [], [sortieBuk], hubsP), /équipe du site « Bukavu »/);
  const t = tr('t1', 'buk', 'gom', [item('ant', 1)], '2026-03-01', 'en_transit');
  assert.ok(movementTouchesHub(t, 'gom') && movementTouchesHub(t, 'buk') && !movementTouchesHub(t, 'kin'));
  assert.equal(hubPortalWriteProblem(mag, [t], [{ ...t, status: 'receptionne', receivedAt: '2026-03-02' }], hubsP), null);
  const t2 = tr('t2', 'gom', 'buk', [item('ant', 1)], '2026-03-01', 'en_transit');
  assert.match(hubPortalWriteProblem(mag, [t2], [{ ...t2, status: 'receptionne', receivedAt: '2026-03-02' }], hubsP), /Bukavu/);
  // Les visas du circuit (changement de statut d'un bon existant) restent possibles.
  assert.equal(hubPortalWriteProblem(mag, [sortieBuk], [{ ...sortieBuk, status: 'valide' }], hubsP), null);
});

test("organigramme d'un hub : structure et droits", () => {
  const c = (id, name, parentId) => ({ id, name, parentId, members: [] });
  assert.deepEqual(hubOrgIssues([c('a', 'Réception'), c('b', 'Magasin', 'a')]), []);
  assert.ok(hubOrgIssues([c('a', 'Réception'), c('b', 'réception')]).some(i => i.includes('existe déjà')));
  assert.ok(hubOrgIssues([c('a', 'A', 'b'), c('b', 'B', 'a')]).some(i => i.includes('elle-même')));
  assert.ok(hubOrgIssues([c('a', 'A', 'zz')]).some(i => i.includes('inconnue')));
  const hubsO = [{ id: 'gom', name: 'Goma', managerId: 'u1', staffIds: ['u2'] }, { id: 'buk', name: 'Bukavu', managerId: 'u3' }];
  assert.equal(hubOrgWriteProblem({ id: 'u1' }, {}, { gom: [c('a', 'A')] }, hubsO), null);
  assert.match(hubOrgWriteProblem({ id: 'u2' }, {}, { gom: [c('a', 'A')] }, hubsO), /responsable du site « Goma »/);
  assert.match(hubOrgWriteProblem({ id: 'u1' }, { buk: [] }, { buk: [c('a', 'A')] }, hubsO), /Bukavu/);
});

console.log(`\n${n} tests du moteur de stock réussis.`);
