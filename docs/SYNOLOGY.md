# Installer RHEMA Business sur un Synology (avec base de données MariaDB)

Ce guide installe sur votre NAS :

- **la base de données MariaDB** (compatible MySQL), où sont enregistrées toutes les données ;
- **le serveur RHEMA Business** (Node.js), qui gère les connexions et sert l'application.

Tous les utilisateurs partagent alors les mêmes données, depuis n'importe quel poste du réseau
(ou d'Internet si vous le décidez).

> Testé avec la configuration `docker-compose.yml` du projet : MariaDB 11.4 + Node.js 22.
> Il n'est **pas nécessaire** d'installer le paquet « MariaDB 10 » de Synology : la base tourne
> dans son propre conteneur, avec ses données dans un dossier du NAS (voir l'annexe si vous
> préférez malgré tout le paquet Synology).

---

## 1. Prérequis

- Un NAS compatible **Container Manager** (modèles « + » comme le DS920+), DSM 7.2 ou plus récent.
- **Container Manager** installé : *Centre de paquets* → rechercher « Container Manager » → *Installer*.
- Environ 2 Go d'espace libre et un accès Internet sur le NAS (pour télécharger les images).

## 2. Copier le projet sur le NAS

1. Sur GitHub, ouvrez https://github.com/kams77/rhema-business-react
   → bouton vert **Code** → **Download ZIP** (après fusion des pull requests dans `main`).
2. Dans DSM, ouvrez **File Station**. Si le dossier partagé `docker` n'existe pas, Container Manager
   l'a normalement créé ; sinon créez-le (*Panneau de configuration → Dossier partagé*).
3. Dans `docker`, créez un dossier **`rhema`** et envoyez-y le fichier ZIP.
4. Clic droit sur le ZIP → **Extraire** → **Extraire ici**.
5. Vérifiez que `docker-compose.yml` se trouve **directement** dans `docker/rhema`
   (si un sous-dossier `rhema-business-react-main` a été créé, déplacez son contenu d'un niveau).

## 3. Choisir les mots de passe (obligatoire)

Ouvrez `docker/rhema/docker-compose.yml` (paquet **Éditeur de texte** du Centre de paquets, ou
modifiez-le à l'étape 4 dans Container Manager) et remplacez les **trois** valeurs `CHANGEZ_MOI_…` :

| Valeur | Rôle | Exemple de forme |
|---|---|---|
| `CHANGEZ_MOI_mot_de_passe_base` (apparaît **2 fois**, mettez la même valeur) | Mot de passe utilisé par l'application pour accéder à la base | `Rb!7mQ2x…` (20 caractères) |
| `CHANGEZ_MOI_mot_de_passe_root` | Mot de passe administrateur de MariaDB (à garder en lieu sûr) | une autre valeur longue |
| `CHANGEZ_MOI_code_installation` | Code demandé une seule fois, à l'écran d'installation | `Installation-RHEMA-2026` |

Les conteneurs **refusent de démarrer** tant que ces valeurs d'exemple sont présentes.
Évitez les caractères `$` et `"` dans ces mots de passe.

## 4. Créer le projet dans Container Manager

1. **Container Manager** → **Projet** → **Créer**.
2. **Nom du projet** : `rhema`.
3. **Chemin** : `/docker/rhema`.
4. **Source** : *Utiliser le fichier docker-compose.yml existant*.
5. Suivant (ignorez la proposition de portail Web Station) → **Terminé**.

La première construction prend **5 à 15 minutes** (téléchargement des images et compilation de
l'application). Suivez l'avancement dans l'onglet *Journal* du projet. À la fin, les deux
conteneurs `rhema-db` et `rhema-app` doivent être **en cours d'exécution** (voyant vert).

## 5. Premier démarrage

1. Depuis un ordinateur du réseau, ouvrez **http://IP-DU-NAS:8080**
   (l'IP est visible dans *Panneau de configuration → Réseau*).
2. L'écran **« Installation du serveur RHEMA Business »** s'affiche :
   - saisissez le **code d'installation** choisi à l'étape 3 ;
   - **Créer mon organisation** : l'assistant enregistre l'entreprise, l'organigramme et les comptes.
     À la dernière étape, notez (ou copiez) les identifiants et mots de passe provisoires des collaborateurs ;
   - *ou* **Importer une sauvegarde** : un fichier `.json` exporté depuis la version navigateur de l'application.
3. Connectez-vous avec le compte DG. Chaque collaborateur choisira son mot de passe personnel
   lors de sa première connexion.

## 6. Accès sécurisé en HTTPS (fortement recommandé)

En `http://…:8080`, les mots de passe circulent **en clair** sur le réseau. Mettez en place HTTPS :

1. **Nom de domaine** : *Panneau de configuration → Accès externe → DDNS → Ajouter*
   → fournisseur *Synology* → par exemple `rhema-entreprise.synology.me`.
2. **Certificat** : *Panneau de configuration → Sécurité → Certificat → Ajouter*
   → *Obtenir un certificat de Let's Encrypt* → domaine `rhema-entreprise.synology.me`.
   (Let's Encrypt doit pouvoir joindre le NAS sur le port 80 : redirigez-le temporairement sur la box.)
3. **Proxy inversé** : *Panneau de configuration → Portail de connexion → Avancé → Proxy inversé → Créer* :
   - Source : protocole **HTTPS**, nom d'hôte `rhema-entreprise.synology.me`, port **443** ;
   - Destination : protocole **HTTP**, nom d'hôte `localhost`, port **8080**.
4. *Sécurité → Certificat → Paramètres* : associez le certificat Let's Encrypt à ce proxy inversé.
5. L'application est alors accessible sur **https://rhema-entreprise.synology.me**.

**Accès depuis Internet :** n'ouvrez sur la box que le port **443**, jamais le 8080 ni le port
de MariaDB (qui n'est d'ailleurs pas exposé). Pour un usage interne uniquement, préférez un VPN
(*VPN Server* de Synology ou Tailscale) plutôt qu'une ouverture sur Internet.

## 7. Sauvegardes

Les données sont dans `docker/rhema/mysql`. Mettez en place **deux** protections :

1. **Export applicatif** (le plus simple) : dans l'application, *menu utilisateur → Sauvegarde des
   données → Exporter* (compte DG). Gardez ce fichier hors du NAS.
2. **Sauvegarde automatique de la base** : *Panneau de configuration → Planificateur de tâches →
   Créer → Tâche planifiée → Script défini par l'utilisateur*, utilisateur **root**, chaque nuit :

   ```bash
   mkdir -p /volume1/docker/rhema/sauvegardes
   docker exec rhema-db sh -c 'mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" --single-transaction rhema' \
     | gzip > /volume1/docker/rhema/sauvegardes/rhema-$(date +%F).sql.gz
   find /volume1/docker/rhema/sauvegardes -name '*.sql.gz' -mtime +30 -delete
   ```

   Incluez ensuite le dossier `docker/rhema/sauvegardes` dans **Hyper Backup**.

**Restaurer un fichier .sql.gz** (en dernier recours) :

```bash
gunzip -c /volume1/docker/rhema/sauvegardes/rhema-AAAA-MM-JJ.sql.gz \
  | docker exec -i rhema-db sh -c 'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" rhema'
```

## 8. Mettre à jour l'application

1. Exportez une sauvegarde (étape 7.1).
2. Téléchargez le nouveau ZIP depuis GitHub et remplacez les fichiers dans `docker/rhema`,
   **sauf** le dossier `mysql` et votre `docker-compose.yml` (qui contient vos mots de passe).
3. Container Manager → **Projet** → `rhema` → **Arrêter**, puis **Action → Construire**
   (reconstruction de l'image), puis **Démarrer**.

Les données de la base sont conservées.

## 9. Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| `rhema-db` s'arrête aussitôt | Les valeurs `CHANGEZ_MOI` sont encore présentes (voir son *Journal*). |
| `rhema-app` redémarre en boucle | Mot de passe de base différent entre `db` et `app`, ou valeurs `CHANGEZ_MOI`. |
| Mot de passe de base modifié après le premier démarrage | MariaDB garde l'ancien. Si la base est encore vide : arrêtez le projet, supprimez le dossier `docker/rhema/mysql`, redémarrez. |
| « Serveur indisponible » dans le navigateur | Le conteneur `rhema-app` n'est pas démarré ; consultez son journal. |
| « Code d'installation incorrect » | Il doit être identique à `SETUP_CODE` dans `docker-compose.yml`. |
| Un compte est verrouillé | Le DG le réactive dans *Gestion & CRUD Agents* (bouton de statut). |
| Le DG est verrouillé | Un autre compte DG peut le réactiver ; sinon, voir « Débloquer un compte DG » ci-dessous. |

Journaux : *Container Manager → Conteneur → rhema-app → Détails → Journal*.

**Débloquer un compte DG** (connexion SSH au NAS, puis, en remplaçant l'email) :

```bash
sudo docker exec rhema-db sh -c 'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" rhema -e \
  "UPDATE users SET status=\"actif\", failed_attempts=0 WHERE login_email=\"dg@votre-entreprise.cd\""'
```

---

## Annexe — Utiliser le paquet « MariaDB 10 » de Synology à la place du conteneur

1. Installez **MariaDB 10** depuis le Centre de paquets (port par défaut **3307**), puis
   **phpMyAdmin** si vous voulez une interface.
2. Créez une base `rhema` et un utilisateur `rhema` ayant tous les droits sur cette base
   (accès autorisé depuis le réseau Docker, par exemple `rhema@'%'`).
3. Dans `docker-compose.yml` : supprimez le service `db` et le bloc `depends_on` de `app`, puis
   réglez `DB_HOST` sur l'adresse IP du NAS et `DB_PORT` sur `3307`.
4. Créez le projet comme à l'étape 4. Les tables sont créées automatiquement au premier démarrage.

## Ce que contient la base

| Table | Contenu |
|---|---|
| `users` | Comptes (email, matricule, rôle, statut, empreinte du mot de passe) |
| `sessions` | Sessions ouvertes (seule une empreinte du jeton est stockée) |
| `app_data` | Données de chaque module (documents, paie, logistique…), avec numéro de version |
| `audit_logs` | Journal d'audit, en ajout seul |

Étape suivante prévue : découper `app_data` en tables détaillées module par module
(contrats, bulletins, factures, stocks…), sans changer l'utilisation de l'application.
