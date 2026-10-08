// Tests du circuit de validation (documents et tâches) — sans dépendance.
// Usage : node shared/__tests__/workflow.test.mjs
import assert from 'node:assert/strict';
import {
  buildDocumentChain, submitDocument, decideDocument, canActOnDocument, currentStep,
  canWriteDocumentChange, canDeleteDocument, documentType,
  buildTaskApprovalChain, canSeeTask, canValidateTaskNow, canTickTaskStep, canWriteTaskChange,
} from '../workflow.mjs';
import { canSeeDocument, canAccessLogistics, isLogisticsManager } from '../access.mjs';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`✓ ${name}`); } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exit(1); }
};

// --- Organigramme de démonstration ---------------------------------------------
const entities = [
  { id: 'dept-daf', name: 'Département Administration Générale & Finances (DAF)', level: 'departement' },
  { id: 'dept-ops', name: 'Département Opérations Télécoms & Supply Chain (DOP)', level: 'departement' },
  { id: 'dir-rh', name: 'Direction des Ressources Humaines (DRH)', level: 'direction', parentId: 'dept-daf' },
  { id: 'dir-finance', name: 'Direction Comptabilité & Trésorerie', level: 'direction', parentId: 'dept-daf' },
  { id: 'dir-vsat', name: 'Direction Déploiement Réseaux & VSAT Minier', level: 'direction', parentId: 'dept-ops' },
  { id: 'dir-log', name: 'Direction Logistique & Gestion des Stocks', level: 'direction', parentId: 'dept-ops' },
  { id: 'div-antennes', name: 'Division Antennes & Stations Terriennes', level: 'division', parentId: 'dir-vsat' },
  { id: 'srv-vsat', name: 'Service Déploiement Terrain VSAT', level: 'service', parentId: 'div-antennes' },
  { id: 'srv-hubs', name: 'Service Hubs & Approvisionnements', level: 'service', parentId: 'dir-log' },
];
const U = (id, role, extra = {}) => ({ id, name: id, role, status: 'actif', ...extra });
const dg = U('dg', 'dg');
const chefOps = U('chef-ops', 'chef_departement', { departementId: 'dept-ops' });
const chefDaf = U('chef-daf', 'chef_departement', { departementId: 'dept-daf' });
const dirRh = U('dir-rh', 'directeur', { departementId: 'dept-daf', directionId: 'dir-rh' });
const dirFin = U('dir-fin', 'directeur', { departementId: 'dept-daf', directionId: 'dir-finance' });
const dirVsat = U('dir-vsat', 'directeur', { departementId: 'dept-ops', directionId: 'dir-vsat' });
const dirLog = U('dir-log', 'directeur', { departementId: 'dept-ops', directionId: 'dir-log', departmentName: 'Direction Logistique' });
const chefVsat = U('chef-vsat', 'chef_service', { departementId: 'dept-ops', directionId: 'dir-vsat', divisionId: 'div-antennes', serviceId: 'srv-vsat' });
const agentVsat = U('agent-vsat', 'agent', { departementId: 'dept-ops', directionId: 'dir-vsat', divisionId: 'div-antennes', serviceId: 'srv-vsat' });
const agent2 = U('agent-2', 'agent', { departementId: 'dept-ops', directionId: 'dir-vsat', divisionId: 'div-antennes', serviceId: 'srv-vsat' });
const chefHubs = U('chef-hubs', 'chef_service', { departementId: 'dept-ops', directionId: 'dir-log', serviceId: 'srv-hubs', departmentName: 'Direction Logistique & Gestion des Stocks' });
const magasinier = U('magasinier', 'agent', { departementId: 'dept-ops', directionId: 'dir-log', serviceId: 'srv-hubs', departmentName: 'Service Hubs & Approvisionnements' });
const users = [dg, chefOps, chefDaf, dirRh, dirFin, dirVsat, dirLog, chefVsat, agentVsat, agent2, chefHubs, magasinier];

const labels = steps => steps.map(s => `${s.approverRole}:${s.entityId || ''}`);
const newDoc = (author, subtype, extra = {}) => ({
  id: `doc-${subtype}`, title: 'Test', subtype, category: documentType(subtype).category, authorId: author.id,
  authorName: author.name, authorRole: author.role, status: 'brouillon', description: 'x', ...extra,
});
const runAll = (doc, actors) => actors.reduce((d, a) => decideDocument(d, a, { decision: 'approve' }), doc);

// --- Circuits ------------------------------------------------------------------------
test("Note de service d'un agent : chef de service → (division vacante → directeur) → directeur dédoublonné", () => {
  const steps = buildDocumentChain(newDoc(agentVsat, 'note_service'), agentVsat, entities, users);
  assert.deepEqual(labels(steps), ['chef_service:srv-vsat', 'directeur:dir-vsat']);
  assert.equal(steps.at(-1).kind, 'signature');
});

test("Demande d'achat > 5 000 USD : hiérarchie, Finance, puis DG", () => {
  const steps = buildDocumentChain(newDoc(agentVsat, 'demande_achat', { amount: 12000, currency: 'USD' }), agentVsat, entities, users);
  assert.deepEqual(labels(steps), ['chef_service:srv-vsat', 'directeur:dir-vsat', 'directeur:dir-finance', 'dg:']);
});

test('Demande de congé : chef de service, (division vacante → directeur), puis RH — visa final', () => {
  const steps = buildDocumentChain(newDoc(agentVsat, 'demande_conge'), agentVsat, entities, users);
  assert.deepEqual(labels(steps), ['chef_service:srv-vsat', 'directeur:dir-vsat', 'directeur:dir-rh']);
  assert.equal(steps.at(-1).kind, 'visa');
});

test("Le chef de service n'est jamais valideur de son propre document", () => {
  const steps = buildDocumentChain(newDoc(chefVsat, 'note_service'), chefVsat, entities, users);
  assert.deepEqual(labels(steps), ['directeur:dir-vsat']);
});

test("Un directeur signe lui-même sa note de service (sommet du circuit)", () => {
  const steps = buildDocumentChain(newDoc(dirVsat, 'note_service'), dirVsat, entities, users);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].approverUserId, dirVsat.id);
});

test('La DG signe seule ses documents', () => {
  const steps = buildDocumentChain(newDoc(dg, 'bon_commande_client', { amount: 50000 }), dg, entities, users);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].approverUserId, dg.id);
});

test('Contrôle fonctionnel conservé même pour un supérieur (Finance vise la dépense du chef DAF)', () => {
  const steps = buildDocumentChain(newDoc(chefDaf, 'demande_achat', { amount: 1000 }), chefDaf, entities, users);
  assert.deepEqual(labels(steps), ['directeur:dir-finance']);
});

test('Bon de commande du magasinier : chef hubs → directeur logistique → Finance (+DG > 10 000)', () => {
  const small = buildDocumentChain(newDoc(magasinier, 'bon_commande_client', { amount: 800 }), magasinier, entities, users);
  assert.deepEqual(labels(small), ['chef_service:srv-hubs', 'directeur:dir-log', 'directeur:dir-finance']);
  const big = buildDocumentChain(newDoc(magasinier, 'bon_commande_client', { amount: 25000 }), magasinier, entities, users);
  assert.equal(big.at(-1).approverRole, 'dg');
});

test('Poste vacant : on remonte au responsable suivant', () => {
  const sansChef = users.filter(u => u.id !== 'chef-vsat');
  const steps = buildDocumentChain(newDoc(agentVsat, 'rapport_activite'), agentVsat, entities, sansChef);
  assert.deepEqual(labels(steps), ['directeur:dir-vsat']);
});

// --- Avancement ------------------------------------------------------------------------
test('Visas dans l\'ordre uniquement, émetteur exclu, statut final « signé »', () => {
  let doc = newDoc(agentVsat, 'note_service');
  doc = submitDocument(doc, buildDocumentChain(doc, agentVsat, entities, users), agentVsat);
  assert.equal(doc.status, 'en_revue');
  assert.equal(canActOnDocument(agentVsat, doc), false, "l'émetteur ne vise pas");
  assert.equal(canActOnDocument(dirVsat, doc), false, 'le directeur attend son tour');
  assert.equal(canActOnDocument(agent2, doc), false, 'un collègue ne vise pas');
  assert.equal(canActOnDocument(chefVsat, doc), true);
  doc = decideDocument(doc, chefVsat, { decision: 'approve' });
  assert.equal(currentStep(doc.workflow).approverRole, 'directeur');
  assert.throws(() => decideDocument(doc, chefVsat, { decision: 'approve' }));
  doc = decideDocument(doc, dirVsat, { decision: 'approve' });
  assert.equal(doc.status, 'signe');
  assert.equal(doc.workflow.history.length, 3);
});

test('Délégation de visa (règle 6) : visa simple oui, signature finale non', () => {
  const delegue = { ...agent2, canApproveServiceDocuments: true };
  let doc = newDoc(agentVsat, 'note_service');
  doc = submitDocument(doc, buildDocumentChain(doc, agentVsat, entities, users), agentVsat);
  assert.equal(canActOnDocument(delegue, doc), true);
  doc = decideDocument(doc, delegue, { decision: 'approve' });
  assert.equal(canActOnDocument(delegue, doc), false);
});

test('Rejet : motif obligatoire, puis correction et renvoi (cycle 2)', () => {
  let doc = newDoc(agentVsat, 'note_service');
  doc = submitDocument(doc, buildDocumentChain(doc, agentVsat, entities, users), agentVsat);
  assert.throws(() => decideDocument(doc, chefVsat, { decision: 'reject' }));
  doc = decideDocument(doc, chefVsat, { decision: 'reject', comment: 'Préciser la date' });
  assert.equal(doc.status, 'rejete');
  assert.equal(doc.workflow.rejection.reason, 'Préciser la date');
  doc = submitDocument({ ...doc, description: 'corrigé' }, buildDocumentChain(doc, agentVsat, entities, users), agentVsat);
  assert.equal(doc.workflow.cycle, 2);
  assert.equal(doc.status, 'en_revue');
});

// --- Contrôles serveur ------------------------------------------------------------------
test('Serveur : visa hors tour refusé, visa du bon titulaire accepté', () => {
  const before = submitDocument(newDoc(agentVsat, 'note_service'), buildDocumentChain(newDoc(agentVsat, 'note_service'), agentVsat, entities, users), agentVsat);
  const ok = decideDocument(before, chefVsat, { decision: 'approve' });
  assert.equal(canWriteDocumentChange(chefVsat, before, ok, entities), true);
  // Le directeur tente de forger le visa du chef de service.
  assert.equal(canWriteDocumentChange(dirVsat, before, ok, entities), false);
  // L'émetteur tente de passer son document « signé ».
  assert.equal(canWriteDocumentChange(agentVsat, before, { ...before, status: 'signe' }, entities), false);
  // L'émetteur ne modifie pas le contenu pendant le circuit.
  assert.equal(canWriteDocumentChange(agentVsat, before, { ...before, title: 'autre' }, entities), false);
});

test('Serveur : création déjà validée par un autre refusée ; brouillon supprimable par son émetteur', () => {
  const doc = newDoc(agentVsat, 'note_service');
  const forged = runAll(submitDocument(doc, buildDocumentChain(doc, agentVsat, entities, users), agentVsat), [chefVsat, dirVsat]);
  assert.equal(canWriteDocumentChange(agentVsat, undefined, forged, entities), false);
  assert.equal(canDeleteDocument(agentVsat, doc), true);
  assert.equal(canDeleteDocument(agentVsat, { ...doc, status: 'en_revue' }), false);
});

// --- Visibilité ---------------------------------------------------------------------------
test('Qui voit quoi et quand : brouillon privé, circuit réservé, signé selon le périmètre', () => {
  let doc = newDoc(agentVsat, 'note_service', { targetEntityId: 'srv-vsat' });
  assert.equal(canSeeDocument(agent2, doc, entities), false, 'brouillon : invisible pour un collègue');
  doc = submitDocument(doc, buildDocumentChain(doc, agentVsat, entities, users), agentVsat);
  assert.equal(canSeeDocument(agent2, doc, entities), false, 'en circuit : invisible pour un collègue agent');
  assert.equal(canSeeDocument(dirVsat, doc, entities), true, 'en circuit : visible du valideur');
  doc = runAll(doc, [chefVsat, dirVsat]);
  assert.equal(canSeeDocument(agent2, doc, entities), true, 'signé : visible dans le service');
  assert.equal(canSeeDocument(magasinier, doc, entities), false, 'signé : invisible hors périmètre');
});

test('Logistique : le magasinier accède au module mais n\'est pas responsable', () => {
  assert.equal(canAccessLogistics(magasinier), true);
  assert.equal(isLogisticsManager(magasinier), false);
  assert.equal(isLogisticsManager(chefHubs), true);
  assert.equal(canAccessLogistics(agentVsat), false);
});

// --- Tâches ----------------------------------------------------------------------------------
const task = {
  id: 't1', title: 'Installer la station', creatorId: chefVsat.id, assignedEntityId: 'srv-vsat', status: 'en_cours',
  assignedIntervenants: [
    { userId: agentVsat.id, userName: 'agent', userRole: 'agent', roleType: 'executant' },
    { userId: dirVsat.id, userName: 'dir', userRole: 'directeur', roleType: 'validateur' },
  ],
  steps: [{ id: 's1', label: 'Pose', completed: false, assignedToUserId: agentVsat.id }, { id: 's2', label: 'Test', completed: false, assignedToUserId: agent2.id }],
  signatureRequired: false,
};

test("Tâche : l'agent ne voit que ses tâches et n'émarge que ses étapes", () => {
  assert.equal(canSeeTask(agentVsat, task, entities), true);
  assert.equal(canSeeTask(agent2, task, entities), false);
  assert.equal(canSeeTask(chefOps, task, entities), true, 'hiérarchie du périmètre');
  assert.equal(canTickTaskStep(agentVsat, task, task.steps[0]), true);
  assert.equal(canTickTaskStep(agentVsat, task, task.steps[1]), false);
});

test('Tâche : circuit des valideurs dans l\'ordre, sinon responsable hiérarchique', () => {
  const steps = buildTaskApprovalChain(task, entities, users);
  assert.deepEqual(steps.map(s => s.approverUserId), [dirVsat.id]);
  const sans = buildTaskApprovalChain({ ...task, assignedIntervenants: [task.assignedIntervenants[0]] }, entities, users);
  assert.equal(sans[0].approverRole, 'chef_service');
  const submitted = { ...task, status: 'en_attente_approbation', approval: { cycle: 1, steps } };
  assert.equal(canValidateTaskNow(dirVsat, submitted), true);
  assert.equal(canValidateTaskNow(agentVsat, submitted), false);
});

test("Tâche (serveur) : l'exécutant avance mais ne valide pas ; un agent ne crée pas de tâche pour un collègue", () => {
  const progressed = { ...task, steps: [{ ...task.steps[0], completed: true }, task.steps[1]] };
  assert.equal(canWriteTaskChange(agentVsat, task, progressed, entities), true);
  assert.equal(canWriteTaskChange(agentVsat, task, { ...task, status: 'validee_terminee' }, entities), false);
  assert.equal(canWriteTaskChange(agent2, task, progressed, entities), false);
  const forOther = { ...task, id: 't2', creatorId: agentVsat.id, assignedIntervenants: [{ userId: agent2.id, roleType: 'executant' }] };
  assert.equal(canWriteTaskChange(agentVsat, undefined, forOther, entities), false);
  const forSelf = { ...task, id: 't3', creatorId: agentVsat.id, assignedIntervenants: [{ userId: agentVsat.id, roleType: 'executant' }] };
  assert.equal(canWriteTaskChange(agentVsat, undefined, forSelf, entities), true);
});

test("Tâche logistique d'un agent : il peut nommer son supérieur comme responsable", () => {
  const t = { ...task, id: 't4', creatorId: magasinier.id, assignedEntityId: 'srv-hubs', source: { module: 'logistique', kind: 'bon_livraison', refId: 'bl1' },
    assignedIntervenants: [{ userId: magasinier.id, roleType: 'executant' }, { userId: chefHubs.id, userRole: 'chef_service', roleType: 'responsable' }] };
  assert.equal(canWriteTaskChange(magasinier, undefined, t, entities), true);
  // Le responsable valide la tâche une fois terminée.
  assert.deepEqual(buildTaskApprovalChain(t, entities, users).map(s => s.approverRole + ':' + s.entityId), ['chef_service:srv-hubs']);
});

test("Tâche : l'exécutant peut terminer et soumettre, jamais clôturer lui-même", () => {
  const steps = buildTaskApprovalChain(task, entities, users);
  const submitted = { ...task, steps: task.steps.map(s => ({ ...s, completed: true })), status: 'en_attente_approbation', approval: { cycle: 1, steps } };
  assert.equal(canWriteTaskChange(agentVsat, task, submitted, entities), true);
  const forgedApproval = { ...submitted, approval: { cycle: 1, steps: steps.map(s => ({ ...s, status: 'approuve', actorId: agentVsat.id })) } };
  assert.equal(canWriteTaskChange(agentVsat, task, forgedApproval, entities), false);
});

console.log(`\n${passed} tests réussis.`);
