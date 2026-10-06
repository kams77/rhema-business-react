// Tests de l'API RHEMA Business.
// Usage : BASE_URL=http://localhost:8080 SETUP_CODE=xxx node server/tests/api.test.mjs
// Le serveur doit être vide (jamais initialisé).
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SETUP_CODE = process.env.SETUP_CODE || 'code-test';
let passed = 0;

function assert(cond, msg) {
  if (!cond) { console.error(`✗ ${msg}`); process.exit(1); }
  passed++;
  console.log(`✓ ${msg}`);
}

/** Petit client HTTP qui garde le cookie de session (comme un navigateur). */
function client() {
  let cookie = '';
  return async function call(method, url, body, { contentType = 'application/json' } = {}) {
    const res = await fetch(BASE + url, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': contentType } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    let json = null;
    try { json = await res.json(); } catch { /* corps non JSON */ }
    return { status: res.status, json, headers: res.headers };
  };
}

const org = { id: 'org-test', name: 'RHEMA TEST SARL', type: 'entreprise', registrationNumber: 'RCCM/TEST', headquarters: 'Kinshasa', email: 'contact@test.cd', phone: '+243' };
const dg = { id: 'u-dg', name: 'Directrice Test', email: 'dg@test.cd', role: 'dg', roleTitle: 'Directrice Générale', organizationId: org.id, status: 'actif', failedAccessAttempts: 0, canCreateSubAgents: true, password: 'Kinshasa-Gombe-2026' };
const agent = { id: 'u-ag', name: 'Agent Test', email: 'agent@test.cd', matricule: 'MAT-007', role: 'agent', roleTitle: 'Technicien VSAT', organizationId: org.id, status: 'actif', failedAccessAttempts: 0, canCreateSubAgents: false, password: 'Provisoire-1234' };

const anon = client();
const boss = client();
const tech = client();

// --- Avant initialisation ---
let r = await anon('GET', '/api/health');
assert(r.status === 200 && r.json.ok, 'santé du serveur');
r = await anon('GET', '/api/public/status');
assert(r.status === 200 && r.json.initialized === false, 'serveur non initialisé');
r = await anon('GET', '/api/data');
assert(r.status === 401, 'données inaccessibles sans connexion');

// --- Initialisation ---
const setupBody = { setupCode: 'mauvais', users: [dg, agent], data: { organizations: [org], currentOrg: org, entities: [], documents: [], auditLogs: [] } };
r = await anon('POST', '/api/setup', setupBody);
assert(r.status === 403, 'initialisation refusée avec un mauvais code');
r = await anon('POST', '/api/setup', { ...setupBody, setupCode: SETUP_CODE });
assert(r.status === 201, 'initialisation réussie');
r = await anon('POST', '/api/setup', { ...setupBody, setupCode: SETUP_CODE });
assert(r.status === 409, 'pas de seconde initialisation');
r = await anon('GET', '/api/public/status');
assert(r.json.initialized && r.json.organization.name === org.name, 'statut public : organisation visible');

// --- Protection CSRF ---
r = await anon('POST', '/api/auth/login', 'identifier=dg@test.cd', { contentType: 'application/x-www-form-urlencoded' });
assert(r.status === 415, 'requête non JSON refusée');

// --- Connexion DG ---
r = await boss('POST', '/api/auth/login', { identifier: 'dg@test.cd', password: 'faux-mot-de-passe' });
assert(r.status === 401 && /4 essais/.test(r.json.error), 'mauvais mot de passe : essais restants');
r = await boss('POST', '/api/auth/login', { identifier: 'DG@test.cd', password: dg.password });
assert(r.status === 200 && r.json.mustChangePassword === false, 'connexion DG (mot de passe robuste conservé)');
assert(/HttpOnly/i.test(r.headers.get('set-cookie')) && /SameSite=Strict/i.test(r.headers.get('set-cookie')), 'cookie HttpOnly + SameSite');
r = await boss('GET', '/api/data');
assert(r.status === 200 && r.json.values.users.length === 2, 'chargement des données');
assert(r.json.values.users.every(u => !u.passwordHash && !u.password), 'aucun mot de passe renvoyé');
assert(r.json.values.auditLogs.some(l => /Connexion/.test(l.action)), 'connexion inscrite au journal');
const versions = r.json.versions;

// --- Écriture avec contrôle de version ---
r = await boss('PUT', '/api/data/documents', { value: [{ id: 'd1', title: 'Contrat' }], version: versions.documents });
assert(r.status === 200 && r.json.version === versions.documents + 1, 'écriture d\'un module');
r = await boss('PUT', '/api/data/documents', { value: [], version: versions.documents });
assert(r.status === 409 && r.json.value[0].id === 'd1', 'conflit détecté (version périmée)');
r = await boss('PUT', '/api/data/logistics.hubs', { value: [{ id: 'h1' }], version: 0 });
assert(r.status === 200 && r.json.version === 1, 'création d\'un nouveau module');
r = await boss('PUT', '/api/data/..%2Fetc', { value: 1, version: 0 });
assert(r.status === 400, 'nom de donnée invalide refusé');

// --- Journal en ajout seul ---
r = await boss('PUT', '/api/data/auditLogs', { value: [{ id: 'log-client-1', action: 'Test', timestamp: 'x', category: 'admin', details: '', userName: 'DG', userRole: 'DG', ip: '', hash: '' }], version: 0 });
assert(r.status === 200, 'ajout au journal');
r = await boss('PUT', '/api/data/auditLogs', { value: [], version: 0 });
r = await boss('GET', '/api/data/auditLogs');
assert(r.json.value.some(l => l.id === 'log-client-1'), 'le journal ne peut pas être vidé');

// --- Agent : changement de mot de passe obligatoire ---
r = await tech('POST', '/api/auth/login', { identifier: 'mat-007', password: agent.password });
assert(r.status === 200 && r.json.mustChangePassword === true, 'agent connecté par matricule, changement exigé');
r = await tech('GET', '/api/data');
assert(r.status === 403, 'données bloquées tant que le mot de passe n\'est pas changé');
r = await tech('POST', '/api/auth/change-password', { newPassword: 'court1' });
assert(r.status === 400, 'mot de passe faible refusé');
r = await tech('POST', '/api/auth/change-password', { newPassword: 'Technicien-Kin-2026' });
assert(r.status === 200, 'nouveau mot de passe enregistré');
r = await tech('GET', '/api/data');
assert(r.status === 200, 'accès aux données après changement');

// --- Droits ---
const usersVersion = r.json.versions.users;
r = await tech('PUT', '/api/data/users', { value: r.json.values.users, version: usersVersion });
assert(r.status === 403, 'un agent ne peut pas modifier l\'annuaire');
r = await tech('PUT', '/api/data/organizations', { value: [], version: 1 });
assert(r.status === 403, 'un agent ne peut pas modifier les organisations');
r = await tech('GET', '/api/data/export');
assert(r.status === 403, 'un agent ne peut pas exporter');

// --- Verrouillage après 5 erreurs ---
const intruder = client();
for (let i = 1; i <= 4; i++) await intruder('POST', '/api/auth/login', { identifier: 'agent@test.cd', password: `faux-${i}` });
r = await intruder('POST', '/api/auth/login', { identifier: 'agent@test.cd', password: 'faux-5' });
assert(r.status === 423, 'compte verrouillé après 5 erreurs');
r = await intruder('POST', '/api/auth/login', { identifier: 'agent@test.cd', password: 'Technicien-Kin-2026' });
assert(r.status === 423, 'même le bon mot de passe est refusé une fois verrouillé');
r = await tech('GET', '/api/data');
assert(r.status === 401, 'la session de l\'agent verrouillé est fermée');
r = await boss('GET', '/api/data');
assert(r.json.values.securityAlerts?.[0]?.status === 'compte_verrouille', 'alerte de sécurité créée');

// --- Le DG débloque l'agent et crée un compte ---
let users = r.json.values.users.map(u => (u.id === agent.id ? { ...u, status: 'actif', failedAccessAttempts: 0 } : u));
users.push({ id: 'u-new', name: 'Nouvelle Recrue', email: 'recrue@test.cd', role: 'agent', roleTitle: 'Comptable', organizationId: org.id, status: 'actif', failedAccessAttempts: 0, canCreateSubAgents: false, password: 'Temp-Recrue-99' });
r = await boss('PUT', '/api/data/users', { value: users, version: r.json.versions.users });
assert(r.status === 200, 'annuaire mis à jour par le DG');
r = await tech('POST', '/api/auth/login', { identifier: 'agent@test.cd', password: 'Technicien-Kin-2026' });
assert(r.status === 200 && !r.json.mustChangePassword, 'agent débloqué peut se reconnecter');
const recruit = client();
r = await recruit('POST', '/api/auth/login', { identifier: 'recrue@test.cd', password: 'Temp-Recrue-99' });
assert(r.status === 200 && r.json.mustChangePassword, 'nouveau compte : mot de passe provisoire à changer');

// Renvoyer l'annuaire avec le mot de passe provisoire ne doit pas le réinitialiser.
r = await boss('GET', '/api/data/users');
r = await boss('PUT', '/api/data/users', { value: users, version: r.json.version });
assert(r.status === 200, 'renvoi de l\'annuaire');
r = await recruit('POST', '/api/auth/change-password', { newPassword: 'Comptable-Kin-2026' });
r = await client()('POST', '/api/auth/login', { identifier: 'recrue@test.cd', password: 'Comptable-Kin-2026' });
assert(r.status === 200 && !r.json.mustChangePassword, 'le mot de passe choisi reste valable');

// --- Export / import ---
r = await boss('GET', '/api/data/export');
assert(r.status === 200 && r.json.data.users.every(u => u.passwordHash), 'export complet (avec empreintes)');
const backup = r.json;
backup.data.documents = [{ id: 'restaure', title: 'Document restauré' }];
r = await boss('POST', '/api/data/import', backup);
assert(r.status === 200 && r.json.relogin, 'restauration réussie');
r = await boss('GET', '/api/data');
assert(r.status === 401, 'reconnexion exigée après restauration');
r = await boss('POST', '/api/auth/login', { identifier: 'dg@test.cd', password: dg.password });
r = await boss('GET', '/api/data');
assert(r.json.values.documents[0].id === 'restaure', 'données restaurées');

// --- Déconnexion ---
r = await boss('POST', '/api/auth/logout', {});
r = await boss('GET', '/api/auth/me');
assert(r.status === 401, 'déconnexion effective');

// --- Fichiers de l'application ---
r = await fetch(BASE + '/');
const html = await r.text();
if (r.status === 200 && html.includes('id="root"')) {
  assert(/default-src 'self'/.test(r.headers.get('content-security-policy') || ''), 'page servie avec CSP');
} else {
  console.log('• (application non compilée : test des fichiers ignoré)');
}

console.log(`\n${passed} vérifications réussies.`);
