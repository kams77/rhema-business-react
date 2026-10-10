# Guide : exécuter RHEMA Business en local et l'héberger en ligne

## Partie 1 — Exécuter l'application sur votre ordinateur

### 1. Installer les outils (une seule fois)

| Outil | Où le trouver | Vérification |
|---|---|---|
| **Node.js 22 LTS** | https://nodejs.org → bouton « LTS » | `node -v` affiche `v22…` |
| **Git** | https://git-scm.com/downloads | `git --version` |
| Un éditeur (facultatif) | https://code.visualstudio.com | — |

Sous Windows, installez-les avec les options par défaut, puis ouvrez **PowerShell** (ou le terminal de VS Code).

### 2. Récupérer le projet

```bash
git clone https://github.com/kams77/rhema-business-react.git
cd rhema-business-react
```

> Tant que la pull request n°1 n'est pas fusionnée, ajoutez :
> `git checkout amelioration/persistance-securite-ui`

### 3. Installer les dépendances

```bash
npm install
```

Comptez 1 à 3 minutes (≈ 200 Mo téléchargés).

### 4. Créer le fichier de configuration

```bash
# Windows (PowerShell)
copy .env.example .env
# Mac / Linux
cp .env.example .env
```

Laissez `VITE_DEMO_MODE=true` pour essayer l'application.

### 5. Lancer l'application

```bash
npm run dev
```

Ouvrez **http://localhost:3000** dans Chrome, Edge ou Firefox.
Connexion de démonstration : `dg@rhemabusiness.com` / `rhema2026` (ou un clic sur un profil).

Pour arrêter : `Ctrl + C` dans le terminal.

### 6. Tester la version de production en local

```bash
npm run build      # crée le dossier dist/
npm run preview    # sert dist/ sur http://localhost:4173
```

### Problèmes fréquents

| Symptôme | Solution |
|---|---|
| `npm` n'est pas reconnu | Redémarrez le terminal après l'installation de Node.js. |
| Le port 3000 est déjà utilisé | `npx vite --port=3001` |
| « Le chiffrement du navigateur est indisponible » | Ouvrez l'application via `http://localhost`, pas via l'adresse IP de l'ordinateur (voir ci-dessous). |
| Page blanche après une mise à jour | Videz le cache (`Ctrl + Maj + R`). |

> **Accès depuis d'autres postes du réseau :** la connexion utilise le chiffrement du navigateur,
> qui n'est disponible qu'en **HTTPS** ou sur `localhost`. `http://192.168.x.x:3000` ne permettra pas
> de se connecter. Pour plusieurs postes, utilisez l'hébergement en ligne (Partie 2) ou un serveur
> interne avec certificat HTTPS (option C).

---

## Partie 2 — Héberger l'application en ligne

Avant toute mise en ligne réelle, l'application doit être compilée en **mode production**
(`VITE_DEMO_MODE=false`) : plus de connexion en 1 clic, mot de passe personnel obligatoire.

### Option A (recommandée) — Cloudflare Pages · gratuit

Pourquoi : offre gratuite sans interdiction d'usage commercial, HTTPS automatique, réseau
mondial rapide (y compris en Afrique), déploiement automatique à chaque modification sur GitHub.
Les en-têtes de sécurité du fichier `public/_headers` sont appliqués automatiquement.

1. Créez un compte sur https://dash.cloudflare.com/sign-up
2. **Workers & Pages** → **Create** → onglet **Pages** → **Connect to Git**.
3. Autorisez GitHub et choisissez le dépôt `kams77/rhema-business-react`.
4. Réglages de compilation :
   - **Production branch** : `main`
   - **Framework preset** : `Vite` (ou « None »)
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
5. **Environment variables** (Production) :
   - `VITE_DEMO_MODE` = `false`
   - `NODE_VERSION` = `22`
6. **Save and Deploy**. Après 1 à 2 minutes, le site est en ligne sur `https://<nom>.pages.dev`.
7. (Facultatif) **Custom domains** → ajoutez par exemple `app.rhemabusiness.com`
   et suivez les instructions DNS.

Chaque fusion sur `main` redéploie automatiquement le site.

### Option B — Netlify · gratuit (limité)

Même principe : https://app.netlify.com → **Add new site** → **Import from Git** →
build `npm run build`, dossier `dist`, variable `VITE_DEMO_MODE=false`.
L'offre gratuite fonctionne par crédits mensuels (≈ 20 déploiements de production) :
le site est mis en pause si les crédits sont épuisés.

### Option C — Serveur de l'entreprise (Docker)

Pour un serveur interne ou un VPS (Linux avec Docker) :

```bash
docker build -t rhema-business .
docker run -d -p 8080:80 --restart unless-stopped --name rhema rhema-business
```

Le site est servi par Nginx sur le port 8080, avec les en-têtes de sécurité
(`deploy/nginx.conf`). Placez devant un certificat HTTPS (Caddy, Traefik ou Nginx + Let's Encrypt),
indispensable pour la connexion.

Mode démo : `docker build --build-arg VITE_DEMO_MODE=true -t rhema-business .`

### Option D — Synology avec base de données MariaDB (données partagées)

Pour que tous les collaborateurs travaillent sur les **mêmes données**, utilisez le mode serveur :
application + serveur Node.js + MariaDB, en un seul projet Container Manager.
Guide complet : **[GUIDE-DEPLOIEMENT-SYNOLOGY.md](GUIDE-DEPLOIEMENT-SYNOLOGY.md)**.

### À éviter

- **Vercel (offre gratuite « Hobby »)** : réservée à un usage personnel non commercial.
- **GitHub Pages** : interdit pour les sites d'entreprise et les sites avec mots de passe.

---

## Après la mise en ligne

1. Connectez-vous avec le compte DG : un **nouveau mot de passe** est demandé.
2. Menu utilisateur → **Sauvegarde des données** → exportez une première sauvegarde.
3. Créez les comptes des collaborateurs (module *Gestion & CRUD Agents* ou *Import CSV*) :
   chacun reçoit un mot de passe provisoire à changer à la première connexion.

> **Rappel important :** les données sont stockées dans le navigateur de chaque poste.
> Deux personnes sur deux ordinateurs **ne voient pas les mêmes données**. Pour un vrai travail
> d'équipe, il faudra ajouter un serveur et une base de données partagée.

## Vérification automatique

À chaque envoi sur GitHub, l'onglet **Actions** du dépôt vérifie que le projet s'installe,
passe le contrôle TypeScript, se compile (modes démo et production) et que l'image Docker
démarre avec les en-têtes de sécurité.
