# Guide de déploiement — RHEMA Business sur Synology DS923+ (DSM 7.4.1-90080)

Ce guide installe sur le NAS, en un seul projet **Container Manager** :

- **la base de données MariaDB 11.4**, où sont enregistrées toutes les données ;
- **le serveur RHEMA Business** (Node.js 22), qui vérifie les connexions et les droits et sert l'application.

Tous les collaborateurs partagent alors les mêmes données. On accède à l'application **uniquement en
HTTPS**, à travers le **proxy inversé** de DSM : le serveur n'écoute que sur le NAS lui-même
(`127.0.0.1:8080`) et n'est jamais exposé directement au réseau.

```
 Postes / téléphones ──HTTPS 443──▶ Proxy inversé DSM ──HTTP localhost:8080──▶ rhema-app ──3306──▶ rhema-db
                                     (certificat)                               (conteneur)          (conteneur)
                                                                                                       │
                                                                          dossier /docker/rhema/mysql ◀┘
```

Durée : environ 45 minutes (dont 5 à 15 minutes de construction automatique).

---

## 1. Ce qu'il faut

| Élément | Détail |
|---|---|
| NAS | Synology **DS923+** (processeur AMD Ryzen R1600, 4 Go de mémoire d'origine — suffisant ; 8 Go conseillés si d'autres paquets tournent). |
| Système | **DSM 7.4.1-90080** (Panneau de configuration → Mise à jour et restauration). |
| Volume | Volume **Btrfs** (nécessaire pour les instantanés). |
| Espace | 3 Go libres pour les images, plus la croissance de la base. |
| Réseau | Une adresse IP fixe pour le NAS (réservation DHCP sur la box, ou IP manuelle dans *Panneau de configuration → Réseau*). |
| Accès | Un compte administrateur DSM **autre que `admin`**, avec la double authentification activée. |

## 2. Préparer et sécuriser le NAS

1. **Mettre DSM à jour** : *Panneau de configuration → Mise à jour et restauration* → vérifier que la
   version affichée est 7.4.1-90080 (ou plus récente).
2. **Fuseau horaire** : *Panneau de configuration → Options régionales → Heure* → fuseau
   **(GMT+01:00) Kinshasa**, synchronisation avec un serveur NTP. Les signatures et le journal d'audit
   sont horodatés : l'heure doit être juste.
3. **Compte administrateur** : *Panneau de configuration → Utilisateur et groupe* → désactivez le compte
   `admin` si ce n'est pas déjà fait, et utilisez un compte administrateur nominatif.
4. **Double authentification** (compte administrateur) : menu de votre compte (en haut à droite) →
   *Personnel* → *Sécurité* → *Méthode de connexion* → activez la vérification en 2 étapes (application
   Synology Secure SignIn ou code à usage unique).
5. **Blocage automatique** : *Panneau de configuration → Sécurité → Protection* → cochez
   *Activer le blocage automatique* (par exemple 10 tentatives en 5 minutes).

## 3. Installer Container Manager

*Centre de paquets* → rechercher **Container Manager** → *Installer*. Le paquet crée le dossier partagé
**`docker`** sur le volume choisi.

> Ne publiez **aucun port** de conteneur sur le réseau dans Container Manager : seul le proxy inversé de
> DSM doit être joignable.

## 4. Copier le projet sur le NAS

1. Sur GitHub, ouvrez `https://github.com/kams77/rhema-business-react` → bouton vert **Code** →
   **Download ZIP** (branche `main`, après fusion de la demande de modification de sécurité).
2. Dans DSM, ouvrez **File Station** → dossier partagé `docker` → créez le dossier **`rhema`**.
3. Envoyez le ZIP dans `docker/rhema`, puis clic droit → **Extraire** → **Extraire ici**.
4. Vérifiez que `docker-compose.yml` se trouve **directement** dans `docker/rhema` (si un sous-dossier
   `rhema-business-react-main` a été créé, déplacez son contenu d'un niveau puis supprimez-le).
5. Supprimez le ZIP.

**Permissions** : *File Station* → clic droit sur `docker/rhema` → *Propriétés* → *Autorisation* :
seuls les administrateurs doivent y avoir accès (retirez le groupe `users` s'il apparaît).

## 5. Choisir les secrets (obligatoire)

Trois valeurs protègent l'installation. Choisissez-les longues (20 caractères ou plus), avec lettres et
chiffres, **sans espace, ni `$`, ni guillemets**. Utilisez un gestionnaire de mots de passe pour les
générer et les conserver.

| Variable | Rôle |
|---|---|
| `DB_PASSWORD` | Mot de passe de l'application pour accéder à la base. |
| `DB_ROOT_PASSWORD` | Mot de passe administrateur de MariaDB (sauvegardes, dépannage). |
| `SETUP_CODE` | Code demandé **une seule fois**, à l'écran d'installation (12 caractères ou plus). |

**Méthode recommandée — fichier `.env`** (il survit aux mises à jour) :

1. Sur votre ordinateur, ouvrez `deploy/synology.env.example` (dans le ZIP) avec le Bloc-notes.
2. Remplacez les trois valeurs `CHANGEZ_MOI_…`.
3. *Fichier → Enregistrer sous* → type **Tous les fichiers** → nom **`.env`** (avec le point).
4. Envoyez ce fichier dans `docker/rhema` (à côté de `docker-compose.yml`).

**Autre méthode** : remplacez les valeurs `CHANGEZ_MOI_…` directement dans `docker-compose.yml`
(étape 6, éditeur de Container Manager). `DB_PASSWORD` apparaît deux fois : mettez la même valeur.

Les conteneurs **refusent de démarrer** tant qu'une valeur d'exemple `CHANGEZ_MOI` est présente :
une erreur de configuration se voit donc immédiatement dans le journal.

## 6. Créer le projet dans Container Manager

1. **Container Manager** → **Projet** → **Créer**.
2. **Nom du projet** : `rhema`.
3. **Chemin** : cliquez sur *Définir le chemin* → `docker/rhema`.
4. **Source** : *Utiliser le fichier docker-compose.yml existant* (le contenu s'affiche ; vous pouvez
   le relire ou y saisir les secrets).
5. *Suivant* → écran *Paramètres du portail Web* : **ne cochez rien** (le portail Web Station n'est pas
   utilisé) → *Suivant*.
6. *Résumé* → cochez *Démarrer le projet une fois créé* → **Terminé**.

La première construction télécharge les images et compile l'application : **5 à 15 minutes** sur un
DS923+. Suivez l'avancement dans la fenêtre de construction, puis dans *Projet → rhema → Journal*.

À la fin, *Container Manager → Conteneur* affiche **`rhema-db`** et **`rhema-app`** en état
**En cours d'exécution** (voyant vert) ; `rhema-app` passe à *sain* (healthy) après environ 40 secondes.

> Le projet utilise un réseau interne à adresse fixe (`172.29.77.0/24`). Si Container Manager signale
> que ce sous-réseau est déjà utilisé, remplacez-le dans `docker-compose.yml` (deux endroits :
> `subnet` et `TRUSTED_PROXIES`) par une autre plage 172.x, par exemple `172.29.78.0/24`.

## 7. Ouvrir l'accès en HTTPS (proxy inversé)

L'application exige HTTPS (cookie de session sécurisé, chiffrement du navigateur). Choisissez **A**
(réseau interne seulement, rapide) ou **B** (nom de domaine et certificat reconnu, recommandé).

### A. Réseau interne seulement

1. *Panneau de configuration → Portail de connexion → Avancé → **Proxy inversé** → Créer*.
2. **Nom de la règle** : `RHEMA Business`.
3. **Source** : protocole **HTTPS**, nom d'hôte = **l'adresse IP du NAS** (ex. `192.168.1.20`),
   port **8443**, cochez *Activer HSTS*.
4. **Destination** : protocole **HTTP**, nom d'hôte **`localhost`**, port **`8080`**.
5. Onglet **En-tête personnalisé** → *Créer* → *En-tête personnalisé*, ajoutez :

   | Nom de l'en-tête | Valeur |
   |---|---|
   | `X-Forwarded-For` | `$proxy_add_x_forwarded_for` |
   | `X-Forwarded-Proto` | `$scheme` |

6. **Enregistrer**. L'application est accessible sur `https://192.168.1.20:8443`.
   Le navigateur affiche un avertissement (certificat propre au NAS) : vérifiez l'adresse, puis
   acceptez-le une fois sur chaque poste.

### B. Nom de domaine et certificat Let's Encrypt (recommandé)

1. **Nom de domaine** : *Panneau de configuration → Accès externe → DDNS → Ajouter* → fournisseur
   *Synology* → par exemple `rhema-entreprise.synology.me`.
2. **Certificat** : *Panneau de configuration → Sécurité → Certificat → Ajouter → Ajouter un nouveau
   certificat → Obtenir un certificat de Let's Encrypt* → domaine `rhema-entreprise.synology.me`.
   Let's Encrypt doit joindre le NAS sur le **port 80** pendant l'opération (redirection temporaire sur
   la box, à refermer ensuite si vous n'exposez pas le service).
3. **Proxy inversé** : comme en A, mais source = nom d'hôte **`rhema-entreprise.synology.me`**,
   port **443**.
4. *Sécurité → Certificat → **Paramètres*** : associez le certificat Let's Encrypt à la règle
   « RHEMA Business ».
5. L'application est accessible sur `https://rhema-entreprise.synology.me`.

## 8. Premier démarrage de l'application

1. Ouvrez l'adresse HTTPS de l'étape 7. L'écran **« Installation du serveur RHEMA Business »** s'affiche.
2. Saisissez le **code d'installation** (`SETUP_CODE`).
3. **Créer mon organisation** : l'assistant enregistre l'entreprise (RCCM, Id. Nat, N° impôt),
   l'organigramme et les comptes. À la dernière étape, notez les identifiants et mots de passe provisoires
   et remettez-les **en main propre** à chaque collaborateur.
   *Ou* **Importer une sauvegarde** : fichier `.json` exporté depuis une installation précédente.
4. Connectez-vous avec le compte DG. Chaque collaborateur choisit son mot de passe personnel à sa
   première connexion (10 caractères minimum, lettres et chiffres).

Le code d'installation ne sert plus ensuite : l'écran d'installation disparaît dès qu'un compte existe.

## 9. Pare-feu de DSM

*Panneau de configuration → Sécurité → **Pare-feu*** → cochez *Activer le pare-feu* → *Modifier les
règles* du profil, puis créez, **dans cet ordre** :

| # | Ports | Source | Action |
|---|---|---|---|
| 1 | Interface DSM (5000, 5001) | Sous-réseau local (ex. `192.168.1.0/24`) | Autoriser |
| 2 | Port de l'application (8443 en A, 443 en B) | Sous-réseau local — ou *Tous* si l'accès Internet est voulu (option B) | Autoriser |
| 3 | Tous | Tous | **Refuser** |

N'ajoutez **jamais** de règle pour 8080 (application) ni 3306 (base) : ils n'écoutent que sur le NAS.

**Accès depuis l'extérieur** : de préférence par VPN (*VPN Server* de Synology, ou Tailscale) sans rien
ouvrir sur la box. Si vous publiez l'application sur Internet (option B), n'ouvrez sur la box que le
port **443**, jamais 5000/5001, 8080 ni 3306.

## 10. Sauvegardes

Mettez en place **trois protections complémentaires** :

1. **Export applicatif** (compte DG) : *menu utilisateur → Sauvegarde des données → Exporter* ; fichier
   `.json` à conserver **chiffré et hors du NAS** (il contient toute la paie et les empreintes des mots de
   passe).
2. **Copie quotidienne de la base** : *Panneau de configuration → Planificateur de tâches → Créer →
   Tâche planifiée → Script défini par l'utilisateur* — utilisateur **root**, tous les jours à 02:00 :

   ```bash
   mkdir -p /volume1/docker/rhema/sauvegardes
   chmod 700 /volume1/docker/rhema/sauvegardes
   docker exec rhema-db sh -c 'mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines rhema' \
     | gzip > /volume1/docker/rhema/sauvegardes/rhema-$(date +%F).sql.gz
   find /volume1/docker/rhema/sauvegardes -name '*.sql.gz' -mtime +30 -delete
   ```

3. **Hyper Backup** (Centre de paquets) : tâche quotidienne du dossier `docker/rhema` (avec
   `sauvegardes`) vers un disque USB, un autre NAS ou Synology C2, avec **chiffrement côté client**
   activé et rotation des versions.

En complément, **Snapshot Replication** : instantanés quotidiens du dossier partagé `docker`
(conservation 30 jours) — protection efficace contre les rançongiciels et les erreurs de manipulation.

**Restaurer une copie `.sql.gz`** (en dernier recours, projet démarré) :

```bash
gunzip -c /volume1/docker/rhema/sauvegardes/rhema-AAAA-MM-JJ.sql.gz \
  | docker exec -i rhema-db sh -c 'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" rhema'
```

Testez une restauration au moins une fois par trimestre.

## 11. Mettre à jour l'application

1. Exportez une sauvegarde (section 10.1).
2. Téléchargez le nouveau ZIP depuis GitHub et remplacez les fichiers de `docker/rhema`, **sauf** les
   dossiers `mysql` et `sauvegardes` et le fichier `.env`.
   (Si vos secrets sont dans `docker-compose.yml`, reportez-les dans le nouveau fichier.)
3. *Container Manager → Projet → rhema* → **Arrêter** → *Action* → **Construire** → **Démarrer**.

Les données de la base sont conservées. Après une mise à jour de sécurité, les empreintes de mots de
passe sont renforcées automatiquement à la connexion suivante de chaque utilisateur.

## 12. Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| `rhema-db` s'arrête aussitôt | Valeurs `CHANGEZ_MOI` encore présentes (voir son *Journal*), ou fichier `.env` mal nommé (`.env.txt`). |
| `rhema-app` redémarre en boucle | Mot de passe de base différent entre `db` et `app`, `SETUP_CODE` trop court (moins de 8 caractères), ou valeurs `CHANGEZ_MOI`. |
| Mot de passe de base changé après le premier démarrage | MariaDB garde l'ancien. Si la base est encore vide : arrêtez le projet, supprimez `docker/rhema/mysql`, redémarrez. |
| « Ce site est inaccessible » | Règle de proxy inversé absente ou port bloqué par le pare-feu (section 9). |
| Erreur 502 du proxy | `rhema-app` n'est pas démarré ou n'est pas encore *sain* : attendez une minute, consultez son journal. |
| La connexion ne tient pas (retour à l'écran de connexion) | Accès en `http://` au lieu de `https://` : le cookie de session n'est envoyé qu'en HTTPS. |
| « Trop de tentatives depuis ce poste » pour tout le monde | Les en-têtes `X-Forwarded-For` ne sont pas transmis ou le sous-réseau ne correspond pas à `TRUSTED_PROXIES` (sections 6 et 7). |
| « Code d'installation incorrect » | Doit être identique à `SETUP_CODE`. Après 10 essais, attendez 15 minutes. |
| Un compte est verrouillé | Le DG ou le responsable le réactive dans *Gestion & CRUD Agents* (bouton *Mot de passe* : mot de passe provisoire et déblocage). |
| Le DG est bloqué | Blocage **temporaire de 15 minutes** : attendez, puis reconnectez-vous. |

Journaux : *Container Manager → Conteneur → rhema-app → Détails → Journal*.

**Débloquer un compte DG immédiatement** (connexion SSH au NAS avec un compte administrateur ; remplacez
l'email) :

```bash
sudo docker exec rhema-db sh -c 'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" rhema -e \
  "UPDATE users SET status=\"actif\", failed_attempts=0, profile=JSON_REMOVE(profile, \"$.lockedUntil\") WHERE login_email=\"dg@votre-entreprise.cd\""'
```

Désactivez SSH ensuite (*Panneau de configuration → Terminal et SNMP*).

## 13. Liste de contrôle sécurité (à cocher avant la mise en service)

- [ ] DSM 7.4.1-90080 ou plus récent, mises à jour automatiques des correctifs activées.
- [ ] Compte `admin` désactivé ; double authentification sur tous les comptes administrateurs.
- [ ] Blocage automatique activé ; pare-feu avec règle finale « Refuser tout ».
- [ ] Secrets `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `SETUP_CODE` uniques, longs, conservés dans un gestionnaire de mots de passe.
- [ ] Dossier `docker/rhema` accessible aux seuls administrateurs.
- [ ] Accès **uniquement en HTTPS** via le proxy inversé ; aucun port 8080 / 3306 ouvert.
- [ ] Accès extérieur par VPN, ou seulement le port 443 ouvert sur la box.
- [ ] Copie quotidienne de la base + Hyper Backup chiffré + instantanés ; restauration testée.
- [ ] Mots de passe provisoires remis en main propre ; chaque agent a choisi le sien.
- [ ] Droits « paie » attribués nominativement par le DG ; revue trimestrielle des comptes (départs, suspensions).
- [ ] Journal d'audit vérifié chaque mois (*Journal d'audit → Vérifier l'intégrité*).

---

## Annexe — Utiliser le paquet « MariaDB 10 » de Synology

Possible mais non recommandé (le conteneur MariaDB est isolé et sauvegardé avec le projet).

1. Installez **MariaDB 10** (port **3307**) depuis le Centre de paquets.
2. Créez une base `rhema` et un utilisateur `rhema` ayant tous les droits sur cette seule base, autorisé
   depuis le sous-réseau du projet (`172.29.77.%`).
3. Dans `docker-compose.yml` : supprimez le service `db` et le bloc `depends_on` de `app` ; réglez
   `DB_HOST` sur l'adresse IP du NAS et `DB_PORT` sur `3307`.
4. Créez le projet comme à la section 6. Les tables sont créées automatiquement au premier démarrage.

## Contenu de la base

| Table | Contenu |
|---|---|
| `users` | Comptes (email, matricule, rôle, statut, empreinte du mot de passe) |
| `sessions` | Sessions ouvertes (seule une empreinte du jeton est stockée) |
| `app_data` | Données de chaque module (documents, paie, logistique…), avec numéro de version |
| `audit_logs` | Journal d'audit chaîné, en ajout seul |
