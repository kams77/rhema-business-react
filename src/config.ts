// src/config.ts
// Réglages globaux lus depuis les variables d'environnement Vite (fichier .env).

/**
 * Mode démonstration (activé par défaut).
 *
 * - `true`  : connexion rapide en 1 clic, sélecteur d'utilisateur et mot de passe de test affichés.
 *             Pratique pour présenter l'application.
 * - `false` : mode production. Connexion uniquement par identifiant + mot de passe,
 *             changement de mot de passe obligatoire à la première connexion,
 *             aucun moyen de prendre l'identité d'un autre utilisateur.
 *
 * Pour passer en production, ajoutez dans votre fichier .env : VITE_DEMO_MODE=false
 */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE !== 'false';

/** Mot de passe des comptes de démonstration (affiché uniquement en mode démo). */
export const DEMO_PASSWORD = 'rhema2026';
