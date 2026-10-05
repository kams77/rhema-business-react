// server/app.mjs — API RHEMA Business + service des fichiers de l'application.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {
  MAX_FAILED_ATTEMPTS,
  SESSION_IDLE_MS,
  SESSION_MAX_MS,
  burnTime,
  hashPassword,
  hashToken,
  isPasswordHash,
  newSessionToken,
  safeEqualStrings,
  validatePasswordStrength,
  verifyPassword,
} from './auth.mjs';

const COOKIE = 'rhema_session';
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MAX_VALUE_CHARS = 20 * 1024 * 1024;
const AUDIT_LIMIT = 2000;
const DATA_KEY_RE = /^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/;
const USERS_VERSION_KEY = '_usersVersion';
const ROLES = new Set(['dg', 'chef_departement', 'directeur', 'chef_division', 'chef_service', 'agent']);

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; " +
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const nowStamp = (d = new Date()) =>
  d.toLocaleString('fr-FR', { timeZone: process.env.TZ || 'Africa/Kinshasa', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

const newId = prefix => `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

// ---------------------------------------------------------------------------
// Conversion utilisateur base <-> application
// ---------------------------------------------------------------------------
const SECRET_FIELDS = ['password', 'passwordHash'];
const COLUMN_FIELDS = ['id', 'organizationId', 'email', 'matricule', 'employeeCode', 'name', 'role', 'status',
  'failedAccessAttempts', 'mustChangePassword', 'lastLogin'];

export function toClientUser(u) {
  return {
    ...u.profile,
    id: u.id,
    organizationId: u.organizationId ?? u.profile?.organizationId,
    email: u.email,
    matricule: u.matricule ?? undefined,
    employeeCode: u.employeeCode ?? undefined,
    name: u.name,
    role: u.role,
    status: u.status,
    failedAccessAttempts: u.failedAttempts ?? 0,
    mustChangePassword: !!u.mustChangePassword,
    lastLogin: u.lastLogin ?? undefined,
  };
}

function profileOf(c) {
  const p = { ...c };
  for (const f of [...SECRET_FIELDS, ...COLUMN_FIELDS]) delete p[f];
  return p;
}

function validateClientUser(c) {
  if (!c || typeof c !== 'object') throw new HttpError(400, 'Compte invalide.');
  if (typeof c.id !== 'string' || !c.id || c.id.length > 64) throw new HttpError(400, 'Identifiant de compte invalide.');
  if (typeof c.email !== 'string' || !/^\S+@\S+\.\S+$/.test(c.email.trim()) || c.email.length > 190) {
    throw new HttpError(400, `Email invalide pour le compte « ${c.name ?? c.id} ».`);
  }
  if (typeof c.name !== 'string' || !c.name.trim()) throw new HttpError(400, 'Chaque compte doit avoir un nom.');
  if (!ROLES.has(c.role)) throw new HttpError(400, `Rôle inconnu pour ${c.name}.`);
}

/** Construit un utilisateur « base » à partir d'un compte venant de l'application. */
async function fromClientUser(c, existing, { allowHash }) {
  validateClientUser(c);
  let passwordHash = existing?.passwordHash ?? null;
  let mustChangePassword = existing ? existing.mustChangePassword : true;
  // Le mot de passe en clair n'est pris en compte qu'à la création du compte
  // (l'application le renvoie tant qu'elle n'a pas relu l'annuaire du serveur).
  if (!existing && typeof c.password === 'string' && c.password) {
    // Mot de passe provisoire fourni par la Direction : à changer à la première connexion.
    passwordHash = await hashPassword(c.password);
    mustChangePassword = c.mustChangePassword ?? true;
  } else if (allowHash && isPasswordHash(c.passwordHash)) {
    passwordHash = c.passwordHash;
    mustChangePassword = !!c.mustChangePassword;
  }
  return {
    id: c.id,
    organizationId: c.organizationId ?? existing?.organizationId ?? null,
    email: c.email.trim(),
    matricule: c.matricule || null,
    employeeCode: c.employeeCode || null,
    name: c.name.trim(),
    role: c.role,
    status: ['actif', 'verrouille', 'suspendu', 'convoque'].includes(c.status) ? c.status : 'actif',
    failedAttempts: Number.isInteger(c.failedAccessAttempts) ? c.failedAccessAttempts : existing?.failedAttempts ?? 0,
    mustChangePassword,
    passwordHash,
    lastLogin: existing?.lastLogin ?? c.lastLogin ?? null,
    profile: profileOf(c),
  };
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------
export function createApp({ db, config }) {
  const distDir = config.distDir;
  const staticCache = new Map();
  const loginAttempts = new Map(); // ip -> { count, resetAt }

  // --- utilitaires HTTP ----------------------------------------------------
  const isHttps = req =>
    !!req.socket.encrypted || (config.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https');

  const clientIp = req =>
    (config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';

  function baseHeaders(req) {
    const h = { ...SECURITY_HEADERS };
    if (isHttps(req)) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    return h;
  }

  function sendJson(req, res, status, body, extraHeaders = {}) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      ...baseHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    });
    res.end(payload);
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      const type = String(req.headers['content-type'] || '');
      // Exiger du JSON bloque les envois de formulaires depuis un autre site (protection CSRF).
      if (!type.includes('application/json')) return reject(new HttpError(415, 'Contenu JSON attendu.'));
      let size = 0;
      const chunks = [];
      req.on('data', c => {
        size += c.length;
        if (size > MAX_BODY_BYTES) {
          reject(new HttpError(413, 'Données trop volumineuses (25 Mo maximum).'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch {
          reject(new HttpError(400, 'JSON invalide.'));
        }
      });
      req.on('error', reject);
    });
  }

  function parseCookies(req) {
    const out = {};
    for (const part of String(req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  function sessionCookie(req, token, maxAgeSec) {
    return [
      `${COOKIE}=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${maxAgeSec}`,
      ...(isHttps(req) || config.cookieSecure ? ['Secure'] : []),
    ].join('; ');
  }

  // --- journal & alertes ---------------------------------------------------
  async function audit(actor, action, category, details) {
    await db.addAuditLogs([{
      id: newId('log'),
      timestamp: nowStamp(),
      userId: actor?.id,
      userName: actor?.name ?? 'Système',
      userRole: actor?.profile?.roleTitle ?? actor?.roleTitle ?? '',
      action,
      category,
      details,
      ip: 'Serveur',
      hash: newId('evt'),
    }]);
  }

  /** Ajoute un élément en tête d'une liste stockée (avec nouvel essai si un collègue écrit en même temps). */
  async function prependToData(key, item) {
    for (let i = 0; i < 5; i++) {
      const cur = await db.getData(key);
      const list = cur ? JSON.parse(cur.value) : [];
      const r = await db.putData(key, JSON.stringify([item, ...(Array.isArray(list) ? list : [])]), cur?.version ?? 0, null);
      if (r.ok) return;
    }
  }

  // --- session -------------------------------------------------------------
  async function loadSession(req) {
    const token = parseCookies(req)[COOKIE];
    if (!token) return null;
    const tokenHash = hashToken(token);
    const s = await db.getSession(tokenHash);
    if (!s) return null;
    const now = Date.now();
    if (now - s.lastSeen > SESSION_IDLE_MS || now - s.createdAt > SESSION_MAX_MS) {
      await db.deleteSession(tokenHash);
      return null;
    }
    const user = await db.getUser(s.userId);
    if (!user || user.status === 'verrouille' || user.status === 'suspendu') {
      await db.deleteSession(tokenHash);
      return null;
    }
    if (now - s.lastSeen > 60_000) await db.updateSession(tokenHash, { lastSeen: now });
    return { ...s, user };
  }

  async function requireSession(req, { allowPending = false } = {}) {
    const s = await loadSession(req);
    if (!s) throw new HttpError(401, 'Session expirée ou absente. Reconnectez-vous.');
    if (s.pending && !allowPending) throw new HttpError(403, 'Vous devez d\'abord choisir un nouveau mot de passe.');
    return s;
  }

  const requireDG = s => {
    if (s.user.role !== 'dg') throw new HttpError(403, 'Action réservée à la Direction Générale.');
  };

  // --- données -------------------------------------------------------------
  async function usersVersion() {
    return (await db.getData(USERS_VERSION_KEY))?.version ?? 0;
  }

  async function allVersions() {
    const v = await db.getVersions();
    const out = Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('_')));
    out.users = v[USERS_VERSION_KEY] ?? 0;
    out.auditLogs = await db.auditVersion();
    return out;
  }

  async function readKey(key) {
    if (key === 'users') return { value: (await db.listUsers()).map(toClientUser), version: await usersVersion() };
    if (key === 'auditLogs') return { value: await db.listAuditLogs(AUDIT_LIMIT), version: await db.auditVersion() };
    const d = await db.getData(key);
    return d ? { value: JSON.parse(d.value), version: d.version } : { value: null, version: 0 };
  }

  /** Synchronise l'annuaire envoyé par l'application avec la table « users ». */
  async function syncUsers(session, incoming) {
    const requester = session.user;
    if (requester.role === 'agent') throw new HttpError(403, 'Seuls les responsables peuvent modifier l\'annuaire.');
    if (!Array.isArray(incoming)) throw new HttpError(400, 'Liste de comptes attendue.');
    const existing = new Map((await db.listUsers()).map(u => [u.id, u]));
    const ids = new Set();
    const emails = new Set();
    const result = [];
    for (const c of incoming) {
      validateClientUser(c);
      if (ids.has(c.id)) throw new HttpError(400, `Compte en double : ${c.id}.`);
      const email = c.email.trim().toLowerCase();
      if (emails.has(email)) throw new HttpError(400, `L'email ${c.email} est utilisé par deux comptes.`);
      ids.add(c.id);
      emails.add(email);
      const prev = existing.get(c.id);
      if (requester.role !== 'dg') {
        // Un responsable ne peut ni attribuer le rôle DG, ni modifier un compte de Direction Générale.
        if (c.role === 'dg' && prev?.role !== 'dg') {
          throw new HttpError(403, 'Seule la Direction Générale peut attribuer le rôle DG.');
        }
        if (prev?.role === 'dg') {
          const changed = ['email', 'name', 'role', 'status'].some(f => String(c[f] ?? '') !== String(toClientUser(prev)[f] ?? ''));
          if (changed) throw new HttpError(403, 'Seule la Direction Générale peut modifier un compte DG.');
        }
      }
      result.push(await fromClientUser(c, prev, { allowHash: false }));
    }
    for (const prev of existing.values()) {
      if (!ids.has(prev.id)) {
        if (prev.id === requester.id) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte.');
        if (prev.role === 'dg' && requester.role !== 'dg') throw new HttpError(403, 'Seule la Direction Générale peut supprimer un compte DG.');
      }
    }
    // Le compte du demandeur ne peut pas être suspendu par lui-même.
    const self = result.find(u => u.id === requester.id);
    if (self && self.status !== 'actif') throw new HttpError(400, 'Vous ne pouvez pas suspendre votre propre compte.');
    if (!result.some(u => u.role === 'dg' && u.status === 'actif')) {
      throw new HttpError(400, 'L\'annuaire doit conserver au moins un compte DG actif.');
    }
    try {
      await db.replaceUsers(result);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(400, 'Un email est déjà utilisé par un autre compte.');
      throw err;
    }
    await db.bump(USERS_VERSION_KEY);
  }

  /** Prépare une liste d'utilisateurs pour l'initialisation ou la restauration. */
  async function prepareUsers(list) {
    if (!Array.isArray(list) || list.length === 0) throw new HttpError(400, 'Au moins un compte est nécessaire.');
    const out = [];
    const emails = new Set();
    for (const c of list) {
      const u = await fromClientUser(c, null, { allowHash: true });
      const e = u.email.toLowerCase();
      if (emails.has(e)) throw new HttpError(400, `L'email ${u.email} est utilisé par deux comptes.`);
      emails.add(e);
      if (!u.passwordHash) throw new HttpError(400, `Le compte ${u.name} n'a pas de mot de passe.`);
      if (typeof c.password === 'string' && c.password && u.role === 'dg') {
        // Le DG garde son mot de passe s'il est robuste ; sinon il devra le changer.
        u.mustChangePassword = validatePasswordStrength(c.password, u) !== null;
      }
      out.push(u);
    }
    if (!out.some(u => u.role === 'dg')) throw new HttpError(400, 'Il faut au moins un compte Direction Générale (DG).');
    return out;
  }

  function prepareDataEntries(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Données invalides.');
    const entries = [];
    for (const [k, v] of Object.entries(data)) {
      if (k === 'users' || k === 'auditLogs' || k === 'session') continue;
      if (!DATA_KEY_RE.test(k)) throw new HttpError(400, `Nom de donnée invalide : ${k}`);
      const json = JSON.stringify(v);
      if (json.length > MAX_VALUE_CHARS) throw new HttpError(413, `Donnée « ${k} » trop volumineuse.`);
      entries.push([k, json]);
    }
    return entries;
  }

  function prepareAudit(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(e => e && typeof e === 'object' && typeof e.id === 'string').slice(0, AUDIT_LIMIT).reverse();
  }

  // --- routes API ----------------------------------------------------------
  async function handleApi(req, res, url) {
    const method = req.method;
    const p = url.pathname;

    if (p === '/api/health' && method === 'GET') {
      await db.ping();
      return sendJson(req, res, 200, { ok: true, storage: db.kind });
    }

    if (p === '/api/public/status' && method === 'GET') {
      const initialized = (await db.countUsers()) > 0;
      const org = (await db.getData('currentOrg'))?.value;
      const o = org ? JSON.parse(org) : null;
      return sendJson(req, res, 200, {
        initialized,
        setupCodeRequired: !!config.setupCode,
        organization: o ? { id: o.id, name: o.name, logo: o.logo, registrationNumber: o.registrationNumber, type: o.type } : null,
      });
    }

    if (p === '/api/setup' && method === 'POST') {
      const body = await readJson(req);
      if ((await db.countUsers()) > 0) throw new HttpError(409, 'L\'application est déjà initialisée.');
      if (config.setupCode && !safeEqualStrings(body.setupCode ?? '', config.setupCode)) {
        throw new HttpError(403, 'Code d\'installation incorrect (variable SETUP_CODE du serveur).');
      }
      const users = await prepareUsers(body.users);
      const entries = prepareDataEntries(body.data ?? {});
      const auditEntries = prepareAudit(body.data?.auditLogs);
      try {
        await db.replaceAllData(entries, users, auditEntries);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new HttpError(400, 'Deux comptes utilisent le même email.');
        throw err;
      }
      await db.bump(USERS_VERSION_KEY);
      const dg = users.find(u => u.role === 'dg');
      await audit(dg, 'Initialisation du serveur', 'admin', `Base initialisée avec ${users.length} compte(s) et ${entries.length} module(s) de données.`);
      return sendJson(req, res, 201, { ok: true, users: users.length });
    }

    if (p === '/api/auth/login' && method === 'POST') {
      const ip = clientIp(req);
      const now = Date.now();
      const rl = loginAttempts.get(ip);
      if (rl && rl.resetAt > now && rl.count >= 30) {
        throw new HttpError(429, 'Trop de tentatives depuis ce poste. Réessayez dans quelques minutes.');
      }
      loginAttempts.set(ip, rl && rl.resetAt > now ? { ...rl, count: rl.count + 1 } : { count: 1, resetAt: now + 15 * 60_000 });

      const body = await readJson(req);
      const identifier = String(body.identifier ?? '').slice(0, 190);
      const password = String(body.password ?? '');
      const generic = 'Identifiant ou mot de passe incorrect.';
      const user = identifier ? await db.findUserByLogin(identifier) : null;
      if (!user || !user.passwordHash) {
        await burnTime(password);
        throw new HttpError(401, generic);
      }
      if (user.status === 'verrouille' || user.status === 'suspendu') {
        throw new HttpError(423, 'Accès refusé : ce compte est verrouillé. Contactez la Direction Générale pour le débloquer.');
      }
      if (!(await verifyPassword(password, user.passwordHash))) {
        const attempts = (user.failedAttempts ?? 0) + 1;
        const lock = attempts >= MAX_FAILED_ATTEMPTS;
        await db.updateUser(user.id, { failedAttempts: attempts, status: lock ? 'verrouille' : user.status });
        await db.bump(USERS_VERSION_KEY);
        await audit(user, lock ? 'VERROUILLAGE COMPTE (MOTS DE PASSE ERRONÉS)' : 'Échec de Connexion', 'security',
          `Mot de passe erroné pour ${user.name} (tentative ${attempts}/${MAX_FAILED_ATTEMPTS}).${lock ? ' Compte verrouillé.' : ''}`);
        if (lock) {
          await prependToData('securityAlerts', {
            id: newId('sec'), timestamp: nowStamp(), userId: user.id, userName: user.name, userRole: user.role,
            userEntityName: user.profile?.departmentName || user.profile?.roleTitle || '', targetEntityId: 'auth',
            targetEntityName: 'Écran de connexion', attemptCount: attempts, status: 'compte_verrouille',
            severity: 'critique', ipAddress: ip, reason: `${attempts} mots de passe erronés consécutifs : compte verrouillé automatiquement.`,
          });
          throw new HttpError(423, 'Trop de tentatives : le compte a été verrouillé. Contactez la Direction Générale.');
        }
        const remaining = MAX_FAILED_ATTEMPTS - attempts;
        throw new HttpError(401, `${generic} Il vous reste ${remaining} essai${remaining > 1 ? 's' : ''} avant le verrouillage du compte.`);
      }

      const lastLogin = nowStamp();
      await db.updateUser(user.id, { failedAttempts: 0, lastLogin });
      await db.bump(USERS_VERSION_KEY);
      const token = newSessionToken();
      await db.createSession({
        tokenHash: hashToken(token), userId: user.id, pending: user.mustChangePassword,
        createdAt: now, lastSeen: now, ip, userAgent: String(req.headers['user-agent'] || ''),
      });
      loginAttempts.delete(ip);
      await audit(user, 'Connexion Certifiée (Identifiants)', 'auth', `Authentification réussie pour ${user.name} (${user.role.toUpperCase()}).`);
      return sendJson(req, res, 200,
        { user: toClientUser({ ...user, lastLogin, failedAttempts: 0 }), mustChangePassword: user.mustChangePassword },
        { 'Set-Cookie': sessionCookie(req, token, Math.floor(SESSION_MAX_MS / 1000)) });
    }

    if (p === '/api/auth/me' && method === 'GET') {
      const s = await loadSession(req);
      if (!s) throw new HttpError(401, 'Non connecté.');
      return sendJson(req, res, 200, { user: toClientUser(s.user), mustChangePassword: s.pending });
    }

    if (p === '/api/auth/change-password' && method === 'POST') {
      const s = await requireSession(req, { allowPending: true });
      const body = await readJson(req);
      if (!s.pending && !(await verifyPassword(String(body.currentPassword ?? ''), s.user.passwordHash))) {
        throw new HttpError(400, 'Mot de passe actuel incorrect.');
      }
      const next = String(body.newPassword ?? '');
      const weak = validatePasswordStrength(next, s.user);
      if (weak) throw new HttpError(400, weak);
      if (await verifyPassword(next, s.user.passwordHash)) throw new HttpError(400, 'Le nouveau mot de passe doit être différent de l\'ancien.');
      await db.updateUser(s.user.id, { passwordHash: await hashPassword(next), mustChangePassword: false });
      await db.bump(USERS_VERSION_KEY);
      await db.updateSession(s.tokenHash, { pending: false });
      await db.deleteUserSessions(s.user.id, s.tokenHash); // déconnecte les autres appareils
      await audit(s.user, 'Changement de Mot de Passe', 'security', `${s.user.name} a défini un nouveau mot de passe personnel.`);
      return sendJson(req, res, 200, { user: toClientUser({ ...s.user, mustChangePassword: false }) });
    }

    if (p === '/api/auth/logout' && method === 'POST') {
      const s = await loadSession(req);
      if (s) {
        await db.deleteSession(s.tokenHash);
        await audit(s.user, 'Clôture de Session (Déconnexion)', 'auth', `Session de ${s.user.name} fermée.`);
      }
      return sendJson(req, res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
    }

    // ----- Données (session obligatoire) -----
    if (p === '/api/data' && method === 'GET') {
      await requireSession(req);
      const values = {};
      const versions = {};
      for (const row of await db.getAllData()) {
        if (row.key.startsWith('_')) continue;
        values[row.key] = JSON.parse(row.value);
        versions[row.key] = row.version;
      }
      for (const key of ['users', 'auditLogs']) {
        const r = await readKey(key);
        values[key] = r.value;
        versions[key] = r.version;
      }
      return sendJson(req, res, 200, { values, versions });
    }

    if (p === '/api/data/versions' && method === 'GET') {
      await requireSession(req);
      return sendJson(req, res, 200, { versions: await allVersions() });
    }

    if (p === '/api/data/export' && method === 'GET') {
      const s = await requireSession(req);
      requireDG(s);
      const data = {};
      for (const row of await db.getAllData()) if (!row.key.startsWith('_')) data[row.key] = JSON.parse(row.value);
      data.users = (await db.listUsers()).map(u => ({ ...toClientUser(u), passwordHash: u.passwordHash }));
      data.auditLogs = await db.listAuditLogs(AUDIT_LIMIT);
      await audit(s.user, 'Export de sauvegarde', 'admin', 'Téléchargement d\'une sauvegarde complète depuis le serveur.');
      return sendJson(req, res, 200, { app: 'rhema-business', version: 1, exportedAt: new Date().toISOString(), data }, {
        'Content-Disposition': `attachment; filename="rhema-sauvegarde-${new Date().toISOString().slice(0, 10)}.json"`,
      });
    }

    if (p === '/api/data/import' && method === 'POST') {
      const s = await requireSession(req);
      requireDG(s);
      const backup = await readJson(req);
      if (!backup || backup.app !== 'rhema-business' || typeof backup.data !== 'object') {
        throw new HttpError(400, 'Ce fichier n\'est pas une sauvegarde RHEMA Business.');
      }
      const users = await prepareUsers(backup.data.users);
      if (!users.some(u => u.id === s.user.id || u.email.toLowerCase() === s.user.email.toLowerCase())) {
        throw new HttpError(400, 'Votre propre compte doit figurer dans la sauvegarde restaurée.');
      }
      const entries = prepareDataEntries(backup.data);
      const auditEntries = prepareAudit(backup.data.auditLogs);
      await db.replaceAllData(entries, users, auditEntries);
      await db.bump(USERS_VERSION_KEY);
      await audit(s.user, 'Restauration de sauvegarde', 'admin', `Restauration complète (${users.length} comptes, ${entries.length} modules).`);
      return sendJson(req, res, 200, { ok: true, relogin: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
    }

    const m = p.match(/^\/api\/data\/([^/]+)$/);
    if (m) {
      const key = decodeURIComponent(m[1]);
      if (!DATA_KEY_RE.test(key)) throw new HttpError(400, 'Nom de donnée invalide.');
      const s = await requireSession(req);

      if (method === 'GET') return sendJson(req, res, 200, await readKey(key));

      if (method === 'PUT') {
        const body = await readJson(req);
        if (!('value' in body)) throw new HttpError(400, 'Valeur manquante.');

        if (key === 'auditLogs') {
          // Journal en ajout seul : les entrées existantes ne sont jamais modifiées ni supprimées.
          const list = Array.isArray(body.value) ? body.value : [];
          const entries = list.filter(e => e && typeof e === 'object' && typeof e.id === 'string' && e.id.length <= 120).slice(0, AUDIT_LIMIT);
          await db.addAuditLogs(entries.reverse());
          return sendJson(req, res, 200, { version: await db.auditVersion() });
        }

        if (key === 'users') {
          const current = await usersVersion();
          if (body.version !== current) {
            return sendJson(req, res, 409, { error: 'conflict', value: (await db.listUsers()).map(toClientUser), version: current });
          }
          await syncUsers(s, body.value);
          return sendJson(req, res, 200, { version: await usersVersion() });
        }

        if (key === 'organizations') requireDG(s);
        const json = JSON.stringify(body.value);
        if (json.length > MAX_VALUE_CHARS) throw new HttpError(413, 'Donnée trop volumineuse.');
        const r = await db.putData(key, json, Number(body.version) || 0, s.user.id);
        if (!r.ok) {
          return sendJson(req, res, 409, {
            error: 'conflict',
            value: r.current.value === null ? null : JSON.parse(r.current.value),
            version: r.current.version,
          });
        }
        return sendJson(req, res, 200, { version: r.version });
      }
    }

    throw new HttpError(404, 'Route inconnue.');
  }

  // --- fichiers de l'application ------------------------------------------
  function serveStatic(req, res, url) {
    if (!distDir || !fs.existsSync(distDir)) {
      res.writeHead(404, { ...baseHeaders(req), 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Application non compilée (dossier dist introuvable).');
    }
    let rel = decodeURIComponent(url.pathname);
    let file = path.join(distDir, path.normalize(rel).replace(/^([/\\])+/, ''));
    if (!file.startsWith(distDir)) file = path.join(distDir, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(distDir, 'index.html');
      rel = '/index.html';
    }
    const ext = path.extname(file).toLowerCase();
    const isAsset = rel.startsWith('/assets/');
    let entry = staticCache.get(file);
    if (!entry) {
      const raw = fs.readFileSync(file);
      const compressible = ['.html', '.js', '.css', '.json', '.svg', '.txt'].includes(ext);
      entry = { raw, gz: compressible && raw.length > 1024 ? zlib.gzipSync(raw) : null };
      if (!config.dev) staticCache.set(file, entry);
    }
    const useGzip = entry.gz && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
    res.writeHead(200, {
      ...baseHeaders(req),
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...(useGzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
    });
    res.end(req.method === 'HEAD' ? undefined : useGzip ? entry.gz : entry.raw);
  }

  // --- point d'entrée --------------------------------------------------------
  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Méthode non autorisée.');
      return serveStatic(req, res, url);
    } catch (err) {
      if (err instanceof HttpError) {
        return sendJson(req, res, err.status, { error: err.message, ...(err.extra || {}) });
      }
      console.error('[api] Erreur interne :', err);
      return sendJson(req, res, 500, { error: 'Erreur interne du serveur. Consultez les journaux du conteneur.' });
    }
  };
}
