# RHEMA Business — Portail Entreprise & Gestion Hiérarchique

Application web de gestion d'entreprise pour la RD Congo : organigramme hiérarchique,
circuits documentaires, paie conforme (USD / CDF), logistique VSAT & solaire,
habilitations par rôle (RBAC), journal d'audit et signature électronique.

Construite avec **React 19**, **TypeScript**, **Vite 6** et **Tailwind CSS 4**.

---

## Démarrage rapide

Prérequis : [Node.js](https://nodejs.org) 20 ou plus récent.

```bash
npm install
cp .env.example .env   # puis adaptez les valeurs
npm run dev            # http://localhost:3000
```

| Commande          | Rôle                                              |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Serveur de développement (port 3000)              |
| `npm run build`   | Version de production dans `dist/`                |
| `npm run preview` | Prévisualise la version de production             |
| `npm run lint`    | Vérification TypeScript (`tsc --noEmit`)          |

Chaque envoi sur GitHub est vérifié automatiquement (onglet **Actions**) : installation,
TypeScript, compilation et image Docker.

## Modules

| Module                 | Contenu                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| Espace employé         | Tableau de bord personnel, tâches, documents, contrats                   |
| Hiérarchie             | Départements → directions → divisions → services, délégations de visa    |
| Invitations            | Accès inter-entités par matricule et clé à 10 chiffres                   |
| Documents & workflows  | Circuits d'approbation, signature électronique, en-tête officiel RHEMA   |
| Logistique             | Bons de commande, livraisons, factures, hubs provinciaux, stocks, S/N    |
| Import en masse        | Employés, contrats et historiques de paie par CSV                        |
| Sécurité & audit       | Alertes d'intrusion, verrouillage, journal horodaté exportable (PDF/CSV) |

## Circuit de validation (documents, tâches, logistique)

Règles communes à l'application et au serveur : `shared/workflow.mjs` (tests : `npm run test:circuit`).

- **Chaque type de document a son circuit** et sa règle de montant (*aucun*, *facultatif*, *obligatoire*).
  Exemples : note de service → chef de service → directeur ; demande d'achat → hiérarchie → Finance
  (+ DG au-delà de 5 000 USD) ; bon de commande → chef de service → directeur → Finance (+ DG au-delà
  de 10 000 USD) ; demande de congé → hiérarchie → RH.
- Le circuit part du **poste de l'émetteur** ; un poste vacant remonte au responsable au-dessus ;
  personne ne vise son propre document ; la DG signe seule ses documents.
- Les visas se donnent **un par un, dans l'ordre** ; la dernière étape est la signature électronique ;
  un rejet exige un motif, l'émetteur corrige puis renvoie (nouveau cycle, historique conservé).
- **Qui voit quoi et quand** : brouillon = son émetteur ; en circuit = émetteur, valideurs et hiérarchie ;
  validé = destinataires prévus. Un agent ne voit que ses tâches, ses documents et les documents
  validés de son service.
- **Tâches** : exécutants, contributeurs, responsable et valideurs ; validation dans l'ordre des valideurs
  (à défaut, le responsable hiérarchique de l'entité).
- **Logistique** : chaque bon passe par son circuit ; le stock ne bouge qu'après validation ; des tâches
  de suivi sont créées automatiquement et soumises à validation une fois l'événement constaté.

## Mode démonstration et mode production

Le comportement de la connexion dépend de la variable `VITE_DEMO_MODE` (fichier `.env`).

| | Démonstration (`true`, par défaut) | Production (`false`) |
|---|---|---|
| Connexion en 1 clic | ✅ | ❌ |
| Changer d'utilisateur sans mot de passe | ✅ | ❌ |
| Mot de passe des comptes de test | `rhema2026` (affiché) | Non affiché |
| Nouveaux comptes | Mot de passe de démo | Mot de passe provisoire aléatoire |
| Changement de mot de passe à la 1re connexion | Non | Obligatoire |

Dans les deux modes :

- les mots de passe sont stockés **hachés** (PBKDF2-SHA-256, 150 000 itérations, sel aléatoire) ;
- un compte est **verrouillé après 5 mots de passe erronés** (déblocage par la Direction Générale) ;
- la session expire après **30 minutes d'inactivité** (10 h maximum) ;
- l'identité de l'organisation, les sauvegardes et la création d'organisation sont réservées au **DG**.

> Le chiffrement du navigateur (Web Crypto) exige une connexion **HTTPS** ou `http://localhost`.

## Deux façons de stocker les données

| | **Mode navigateur** (`VITE_BACKEND=local`, défaut) | **Mode serveur** (`VITE_BACKEND=api`) |
|---|---|---|
| Où sont les données | Dans le navigateur de chaque poste | Base **MariaDB / MySQL** sur votre serveur |
| Partage entre collègues | ❌ | ✅ tout le monde voit les mêmes données |
| Connexion | Vérifiée dans le navigateur | Vérifiée par le serveur (cookie sécurisé) |
| Installation | Hébergement statique (Cloudflare Pages…) | Docker : `docker compose up -d --build` |
| Guide | [docs/INSTALLATION-ET-HEBERGEMENT.md](docs/INSTALLATION-ET-HEBERGEMENT.md) | [docs/SYNOLOGY.md](docs/SYNOLOGY.md) |

En mode serveur, deux personnes peuvent modifier le même module en même temps : leurs
changements sont **fusionnés automatiquement**, et chacun voit ceux des autres en moins de 20 secondes.

Pour essayer le serveur sans base de données : `npm run build` puis `npm run server:memoire` (ouvrir http://localhost:8080)
(données perdues à l'arrêt, code d'installation : `essai`), avec `VITE_BACKEND=api` dans `.env`
avant la compilation.

## Données et sauvegardes (mode navigateur)

Les données sont enregistrées **dans le navigateur** (`localStorage`, clés `rhema:v1:*`) :
elles survivent au rechargement mais ne sont **pas partagées** entre ordinateurs ni navigateurs.

Menu utilisateur → **Sauvegarde des données** (réservé au DG) :

- **Exporter** : télécharge un fichier `.json` contenant toutes les données ;
- **Restaurer** : recharge un fichier exporté (remplace les données actuelles) ;
- **Revenir aux données de démonstration** : efface tout et repart des données d'exemple.

L'espace du navigateur est limité (environ 5 Mo). Une alerte s'affiche s'il est plein :
exportez une sauvegarde puis supprimez les documents volumineux (logos, scans).

## ⚠️ Limites actuelles

- **Mode navigateur** : les données restent sur chaque poste ; un utilisateur averti peut lire ou
  modifier le stockage local. Convient à une démonstration ou à un poste unique.
- **Mode serveur (étape 1)** : les comptes et le journal sont dans de vraies tables ; les autres
  modules sont enregistrés module par module (colonne JSON versionnée). Prochaine étape : des
  tables détaillées par module (contrats, bulletins, factures, stocks…).

## Structure du projet

```
src/
├── App.tsx                 # État global, navigation, gestion de session
├── config.ts               # Réglages (mode démo)
├── types.ts                # Types métier partagés
├── components/             # Écrans et fenêtres (un fichier par module)
│   ├── logistics/          # Onglets du module logistique
│   └── invitations/        # Invitations inter-entités
├── data/                   # Données de démonstration (mode navigateur)
├── hooks/
│   └── usePersistentState.ts   # useState enregistré dans le navigateur
├── lib/
│   ├── auth.ts             # Hachage des mots de passe, session (mode navigateur)
│   ├── storage.ts          # Stockage local, export / import de sauvegarde
│   ├── api.ts              # Appels au serveur (mode serveur)
│   ├── remoteStore.ts      # Synchronisation des données avec le serveur
│   └── merge.ts            # Fusion des modifications simultanées
└── utils/                  # Droits (rbac), exports PDF/CSV, identifiants
server/                     # Serveur Node.js (API + MariaDB/MySQL)
├── index.mjs               # Démarrage et configuration (variables d'environnement)
├── app.mjs                 # Routes : connexion, données, installation, sauvegarde
├── auth.mjs                # Mots de passe et sessions
├── db-mysql.mjs            # Tables et requêtes MariaDB / MySQL
├── db-memory.mjs           # Stockage en mémoire (essais, tests)
├── Dockerfile              # Image du serveur
└── tests/api.test.mjs      # Tests de l'API
docker-compose.yml          # Application + MariaDB (Synology, serveur Linux)
```

## Déploiement

Guide pas à pas (installation locale, Cloudflare Pages, Netlify, Docker) :
**[docs/INSTALLATION-ET-HEBERGEMENT.md](docs/INSTALLATION-ET-HEBERGEMENT.md)**

En bref : `npm run build` produit un site statique dans `dist/`. Hébergement recommandé :
**Cloudflare Pages** (gratuit, HTTPS, en-têtes de sécurité de `public/_headers` appliqués).
Définissez `VITE_DEMO_MODE=false` **avant** la compilation pour une mise en production.
Pour un serveur interne : `docker build -t rhema-business .` puis `docker run -d -p 8080:80 rhema-business`.

---

© RHEMA BUSINESS — Télécoms, VSAT, Réseaux & Intégration Technologique, Kinshasa (RD Congo).
