// Tests unitaires de la chaîne d'empreintes du journal d'audit (sans serveur).
// Usage : node server/tests/audit-chain.test.mjs
import assert from 'node:assert/strict';
import { AUDIT_GENESIS, chainHash, rechain, sha256, verifyChain } from '../auth.mjs';

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log(`✓ ${msg}`); };

ok(sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 conforme au vecteur de test officiel');

const raw = [1, 2, 3, 4].map(i => ({ id: `log-${i}`, timestamp: `2026-10-0${i} 08:00:00`, userName: 'DG', action: `Action ${i}`, category: 'admin', details: `Détail ${i}`, ip: '10.0.0.1' }));
const chain = rechain(raw);
ok(chain[0].prevHash === AUDIT_GENESIS, 'première entrée rattachée à GENESIS');
ok(chain.every((e, i) => i === 0 || e.prevHash === chain[i - 1].hash), 'chaque entrée contient l\'empreinte de la précédente');
ok(chain[1].hash === chainHash(chain[0].hash, chain[1]), 'empreinte recalculable');

let r = verifyChain(chain);
ok(r.ok && r.count === 4 && r.lastHash === chain[3].hash, 'chaîne intacte vérifiée');

const edited = chain.map(e => ({ ...e }));
edited[1].details = 'Détail falsifié';
r = verifyChain(edited);
ok(!r.ok && r.brokenAt === 1, 'modification d\'une entrée détectée');

r = verifyChain([chain[0], chain[2], chain[3]]);
ok(!r.ok && r.brokenAt === 1, 'suppression d\'une entrée détectée');

const forged = chain.map(e => ({ ...e }));
forged[2].action = 'Action réécrite';
forged[2].hash = chainHash(forged[2].prevHash, forged[2]);
r = verifyChain(forged);
ok(!r.ok && r.brokenAt === 3, 'réécriture d\'une entrée (empreinte recalculée) détectée à l\'entrée suivante');

const legacy = [{ id: 'old-1', action: 'ancienne entrée', hash: 'evt-xyz' }, ...chain];
r = verifyChain(legacy);
ok(r.ok && r.legacy === 1 && r.count === 4, 'entrées antérieures au chaînage ignorées en tête');

ok(verifyChain([]).ok, 'journal vide valide');

console.log(`\n${passed} vérifications de la chaîne d'audit réussies.`);
