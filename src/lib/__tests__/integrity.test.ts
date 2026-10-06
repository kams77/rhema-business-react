// Tests des empreintes côté application : SHA-256 synchrone = Web Crypto = Node,
// et chaîne du journal d'audit identique à celle du serveur.
// Usage : esbuild src/lib/__tests__/integrity.test.ts --bundle --platform=node --format=esm --outfile=/tmp/integrity.test.mjs && node /tmp/integrity.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AUDIT_GENESIS, auditChainHash, canonicalJson, contentHash, contentHashSync, sha256Hex, sha256HexSync, verifyAuditChain } from '../integrity';
// @ts-ignore — module JavaScript du serveur
import { chainHash as serverChainHash, canonicalJson as serverCanonical } from '../../../server/auth.mjs';

let passed = 0;
const ok = (cond: unknown, msg: string) => { assert.ok(cond, msg); passed++; console.log(`✓ ${msg}`); };
const nodeSha = (t: string) => createHash('sha256').update(t).digest('hex');

const samples = ['', 'abc', 'é à ç — Kinshasa 🇨🇩', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(1000)];
ok(samples.every(t => sha256HexSync(t) === nodeSha(t)), 'SHA-256 synchrone identique à Node (y compris UTF-8 et tailles limites)');
for (const t of samples) assert.equal(await sha256Hex(t), nodeSha(t));
ok(true, 'SHA-256 Web Crypto identique à Node');

const obj = { b: 2, a: { d: [1, 'deux', null], c: true }, z: undefined };
ok(canonicalJson(obj) === '{"a":{"c":true,"d":[1,"deux",null]},"b":2}', 'forme canonique : clés triées, undefined ignoré');
ok(canonicalJson(obj) === serverCanonical(obj), 'forme canonique identique au serveur');
ok(contentHashSync(obj) === (await contentHash(obj as Record<string, unknown>)), 'contentHash et contentHashSync concordent');

const entry = { id: 'log-1', timestamp: '2026-10-06 09:00:00', userName: 'DG', userRole: 'Directeur Général', action: 'Test', category: 'admin', details: 'Détail', ip: '' };
ok(auditChainHash(AUDIT_GENESIS, entry) === serverChainHash(AUDIT_GENESIS, entry), 'empreinte chaînée identique au serveur');

const asc: Array<Record<string, any>> = [];
let prev = AUDIT_GENESIS;
for (let i = 0; i < 3; i++) {
  const base = { ...entry, id: `log-${i}`, prevHash: prev };
  const e = { ...base, hash: auditChainHash(prev, base) };
  asc.push(e);
  prev = e.hash;
}
ok(verifyAuditChain(asc).ok, 'chaîne locale vérifiée');
// Le journal local est tronqué aux 2 000 entrées les plus récentes : la vérification part de la plus ancienne conservée.
ok(verifyAuditChain(asc.slice(1)).ok, 'chaîne tronquée en tête toujours vérifiable');
const tampered = asc.map(e => ({ ...e }));
tampered[1].details = 'falsifié';
const r = verifyAuditChain(tampered);
ok(!r.ok && r.brokenAt === 1, 'modification locale détectée');

console.log(`\n${passed} vérifications d'intégrité réussies.`);
