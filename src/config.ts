// src/config.ts
// Réglages globaux lus depuis les variables d'environnement Vite (fichier .env).

/**
 * Où sont enregistrées les données.
 *
 * - `local` (défaut) : dans le navigateur de chaque poste (aucun serveur nécessaire).
 * - `api`            : sur le serveur RHEMA (dossier server/) avec MariaDB / MySQL.
 *                      Tous les utilisateurs partagent les mêmes données.
 *
 * Fichier .env : VITE_BACKEND=api
 */
export const API_MODE: boolean = import.meta.env.VITE_BACKEND === 'api';

/**
 * Mode démonstration (activé par défaut en mode `local`, toujours désactivé en mode `api`).
 *
 * - `true`  : connexion rapide en 1 clic, sélecteur d'utilisateur et mot de passe de test affichés.
 * - `false` : mode production. Connexion uniquement par identifiant + mot de passe,
 *             changement de mot de passe obligatoire à la première connexion,
 *             aucun moyen de prendre l'identité d'un autre utilisateur.
 *
 * Pour passer en production sans serveur : VITE_DEMO_MODE=false
 */
export const DEMO_MODE: boolean = !API_MODE && import.meta.env.VITE_DEMO_MODE !== 'false';

/**
 * Nom de la version livrée (badge en haut de l'écran et sur la page de connexion).
 * Fichier .env : VITE_APP_VERSION=Test1 — vide = aucun badge.
 */
export const APP_VERSION: string = (import.meta.env.VITE_APP_VERSION || '').trim();

/** Mot de passe des comptes de démonstration (affiché uniquement en mode démo). */
export const DEMO_PASSWORD = 'rhema2026';
