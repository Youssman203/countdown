# Mettre CHRONO en production sur spicy-drc.tech

Ce guide correspond à ton VPS : dossier `/opt/countdown`, projet Docker **chrono**, conteneurs `chrono-app-1` et `chrono-postgres-1`, réseau **spicy_web**, Traefik central en mode **host**. Toutes les commandes ci-dessous sont à lancer dans le terminal Linux du VPS, sauf le transfert de fichiers.

Le domaine est **spicy-drc.tech**, sans `www`. L'application et l'API utilisent cette même adresse. Le routeur et le service Traefik s'appellent désormais **chrono-spicy-drc** pour éviter de réutiliser le nom de routeur de l'ancienne installation.

## 1. Transférer les fichiers corrigés

Transfère le contenu du projet dans `/opt/countdown` avec ton outil habituel (SFTP, Git ou SCP). Inclure les fichiers cachés comme `.dockerignore`, le `Dockerfile`, `compose.production.yml`, `package.json`, `package-lock.json`, les dossiers `backend`, `frontend`, `database` et `deploy`.

Si tu utilises l'archive fournie `countdown-production.zip`, ouvre un terminal sur ton ordinateur dans le dossier où tu l'as téléchargée, puis copie :

```sh
scp countdown-production.zip deploy@2.25.241.13:/tmp/countdown-production.zip
```

Ensuite, sur le VPS (la commande `unzip` doit être installée) :

```sh
mkdir -p /opt/countdown
unzip -o /tmp/countdown-production.zip -d /opt/countdown
```

L'archive contient les sources et les exemples de configuration, aucun secret `.env` réel. L'extraction remplace les fichiers du projet, mais ne supprime pas les fichiers absents de l'archive, dont les secrets existants.

**Conserve les fichiers `.env` et `.env.production` déjà sur le serveur, ainsi que `backups`.** Ne transfère pas les `node_modules` de Windows, les données PostgreSQL ni des secrets de développement. Ne supprime aucun réseau ou volume Docker.

```sh
cd /opt/countdown
docker compose version
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

Les étapes 2 à 5 concernent ton installation existante. Pour un VPS entièrement neuf, utilise la section « Première installation » plus bas.

## 2. Sauvegarder la base existante

Ce bloc utilise directement le conteneur PostgreSQL déjà en marche. Il ne dépend pas du nouveau fichier Compose.

```sh
cd /opt/countdown
(
  set -eu
  umask 077
  mkdir -p backups
  backup="backups/avant-correction-$(date -u +%Y%m%dT%H%M%SZ).dump"
  docker exec chrono-postgres-1 pg_dump -U chrono -d chrono -Fc > "$backup.partial"
  test -s "$backup.partial"
  mv "$backup.partial" "$backup"
  printf 'Sauvegarde créée : %s\n' "$backup"
)
```

Continuer seulement si le message « Sauvegarde créée » apparaît. Copier ensuite cette sauvegarde dans un emplacement privé hors du VPS.

## 3. Récupérer les paramètres de l'installation existante

```sh
cd /opt/countdown
sh deploy/prepare-vps.sh
```

Cette commande récupère le mot de passe PostgreSQL et le secret des codes membres **depuis le conteneur en fonctionnement**. Elle relève le vrai volume PostgreSQL et la passerelle de `spicy_web`, puis prépare `.env.production` sans afficher les secrets. Une éventuelle ancienne version de `.env.production` est conservée dans `backups`. Aucun conteneur n'est arrêté et aucune donnée n'est déplacée.

Cela évite la confusion entre l'ancien `.env` utilisé sur ton VPS et le fichier `.env.production` utilisé désormais. Le script s'arrête si les conteneurs ou le réseau n'appartiennent pas au projet attendu ; dans ce cas, ne lance pas la suite et conserve son message.

D'après tes dernières sorties, le réseau est `172.30.25.0/24`, avec la passerelle `172.30.25.1`. On conserve ce réseau actuel.

**Ne régénère pas les secrets d'une installation existante.** Changer `PIN_PEPPER` empêche les membres de se connecter avec leurs anciens codes. Changer seulement le mot de passe dans Compose ne change pas celui de la base déjà initialisée.

## 4. Construire et démarrer la version corrigée

Copier ce bloc entier. Il s'arrête à la première erreur :

```sh
cd /opt/countdown
(
  set -eu
  sh deploy/compose.sh config --quiet
  sh deploy/compose.sh build
  sh deploy/compose.sh up -d --wait postgres
  sh deploy/compose.sh stop app
  sh deploy/compose.sh run --rm migrate
  sh deploy/compose.sh up -d --no-deps --force-recreate --wait app
)
```

La construction a lieu pendant que l'ancienne application fonctionne. Une courte interruption commence à `stop app`. La migration est rejouable et conserve les données. Si elle échoue, l'application reste arrêtée : consulter ses erreurs avant de poursuivre.

Le helper `deploy/compose.sh` fixe le projet **chrono**, le fichier **compose.production.yml** et **.env.production**. Utilise-le pour toutes les commandes de production. Un simple `docker compose up` pourrait sélectionner le fichier de développement.

Le nouveau conteneur reçoit la règle de domaine `spicy-drc.tech`, le réseau `spicy_web`, le port interne `3001` et le routeur `chrono-spicy-drc`. Traefik doit détecter les labels automatiquement ; son redémarrage n'est normalement pas nécessaire.

## 5. Vérifier le site

```sh
cd /opt/countdown
sh deploy/compose.sh ps -a
sh deploy/compose.sh logs --tail=60 app
curl --fail --show-error https://spicy-drc.tech/api/health
curl --fail --show-error -I https://spicy-drc.tech/
```

Résultat attendu : `app` et `postgres` sont `healthy`, la santé renvoie `{"status":"ok","database":"postgresql"}`, et la page répond en HTTP 200. L'ancien conteneur `migrate` peut rester affiché avec `Exited (0)` ; la migration de l'étape 4 utilise un conteneur temporaire.

Ouvre ensuite **https://spicy-drc.tech**. Vérifie la connexion d'un compte existant, ses objectifs, puis une déconnexion. Avec deux comptes, chacun doit voir uniquement ses propres objectifs.

## Si le site répond encore 404

```sh
cd /opt/countdown
sh deploy/diagnose.sh
```

Ce diagnostic ne modifie rien et n'affiche pas les variables secrètes des conteneurs. Il teste la page directement, le Traefik local sans passer par le DNS, puis le domaine public ; il affiche aussi les labels et les journaux. Relire les journaux avant de les partager.

| Résultat                              | Ce qu'il faut vérifier                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Page directe 200, Traefik local 404   | Routeur absent ou rejeté, provider Docker, noms d'entrypoints et erreurs Traefik.     |
| Traefik local 200, domaine public 404 | Enregistrements A/AAAA, éventuel proxy DNS ou autre serveur répondant au domaine.     |
| Page directe 404 ou 503               | Build frontend, fichiers dans l'image et journaux de l'application.                   |
| Traefik 502 ou 503                    | Accès au réseau `spicy_web`, port 3001, état de santé de l'application.               |
| Erreur de certificat                  | DNS, ports 80/443 et journaux Let's Encrypt ; ne pas masquer l'erreur avec `curl -k`. |

Plusieurs anciens conteneurs peuvent encore annoncer le même domaine. Le nouveau nom de routeur élimine une collision de nom avec l'ancien routeur, mais deux routeurs distincts visant le même domaine restent ambigus. Identifier l'ancien conteneur dans les labels et désactiver son routage dans **sa propre stack**, uniquement après avoir confirmé qu'il n'est plus utilisé. Ne pas supprimer les réseaux partagés.

Les sorties précédentes montraient déjà le bon domaine dans les labels du VPS : la faute de frappe n'est donc pas une cause confirmée du 404 actuel. Ce diagnostic permet d'en déterminer la cause sans toucher aux autres sites.

## Traefik central et DNS

La configuration fournie dans `deploy/traefik/compose.yml` reste compatible avec ton Traefik central : mode host, provider Docker, entrée `web` sur 80, entrée `websecure` sur 443, resolver `letsencrypt` et redirection HTTP vers HTTPS. Les labels du site sont dans le Compose de l'application, pas dans celui de Traefik.

**Si ton Traefik central fonctionne déjà, ne lance pas une deuxième stack Traefik et ne remplace pas sa configuration complète.** Comparer le modèle fourni à la stack existante et ne reprendre que les options nécessaires. Conserver le nom de son projet et son volume ACME, ainsi que les options des autres sites. Garder une version Traefik connue et compatible ; le fichier exemple demande un tag ou digest testé.

Pour retrouver son dossier et son fichier de configuration :

```sh
for container in $(docker ps --filter name=traefik --format '{{.Names}}'); do
  docker inspect --format '{{.Name}} projet={{index .Config.Labels "com.docker.compose.project"}} dossier={{index .Config.Labels "com.docker.compose.project.working_dir"}} compose={{index .Config.Labels "com.docker.compose.project.config_files"}}' "$container"
done
```

Si le nom ne contient pas `traefik`, le retrouver avec `docker ps`. Le réseau host permet au Traefik de ce VPS de joindre directement l'IP de l'application sur `spicy_web`. Aucun port PostgreSQL ou Node n'est publié sur Internet. Ne pas activer `forwardedHeaders.insecure`.

DNS attendu, selon l'adresse publique que tu as fournie :

| Type | Nom | Valeur      |
| ---- | --- | ----------- |
| A    | @   | 2.25.241.13 |

Vérifier que cette IP est toujours celle du VPS. Conserver un AAAA uniquement si IPv6 atteint effectivement le même serveur. Les ports publics TCP **80 et 443** doivent être accessibles pour HTTPS et le challenge Let's Encrypt.

```sh
getent ahosts spicy-drc.tech
curl -I http://spicy-drc.tech/
```

HTTP doit rediriger vers `https://spicy-drc.tech/`. Le certificat ne couvre pas automatiquement `www`.

## Première installation sur un VPS vide uniquement

Ne pas utiliser cette section pour réparer ton installation existante. Docker Engine, Compose v2 et le Traefik central doivent déjà être installés.

Vérifier que `172.30.25.0/24` ne chevauche aucun réseau ou route existants :

```sh
docker network inspect $(docker network ls -q) --format '{{.Name}}: {{range .IPAM.Config}}{{.Subnet}} {{end}}'
ip -4 route
```

Après transfert du projet :

```sh
cd /opt/countdown
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work node:24-alpine node deploy/init-env.mjs
chmod 600 .env.production
```

Le générateur refuse d'écraser un fichier existant. Si la plage réseau est occupée, modifier ensemble `PROXY_SUBNET` et `PROXY_GATEWAY` dans `.env.production` avant le lancement. Ne pas réutiliser un réseau appartenant à un autre projet.

```sh
cd /opt/countdown
(
  set -eu
  sh deploy/compose.sh config --quiet
  sh deploy/compose.sh up -d --build --wait
)
```

Puis suivre l'étape 5. Le premier membre crée lui-même son compte ; aucun code par défaut n'est livré.

## Commandes utiles après installation

Sauvegarder la base :

```sh
cd /opt/countdown
sh deploy/backup.sh
```

Conserver hors du VPS les dumps, une copie chiffrée de `.env.production` et la sauvegarde du volume ACME du Traefik central. Les sauvegardes contiennent des données privées. Ne jamais lancer `down -v` pour une simple mise à jour.

Pour une prochaine mise à jour : transférer les fichiers, sauvegarder, puis reprendre l'étape 4. Ne pas relancer la préparation des secrets si la configuration est déjà correcte.

Réinitialiser un code oublié, après vérification de l'identité du membre (remplacer `identifiant`) :

```sh
cd /opt/countdown
sh deploy/compose.sh exec app node backend/reset-pin.js identifiant
```

Le nouveau code s'affiche une seule fois ; le transmettre en privé. Les sessions du compte sont révoquées. Les codes ont quatre chiffres : cette protection reste limitée pour des données sensibles malgré le hachage et la limitation des tentatives.

Les anciens objectifs sans propriétaire restent conservés mais invisibles aux membres ; leur attribution nécessite une intervention ciblée après identification du propriétaire.

Pour une restauration ou un retour à une version précédente, voir [maintenance.md](maintenance.md). Une restauration peut écraser les données : elle n'est pas une étape de résolution du 404.

Références : [labels Docker Traefik](https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/docker/), [nom de projet Compose](https://docs.docker.com/compose/how-tos/project-name/).
