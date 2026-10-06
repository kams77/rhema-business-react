// Tests des droits côté serveur (à lancer APRÈS api.test.mjs, sur le même serveur).
// Usage : BASE_URL=http://localhost:8080 node server/tests/permissions.test.mjs
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const DG = { identifier: process.env.DG_EMAIL || 'dg@test.cd', password: process.env.DG_PASSWORD || 'Kinshasa-Gombe-2026' };
let passed = 0;

function assert(cond, msg) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  passed++;
  console.log(`✓ ${msg}`);
}

function client() {
  let cookie = '';
  return async function call(method, url, body) {
    const res = await fetch(BASE + url, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
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
    if (r.status !== 200) throw new Error(`Changement de mot de passe refusé : ${r.json?.error}`);
  }
}

const put = async (c, key, value) => {
  const cur = await c('GET', `/api/data/${encodeURIComponent(key)}`);
  return c('PUT', `/api/data/${encodeURIComponent(key)}`, { value, version: cur.json.version });
};

// ---------------------------------------------------------------------------
// Préparation par le DG : organigramme, comptes, données de paie et documents
// ---------------------------------------------------------------------------
const boss = client();
await login(boss, DG.identifier, DG.password);

const entities = [
  { id: 'dep-tech', name: 'Département Technique', code: 'TECH', level: 'departement', organizationId: 'o' },
  { id: 'svc-vsat', name: 'Service VSAT', code: 'VSAT', level: 'service', parentId: 'dep-tech', organizationId: 'o' },
  { id: 'svc-compta', name: 'Service Comptabilité', code: 'CPT', level: 'service', organizationId: 'o' },
];
assert((await put(boss, 'entities', entities)).status === 200, 'DG : organigramme enregistré');

const base = { organizationId: 'o', status: 'actif', failedAccessAttempts: 0, canCreateSubAgents: false };
let users = (await boss('GET', '/api/data/users')).json.value;
users = users.filter(u => !['p-chef', 'p-ag1', 'p-ag2', 'p-dir'].includes(u.id)).concat([
  { ...base, id: 'p-dir', name: 'Directeur Technique', email: 'dir@perm.cd', role: 'directeur', roleTitle: 'Directeur Technique', departementId: 'dep-tech', password: 'Temp-Directeur-1' },
  { ...base, id: 'p-chef', name: 'Chef VSAT', email: 'chef@perm.cd', role: 'chef_service', roleTitle: 'Chef de service VSAT', departementId: 'dep-tech', serviceId: 'svc-vsat', password: 'Temp-ChefVsat-1' },
  { ...base, id: 'p-ag1', name: 'Technicien Un', email: 'tech1@perm.cd', role: 'agent', roleTitle: 'Technicien VSAT', departementId: 'dep-tech', serviceId: 'svc-vsat', password: 'Temp-Tech1-xx1' },
  { ...base, id: 'p-ag2', name: 'Comptable Deux', email: 'cpt2@perm.cd', role: 'agent', roleTitle: 'Comptable', serviceId: 'svc-compta', password: 'Temp-Cpt2-xx22' },
]);
assert((await put(boss, 'users', users)).status === 200, 'DG : comptes de test créés');

const contracts = [
  { id: 'k1', userId: 'p-ag1', matricule: 'M1', baseSalary: 900, salaryCurrency: 'USD' },
  { id: 'k2', userId: 'p-ag2', matricule: 'M2', baseSalary: 1400, salaryCurrency: 'USD' },
  { id: 'k3', userId: 'p-chef', matricule: 'M3', baseSalary: 2000, salaryCurrency: 'USD' },
];
assert((await put(boss, 'contracts', contracts)).status === 200, 'DG : contrats enregistrés');
assert((await put(boss, 'payroll.runs', [{ id: 'r1', month: '2026-10' }])).status === 200, 'DG : période de paie enregistrée');
const documents = [
  { id: 'doc-pay-ag2', title: 'Bulletin Comptable', subtype: 'bulletin_de_paie', isConfidentialPayslip: true, targetUserId: 'p-ag2', authorId: 'dg' },
  { id: 'doc-pay-ag1', title: 'Bulletin Technicien', subtype: 'bulletin_de_paie', isConfidentialPayslip: true, targetUserId: 'p-ag1', authorId: 'dg' },
  { id: 'doc-compta', title: 'Note comptable', targetEntityId: 'svc-compta', authorId: 'dg' },
  { id: 'doc-vsat', title: 'Procédure VSAT', targetEntityId: 'svc-vsat', authorId: 'dg' },
];
assert((await put(boss, 'documents', documents)).status === 200, 'DG : documents enregistrés');

// ---------------------------------------------------------------------------
// Agent : ne voit que ce qui le concerne et ne peut rien falsifier
// ---------------------------------------------------------------------------
const tech = client();
await login(tech, 'tech1@perm.cd', 'Temp-Tech1-xx1', 'Technicien-VSAT-2026');
let r = await tech('GET', '/api/data');
assert(r.status === 200, 'agent : chargement des données');
const v = r.json.values;
assert(v.contracts.length === 1 && v.contracts[0].userId === 'p-ag1', 'agent : ne voit que son propre contrat');
assert(v['payroll.runs'] === undefined, 'agent : périodes de paie invisibles');
assert(Array.isArray(v.auditLogs) && v.auditLogs.length === 0, 'agent : journal d\'audit invisible');
assert(!v.securityAlerts || v.securityAlerts.length === 0, 'agent : alertes de sécurité invisibles');
const visibleDocs = v.documents.map(d => d.id).sort();
assert(JSON.stringify(visibleDocs) === JSON.stringify(['doc-pay-ag1', 'doc-vsat']), `agent : voit son bulletin et les documents de son service (${visibleDocs})`);

r = await tech('GET', '/api/data/contracts');
assert(r.json.value.length === 1, 'agent : lecture directe filtrée');
r = await put(tech, 'contracts', [{ ...contracts[0], baseSalary: 99999 }]);
assert(r.status === 403, 'agent : ne peut pas modifier son salaire');
r = await put(tech, 'payroll.runs', []);
assert(r.status === 403, 'agent : ne peut pas toucher aux périodes de paie');
r = await put(tech, 'securityAlerts', []);
assert(r.status === 403, 'agent : ne peut pas effacer les alertes');
r = await put(tech, 'organizations', []);
assert(r.status === 403, 'agent : ne peut pas modifier l\'organisation');

// Documents : ajout d'un document de son service ; les documents cachés restent intacts
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', {
  value: [{ id: 'doc-new', title: 'Rapport intervention', targetEntityId: 'svc-vsat', authorId: 'p-ag1' }, ...r.json.value],
  version: r.json.version,
});
assert(r.status === 200, 'agent : peut ajouter un document de son service');
r = await boss('GET', '/api/data/documents');
const all = r.json.value.map(d => d.id);
assert(all.includes('doc-pay-ag2') && all.includes('doc-compta') && all.includes('doc-new'), 'documents cachés à l\'agent conservés après son enregistrement');

r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', { value: r.json.value.filter(d => d.id !== 'doc-vsat'), version: r.json.version });
assert(r.status === 200, 'agent : peut supprimer un document qu\'il voit');
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', {
  value: [{ id: 'faux-bulletin', title: 'Bulletin', subtype: 'bulletin_de_paie', isConfidentialPayslip: true, targetUserId: 'p-ag1' }, ...r.json.value],
  version: r.json.version,
});
assert(r.status === 403, 'agent : ne peut pas créer de bulletin de paie');
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', {
  value: [{ id: 'doc-ailleurs', title: 'Hors périmètre', targetEntityId: 'svc-compta' }, ...r.json.value],
  version: r.json.version,
});
assert(r.status === 403, 'agent : ne peut pas déposer un document hors de son périmètre');

// Journal : l'auteur est fixé par le serveur
r = await tech('PUT', '/api/data/auditLogs', { value: [{ id: 'log-forge-1', action: 'Faux', userName: 'Directrice Générale', userRole: 'DG', category: 'admin', details: 'tentative' }], version: 0 });
r = await boss('GET', '/api/data/auditLogs');
const forged = r.json.value.find(l => l.id === 'log-forge-1');
assert(forged && forged.userName === 'Technicien Un' && forged.userId === 'p-ag1', 'journal : impossible d\'écrire au nom d\'un autre');

// ---------------------------------------------------------------------------
// Chef de service : périmètre et rang
// ---------------------------------------------------------------------------
const chef = client();
await login(chef, 'chef@perm.cd', 'Temp-ChefVsat-1', 'Responsable-VSAT-2026');
const usersNow = async c => (await c('GET', '/api/data/users')).json;
let u = await usersNow(chef);
r = await chef('PUT', '/api/data/users', { value: u.value.map(x => (x.id === 'p-chef' ? { ...x, role: 'chef_departement' } : x)), version: u.version });
assert(r.status === 403, 'chef de service : ne peut pas se promouvoir lui-même');
u = await usersNow(chef);
r = await chef('PUT', '/api/data/users', { value: u.value.map(x => (x.id === 'p-dir' ? { ...x, status: 'suspendu' } : x)), version: u.version });
assert(r.status === 403, 'chef de service : ne peut pas suspendre son directeur');
u = await usersNow(chef);
r = await chef('PUT', '/api/data/users', { value: u.value.filter(x => x.id !== 'p-ag2'), version: u.version });
assert(r.status === 403, 'chef de service : ne peut pas supprimer un agent d\'un autre service');
u = await usersNow(chef);
r = await chef('PUT', '/api/data/users', { value: u.value.map(x => (x.id === 'p-ag1' ? { ...x, role: 'chef_service' } : x)), version: u.version });
assert(r.status === 403, 'chef de service : ne peut pas promouvoir un agent à son propre rang');
u = await usersNow(chef);
r = await chef('PUT', '/api/data/users', { value: u.value.map(x => (x.id === 'p-ag1' ? { ...x, canApproveServiceDocuments: true } : x)), version: u.version });
assert(r.status === 200, 'chef de service : peut déléguer le visa à un agent de son service');
u = await usersNow(chef);
r = await chef('PUT', '/api/data/users', { value: u.value.map(x => (x.id === 'p-ag1' ? { ...x, canManagePayroll: true } : x)), version: u.version });
assert(r.status === 403, 'chef de service : ne peut pas donner l\'accès à la paie');

// Le DG accorde l'accès paie au comptable : il voit alors tous les contrats
u = await usersNow(boss);
r = await boss('PUT', '/api/data/users', { value: u.value.map(x => (x.id === 'p-ag2' ? { ...x, canManagePayroll: true } : x)), version: u.version });
assert(r.status === 200, 'DG : accorde l\'accès à la paie');
const cpt = client();
await login(cpt, 'cpt2@perm.cd', 'Temp-Cpt2-xx22', 'Comptable-Kin-2026');
r = await cpt('GET', '/api/data/contracts');
assert(r.json.value.length === 3, 'comptable habilité : voit tous les contrats');
r = await cpt('GET', '/api/data/documents');
assert(r.json.value.some(d => d.id === 'doc-pay-ag1'), 'comptable habilité : voit les bulletins');

console.log(`\n${passed} vérifications de droits réussies.`);
