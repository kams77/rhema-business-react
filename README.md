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

## Modules

| Module                 | Contenu                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| Espace employé         | Tableau de bord personnel, tâches, documents, contrats                   |
| Hiérarchie             | Départements → directions → divisions → services, délégations de visa    |
| Invitations            | Accès inter-entités par matricule et clé à 10 chiffres                   |
| Documents & workflows  | Circuits d'approbation, signature électronique, en-tête officiel RHEMA   |
| Logistique             | Bons de commande, livraisons, factures, hubs provinciaux, stocks, S/N    |
| Paie & RH              | Barème RDC paramétrable, congés, avances, heures sup., sanctions, bulletins |
| Import en masse        | Employés, contrats et historiques de paie par CSV                        |
| Sécurité & audit       | Alertes d'intrusion, verrouillage, journal horodaté exportable (PDF/CSV) |

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

## Données et sauvegardes

Les données sont enregistrées **dans le navigateur** (`localStorage`, clés `rhema:v1:*`) :
elles survivent au rechargement mais ne sont **pas partagées** entre ordinateurs ni navigateurs.

Menu utilisateur → **Sauvegarde des données** (réservé au DG) :

- **Exporter** : télécharge un fichier `.json` contenant toutes les données ;
- **Restaurer** : recharge un fichier exporté (remplace les données actuelles) ;
- **Revenir aux données de démonstration** : efface tout et repart des données d'exemple.

L'espace du navigateur est limité (environ 5 Mo). Une alerte s'affiche s'il est plein :
exportez une sauvegarde puis supprimez les documents volumineux (logos, scans).

## ⚠️ Limites actuelles

Cette version fonctionne **entièrement côté navigateur**, sans serveur ni base de données.
Elle convient à une démonstration ou à un poste unique. Pour un usage réel à plusieurs postes,
il faut ajouter un backend (par exemple l'API Laravel décrite dans l'onglet « Laravel ») qui
assure l'authentification, les droits d'accès et le stockage partagé : dans le navigateur, un
utilisateur averti peut toujours lire ou modifier les données locales.

## Structure du projet

```
src/
├── App.tsx                 # État global, navigation, gestion de session
├── config.ts               # Réglages (mode démo)
├── types.ts                # Types métier partagés
├── components/             # Écrans et fenêtres (un fichier par module)
│   ├── logistics/          # Onglets du module logistique
│   └── invitations/        # Invitations inter-entités
├── data/                   # Données de démonstration
├── hooks/
│   └── usePersistentState.ts   # useState enregistré dans le navigateur
├── lib/
│   ├── auth.ts             # Hachage des mots de passe, session
│   └── storage.ts          # Stockage local, export / import de sauvegarde
└── utils/                  # Droits (rbac), exports PDF/CSV, identifiants
```

## Déploiement

`npm run build` produit un site statique dans `dist/`, déployable sur n'importe quel
hébergeur statique (Cloud Run, Netlify, Vercel, Nginx…). Pensez à définir
`VITE_DEMO_MODE=false` **avant** la compilation pour une mise en production.

---

© RHEMA BUSINESS — Télécoms, VSAT, Réseaux & Intégration Technologique, Kinshasa (RD Congo).
