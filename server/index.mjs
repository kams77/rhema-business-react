// server/index.mjs — démarrage du serveur RHEMA Business.
//
// Variables d'environnement :
//   PORT            Port HTTP (défaut 8080)
//   DB_DRIVER       "mysql" (défaut) ou "memory" (essais sans base, données perdues à l'arrêt)
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME   Connexion MariaDB / MySQL
//   SETUP_CODE      Code demandé lors de la première initialisation (fortement recommandé)
//   TRUST_PROXY     "true" si un reverse proxy (Synology, Nginx…) est placé devant (défaut true)
//   COOKIE_SECURE   "true" pour forcer les cookies « Secure » (HTTPS)
//   DIST_DIR        Dossier de l'application compilée (défaut ../dist)
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { SESSION_MAX_MS } from './auth.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

const config = {
  port: Number(env.PORT || 8080),
  distDir: path.resolve(env.DIST_DIR || path.join(here, '..', 'dist')),
  setupCode: env.SETUP_CODE || '',
  trustProxy: (env.TRUST_PROXY ?? 'true') !== 'false',
  cookieSecure: env.COOKIE_SECURE === 'true',
  dev: env.NODE_ENV === 'development',
};

async function createDb() {
  if ((env.DB_DRIVER || 'mysql') === 'memory') {
    const { createMemoryDb } = await import('./db-memory.mjs');
    console.warn('[db] Stockage EN MÉMOIRE : les données seront perdues à l\'arrêt du serveur.');
    return createMemoryDb();
  }
  const { createMysqlDb } = await import('./db-mysql.mjs');
  return createMysqlDb({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'rhema',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'rhema',
  });
}

// Refuse de démarrer avec les valeurs d'exemple du fichier docker-compose.yml.
const placeholders = ['DB_PASSWORD', 'SETUP_CODE'].filter(k => String(env[k] || '').includes('CHANGEZ_MOI'));
if (placeholders.length) {
  console.error(`[rhema] Modifiez d'abord ${placeholders.join(' et ')} dans docker-compose.yml (valeurs « CHANGEZ_MOI »).`);
  process.exit(1);
}

const db = await createDb();
await db.migrate();
if (!config.setupCode && (await db.countUsers()) === 0) {
  console.warn('[setup] Aucun SETUP_CODE défini : n\'importe qui atteignant le serveur peut l\'initialiser. Définissez SETUP_CODE.');
}

const server = http.createServer(createApp({ db, config }));
server.requestTimeout = 120_000;
server.listen(config.port, () => {
  console.log(`[rhema] Serveur prêt sur le port ${config.port} (stockage : ${db.kind}, application : ${config.distDir})`);
});

// Nettoyage des sessions expirées toutes les heures.
setInterval(() => db.purgeSessions(Date.now() - SESSION_MAX_MS).catch(() => {}), 60 * 60 * 1000).unref();

const shutdown = async signal => {
  console.log(`[rhema] Arrêt (${signal})…`);
  server.close();
  await db.close().catch(() => {});
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
