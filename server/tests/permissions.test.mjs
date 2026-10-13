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
  { id: 'dir-tech', name: 'Direction Technique', code: 'DTECH', level: 'direction', parentId: 'dep-tech', organizationId: 'o' },
  { id: 'svc-vsat', name: 'Service VSAT', code: 'VSAT', level: 'service', parentId: 'dir-tech', organizationId: 'o' },
  { id: 'svc-compta', name: 'Service Comptabilité', code: 'CPT', level: 'service', organizationId: 'o' },
];
assert((await put(boss, 'entities', entities)).status === 200, 'DG : organigramme enregistré');

const base = { organizationId: 'o', status: 'actif', failedAccessAttempts: 0, canCreateSubAgents: false };
let users = (await boss('GET', '/api/data/users')).json.value;
users = users.filter(u => !['p-chef', 'p-ag1', 'p-ag2', 'p-dir'].includes(u.id)).concat([
  { ...base, id: 'p-dir', name: 'Directeur Technique', email: 'dir@perm.cd', role: 'directeur', roleTitle: 'Directeur Technique', departementId: 'dep-tech', directionId: 'dir-tech', password: 'Temp-Directeur-1' },
  { ...base, id: 'p-chef', name: 'Chef VSAT', email: 'chef@perm.cd', role: 'chef_service', roleTitle: 'Chef de service VSAT', departementId: 'dep-tech', directionId: 'dir-tech', serviceId: 'svc-vsat', password: 'Temp-ChefVsat-1' },
  { ...base, id: 'p-ag1', name: 'Technicien Un', email: 'tech1@perm.cd', role: 'agent', roleTitle: 'Technicien VSAT', departementId: 'dep-tech', directionId: 'dir-tech', serviceId: 'svc-vsat', phone: '+243 810 000 001', password: 'Temp-Tech1-xx1' },
  { ...base, id: 'p-ag2', name: 'Comptable Deux', email: 'cpt2@perm.cd', role: 'agent', roleTitle: 'Comptable', serviceId: 'svc-compta', phone: '+243 990 000 002', password: 'Temp-Cpt2-xx22' },
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
  value: [{ id: 'doc-new', title: 'Rapport intervention', targetEntityId: 'svc-vsat', authorId: 'p-ag1', status: 'brouillon' }, ...r.json.value],
  version: r.json.version,
});
assert(r.status === 200, 'agent : peut ajouter un document de son service');
r = await boss('GET', '/api/data/documents');
const all = r.json.value.map(d => d.id);
assert(all.includes('doc-pay-ag2') && all.includes('doc-compta') && all.includes('doc-new'), 'documents cachés à l\'agent conservés après son enregistrement');

r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', { value: r.json.value.filter(d => d.id !== 'doc-vsat'), version: r.json.version });
assert(r.status === 403, 'agent : ne peut pas supprimer un document officiel publié par un autre');
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', {
  value: [{ id: 'doc-brouillon', title: 'Brouillon', targetEntityId: 'svc-vsat', authorId: 'p-ag1', status: 'brouillon' }, ...r.json.value],
  version: r.json.version,
});
assert(r.status === 200, 'agent : enregistre un brouillon');
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', { value: r.json.value.filter(d => d.id !== 'doc-brouillon'), version: r.json.version });
assert(r.status === 200, 'agent : peut supprimer son propre brouillon');
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

// ---------------------------------------------------------------------------
// Circuit de validation : chaque visa revient au bon titulaire, dans l'ordre
// ---------------------------------------------------------------------------
const wfSteps = [
  { id: 'e1', kind: 'visa', approverRole: 'chef_service', entityId: 'svc-vsat', label: 'Chef VSAT', status: 'en_attente' },
  { id: 'e2', kind: 'signature', approverRole: 'directeur', entityId: 'dir-tech', label: 'Directeur', status: 'en_attente' },
];
// Circuit inventé par l'émetteur (un complice comme unique valideur) : refusé.
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', {
  value: [{ id: 'doc-complice', title: 'Achat urgent', subtype: 'note_service', targetEntityId: 'svc-vsat', authorId: 'p-ag1', status: 'en_revue',
    workflow: { cycle: 1, submittedAt: '2026-10-08T10:00:00Z', steps: [{ id: 'x1', kind: 'signature', approverRole: 'agent', approverUserId: 'p-ag2', label: 'Complice', status: 'en_attente' }], history: [] } }, ...r.json.value],
  version: r.json.version,
});
assert(r.status === 403, 'circuit : l\'émetteur ne peut pas choisir lui-même ses valideurs');
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', {
  value: [{ id: 'doc-faux-signe', title: 'Attestation', subtype: 'note_service', targetEntityId: 'svc-vsat', authorId: 'p-ag1', status: 'signe',
    electronicSignature: { signedBy: 'Directrice Test', signedAt: '2026-10-08', role: 'DG', certificateHash: 'abc' } }, ...r.json.value],
  version: r.json.version,
});
assert(r.status === 403, 'document : impossible de créer un document déjà « signé » (fausse signature)');
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', {
  value: [{ id: 'doc-usurpe', title: 'Note', subtype: 'note_service', targetEntityId: 'svc-vsat', authorId: 'p-chef', status: 'brouillon' }, ...r.json.value],
  version: r.json.version,
});
assert(r.status === 403, 'document : impossible de publier au nom d\'un autre');
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', {
  value: [{ id: 'doc-wf', title: 'Note VSAT', subtype: 'note_service', targetEntityId: 'svc-vsat', authorId: 'p-ag1', status: 'en_revue',
    workflow: { cycle: 1, submittedAt: '2026-10-08T10:00:00Z', steps: wfSteps, history: [] } }, ...r.json.value],
  version: r.json.version,
});
assert(r.status === 200, 'circuit : l\'agent soumet sa note');
const visa = (docs, stepId, actorId, extra = {}) => docs.map(d => d.id !== 'doc-wf' ? d : {
  ...d, ...extra, workflow: { ...d.workflow, steps: d.workflow.steps.map(st => st.id === stepId ? { ...st, status: 'approuve', actorId } : st) },
});
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', { value: visa(r.json.value, 'e1', 'p-ag1'), version: r.json.version });
assert(r.status === 403, 'circuit : l\'émetteur ne peut pas viser sa propre note');
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', { value: r.json.value.map(d => (d.id === 'doc-wf' ? { ...d, status: 'signe' } : d)), version: r.json.version });
assert(r.status === 403, 'circuit : l\'émetteur ne peut pas déclarer sa note signée');
const dir = client();
await login(dir, 'dir@perm.cd', 'Temp-Directeur-1', 'Gombe-Visa-Final-2026');
r = await dir('GET', '/api/data/documents');
r = await dir('PUT', '/api/data/documents', { value: visa(r.json.value, 'e2', 'p-dir', { status: 'signe' }), version: r.json.version });
assert(r.status === 403, 'circuit : le directeur ne peut pas signer avant le visa du chef de service');
r = await chef('GET', '/api/data/documents');
r = await chef('PUT', '/api/data/documents', { value: visa(r.json.value, 'e1', 'p-chef'), version: r.json.version });
assert(r.status === 200, 'circuit : le chef de service vise à son tour');
r = await dir('GET', '/api/data/documents');
r = await dir('PUT', '/api/data/documents', { value: visa(r.json.value, 'e2', 'p-dir', { status: 'signe' }), version: r.json.version });
assert(r.status === 200, 'circuit : le directeur signe en dernier');
r = await tech('GET', '/api/data/documents');
r = await tech('PUT', '/api/data/documents', { value: r.json.value.map(d => (d.id === 'doc-wf' ? { ...d, allowedRoles: ['agent'], targetEntityId: undefined } : d)), version: r.json.version });
assert(r.status === 403, 'document signé : diffusion et contenu verrouillés');
r = await chef('GET', '/api/data/documents');
r = await chef('PUT', '/api/data/documents', { value: r.json.value.map(d => (d.id === 'doc-wf' ? { ...d, electronicSignature: { signedBy: 'Chef VSAT', signedAt: 'x', role: 'x', certificateHash: 'faux' } } : d)), version: r.json.version });
assert(r.status === 403, 'document signé : la signature électronique ne peut pas être remplacée');

// Tâches : l'agent ne voit que les siennes
r = await boss('GET', '/api/data/tasks');
r = await boss('PUT', '/api/data/tasks', {
  value: [
    { id: 'tk-1', title: 'Pose antenne', creatorId: 'p-chef', assignedEntityId: 'svc-vsat', status: 'a_faire', steps: [],
      assignedIntervenants: [{ userId: 'p-ag1', userName: 'Technicien Un', userRole: 'agent', roleType: 'executant' }] },
    { id: 'tk-2', title: 'Rapprochement', creatorId: 'dg', assignedEntityId: 'svc-compta', status: 'a_faire', steps: [],
      assignedIntervenants: [{ userId: 'p-ag2', userName: 'Comptable Deux', userRole: 'agent', roleType: 'executant' }] },
  ],
  version: r.json.version ?? 0,
});
assert(r.status === 200, 'DG : tâches enregistrées');
r = await tech('GET', '/api/data/tasks');
assert(r.json.value.map(t => t.id).join() === 'tk-1', 'agent : ne voit que ses propres tâches');
r = await tech('PUT', '/api/data/tasks', { value: r.json.value.map(t => ({ ...t, status: 'validee_terminee' })), version: r.json.version });
assert(r.status === 403, 'agent : ne peut pas valider lui-même sa tâche');
r = await chef('GET', '/api/data/tasks');
r = await chef('PUT', '/api/data/tasks', { value: r.json.value.map(t => (t.id === 'tk-1' ? { ...t, status: 'validee_terminee' } : t)), version: r.json.version });
assert(r.status === 403, 'créateur : ne peut pas clôturer une tâche sans le circuit de validation');

// ---------------------------------------------------------------------------
// Vie privée de l'annuaire et escalade de droits
// ---------------------------------------------------------------------------
let dirList = (await tech('GET', '/api/data/users')).json.value;
const colleague = dirList.find(x => x.id === 'p-ag2');
const myself = dirList.find(x => x.id === 'p-ag1');
assert(colleague && colleague.name === 'Comptable Deux' && colleague.phone === undefined && colleague.lastLogin === undefined && colleague.failedAccessAttempts === undefined,
  'annuaire : un agent ne voit pas le téléphone ni les connexions de ses collègues');
assert(myself && myself.phone === '+243 810 000 001', 'annuaire : chacun voit sa propre fiche complète');
dirList = (await chef('GET', '/api/data/users')).json.value;
assert(dirList.find(x => x.id === 'p-ag1').phone === '+243 810 000 001', 'annuaire : le chef de service voit la fiche de ses agents');
assert(dirList.find(x => x.id === 'p-ag2').phone === undefined, 'annuaire : mais pas celle des agents d\'un autre service');
u = await usersNow(chef);
r = await chef('PUT', '/api/data/users', { value: u.value.map(x => (x.id === 'p-ag1' ? { ...x, departmentName: 'Service VSAT (terrain)' } : x)), version: u.version });
assert(r.status === 200, 'chef de service : modifie la fiche de son agent (champs masqués préservés)');
r = (await boss('GET', '/api/data/users')).json.value.find(x => x.id === 'p-ag2');
assert(r.phone === '+243 990 000 002', 'annuaire : les champs masqués au chef ne sont pas effacés par son enregistrement');
u = await usersNow(chef);
r = await chef('PUT', '/api/data/users', { value: u.value.map(x => (x.id === 'p-ag1' ? { ...x, roleTitle: 'Assistant RH et paie' } : x)), version: u.version });
assert(r.status === 403, 'chef de service : ne peut pas ouvrir les salaires en changeant l\'intitulé d\'un poste');
u = await usersNow(chef);
r = await chef('PUT', '/api/data/users', { value: u.value.concat([{ ...base, id: 'p-new', name: 'Nouvel Agent', email: 'new@perm.cd', role: 'agent', roleTitle: 'Technicien', serviceId: 'svc-vsat', password: 'court' }]), version: u.version });
assert(r.status === 400, 'chef de service : mot de passe provisoire trop court refusé');

// Organigramme : chacun sa branche
r = await chef('GET', '/api/data/entities');
r = await chef('PUT', '/api/data/entities', { value: r.json.value.map(e => (e.id === 'svc-compta' ? { ...e, parentId: 'svc-vsat' } : e)), version: r.json.version });
assert(r.status === 403, 'organigramme : un chef ne peut pas s\'approprier une autre entité');
r = await chef('GET', '/api/data/entities');
r = await chef('PUT', '/api/data/entities', { value: r.json.value.map(e => (e.id === 'svc-vsat' ? { ...e, parentId: undefined } : e)), version: r.json.version });
assert(r.status === 403, 'organigramme : un chef ne peut pas détacher son service de sa hiérarchie');
r = await tech('GET', '/api/data/entities');
r = await tech('PUT', '/api/data/entities', { value: r.json.value.concat([{ id: 'svc-x', name: 'X', level: 'service', parentId: 'svc-vsat' }]), version: r.json.version });
assert(r.status === 403, 'organigramme : un agent ne peut rien modifier');

// Logistique, données inconnues, invitations
r = await boss('GET', '/api/data/logistics.suppliers');
r = await boss('PUT', '/api/data/logistics.suppliers', { value: [{ id: 'sup1', name: 'Fournisseur', bankDetails: { ibanOrRib: 'CD00 1234' } }], version: r.json.version });
assert(r.status === 200, 'DG : fournisseurs enregistrés');
r = await tech('GET', '/api/data/logistics.suppliers');
assert(r.json.value === null, 'logistique : fournisseurs et coordonnées bancaires invisibles hors logistique');
r = await tech('PUT', '/api/data/donnee-pirate', { value: { x: 1 }, version: 0 });
assert(r.status === 403, 'agent : ne peut pas créer de donnée inconnue');
r = await tech('GET', '/api/data/invitations');
r = await tech('PUT', '/api/data/invitations', {
  value: [{ id: 'inv-pirate', inviterUserId: 'p-ag1', invitedAgentId: 'p-ag1', hostEntityId: 'svc-compta', status: 'active', expiresAt: '2099-01-01' }, ...(r.json.value || [])],
  version: r.json.version,
});
assert(r.status === 403, 'invitations : un agent ne peut pas s\'inviter lui-même ailleurs');
r = await tech('GET', '/api/data/invitationNotifications');
r = await tech('PUT', '/api/data/invitationNotifications', {
  value: [{ id: 'notif-pirate', recipientUserId: 'p-ag2', title: 'Clé', authKey10Digits: '0000000000', isRead: false }, ...(r.json.value || [])],
  version: r.json.version,
});
assert(r.status === 403, 'invitations : un agent ne peut pas envoyer de fausse notification');
r = await chef('GET', '/api/data/invitations');
r = await chef('PUT', '/api/data/invitations', {
  value: [{ id: 'inv-ok', inviterUserId: 'p-chef', invitedAgentId: 'p-ag2', invitedAgentMatricule: 'M2', hostEntityId: 'svc-vsat', status: 'active', expiresAt: '2099-01-01T00:00:00Z' }, ...(r.json.value || [])],
  version: r.json.version,
});
assert(r.status === 200, 'invitations : le chef invite un agent dans son service');
r = await tech('GET', '/api/data/x%E0%A4%A');
assert(r.status === 400, 'adresse mal formée : erreur 400 (pas de plantage)');

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

// ---------------------------------------------------------------------------
// Signature : confirmation du mot de passe par le serveur
// ---------------------------------------------------------------------------
r = await tech('POST', '/api/auth/verify-password', { password: 'Technicien-VSAT-2026' });
assert(r.status === 200 && r.json.ok && typeof r.json.serverTime === 'string', 'signature : bon mot de passe confirmé, heure fournie par le serveur');
r = await tech('POST', '/api/auth/verify-password', { password: 'mauvais-mot-2026' });
assert(r.status === 401, 'signature : mauvais mot de passe refusé');
r = await tech('POST', '/api/auth/verify-password', { password: 'Technicien-VSAT-2026' });
assert(r.status === 200, 'signature : un succès remet le compteur d\'échecs à zéro');

// ---------------------------------------------------------------------------
// Journal d'audit : auteur imposé par le serveur, chaîne vérifiable
// ---------------------------------------------------------------------------
const fakeId = `log-forge-${Date.now()}`;
r = await tech('PUT', '/api/data/auditLogs', { value: [{ id: fakeId, userName: 'Directeur Général', userRole: 'DG', ip: '1.2.3.4', timestamp: '2020-01-01 00:00:00', action: 'Action test', category: 'admin', details: 'essai' }], version: 0 });
assert(r.status === 200, 'agent : peut ajouter une entrée au journal');
let logs = (await boss('GET', '/api/data/auditLogs')).json.value;
const forgedLog = logs.find(l => l.id === fakeId);
assert(forgedLog && forgedLog.userName === 'Technicien Un' && forgedLog.ip !== '1.2.3.4' && !forgedLog.timestamp.startsWith('2020'), 'journal : auteur, heure et IP fixés par le serveur (pas d\'usurpation)');
// Renvoyer tout le journal (comme le fait l'application) ne doit ni dupliquer ni casser la chaîne
r = await boss('PUT', '/api/data/auditLogs', { value: logs, version: 0 });
assert(r.status === 200, 'journal : renvoi des entrées existantes accepté');
const logs2 = (await boss('GET', '/api/data/auditLogs')).json.value;
assert(logs2.length === logs.length, 'journal : entrées existantes non dupliquées');
r = await boss('GET', '/api/audit/verify');
assert(r.status === 200 && r.json.ok === true && r.json.count > 0, `journal : chaîne d'empreintes intacte (${r.json.count} entrées)`);
r = await tech('GET', '/api/audit/verify');
assert(r.status === 403, 'agent : vérification du journal réservée à la Direction');

// ---------------------------------------------------------------------------
// Verrouillage : agent verrouillé ; DG bloqué 15 minutes seulement
// ---------------------------------------------------------------------------
const anon = client();
for (let i = 0; i < 4; i++) await anon('POST', '/api/auth/login', { identifier: 'tech1@perm.cd', password: 'Faux-mot-2026' });
r = await anon('POST', '/api/auth/login', { identifier: 'tech1@perm.cd', password: 'Faux-mot-2026' });
assert(r.status === 423, 'agent : verrouillé après 5 échecs');
r = await anon('POST', '/api/auth/login', { identifier: 'tech1@perm.cd', password: 'Technicien-VSAT-2026' });
assert(r.status === 423, 'agent verrouillé : même le bon mot de passe est refusé');
let me = (await boss('GET', '/api/data/users')).json.value.find(x => x.id === 'p-ag1');
assert(me.status === 'verrouille', 'agent : statut « verrouillé » (réactivation par la Direction)');

// Mot de passe oublié : le chef réinitialise le compte de son agent (et le débloque).
r = await tech('POST', '/api/users/p-chef/reset-password', {});
assert(r.status === 401 || r.status === 403, 'réinitialisation : un agent ne peut pas réinitialiser le compte de son chef');
r = await chef('POST', '/api/users/p-ag2/reset-password', {});
assert(r.status === 403, 'réinitialisation : un chef ne réinitialise pas un agent d\'un autre service');
r = await chef('POST', '/api/users/p-ag1/reset-password', {});
assert(r.status === 200 && typeof r.json.temporaryPassword === 'string' && r.json.temporaryPassword.length >= 10, 'réinitialisation : mot de passe provisoire fourni une seule fois');
const fresh = client();
r = await fresh('POST', '/api/auth/login', { identifier: 'tech1@perm.cd', password: r.json.temporaryPassword });
assert(r.status === 200 && r.json.mustChangePassword === true, 'réinitialisation : compte débloqué, nouveau mot de passe obligatoire');
r = await fresh('GET', '/api/data');
assert(r.status === 403, 'réinitialisation : aucune donnée tant que le mot de passe n\'est pas changé');

// En dernier : le DG se bloque lui-même (temporairement).
for (let i = 0; i < 4; i++) {
  r = await anon('POST', '/api/auth/login', { identifier: DG.identifier, password: 'Faux-mot-DG-2026' });
}
assert(r.status === 401 && /blocage temporaire/.test(r.json.error), 'DG : message d\'avertissement « blocage temporaire »');
r = await anon('POST', '/api/auth/login', { identifier: DG.identifier, password: 'Faux-mot-DG-2026' });
assert(r.status === 423 && /15 minutes/.test(r.json.error), 'DG : bloqué 15 minutes après 5 échecs');
r = await anon('POST', '/api/auth/login', { identifier: DG.identifier, password: DG.password });
assert(r.status === 423, 'DG bloqué : connexion refusée pendant le blocage');
const dgRow = (await boss('GET', '/api/data/users')).json.value.find(x => x.role === 'dg' && x.email === DG.identifier);
assert(dgRow && dgRow.status === 'actif', 'DG : compte resté actif (pas de verrouillage définitif)');
r = await boss('GET', '/api/data/securityAlerts');
assert(Array.isArray(r.json.value) && r.json.value.some(a => /blocage temporaire/.test(a.reason)), 'DG : alerte de sécurité émise');

console.log(`\n${passed} vérifications de droits réussies.`);
