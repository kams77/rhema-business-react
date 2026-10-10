// Tests de sécurité et de confidentialité (audit d'octobre 2026).
// Usage : node server/tests/security.test.mjs   (démarre son propre serveur en mémoire)
import http from 'node:http';
import { createApp, isInRanges, parseRanges } from '../app.mjs';
import { createMemoryDb } from '../db-memory.mjs';
import { hashPassword, needsRehash, verifyPassword } from '../auth.mjs';
import { canSeeDocument } from '../../shared/access.mjs';
import { canWriteDocumentChange } from '../../shared/workflow.mjs';

let passed = 0;
function assert(cond, msg) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  passed++;
  console.log(`✓ ${msg}`);
}

// ---------------------------------------------------------------------------
// Unitaires
// ---------------------------------------------------------------------------
const ranges = parseRanges('loopback,172.16.0.0/12');
assert(isInRanges('127.0.0.1', ranges) && isInRanges('::1', ranges) && isInRanges('::ffff:172.17.0.1', ranges), 'proxy de confiance : NAS et réseau Docker reconnus');
assert(!isInRanges('192.168.1.50', ranges) && !isInRanges('10.0.0.8', ranges) && !isInRanges('8.8.8.8', ranges), 'proxy de confiance : un poste du réseau n\'est pas un proxy');

const legacy = 'pbkdf2-sha256$150000$' + Buffer.alloc(16, 1).toString('base64') + '$' + Buffer.alloc(32, 2).toString('base64');
assert(needsRehash(legacy), 'empreinte à 150 000 itérations : à renforcer');
const modern = await hashPassword('Mot-de-passe-2026');
assert(!needsRehash(modern) && (await verifyPassword('Mot-de-passe-2026', modern)), 'nouvelle empreinte : 600 000 itérations, vérifiable');
assert(!(await verifyPassword('x', 'pbkdf2-sha256$999999999$AAAA$AAAA')), 'empreinte au coût démesuré refusée (pas de blocage du serveur)');

const jean = { id: 'j', name: 'Jean', role: 'chef_service', serviceId: 's1' };
const doc = {
  id: 'd', authorId: 'x', subtype: 'note_service', status: 'en_revue',
  workflow: { cycle: 1, submittedAt: 't', steps: [{ id: 'e1', kind: 'signature', approverRole: 'chef_service', entityId: 's1', status: 'en_attente' }] },
};
const signed = signer => ({
  ...doc, status: 'signe',
  workflow: { ...doc.workflow, steps: [{ ...doc.workflow.steps[0], status: 'approuve', actorId: 'j' }] },
  electronicSignature: { signedBy: signer },
});
assert(canWriteDocumentChange(jean, doc, signed('Jean (Chef de service)'), [], []), 'signature : « Nom (fonction) » accepté');
assert(!canWriteDocumentChange(jean, doc, signed('Jean Mukendi (Directeur)'), [], []), 'signature : impossible de signer au nom d\'un homonyme plus long');

// ---------------------------------------------------------------------------
// Serveur en mémoire
// ---------------------------------------------------------------------------
const db = await createMemoryDb();
await db.migrate();
const server = http.createServer(createApp({ db, config: { setupCode: 'code-securite', trustProxy: true, distDir: '' } }));
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

function client() {
  let cookie = '';
  return async (method, url, body, headers = {}) => {
    const res = await fetch(BASE + url, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let json = null;
    try { json = await res.json(); } catch { /* vide */ }
    return { status: res.status, json };
  };
}
async function login(c, identifier, password, newPassword) {
  let r = await c('POST', '/api/auth/login', { identifier, password });
  if (r.status !== 200) throw new Error(`Connexion impossible pour ${identifier} : ${r.json?.error}`);
  if (r.json.mustChangePassword) {
    r = await c('POST', '/api/auth/change-password', { newPassword });
    if (r.status !== 200) throw new Error(`Changement refusé : ${r.json?.error}`);
  }
}
const put = async (c, key, value) => {
  const cur = await c('GET', `/api/data/${encodeURIComponent(key)}`);
  return c('PUT', `/api/data/${encodeURIComponent(key)}`, { value, version: cur.json.version });
};

const anon = client();
let r = await anon('POST', '/api/setup', { setupCode: 'mauvais', users: [] }, {});
assert(r.status === 403 || r.status === 400, 'installation : mauvais code refusé');

const base = { organizationId: 'o', status: 'actif', failedAccessAttempts: 0, canCreateSubAgents: false };
const dgUser = { ...base, id: 's-dg', name: 'Directrice Sécurité', email: 'dg@sec.cd', role: 'dg', roleTitle: 'Directrice Générale', password: 'Kinshasa-Securite-2026' };
r = await anon('POST', '/api/setup', { setupCode: 'code-securite', users: [dgUser], data: { currentOrg: { id: 'o', name: 'SEC' } } });
assert(r.status === 201, 'installation réussie');

// CSRF : une requête d'un autre site est refusée, même avec un JSON valide.
r = await anon('POST', '/api/auth/login', { identifier: 'dg@sec.cd', password: dgUser.password }, { 'Sec-Fetch-Site': 'cross-site' });
assert(r.status === 403, 'CSRF : requête venant d\'un autre site refusée');

const boss = client();
await login(boss, 'dg@sec.cd', dgUser.password, 'Kinshasa-Securite-2027');

await put(boss, 'entities', [
  { id: 'dir-a', name: 'Direction A', level: 'direction', organizationId: 'o' },
  { id: 'svc-a', name: 'Service A', level: 'service', parentId: 'dir-a', organizationId: 'o' },
  { id: 'svc-rh', name: 'Service RH', level: 'service', organizationId: 'o' },
]);
let users = (await boss('GET', '/api/data/users')).json.value;
users = users.concat([
  { ...base, id: 's-chef', name: 'Chef A', email: 'chef@sec.cd', role: 'chef_service', roleTitle: 'Chef de service A', directionId: 'dir-a', serviceId: 'svc-a', password: 'Temp-Chef-A-1' },
  { ...base, id: 's-a1', name: 'Agent Un', email: 'a1@sec.cd', role: 'agent', roleTitle: 'Technicien', directionId: 'dir-a', serviceId: 'svc-a', password: 'Temp-Agent-A1' },
  { ...base, id: 's-a2', name: 'Agent Deux', email: 'a2@sec.cd', role: 'agent', roleTitle: 'Technicien', directionId: 'dir-a', serviceId: 'svc-a', password: 'Temp-Agent-A2' },
  { ...base, id: 's-rh', name: 'Chef RH', email: 'rh@sec.cd', role: 'chef_service', roleTitle: 'Chef de service RH', serviceId: 'svc-rh', password: 'Temp-Chef-RH-1' },
]);
assert((await put(boss, 'users', users)).status === 200, 'DG : comptes créés');

await put(boss, 'contracts', [
  { id: 'c-a1', userId: 's-a1', baseSalary: 800 },
  { id: 'c-rh', userId: 's-rh', baseSalary: 1500 },
]);
await put(boss, 'payroll.runs', [{ id: 'run-1', month: '2026-10' }]);
await put(boss, 'documents', [
  { id: 'd-contrat', title: 'Contrat Agent Un', subtype: 'contrat_travail', status: 'signe', authorId: 's-dg', targetEntityId: 'svc-a', allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'] },
  { id: 'd-conge', title: 'Congé maladie Agent Un', subtype: 'demande_conge', status: 'approuve', authorId: 's-a1', originEntityId: 'svc-a', targetEntityId: 'svc-a', allowedRoles: ['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent'] },
  { id: 'd-note', title: 'Note de service A', subtype: 'note_service', status: 'signe', authorId: 's-dg', targetEntityId: 'svc-a', allowedRoles: [] },
]);

const a1 = client();
await login(a1, 'a1@sec.cd', 'Temp-Agent-A1', 'Agent-Un-Kinshasa-26');
const a2 = client();
await login(a2, 'a2@sec.cd', 'Temp-Agent-A2', 'Agent-Deux-Kinshasa-26');
const chef = client();
await login(chef, 'chef@sec.cd', 'Temp-Chef-A-1', 'Service-A-Gombe-2026');
const rh = client();
await login(rh, 'rh@sec.cd', 'Temp-Chef-RH-1', 'Ressources-Limete-2026');

// --- Documents confidentiels et personnels ---------------------------------
const seen = async c => (await c('GET', '/api/data/documents')).json.value.map(d => d.id).sort().join(',');
assert(await seen(a2) === 'd-note', `collègue : ne voit ni le contrat ni le congé d'un autre agent (${await seen(a2)})`);
assert(await seen(a1) === 'd-conge,d-note', `agent : voit son propre congé (${await seen(a1)})`);
assert(await seen(chef) === 'd-conge,d-note', `chef de service : voit le congé de son agent, pas son contrat (${await seen(chef)})`);
assert((await seen(rh)).includes('d-contrat'), 'RH : voit le contrat de travail');
assert(!canSeeDocument({ id: 'z', role: 'directeur', directionId: 'dir-b' }, { subtype: 'bilan_comptable', status: 'signe', allowedRoles: ['directeur'] }, []), 'bilan comptable : pas diffusé aux directeurs hors circuit');

// --- Paie : pas de conflit d'intérêts ------------------------------------------
let contracts = (await rh('GET', '/api/data/contracts')).json.value;
assert(contracts.length === 2, 'RH : voit les contrats');
r = await put(rh, 'contracts', contracts.map(c => (c.userId === 's-rh' ? { ...c, baseSalary: 9999 } : c)));
assert(r.status === 403, 'RH : ne peut pas augmenter son propre salaire');
r = await put(rh, 'contracts', contracts.map(c => (c.userId === 's-a1' ? { ...c, baseSalary: 850 } : c)));
assert(r.status === 200, 'RH : peut mettre à jour le contrat d\'un agent');
r = await put(rh, 'contracts', contracts.filter(c => c.userId !== 's-rh'));
assert(r.status === 403, 'RH : ne peut pas supprimer son propre contrat');

// --- Versions : pas de fuite sur l'activité des données cachées ----------------
r = await a2('GET', '/api/data/versions');
assert(r.status === 200 && !('payroll.runs' in r.json.versions) && !('auditLogs' in r.json.versions), 'agent : activité de la paie et du journal non révélée');
r = await a2('GET', '/api/data');
assert(!('payroll.runs' in r.json.versions), 'agent : version de la paie absente du chargement initial');

// --- Convocation disciplinaire : invisible des collègues -----------------------
users = (await boss('GET', '/api/data/users')).json.value;
assert((await put(boss, 'users', users.map(u => (u.id === 's-a1' ? { ...u, status: 'convoque' } : u)))).status === 200, 'DG : agent convoqué');
const statusSeenBy = async c => (await c('GET', '/api/data/users')).json.value.find(u => u.id === 's-a1').status;
assert(await statusSeenBy(a2) === 'actif', 'collègue : ne voit pas la convocation');
assert(await statusSeenBy(chef) === 'convoque', 'chef de service : voit la convocation de son agent');
assert(await statusSeenBy(rh) === 'convoque', 'RH : voit la convocation');

// --- Tâches : personne ne valide son propre travail -----------------------------
const task = extra => ({
  id: `t-${Math.random().toString(36).slice(2, 8)}`, title: 'Installer antenne', creatorId: 's-a1', status: 'a_faire',
  assignedEntityId: 'svc-a',
  assignedIntervenants: [{ userId: 's-a1', userName: 'Agent Un', userRole: 'agent', roleType: 'executant' }],
  ...extra,
});
let tasks = (await a1('GET', '/api/data/tasks')).json.value || [];
const selfValidated = task({
  approval: { cycle: 1, steps: [{ id: 'v1', kind: 'visa', approverRole: 'agent', approverUserId: 's-a1', status: 'en_attente' }] },
});
r = await put(a1, 'tasks', [selfValidated, ...tasks]);
assert(r.status === 403, 'tâche : un exécutant ne peut pas se désigner valideur');
const ok = task({});
r = await put(a1, 'tasks', [ok, ...tasks]);
assert(r.status === 200, 'tâche : création normale acceptée');
tasks = (await a1('GET', '/api/data/tasks')).json.value;
const crony = tasks.map(t => (t.id === ok.id ? {
  ...t, status: 'en_attente_approbation',
  approval: { cycle: 1, steps: [{ id: 'v2', kind: 'visa', approverRole: 'agent', approverUserId: 's-a2', status: 'en_attente' }] },
} : t));
r = await put(a1, 'tasks', crony);
assert(r.status === 403, 'tâche : l\'exécutant ne choisit pas un collègue complaisant comme valideur');
const proper = tasks.map(t => (t.id === ok.id ? {
  ...t, status: 'en_attente_approbation',
  approval: { cycle: 1, steps: [{ id: 'v3', kind: 'visa', approverRole: 'chef_service', entityId: 'svc-a', entityName: 'Service A', expectedHolderName: 'Chef A', label: 'Chef de service — Service A', status: 'en_attente' }] },
} : t));
r = await put(a1, 'tasks', proper);
assert(r.status === 200, 'tâche : soumission au chef de service (circuit prévu) acceptée');

// --- Limite de débit sur l'installation ----------------------------------------
let last;
for (let i = 0; i < 11; i++) last = await anon('POST', '/api/setup', { setupCode: `essai-${i}` });
assert(last.status === 429, 'installation : essais répétés du code bloqués');

server.close();
console.log(`\n${passed} vérifications de sécurité réussies.`);
