# Audit de sécurité et de confidentialité — octobre 2026

Périmètre : serveur Node.js (`server/`), règles d'accès partagées (`shared/`), application React (`src/`),
images Docker et `docker-compose.yml` (déploiement Synology). Mode étudié en priorité : **mode serveur**
(`VITE_BACKEND=api`), le seul adapté à une utilisation réelle avec des données de personnel.

## Ce qui était déjà solide

- Mots de passe hachés (PBKDF2-SHA-256, sel aléatoire), comparaison en temps constant, calcul factice
  pour les comptes inexistants (pas de fuite par la durée).
- Sessions : jeton aléatoire de 256 bits, seule son empreinte est stockée ; cookie `HttpOnly`,
  `SameSite=Strict`, `Secure` en HTTPS ; expiration après 30 min d'inactivité (10 h maximum).
- Verrouillage après 5 erreurs, limite de débit par adresse, journal d'audit chaîné (SHA-256).
- Contrôles d'accès appliqués **par le serveur** (paie, documents, tâches, organigramme, invitations),
  et non seulement masqués à l'écran ; requêtes SQL paramétrées ; en-têtes de sécurité (CSP stricte,
  `X-Frame-Options`, HSTS) ; conteneur en lecture seule, utilisateur non-root, port lié à `127.0.0.1`.

## Failles trouvées et corrigées

| # | Gravité | Faille | Correction |
|---|---|---|---|
| 1 | **Élevée** (vie privée) | Les documents marqués « confidentiels » (contrat de travail, déclaration CNSS/IPR, bilan) n'étaient en réalité protégés que par l'écran : une fois validés, le serveur les envoyait à tous les responsables, voire à tous les agents du périmètre si l'émetteur choisissait une large diffusion. | `shared/access.mjs` : réservés au circuit, au destinataire, à la DG et à la fonction RH / Finance, quel que soit le choix de diffusion. |
| 2 | **Élevée** (vie privée) | Les demandes de congé (dont congés maladie / maternité) et les fiches d'évaluation validées étaient visibles par tous les collègues du service. | Documents « personnels » : l'agent, son circuit, **sa hiérarchie** et les RH seulement. |
| 3 | **Élevée** (intégrité) | Un agent pouvait se désigner lui-même valideur de sa propre tâche, ou soumettre sa tâche à un collègue complaisant au lieu de son responsable. | Le serveur refuse tout valideur qui est aussi exécutant/contributeur, et vérifie que le circuit soumis est celui que prévoit la tâche (valideurs désignés, sinon la hiérarchie). |
| 4 | **Moyenne** (fraude) | Un gestionnaire de paie (RH non-DG) pouvait modifier **son propre** contrat (salaire, compte bancaire) ou supprimer sa fiche. | Interdit : ses propres lignes de paie ne sont modifiables que par un collègue ou la DG ; ses propres demandes restent « en attente ». |
| 5 | **Moyenne** (vie privée) | Le statut « convoqué » (procédure disciplinaire) d'un agent était visible de tous ses collègues dans l'annuaire. | Masqué à ceux qui ne gèrent pas ce compte (affiché « actif »), valeur réelle conservée lors des enregistrements. |
| 6 | Moyenne | Les adresses transmises par le proxy (`X-Forwarded-For`) étaient crues quelle que soit la provenance : un poste joignant directement le serveur pouvait s'inventer une adresse et contourner la limite de tentatives. | Seuls les proxys de confiance sont crus (`TRUSTED_PROXIES`, sous-réseau fixe du projet Docker). |
| 7 | Moyenne | Le code d'installation (`SETUP_CODE`) pouvait être deviné par essais illimités avant la première installation. | Limite : 10 essais par 15 minutes et par adresse. |
| 8 | Moyenne | Injection de formules dans les exports CSV (journal d'audit, documents, paie, logistique) : un texte commençant par `=`, `+`, `-` ou `@` s'exécutait dans Excel à l'ouverture. | Cellules neutralisées et correctement échappées (`csvCell` dans `src/utils/exportUtils.ts`). |
| 9 | Faible | Signature électronique : le serveur acceptait un signataire dont le nom **commençait** par celui de l'utilisateur (« Jean » pouvait signer « Jean Mukendi »). | Nom exact, éventuellement suivi de la fonction entre parenthèses. |
| 10 | Faible | Clés d'invitation à 10 chiffres générées avec `Math.random` (prévisible). | Générateur cryptographique (`crypto.getRandomValues`), tirage uniforme. |
| 11 | Faible | Les numéros de version des données cachées (paie, alertes, journal) étaient communiqués à tous : on pouvait suivre l'activité de la paie. | Versions filtrées selon les droits de lecture. |
| 12 | Faible | Protection CSRF reposant uniquement sur `SameSite` et le type JSON. | Défense supplémentaire : rejet des requêtes d'écriture marquées par le navigateur comme venant d'un autre site (`Sec-Fetch-Site`). |
| 13 | Faible | PBKDF2 à 150 000 itérations (recommandation OWASP actuelle : 600 000) ; une empreinte importée avec un coût démesuré pouvait bloquer le serveur. | 600 000 itérations, renforcement automatique à la connexion suivante ; coût d'une empreinte borné. |
| 14 | Faible | Conteneurs : capacités Linux non retirées, base sans `no-new-privileges`. | `cap_drop: ALL` pour l'application, `no-new-privileges` pour les deux conteneurs. |
| 15 | Documentation | Le guide Synology indiquait d'ouvrir `http://IP-DU-NAS:8080`, alors que le port n'écoute que sur le NAS lui-même (et que le cookie exige HTTPS) : l'installation était impossible en suivant le guide. | Guide réécrit : accès uniquement en HTTPS par le proxy inversé de DSM (`docs/GUIDE-DEPLOIEMENT-SYNOLOGY.md`). |

Inclus dans la même série (renforcements préparés auparavant dans la copie de travail, vérifiés par
`server/tests/permissions.test.mjs`) : polices hébergées sur le serveur (plus aucune requête vers Google
à chaque ouverture), clé d'invitation masquée dans le journal d'audit, annuaire sans téléphone ni dernière
connexion des collègues, circuit des documents imposé par le serveur (pas de valideurs choisis par
l'émetteur ni de fausse signature), organigramme protégé contre l'appropriation d'une autre branche,
données logistiques (fournisseurs, coordonnées bancaires) réservées, réinitialisation de mot de passe
par le responsable avec changement obligatoire, en-têtes de sécurité complétés.

Tests ajoutés : `npm run test:securite` (`server/tests/security.test.mjs`, 31 vérifications), exécutés
aussi par la vérification automatique GitHub. Les tests existants (API, droits, circuits, journal)
passent toujours.

## Risques résiduels (choix de conception, à connaître)

- **Mode navigateur** (`VITE_BACKEND=local`) : les données de tous les agents, y compris la paie, sont
  dans le navigateur du poste ; toute personne ayant accès au poste peut les lire. **Ne l'utilisez pas
  pour de vraies données** : utilisez le mode serveur (Synology).
- **Validations logistiques** : le visa final d'un bon de commande / mouvement de stock est apposé sans
  ressaisie du mot de passe (contrairement aux documents signés depuis le module Documents). La session
  reste protégée (expiration, cookie sécurisé) ; une ressaisie systématique est une évolution possible.
- **Verrouillage** : quelqu'un qui connaît l'identifiant d'un agent peut verrouiller son compte par
  5 mauvais mots de passe (le DG le débloque). Le compte DG n'est bloqué que 15 minutes. C'est la
  politique voulue ; la limite par adresse freine les tentatives massives.
- **Messages de connexion** : « il vous reste N essais » confirme qu'un identifiant existe. Choix
  d'ergonomie conservé, compensé par la limite de débit.
- **Sauvegarde exportée** (DG) : contient les empreintes des mots de passe et toute la paie. À conserver
  chiffrée, hors du NAS, et jamais envoyée par messagerie.
- **Sécurité du NAS** : l'application ne peut pas compenser un DSM non mis à jour, un compte `admin`
  sans double authentification ou une box exposant d'autres ports. Voir la liste de contrôle du guide de
  déploiement.
