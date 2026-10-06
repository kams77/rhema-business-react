// server/db-mysql.mjs — stockage MariaDB / MySQL.
import mysql from 'mysql2/promise';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id VARCHAR(64) NOT NULL PRIMARY KEY,
     organization_id VARCHAR(64) NULL,
     email VARCHAR(190) NOT NULL,
     login_email VARCHAR(190) NOT NULL,
     matricule VARCHAR(64) NULL,
     employee_code VARCHAR(64) NULL,
     name VARCHAR(190) NOT NULL,
     role VARCHAR(40) NOT NULL,
     status VARCHAR(20) NOT NULL DEFAULT 'actif',
     failed_attempts INT NOT NULL DEFAULT 0,
     must_change_password TINYINT(1) NOT NULL DEFAULT 0,
     password_hash VARCHAR(255) NULL,
     last_login VARCHAR(40) NULL,
     profile LONGTEXT NOT NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY uq_users_login_email (login_email),
     KEY ix_users_matricule (matricule),
     KEY ix_users_employee_code (employee_code)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash CHAR(64) NOT NULL PRIMARY KEY,
     user_id VARCHAR(64) NOT NULL,
     pending_password_change TINYINT(1) NOT NULL DEFAULT 0,
     created_at BIGINT NOT NULL,
     last_seen BIGINT NOT NULL,
     ip VARCHAR(64) NULL,
     user_agent VARCHAR(255) NULL,
     KEY ix_sessions_user (user_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS app_data (
     data_key VARCHAR(64) NOT NULL PRIMARY KEY,
     value LONGTEXT NOT NULL,
     version INT NOT NULL DEFAULT 1,
     updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     updated_by VARCHAR(64) NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
     seq BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     id VARCHAR(120) NOT NULL,
     entry LONGTEXT NOT NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_audit_id (id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const toUser = r => r && ({
  id: r.id,
  organizationId: r.organization_id,
  email: r.email,
  matricule: r.matricule,
  employeeCode: r.employee_code,
  name: r.name,
  role: r.role,
  status: r.status,
  failedAttempts: r.failed_attempts,
  mustChangePassword: !!r.must_change_password,
  passwordHash: r.password_hash,
  lastLogin: r.last_login,
  profile: JSON.parse(r.profile || '{}'),
});

const userColumns = u => ({
  organization_id: u.organizationId ?? null,
  email: u.email,
  login_email: String(u.email).trim().toLowerCase(),
  matricule: u.matricule ?? null,
  employee_code: u.employeeCode ?? null,
  name: u.name,
  role: u.role,
  status: u.status ?? 'actif',
  failed_attempts: u.failedAttempts ?? 0,
  must_change_password: u.mustChangePassword ? 1 : 0,
  password_hash: u.passwordHash ?? null,
  last_login: u.lastLogin ?? null,
  profile: JSON.stringify(u.profile ?? {}),
});

export async function createMysqlDb(config) {
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 10,
    charset: 'utf8mb4',
    dateStrings: true,
    supportBigNumbers: true,
  });

  // Attente de la base au démarrage (le conteneur MariaDB peut démarrer après l'application).
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      if (attempt >= 30) throw err;
      console.log(`[db] Base indisponible (${err.code || err.message}), nouvel essai dans 2 s… (${attempt}/30)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Exécute fn avec une connexion transactionnelle ; « q » est la fonction de requête à utiliser.
  async function transaction(fn) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback().catch(() => {});
      throw err;
    } finally {
      conn.release();
    }
  }

  const insertUserSql = async (q, u) => {
    const c = userColumns(u);
    await q.query(
      `INSERT INTO users (id, organization_id, email, login_email, matricule, employee_code, name, role, status,
         failed_attempts, must_change_password, password_hash, last_login, profile)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [u.id, c.organization_id, c.email, c.login_email, c.matricule, c.employee_code, c.name, c.role, c.status,
        c.failed_attempts, c.must_change_password, c.password_hash, c.last_login, c.profile]
    );
  };

  const putDataSql = async (q, key, value, userId) => {
    await q.query(
      `INSERT INTO app_data (data_key, value, version, updated_by) VALUES (?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), version = version + 1, updated_by = VALUES(updated_by)`,
      [key, value, userId ?? null]
    );
  };

  return {
    kind: 'mysql',

    async migrate() {
      for (const sql of SCHEMA) await pool.query(sql);
    },

    async ping() {
      await pool.query('SELECT 1');
    },

    async close() {
      await pool.end();
    },

    // ----- Utilisateurs -------------------------------------------------
    async countUsers() {
      const [rows] = await pool.query('SELECT COUNT(*) AS n FROM users');
      return Number(rows[0].n);
    },
    async listUsers() {
      const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at, id');
      return rows.map(toUser);
    },
    async getUser(id) {
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
      return toUser(rows[0]) ?? null;
    },
    async findUserByLogin(identifier) {
      const v = String(identifier).trim().toLowerCase();
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE login_email = ? OR LOWER(matricule) = ? OR LOWER(employee_code) = ? LIMIT 1',
        [v, v, v]
      );
      return toUser(rows[0]) ?? null;
    },
    async updateUser(id, fields) {
      const current = await this.getUser(id);
      if (!current) return;
      const c = userColumns({ ...current, ...fields });
      await pool.query(
        `UPDATE users SET organization_id=?, email=?, login_email=?, matricule=?, employee_code=?, name=?, role=?,
           status=?, failed_attempts=?, must_change_password=?, password_hash=?, last_login=?, profile=? WHERE id=?`,
        [c.organization_id, c.email, c.login_email, c.matricule, c.employee_code, c.name, c.role, c.status,
          c.failed_attempts, c.must_change_password, c.password_hash, c.last_login, c.profile, id]
      );
    },
    /** Remplace l'annuaire complet (synchronisation) dans une transaction. */
    async replaceUsers(users) {
      await transaction(async conn => {
        const [rows] = await conn.query('SELECT id FROM users');
        const keep = new Set(users.map(u => u.id));
        for (const r of rows) {
          if (!keep.has(r.id)) {
            await conn.query('DELETE FROM sessions WHERE user_id = ?', [r.id]);
            await conn.query('DELETE FROM users WHERE id = ?', [r.id]);
          }
        }
        // Évite les conflits d'unicité temporaires si deux comptes échangent leur email.
        await conn.query("UPDATE users SET login_email = CONCAT('~tmp~', id)");
        const existing = new Set(rows.map(r => r.id));
        for (const u of users) {
          const c = userColumns(u);
          if (existing.has(u.id)) {
            await conn.query(
              `UPDATE users SET organization_id=?, email=?, login_email=?, matricule=?, employee_code=?, name=?, role=?,
                 status=?, failed_attempts=?, must_change_password=?, password_hash=?, last_login=?, profile=? WHERE id=?`,
              [c.organization_id, c.email, c.login_email, c.matricule, c.employee_code, c.name, c.role, c.status,
                c.failed_attempts, c.must_change_password, c.password_hash, c.last_login, c.profile, u.id]
            );
          } else {
            await insertUserSql(conn, u);
          }
        }
      });
    },

    // ----- Sessions -----------------------------------------------------
    async createSession(s) {
      await pool.query(
        'INSERT INTO sessions (token_hash, user_id, pending_password_change, created_at, last_seen, ip, user_agent) VALUES (?,?,?,?,?,?,?)',
        [s.tokenHash, s.userId, s.pending ? 1 : 0, s.createdAt, s.lastSeen, s.ip ?? null, (s.userAgent ?? '').slice(0, 255)]
      );
    },
    async getSession(tokenHash) {
      const [rows] = await pool.query('SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]);
      const r = rows[0];
      return r ? { tokenHash: r.token_hash, userId: r.user_id, pending: !!r.pending_password_change,
        createdAt: Number(r.created_at), lastSeen: Number(r.last_seen) } : null;
    },
    async updateSession(tokenHash, fields) {
      if ('lastSeen' in fields) await pool.query('UPDATE sessions SET last_seen = ? WHERE token_hash = ?', [fields.lastSeen, tokenHash]);
      if ('pending' in fields) await pool.query('UPDATE sessions SET pending_password_change = ? WHERE token_hash = ?', [fields.pending ? 1 : 0, tokenHash]);
    },
    async deleteSession(tokenHash) {
      await pool.query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    },
    async deleteUserSessions(userId, exceptTokenHash) {
      await pool.query('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [userId, exceptTokenHash ?? '']);
    },
    async purgeSessions(olderThan) {
      await pool.query('DELETE FROM sessions WHERE last_seen < ?', [olderThan]);
    },

    // ----- Données des modules -----------------------------------------
    async getAllData() {
      const [rows] = await pool.query('SELECT data_key, value, version FROM app_data');
      return rows.map(r => ({ key: r.data_key, value: r.value, version: r.version }));
    },
    async getData(key) {
      const [rows] = await pool.query('SELECT value, version FROM app_data WHERE data_key = ?', [key]);
      return rows[0] ? { value: rows[0].value, version: rows[0].version } : null;
    },
    async getVersions() {
      const [rows] = await pool.query('SELECT data_key, version FROM app_data');
      return Object.fromEntries(rows.map(r => [r.data_key, r.version]));
    },
    /** Écriture avec contrôle de version : refusée si quelqu'un a modifié la donnée entre-temps. */
    async putData(key, value, expectedVersion, userId) {
      return transaction(async conn => {
        const [rows] = await conn.query('SELECT value, version FROM app_data WHERE data_key = ? FOR UPDATE', [key]);
        const currentVersion = rows[0]?.version ?? 0;
        if (currentVersion !== expectedVersion) {
          return { ok: false, current: { value: rows[0]?.value ?? null, version: currentVersion } };
        }
        await putDataSql(conn, key, value, userId);
        return { ok: true, version: currentVersion + 1 };
      });
    },
    /** Incrémente un compteur interne (ex. version de l'annuaire). */
    async bump(key) {
      await putDataSql(pool, key, '""', null);
    },
    /** Remplace toutes les données (initialisation / restauration). */
    async replaceAllData(entries, users, auditEntries) {
      await transaction(async conn => {
        await conn.query('DELETE FROM app_data');
        for (const [key, value] of entries) await putDataSql(conn, key, value, null);
        if (users) {
          await conn.query('DELETE FROM sessions');
          await conn.query('DELETE FROM users');
          for (const u of users) await insertUserSql(conn, u);
        }
        if (auditEntries) {
          await conn.query('DELETE FROM audit_logs');
          for (const e of auditEntries) {
            await conn.query('INSERT IGNORE INTO audit_logs (id, entry) VALUES (?, ?)', [e.id, JSON.stringify(e)]);
          }
        }
      });
    },

    // ----- Journal d'audit (ajout uniquement) --------------------------
    async addAuditLogs(entries) {
      for (const e of entries) {
        await pool.query('INSERT IGNORE INTO audit_logs (id, entry) VALUES (?, ?)', [e.id, JSON.stringify(e)]);
      }
    },
    async listAuditLogs(limit) {
      const [rows] = await pool.query('SELECT entry FROM audit_logs ORDER BY seq DESC LIMIT ?', [limit]);
      return rows.map(r => JSON.parse(r.entry));
    },
    async existingAuditIds(ids) {
      const found = new Set();
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        if (!chunk.length) continue;
        const [rows] = await pool.query('SELECT id FROM audit_logs WHERE id IN (?)', [chunk]);
        for (const r of rows) found.add(r.id);
      }
      return found;
    },
    async lastAuditHash() {
      const [rows] = await pool.query('SELECT entry FROM audit_logs ORDER BY seq DESC LIMIT 1');
      return rows[0] ? JSON.parse(rows[0].entry).hash || null : null;
    },
    async listAuditLogsAsc() {
      const [rows] = await pool.query('SELECT entry FROM audit_logs ORDER BY seq ASC');
      return rows.map(r => JSON.parse(r.entry));
    },
    async auditVersion() {
      const [rows] = await pool.query('SELECT COALESCE(MAX(seq), 0) AS v FROM audit_logs');
      return Number(rows[0].v);
    },
  };
}
