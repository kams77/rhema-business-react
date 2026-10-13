// test-sans-docker/lanceur.mjs — démarre ERP-WORKFLOW SANS Docker, avec le MySQL / MariaDB
// déjà installé sur l'ordinateur (XAMPP, Laragon, WampServer…).
//
//   demarrer.bat                 : prépare la base (la première fois) puis démarre l'application
//   reinitialiser.bat            : efface la base de test (après confirmation)
//
// Réglages : fichier « configuration.txt » (créé au premier lancement, à côté de demarrer.bat).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { exec } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..');
const CONF = path.join(racine, 'configuration.txt');
const args = process.argv.slice(2);
const SANS_NAVIGATEUR = args.includes('--sans-navigateur');
const REINITIALISER = args.includes('--reinitialiser');

const titre = t => console.log(`\n=== ${t} ===\n`);
const stop = (message, code = 1) => {
  console.log(`\n${message}\n`);
  process.exit(code);
};

/** Mot de passe aléatoire lisible (générateur cryptographique). */
function secret(n) {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(n), b => a[b % a.length]).join('');
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
function lireConfiguration() {
  if (!fs.existsSync(CONF)) {
    const lignes = [
      '# ERP-WORKFLOW - réglages du test sans Docker.',
      '# Modifiez ce fichier avec le Bloc-notes, puis relancez demarrer.bat.',
      '',
      '# Serveur MySQL / MariaDB déjà installé (XAMPP : utilisateur root, mot de passe vide).',
      'MYSQL_HOTE=127.0.0.1',
      'MYSQL_PORT=3306',
      'MYSQL_ADMIN=root',
      'MYSQL_ADMIN_MOT_DE_PASSE=',
      '',
      '# Base créée automatiquement pour ERP-WORKFLOW (ne touche à aucune autre base).',
      'BASE=erp_workflow_test',
      'BASE_UTILISATEUR=erp_workflow',
      `BASE_MOT_DE_PASSE=${secret(24)}`,
      '',
      '# Application : adresse http://localhost:PORT',
      'PORT=8080',
      `CODE_INSTALLATION=${secret(16)}`,
      '',
    ];
    fs.writeFileSync(CONF, lignes.join('\r\n'), { encoding: 'utf8', mode: 0o600 });
    console.log('Fichier configuration.txt créé (mots de passe de test tirés au hasard).');
  }
  const conf = {};
  for (const ligne of fs.readFileSync(CONF, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(ligne);
    if (m) conf[m[1]] = m[2];
  }
  const manquant = ['MYSQL_HOTE', 'MYSQL_PORT', 'MYSQL_ADMIN', 'BASE', 'BASE_UTILISATEUR', 'BASE_MOT_DE_PASSE', 'PORT', 'CODE_INSTALLATION']
    .filter(k => !conf[k]);
  if (manquant.length) stop(`configuration.txt incomplet : ${manquant.join(', ')}. Supprimez le fichier pour le recréer.`);
  if (!/^[A-Za-z0-9_]{1,64}$/.test(conf.BASE)) stop('BASE ne doit contenir que des lettres, chiffres et « _ ».');
  if (!/^[A-Za-z0-9_]{1,32}$/.test(conf.BASE_UTILISATEUR)) stop('BASE_UTILISATEUR ne doit contenir que des lettres, chiffres et « _ ».');
  if (conf.CODE_INSTALLATION.length < 8) stop('CODE_INSTALLATION doit faire au moins 8 caractères.');
  return conf;
}

// ---------------------------------------------------------------------------
// MySQL
// ---------------------------------------------------------------------------
async function connexionAdmin(conf) {
  const mysql = (await import('mysql2/promise')).default;
  try {
    return await mysql.createConnection({
      host: conf.MYSQL_HOTE,
      port: Number(conf.MYSQL_PORT),
      user: conf.MYSQL_ADMIN,
      password: conf.MYSQL_ADMIN_MOT_DE_PASSE || '',
      charset: 'utf8mb4',
      connectTimeout: 8000,
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      stop(`MySQL ne répond pas sur ${conf.MYSQL_HOTE}:${conf.MYSQL_PORT}.\n` +
        '-> Ouvrez le panneau de contrôle XAMPP et cliquez sur « Start » en face de MySQL,\n' +
        '   attendez que la ligne MySQL passe au vert, puis relancez demarrer.bat.');
    }
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      stop(`MySQL refuse l'utilisateur « ${conf.MYSQL_ADMIN} » avec ce mot de passe.\n` +
        '-> Ouvrez configuration.txt et renseignez MYSQL_ADMIN_MOT_DE_PASSE (mot de passe root de votre MySQL).');
    }
    stop(`Connexion à MySQL impossible : ${err.code || ''} ${err.message}`);
  }
}

async function preparerBase(conf) {
  const c = await connexionAdmin(conf);
  const [[{ v }]] = await c.query('SELECT VERSION() AS v');
  console.log(`MySQL joint : version ${v}.`);
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${conf.BASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  // Compte dédié à l'application, limité à SA base (connexions locales seulement).
  for (const hote of ['localhost', '127.0.0.1']) {
    await c.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [conf.BASE_UTILISATEUR, hote, conf.BASE_MOT_DE_PASSE]);
    await c.query('ALTER USER ?@? IDENTIFIED BY ?', [conf.BASE_UTILISATEUR, hote, conf.BASE_MOT_DE_PASSE]);
    await c.query(`GRANT ALL PRIVILEGES ON \`${conf.BASE}\`.* TO ?@?`, [conf.BASE_UTILISATEUR, hote]);
  }
  await c.query('FLUSH PRIVILEGES');
  await c.end();
  console.log(`Base « ${conf.BASE} » et utilisateur « ${conf.BASE_UTILISATEUR} » prêts.`);
}

async function reinitialiser(conf) {
  titre('ERP-WORKFLOW : réinitialisation de la base de test');
  console.log(`ATTENTION : la base « ${conf.BASE} » va être effacée définitivement`);
  console.log('(organisation, agents, documents, paie...). Les autres bases ne sont pas touchées.');
  console.log('Fermez d\'abord la fenêtre de l\'application si elle est ouverte.\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const reponse = await new Promise(r => rl.question('Tapez EFFACER pour confirmer : ', r));
  rl.close();
  if (String(reponse).trim() !== 'EFFACER') stop('Annulé : rien n\'a été effacé.', 0);
  const c = await connexionAdmin(conf);
  await c.query(`DROP DATABASE IF EXISTS \`${conf.BASE}\``);
  await c.end();
  stop('Base de test effacée. Relancez demarrer.bat pour repartir de zéro (même code d\'installation).', 0);
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
function ouvrirNavigateur(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

async function attendreServeur(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${url}/api/health`);
      if (r.ok) return true;
    } catch { /* pas encore prêt */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

const conf = lireConfiguration();
if (REINITIALISER) await reinitialiser(conf);

titre('ERP-WORKFLOW : test sans Docker (MySQL)');
await preparerBase(conf);

Object.assign(process.env, {
  DB_DRIVER: 'mysql',
  DB_HOST: conf.MYSQL_HOTE,
  DB_PORT: conf.MYSQL_PORT,
  DB_NAME: conf.BASE,
  DB_USER: conf.BASE_UTILISATEUR,
  DB_PASSWORD: conf.BASE_MOT_DE_PASSE,
  SETUP_CODE: conf.CODE_INSTALLATION,
  PORT: conf.PORT,
  // Accès direct en http://localhost (pas de proxy, pas de HTTPS) : cookie sans « Secure ».
  TRUST_PROXY: 'false',
  COOKIE_SECURE: 'false',
  NODE_ENV: 'production',
  TZ: process.env.TZ || 'Africa/Kinshasa',
});

process.on('uncaughtException', err => {
  if (err && err.code === 'EADDRINUSE') {
    stop(`Le port ${conf.PORT} est déjà utilisé par un autre logiciel.\n-> Ouvrez configuration.txt, mettez par exemple PORT=8090, puis relancez demarrer.bat.`);
  }
  console.error(err);
  stop('Erreur inattendue : copiez le message ci-dessus pour l\'assistance.');
});

const url = `http://localhost:${conf.PORT}`;
// Le serveur ERP-WORKFLOW (le même que sur le Synology) démarre dans cette fenêtre.
await import(pathToFileURL(path.join(ici, 'server', 'index.mjs')).href);

if (await attendreServeur(`http://127.0.0.1:${conf.PORT}`)) {
  console.log('');
  console.log('Tout est prêt. Laissez cette fenêtre ouverte pendant le test (la fermer arrête l\'application).');
  console.log('');
  console.log(`  Application         : ${url}`);
  console.log(`  Code d'installation : ${conf.CODE_INSTALLATION}   (demandé une seule fois, au premier accès)`);
  console.log('');
  console.log('  phpMyAdmin (XAMPP)  : http://localhost/phpmyadmin   (Apache doit être démarré dans XAMPP)');
  console.log(`      base            : ${conf.BASE}`);
  console.log(`      utilisateur     : ${conf.BASE_UTILISATEUR}`);
  console.log(`      mot de passe    : ${conf.BASE_MOT_DE_PASSE}`);
  console.log('');
  if (!SANS_NAVIGATEUR) ouvrirNavigateur(url);
} else {
  console.log('Le serveur ne répond pas : lisez les messages ci-dessus.');
}
