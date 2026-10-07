// scripts/theme-clair.mjs
// Génère src/theme-clair.css : passe l'interface (conçue en sombre) en thème clair doux.
//
// Principe : on parcourt les composants, on repère les classes Tailwind sombres
// (bg-slate-900, text-slate-300, border-slate-800, text-emerald-300…) et on écrit pour
// chacune une règle hors couche qui la remplace par une teinte claire. Les règles hors
// couche l'emportent sur les utilitaires Tailwind, sans toucher au code des composants.
//
// Exceptions : le texte posé sur un fond de couleur franche (bouton indigo, badge rouge…)
// garde sa couleur d'origine (blanc), et les voiles de fond des fenêtres restent sombres.
//
// À relancer après avoir ajouté des écrans :  npm run theme:clair

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');

// ---------------------------------------------------------------------------
// Palette claire (gris-bleu doux, pas de blanc pur ni de noir pur)
// ---------------------------------------------------------------------------
const PAGE = '#e9edf2';

const BG_NEUTRE = {
  950: PAGE, // fond de page et panneaux intérieurs
  900: '#f6f8fa', // cartes, menu latéral
  800: '#e2e7ed', // champs, survols, blocs imbriqués
  750: '#d2d9e1',
  700: '#d2d9e1',
};
const BORDURE_NEUTRE = { 950: '#e2e7ed', 900: '#e2e7ed', 800: '#d6dde5', 700: '#c5ced8', 600: '#b3bec9' };
const TEXTE_NEUTRE = { white: '#1f2937', 50: '#1f2937', 100: '#1f2937', 200: '#283548', 300: '#3a4758', 400: '#546173' };

const NEUTRES = new Set(['slate', 'gray', 'zinc', 'neutral']);
const COULEURS = new Set([
  'red', 'rose', 'emerald', 'green', 'amber', 'yellow', 'orange', 'sky', 'cyan', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'teal', 'lime',
]);

// ---------------------------------------------------------------------------
// Lecture des classes utilisées
// ---------------------------------------------------------------------------
function fichiers(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : fichiers(p);
    return /\.(tsx|ts)$/.test(n) ? [p] : [];
  });
}

const RE =
  /(?<![\w-])((?:(?:hover|focus|group-hover|sm|lg):)*)(bg|text|border|divide|from|via|to|ring)-(white|black|[a-z]+)(?:-(\d{2,3}))?(?:\/(\d{1,3}))?(?![\w/-])/g;

const jetons = new Map();
for (const f of fichiers(srcDir)) {
  const code = readFileSync(f, 'utf8');
  for (const m of code.matchAll(RE)) jetons.set(m[0], m);
}

// ---------------------------------------------------------------------------
// Correspondances
// ---------------------------------------------------------------------------
const alpha = (couleur, a) => (a == null ? couleur : `color-mix(in oklab, ${couleur} ${a}%, transparent)`);

function couleurClaire(prop, nom, nuance, a) {
  const n = nuance ? Number(nuance) : null;
  const opacite = a != null ? Number(a) : null;

  if (prop === 'text') {
    if (nom === 'white' || (NEUTRES.has(nom) && n != null && n <= 400)) {
      return alpha(TEXTE_NEUTRE[nom === 'white' ? 'white' : n] ?? TEXTE_NEUTRE[400], opacite);
    }
    if (COULEURS.has(nom) && n != null && n <= 400) {
      return alpha(`var(--color-${nom}-${n <= 200 ? 800 : 700})`, opacite);
    }
    return null;
  }

  if (prop === 'bg' || prop === 'from' || prop === 'via' || prop === 'to') {
    if (NEUTRES.has(nom) && BG_NEUTRE[n]) return alpha(BG_NEUTRE[n], opacite);
    if (nom === 'white' && opacite != null && opacite <= 20) return `rgb(15 23 42 / ${opacite / 2}%)`;
    if (COULEURS.has(nom) && n != null && n >= 800) {
      return alpha(`var(--color-${nom}-100)`, opacite == null ? null : Math.min(100, Math.round(opacite * 1.5)));
    }
    return null;
  }

  if (prop === 'border' || prop === 'divide') {
    if (NEUTRES.has(nom) && BORDURE_NEUTRE[n]) return alpha(BORDURE_NEUTRE[n], opacite);
    if (COULEURS.has(nom) && n != null && n >= 800) return alpha(`var(--color-${nom}-200)`, opacite);
    return null;
  }

  if (prop === 'ring' && nom === 'white') return '#475569';
  return null;
}

function declaration(prop, valeur) {
  switch (prop) {
    case 'text': return `color: ${valeur};`;
    case 'bg': return `background-color: ${valeur};`;
    case 'border': return `border-color: ${valeur};`;
    case 'from': return `--tw-gradient-from: ${valeur};`;
    case 'via': return `--tw-gradient-via: ${valeur};`;
    case 'to': return `--tw-gradient-to: ${valeur};`;
    case 'ring': return `--tw-ring-color: ${valeur};`;
    default: return null; // divide : traité à part
  }
}

const MEDIA = { sm: '40rem', lg: '64rem' };

function selecteur(jeton, variantes, prop) {
  let sel = `[class~="${jeton}"]`;
  if (variantes.includes('hover')) sel += ':hover';
  if (variantes.includes('focus')) sel += ':focus';
  if (variantes.includes('group-hover')) sel = `.group:hover ${sel}`;
  if (prop === 'divide') sel = `${sel} > :not(:last-child)`;
  return sel;
}

// ---------------------------------------------------------------------------
// Génération
// ---------------------------------------------------------------------------
const regles = [];
const fondsFrancs = [];

for (const [jeton, m] of [...jetons].sort(([a], [b]) => a.localeCompare(b))) {
  const [, prefixe, prop, nom, nuance, a] = m;
  const variantes = prefixe ? prefixe.split(':').filter(Boolean) : [];

  // Fond de couleur franche : on garde le texte d'origine (souvent blanc) dessus.
  const n = Number(nuance);
  if ((prop === 'bg' || prop === 'from') && COULEURS.has(nom) && n >= 400 && n <= 700 && a == null) {
    const base = `[class~="${jeton}"]${variantes.includes('hover') ? ':hover' : ''}`;
    if (!variantes.includes('focus') && !variantes.includes('group-hover')) fondsFrancs.push(base);
  }

  const valeur = couleurClaire(prop, nom, nuance, a);
  if (!valeur) continue;
  const decl = prop === 'divide' ? `border-color: ${valeur};` : declaration(prop, valeur);
  let regle = `${selecteur(jeton, variantes, prop)} { ${decl} }`;
  const media = variantes.find((v) => MEDIA[v]);
  if (media) regle = `@media (min-width: ${MEDIA[media]}) { ${regle} }`;
  regles.push(regle);
}

const fonds = [...new Set(fondsFrancs)];

const css = `/* ==========================================================================
 * THÈME CLAIR DOUX — fichier GÉNÉRÉ par scripts/theme-clair.mjs, ne pas modifier à la main.
 * Relancer « npm run theme:clair » après l'ajout d'écrans ou de nouvelles couleurs.
 * ========================================================================== */

${regles.join('\n')}

/* --- Exceptions (placées en dernier pour l'emporter) --- */

/* Texte d'origine conservé sur les fonds de couleur franche (boutons, badges pleins) */
:is(${fonds.join(', ')})[class][class],
:is(${fonds.join(', ')}) [class][class] { color: revert-layer; }

/* Voiles derrière les fenêtres : restent sombres */
.fixed.inset-0:is([class*="bg-slate-950/"], [class*="bg-slate-900/"]) { background-color: revert-layer; }

/* Pastilles qui représentent une couleur précise (ex. encre noire de la signature) */
.garder-couleur { background-color: revert-layer !important; }
`;

writeFileSync(join(srcDir, 'theme-clair.css'), css);

console.log(`theme-clair.css : ${regles.length} règles, ${fonds.length} fonds de couleur franche.`);
