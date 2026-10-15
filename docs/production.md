# Production — spicyi-drc.tech

Cette version comprend les comptes membres et le déploiement Docker Compose pour un **serveur Linux unique** hébergeant déjà votre Traefik central en `network_mode: host`. Les fichiers sont prêts à transférer sur ce serveur ; aucune publication ni modification DNS n’est effectuée par leur création.

## Fichiers

- `Dockerfile` : construction Vite, runtime Node 24, utilisateur non privilégié, healthcheck.
- `compose.production.yml` : application, migration préalable, PostgreSQL persistant et privé, labels Traefik.
- `deploy/traefik/compose.yml` : configuration centrale équivalente à celle fournie, HTTPS automatique et redirection HTTP.
- `deploy/init-env.mjs` : génération exclusive des secrets ; refuse d’écraser un fichier existant.
- `deploy/backup.sh` : sauvegarde PostgreSQL au format custom.

## 1. DNS et prérequis

Configurer un enregistrement **A** de `spicyi-drc.tech` vers l’IPv4 publique du serveur. Ne conserver un **AAAA** que si IPv6 atteint effectivement le même Traefik. Ouvrir les ports TCP **80 et 443** pour le trafic public et le challenge Let's Encrypt. Docker Engine et Compose v2 sont requis. Le certificat demandé couvre le domaine exact, sans `www`.

Le réseau Docker `172.30.24.0/24` doit être libre sur le serveur. En cas de conflit, choisir un autre sous-réseau privé et modifier ensemble `PROXY_SUBNET` et `PROXY_GATEWAY` dans `.env.production` avant le premier lancement.

## 2. Traefik central

Votre configuration fournie est déjà compatible. **Ne lancez pas une deuxième instance Traefik.** Le modèle dans `deploy/traefik/compose.yml` est à intégrer dans le dossier de la stack centrale existante, en conservant son nom de projet et son volume `traefik-letsencrypt`. Changer de projet créerait un autre volume et ferait perdre l’accès aux certificats existants.

Le modèle remplace `latest` par `TRAEFIK_IMAGE` : renseigner le tag v3 exact ou le digest déjà validé sur votre serveur dans son `.env`, avec `ACME_EMAIL`. Le `.env.example` donne un exemple de famille de version ; fixer une version exacte avant déploiement. Ne pas mettre à niveau le Traefik partagé sans vérifier les autres applications.

Traefik, sur le réseau de l’hôte Linux, peut joindre l’IP du conteneur dans `spicyi_web`. Les labels désignent explicitement ce réseau et le port interne **3001**. Il n’y a aucun port publié pour l’application ni pour PostgreSQL, aucun réseau externe à créer, et aucune option globale `useBindPortIP` à changer. Les autres sites du Traefik central conservent leur configuration.

L’application fait confiance à l’adresse de passerelle de ce réseau pour l’IP cliente transmise par Traefik. Ne pas activer `forwardedHeaders.insecure` sur Traefik et ne pas attacher d’autres applications non fiables à `spicyi_web`.

Références : [provider Docker Traefik](https://doc.traefik.io/traefik/reference/install-configuration/providers/docker/), [sessions OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## 3. Premier déploiement

Transférer ce dépôt sans `node_modules`, fichiers `.env`, journaux ni données de développement. Depuis sa racine sur le serveur :

```sh
# Générer les secrets (Node local facultatif grâce à ce conteneur temporaire).
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work node:24-alpine node deploy/init-env.mjs
chmod 600 .env.production
docker compose --env-file .env.production -f compose.production.yml config --quiet
docker compose --env-file .env.production -f compose.production.yml up -d --build
docker compose --env-file .env.production -f compose.production.yml ps -a
docker compose --env-file .env.production -f compose.production.yml logs --tail=100 migrate app
curl --fail https://spicyi-drc.tech/api/health
```

`migrate` doit terminer avec le code **0** ; `app` et `postgres` doivent être sains. Le service migration initialise aussi une base vide et n’a pas besoin du montage SQL du compose de développement. Ne pas combiner `docker-compose.yml` et `compose.production.yml` : cela pourrait réintroduire des ports de développement.

Ouvrir `https://spicyi-drc.tech`, créer un premier compte, se connecter, créer un objectif. Avec un second compte, vérifier que cet objectif n’apparaît pas. Tester une déconnexion et un rechargement. Vérifier que `http://spicyi-drc.tech` redirige vers HTTPS.

## 4. Comptes et limites

- Identifiant unique de 3–40 caractères, normalisé en minuscules ; nom affiché et code **exactement à quatre chiffres**, zéros initiaux acceptés. Aucune adresse e-mail ni vérification e-mail.
- Inscription publique puis connexion explicite. Aucun compte administrateur ou code par défaut.
- Code haché par scrypt avec sel individuel et secret serveur `PIN_PEPPER`. Conserver ce secret : le remplacer rend les anciens codes inutilisables.
- Sessions aléatoires de 7 jours, hachées en PostgreSQL, cookies `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`. Déconnexion avec révocation serveur ; sessions expirées nettoyées périodiquement.
- Chaque requête d’objectifs est limitée au propriétaire authentifié. Le thème est enregistré dans le compte. Aucun stockage des données membres dans `localStorage`.
- Modifications acceptées seulement avec l’en-tête `Origin: https://spicyi-drc.tech`, y compris pour un client API. Le navigateur l’envoie automatiquement.
- Connexion : 5 tentatives par identifiant / 15 minutes, 20 / jour et 30 par IP / heure. Inscription : 10 par IP / heure. Les limites incluent les tentatives réussies, persistent en base, et sont atomiques. Une attaque peut temporairement bloquer un identifiant ; attendre la fin de sa fenêtre. Réponse 429 avec `Retry-After`.

**Un code à quatre chiffres ne possède que 10 000 possibilités.** Les protections réduisent les essais mais ce niveau d’authentification reste faible pour des données sensibles. Un mot de passe plus long ou un second facteur serait nécessaire pour ce type d’usage.

### Code oublié

Après vérification de l’identité du demandeur par l’administrateur, exécuter depuis un terminal privé :

```sh
docker compose --env-file .env.production -f compose.production.yml exec app node backend/reset-pin.js identifiant
```

Le nouveau code aléatoire est affiché une fois et toutes les sessions du compte sont révoquées. Le transmettre par un canal privé ; ne pas copier la sortie dans des logs partagés. La limitation des tentatives reste en vigueur.

## 5. Données anciennes

La migration est transactionnelle et idempotente. Les objectifs de l’ancienne version restent en base avec `user_id IS NULL`, invisibles à tous les membres. Aucun transfert au premier inscrit. Après sauvegarde et identification du propriétaire, l’administrateur peut affecter explicitement des UUID d’objectifs à un compte avec une requête paramétrée ou un outil SQL de confiance. Ne pas attribuer globalement des objectifs sans vérifier leur propriétaire.

Le volume production `spicyi_postgres_data` est distinct du volume de développement. Pour transférer une ancienne base, sauvegarder puis restaurer dans la base de production avant d’exécuter la migration. Ne pas copier les répertoires physiques de PostgreSQL entre versions.

## 6. Sauvegardes, mises à jour et restauration

```sh
sh deploy/backup.sh
```

Copier régulièrement le dump et une copie **chiffrée** de `.env.production` hors du serveur, ainsi que le volume ACME de la stack centrale. Le dump contient les comptes, sessions et objectifs : le traiter comme confidentiel. Tester la restauration sur une base séparée. `docker compose down` conserve les volumes ; **ne pas utiliser `down -v`** sauf suppression intentionnelle des données.

Avant une mise à jour : sauvegarder, conserver le tag/digest précédent, choisir un nouveau `APP_TAG` dans `.env.production`, transférer le code puis :

```sh
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml stop app
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml up -d
```

En cas d’échec de migration, ne pas poursuivre le déploiement. Pour restaurer **intentionnellement** une sauvegarde dans la base cible (écrase ses données), arrêter l’application et exécuter :

```sh
docker compose --env-file .env.production -f compose.production.yml stop app
docker compose --env-file .env.production -f compose.production.yml exec -T postgres pg_restore -U chrono -d chrono --clean --if-exists --exit-on-error < backups/NOM.dump
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml up -d
```

Un retour à une ancienne image doit rester compatible avec le schéma ; sinon restaurer aussi la sauvegarde correspondante pendant l’arrêt. Épingler les images Node/PostgreSQL/Traefik à des digests validés pour une livraison strictement reproductible, puis prévoir leur mise à jour de sécurité.
