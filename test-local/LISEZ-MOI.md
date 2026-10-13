# Tester ERP-WORKFLOW sur votre ordinateur, avec MySQL

Ce dossier lance sur votre ordinateur, en un double-clic :

| Service | Adresse | Rôle |
|---|---|---|
| Application ERP-WORKFLOW | http://localhost:8080 | L'application, en mode serveur |
| Base MySQL (MariaDB 11.4) | interne | Toutes vos données de test |
| phpMyAdmin | http://localhost:8081 | Voir les tables MySQL dans le navigateur |

Rien n'est accessible depuis le réseau : tout reste sur votre ordinateur.

## 1. Installer Docker Desktop (une seule fois)

https://www.docker.com/products/docker-desktop/ → installez, redémarrez, ouvrez Docker Desktop et
attendez « Engine running ». Windows : acceptez l'installation de WSL 2 si elle est proposée.

## 2. Démarrer

- **Windows** : double-clic sur `demarrer-test.bat`.
- **Mac / Linux** : dans le Terminal, `sh demarrer-test.sh`.

La première fois : 5 à 15 minutes (téléchargement et compilation). La fenêtre affiche ensuite le
**code d'installation** et les identifiants de phpMyAdmin, puis ouvre le navigateur.

## 3. Saisir vos données

1. Écran « Installation du serveur » : collez le code d'installation.
2. **Créer mon organisation** : votre entreprise et le compte DG ; à l'étape 2, choisissez
   **Partir d'un organigramme vide**.
3. Connectez-vous avec le compte DG, puis :
   - *Organigramme & Entités* → **Nouvelle Entité** : vos départements, directions, services ;
   - *Gestion & CRUD Agents* → **Enrôler un Collaborateur** : vos agents (ou en masse :
     *Import Massif CSV & Paie*, gabarit CSV téléchargeable dans l'écran) ;
   - puis testez documents, tâches, paie, logistique…

## 4. Voir les données dans MySQL

phpMyAdmin → utilisateur `erp_workflow`, mot de passe = `DB_PASSWORD` du fichier `.env` → base `erp_workflow` :

| Table | Contenu |
|---|---|
| `users` | Comptes (le mot de passe n'y est jamais en clair, seulement son empreinte) |
| `sessions` | Connexions ouvertes |
| `app_data` | Données de chaque module (une ligne par module, contenu JSON) |
| `audit_logs` | Journal d'audit chaîné |

Ne modifiez pas les tables à la main : passez par l'application.

## 5. Arrêter, reprendre, effacer

| Action | Windows | Mac / Linux |
|---|---|---|
| Arrêter (données conservées) | `arreter-test.bat` | `sh arreter-test.sh` |
| Reprendre | `demarrer-test.bat` | `sh demarrer-test.sh` |
| Tout effacer et repartir de zéro | `reinitialiser-test.bat` | `sh reinitialiser-test.sh` |

## Dépannage

| Problème | Solution |
|---|---|
| « port is already allocated » | Changez `APP_PORT` (ex. 8090) ou `PMA_PORT` dans `.env`, relancez. |
| Le serveur ne répond pas | Docker Desktop → Containers → `erp-workflow-test-app` → Logs. |
| Code d'installation perdu | Il est dans le fichier `.env` (ligne `SETUP_CODE=`). |

Le fichier `.env` contient vos mots de passe de test : ne le partagez pas.
