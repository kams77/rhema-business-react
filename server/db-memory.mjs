// server/db-memory.mjs — stockage en mémoire (tests et essais sans base de données).
// Même interface que db-mysql.mjs. Les données sont perdues à l'arrêt du serveur.

const clone = v => (v === undefined ? v : structuredClone(v));

export function createMemoryDb() {
  const users = new Map();
  const sessions = new Map();
  const data = new Map(); // key -> { value: string, version: number }
  const audit = []; // { seq, entry }
  let seq = 0;

  const loginTaken = (email, exceptId) =>
    [...users.values()].some(u => u.id !== exceptId && u.email.trim().toLowerCase() === String(email).trim().toLowerCase());

  const putRaw = (key, value) => {
    const cur = data.get(key);
    data.set(key, { value, version: (cur?.version ?? 0) + 1 });
  };

  return {
    kind: 'memory',
    async migrate() {},
    async ping() {},
    async close() {},

    async countUsers() { return users.size; },
    async listUsers() { return [...users.values()].map(clone); },
    async getUser(id) { return clone(users.get(id)) ?? null; },
    async findUserByLogin(identifier) {
      const v = String(identifier).trim().toLowerCase();
      const u = [...users.values()].find(x =>
        x.email.trim().toLowerCase() === v ||
        (x.matricule && x.matricule.toLowerCase() === v) ||
        (x.employeeCode && x.employeeCode.toLowerCase() === v));
      return clone(u) ?? null;
    },
    async updateUser(id, fields) {
      const cur = users.get(id);
      if (cur) users.set(id, { ...cur, ...clone(fields) });
    },
    async replaceUsers(list) {
      const seen = new Set();
      for (const u of list) {
        if (seen.has(u.email.trim().toLowerCase())) {
          const err = new Error('Duplicate entry'); err.code = 'ER_DUP_ENTRY'; throw err;
        }
        seen.add(u.email.trim().toLowerCase());
      }
      const keep = new Set(list.map(u => u.id));
      for (const id of [...users.keys()]) {
        if (!keep.has(id)) {
          users.delete(id);
          for (const [h, s] of sessions) if (s.userId === id) sessions.delete(h);
        }
      }
      for (const u of list) users.set(u.id, clone(u));
    },

    async createSession(s) { sessions.set(s.tokenHash, clone(s)); },
    async getSession(h) { return clone(sessions.get(h)) ?? null; },
    async updateSession(h, fields) { const s = sessions.get(h); if (s) Object.assign(s, fields); },
    async deleteSession(h) { sessions.delete(h); },
    async deleteUserSessions(userId, except) {
      for (const [h, s] of sessions) if (s.userId === userId && h !== except) sessions.delete(h);
    },
    async purgeSessions(olderThan) {
      for (const [h, s] of sessions) if (s.lastSeen < olderThan) sessions.delete(h);
    },

    async getAllData() { return [...data].map(([key, d]) => ({ key, ...d })); },
    async getData(key) { return clone(data.get(key)) ?? null; },
    async getVersions() { return Object.fromEntries([...data].map(([k, d]) => [k, d.version])); },
    async putData(key, value, expectedVersion) {
      const cur = data.get(key);
      const v = cur?.version ?? 0;
      if (v !== expectedVersion) return { ok: false, current: { value: cur?.value ?? null, version: v } };
      putRaw(key, value);
      return { ok: true, version: v + 1 };
    },
    async bump(key) { putRaw(key, '""'); },
    async replaceAllData(entries, newUsers, auditEntries) {
      data.clear();
      for (const [k, v] of entries) putRaw(k, v);
      if (newUsers) {
        sessions.clear();
        users.clear();
        for (const u of newUsers) {
          if (loginTaken(u.email, u.id)) { const e = new Error('Duplicate entry'); e.code = 'ER_DUP_ENTRY'; throw e; }
          users.set(u.id, clone(u));
        }
      }
      if (auditEntries) {
        audit.length = 0;
        for (const e of auditEntries) audit.push({ seq: ++seq, entry: clone(e) });
      }
    },

    async addAuditLogs(entries) {
      for (const e of entries) {
        if (!audit.some(a => a.entry.id === e.id)) audit.push({ seq: ++seq, entry: clone(e) });
      }
    },
    async listAuditLogs(limit) { return audit.slice(-limit).reverse().map(a => clone(a.entry)); },
    async auditVersion() { return seq; },
  };
}
