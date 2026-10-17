# Mettre CHRONO en production sur spicy-drc.tech

Ce guide correspond à ton VPS : dossier `/opt/countdown`, projet Docker **chrono**, conteneurs `chrono-app-1` et `chrono-postgres-1`, réseau **spicy_web**, Traefik central en mode **host**. Aucun fichier `.sh` à exécuter : copier les blocs directement dans le terminal. Toutes les commandes ci-dessous sont à lancer dans le terminal Linux du VPS, sauf le transfert de fichiers.

Le domaine est **spicy-drc.tech**, sans `www`. L'application et l'API utilisent cette même adresse. Le routeur et le service Traefik s'appellent désormais **chrono-spicy-drc** pour éviter de réutiliser le nom de routeur de l'ancienne installation.

## Correction confirmée du conflit de routeur sur ton VPS

Les journaux du 16 octobre montrent deux conteneurs actifs, `chrono-app-1` et `spicyi-app-1`, déclarant le même routeur `spicyi` avec des règles différentes. Traefik signale : **HTTP router defined multiple times with different configurations**. L'API directe répond 200 ; le routage local et public répond 404.

Les labels de `chrono-app-1` indiquent encore l'ancien routeur et le fichier `/opt/countdown/.env`. Pour cette correction ciblée sur l'installation existante, conserver ce fichier d'environnement. Cette opération sauvegarde le Compose, renomme seulement le routeur/service de l'application et recrée uniquement `app`. Elle ne relance ni PostgreSQL ni les migrations et n'arrête pas les autres sites.

Copier le bloc entier dans le terminal du VPS :

```sh
cd /opt/countdown
(
  set -eu
  test -f .env
  cp -p compose.production.yml "compose.production.yml.bak-$(date -u +%Y%m%dT%H%M%SZ)"
  sed -i \
    -e 's/traefik\.http\.routers\.spicyi\./traefik.http.routers.chrono-spicy-drc./g' \
    -e 's/traefik\.http\.services\.spicyi\./traefik.http.services.chrono-spicy-drc./g' \
    -e '/traefik\.http\.routers\.chrono-spicy-drc\.service/s/spicyi/chrono-spicy-drc/g' \
    compose.production.yml
  docker compose -p chrono --env-file .env -f compose.production.yml config --quiet
  docker compose -p chrono --env-file .env -f compose.production.yml up -d --no-deps --force-recreate --wait app
)
```

Puis vérifier le nom du routeur appliqué et les réponses :

```sh
docker inspect chrono-app-1 --format '{{index .Config.Labels "traefik.http.routers.chrono-spicy-drc.rule"}}'
curl --connect-timeout 5 --max-time 15 --fail --show-error --resolve spicy-drc.tech:443:127.0.0.1 https://spicy-drc.tech/api/health
curl --connect-timeout 5 --max-time 15 --fail --show-error https://spicy-drc.tech/api/health
```

Résultat attendu : une règle pour `spicy-drc.tech`, puis `{"status":"ok","database":"postgresql"}`. La correction n'est confirmée en ligne qu'après ces vérifications. Le conteneur de l'ancienne installation conserve son routeur distinct ; son éventuel retrait se traite séparément, après identification de ses données.

Cette procédure est un correctif immédiat pour les fichiers actuellement sur le VPS. Pour reprendre ensuite la configuration complète livrée, suivre les étapes ci-dessous : l'étape 3 récupère les secrets existants dans `.env.production`, utilisé par le reste du guide.

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
(
set -eu
umask 077
unset POSTGRES_PASSWORD PIN_PEPPER APP_TAG POSTGRES_VOLUME PROXY_SUBNET PROXY_GATEWAY
for container in chrono-app-1 chrono-postgres-1; do
  project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container")
  [ "$project" = chrono ] || { echo "Projet inattendu pour $container." >&2; exit 1; }
done
volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{if eq .Type "volume"}}{{.Name}}{{end}}{{end}}{{end}}' chrono-postgres-1)
[ -n "$volume" ] || { echo 'Volume PostgreSQL introuvable : arrêt sans modification.' >&2; exit 1; }
network_project=$(docker network inspect spicy_web --format '{{index .Labels "com.docker.compose.project"}}')
[ "$network_project" = chrono ] || { echo 'spicy_web appartient à un autre projet : arrêt.' >&2; exit 1; }
subnet=$(docker network inspect spicy_web --format '{{(index .IPAM.Config 0).Subnet}}')
gateway=$(docker network inspect spicy_web --format '{{(index .IPAM.Config 0).Gateway}}')
[ -n "$subnet" ] && [ -n "$gateway" ] || { echo 'Paramètres réseau absents.' >&2; exit 1; }
temp=$(mktemp .env.production.XXXXXX)
trap 'rm -f "$temp"' EXIT HUP INT TERM
docker exec -i -e DEPLOY_VOLUME="$volume" -e DEPLOY_SUBNET="$subnet" -e DEPLOY_GATEWAY="$gateway" \
  chrono-app-1 node --input-type=module > "$temp" <<'NODE'
const env = process.env;
const values = {
  POSTGRES_PASSWORD: env.PGPASSWORD,
  PIN_PEPPER: env.PIN_PEPPER,
  APP_TAG: 'local',
  POSTGRES_VOLUME: env.DEPLOY_VOLUME,
  PROXY_SUBNET: env.DEPLOY_SUBNET,
  PROXY_GATEWAY: env.DEPLOY_GATEWAY,
};
if (env.PGUSER !== 'chrono' || env.PGDATABASE !== 'chrono' || env.DATABASE_URL) {
  throw new Error('Configuration PostgreSQL inattendue : vérifier la configuration existante.');
}
if (!values.PIN_PEPPER || values.PIN_PEPPER.length < 32) {
  throw new Error('PIN_PEPPER existant absent ou trop court.');
}
for (const value of Object.values(values)) {
  if (!value || /[\r\n\0]/.test(value)) throw new Error('Paramètre existant absent ou invalide.');
}
const quote = (value) => JSON.stringify(value).replaceAll('$', () => '$$');
process.stdout.write(
  Object.entries(values)
    .map(([key, value]) => `${key}=${quote(value)}`)
    .join('\n') + '\n',
);
NODE
docker compose -p chrono --env-file "$temp" -f compose.production.yml config --quiet
if [ -f .env.production ]; then
  mkdir -p backups
  backup=$(mktemp backups/env-production.XXXXXX)
  cp .env.production "$backup"
  chmod 600 "$backup"
fi
mv "$temp" .env.production
chmod 600 .env.production
trap - EXIT HUP INT TERM
printf 'Configuration prête. Projet : chrono ; volume : %s ; réseau : spicy_web (%s).\n' "$volume" "$subnet"
printf 'Les secrets existants sont conservés. Aucun conteneur ni volume modifié.\n'
)
```

Cette commande récupère le mot de passe PostgreSQL et le secret des codes membres **depuis le conteneur en fonctionnement**. Elle relève le vrai volume PostgreSQL et la passerelle de `spicy_web`, puis prépare `.env.production` sans afficher les secrets. Une éventuelle ancienne version de `.env.production` est conservée dans `backups`. Aucun conteneur n'est arrêté et aucune donnée n'est déplacée.

Cela évite la confusion entre l'ancien `.env` utilisé sur ton VPS et le fichier `.env.production` utilisé désormais. Le bloc s'arrête si les conteneurs ou le réseau n'appartiennent pas au projet attendu ; dans ce cas, ne lance pas la suite et conserve son message.

D'après tes dernières sorties, le réseau est `172.30.25.0/24`, avec la passerelle `172.30.25.1`. On conserve ce réseau actuel.

**Ne régénère pas les secrets d'une installation existante.** Changer `PIN_PEPPER` empêche les membres de se connecter avec leurs anciens codes. Changer seulement le mot de passe dans Compose ne change pas celui de la base déjà initialisée.

## 4. Construire et démarrer la version corrigée

Copier ce bloc entier. Il s'arrête à la première erreur :

```sh
cd /opt/countdown
(
  set -eu
  unset POSTGRES_PASSWORD PIN_PEPPER APP_TAG POSTGRES_VOLUME PROXY_SUBNET PROXY_GATEWAY
  docker compose -p chrono --env-file .env.production -f compose.production.yml config --quiet
  docker compose -p chrono --env-file .env.production -f compose.production.yml build
  docker compose -p chrono --env-file .env.production -f compose.production.yml up -d --wait postgres
  docker compose -p chrono --env-file .env.production -f compose.production.yml stop app
  docker compose -p chrono --env-file .env.production -f compose.production.yml run --rm migrate
  docker compose -p chrono --env-file .env.production -f compose.production.yml up -d --no-deps --force-recreate --wait app
)
```

La construction a lieu pendant que l'ancienne application fonctionne. Une courte interruption commence à `stop app`. La migration est rejouable et conserve les données. Si elle échoue, l'application reste arrêtée : consulter ses erreurs avant de poursuivre.

Chaque commande indique explicitement le projet **chrono**, le fichier **compose.production.yml** et **.env.production**. Conserver ces trois paramètres pour toutes les commandes de production. Un simple `docker compose up` pourrait sélectionner le fichier de développement.

Le nouveau conteneur reçoit la règle de domaine `spicy-drc.tech`, le réseau `spicy_web`, le port interne `3001` et le routeur `chrono-spicy-drc`. Traefik doit détecter les labels automatiquement ; son redémarrage n'est normalement pas nécessaire.

## 5. Vérifier le site

```sh
cd /opt/countdown
docker compose -p chrono --env-file .env.production -f compose.production.yml ps -a
docker compose -p chrono --env-file .env.production -f compose.production.yml logs --tail=60 app
curl --fail --show-error https://spicy-drc.tech/api/health
curl --fail --show-error -I https://spicy-drc.tech/
```

Résultat attendu : `app` et `postgres` sont `healthy`, la santé renvoie `{"status":"ok","database":"postgresql"}`, et la page répond en HTTP 200. L'ancien conteneur `migrate` peut rester affiché avec `Exited (0)` ; la migration de l'étape 4 utilise un conteneur temporaire.

Ouvre ensuite **https://spicy-drc.tech**. Vérifie la connexion d'un compte existant, ses objectifs, puis une déconnexion. Avec deux comptes, chacun doit voir uniquement ses propres objectifs.

## Inscription refusée : « Origine de la requête non autorisée »

Le backend compare l'origine envoyée par le navigateur à `APP_ORIGIN`. Le domaine du routeur Traefik et cette variable doivent tous deux correspondre à `https://spicy-drc.tech`. Une page accessible ne garantit pas que l'origine autorisée dans le conteneur soit correcte.

Afficher uniquement cette variable, sans afficher les secrets :

```sh
docker exec chrono-app-1 printenv APP_ORIGIN
```

Si elle ne vaut pas exactement `https://spicy-drc.tech`, copier ce bloc sur le VPS. Il corrige la déclaration `APP_ORIGIN` du Compose fourni et recrée seulement l'application. Le fichier `.env` est celui confirmé par les derniers labels de ton conteneur ; si tu as depuis effectué la reprise complète vers `.env.production`, utiliser `--env-file .env.production` dans les deux commandes Compose ci-dessous.

```sh
cd /opt/countdown
(
  set -eu
  grep -qE '^[[:space:]]*APP_ORIGIN:' compose.production.yml
  cp -p compose.production.yml "compose.production.yml.bak-origin-$(date -u +%Y%m%dT%H%M%SZ)"
  sed -i -E 's|^([[:space:]]*APP_ORIGIN:).*|\1 https://spicy-drc.tech|' compose.production.yml
  docker compose -p chrono --env-file .env -f compose.production.yml config --quiet
  docker compose -p chrono --env-file .env -f compose.production.yml up -d --no-deps --force-recreate --wait app
  docker exec chrono-app-1 printenv APP_ORIGIN
)
```

La dernière ligne doit afficher `https://spicy-drc.tech`, sans barre oblique finale ni `www`. Ouvrir cette adresse exacte, recharger la page et réessayer l'inscription. Cette correction conserve le contrôle de l'origine et les comptes existants.

Pour vérifier ce contrôle sans créer de compte, envoyer une requête anonyme vers une route protégée :

```sh
curl --connect-timeout 5 --max-time 15 -i \
  -X POST https://spicy-drc.tech/api/objectives \
  -H 'Origin: https://spicy-drc.tech' \
  -H 'Content-Type: application/json' \
  --data '{}'
```

Une réponse **401** est attendue : l'origine est acceptée et l'authentification est ensuite requise. Une réponse **403** avec le même message signifie que l'origine est encore rejetée. Aucun objectif n'est créé par cette requête anonyme. Si le test donne 401 mais le navigateur affiche encore 403, vérifier l'adresse exacte de la page et l'en-tête `Origin` dans l'onglet Réseau du navigateur.

## Si le site répond encore 404

```sh
cd /opt/countdown
# Conteneur réellement déployé et ses labels
docker inspect chrono-app-1 --format '{{.State.Status}} {{json .State.Health}}'
docker inspect chrono-app-1 --format '{{json .Config.Labels}}'

# Accès direct à l'application depuis le VPS
app_ip=$(docker inspect --format '{{with index .NetworkSettings.Networks "spicy_web"}}{{.IPAddress}}{{end}}' chrono-app-1)
if [ -n "$app_ip" ]; then
  curl --connect-timeout 5 --max-time 15 -i "http://$app_ip:3001/api/health"
else
  echo 'Le conteneur ne possède pas d’adresse sur spicy_web.'
fi

# Traefik local : contourner le DNS tout en conservant le bon domaine TLS
curl --connect-timeout 5 --max-time 15 -i --resolve spicy-drc.tech:443:127.0.0.1 https://spicy-drc.tech/api/health

# Accès public
curl --connect-timeout 5 --max-time 15 -i https://spicy-drc.tech/api/health

# Conteneurs publiés par Traefik : repérer les routeurs qui utilisent ce domaine
for container in $(docker ps -q --filter label=traefik.enable=true); do
  docker inspect --format '{{.Name}}{{range $key, $value := .Config.Labels}}{{if eq $key "traefik.docker.network"}} {{$key}}={{$value}}{{else if and (ge (len $key) 21) (eq (slice $key 0 21) "traefik.http.routers.")}} {{$key}}={{$value}}{{end}}{{end}}' "$container"
done

# Journaux du Traefik central
for container in $(docker ps --filter name=traefik --format '{{.Names}}'); do
  docker logs --tail=100 "$container" 2>&1
done
```

Ce diagnostic ne modifie rien et n'affiche pas les variables secrètes des conteneurs. Il teste la santé de l’application directement, le Traefik local sans passer par le DNS, puis le domaine public ; il affiche aussi les labels et les journaux. Relire les journaux avant de les partager.

| Résultat                              | Ce qu'il faut vérifier                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| API directe 200, Traefik local 404    | Routeur absent ou rejeté, provider Docker, noms d'entrypoints et erreurs Traefik.     |
| Traefik local 200, domaine public 404 | Enregistrements A/AAAA, éventuel proxy DNS ou autre serveur répondant au domaine.     |
| API directe 404 ou 503                | Routes API, connexion PostgreSQL et journaux de l'application.                        |
| Traefik 502 ou 503                    | Accès au réseau `spicy_web`, port 3001, état de santé de l'application.               |
| Erreur de certificat                  | DNS, ports 80/443 et journaux Let's Encrypt ; ne pas masquer l'erreur avec `curl -k`. |

Plusieurs anciens conteneurs peuvent encore annoncer le même domaine. Le nouveau nom de routeur élimine une collision de nom avec l'ancien routeur, mais deux routeurs distincts visant le même domaine restent ambigus. Identifier l'ancien conteneur dans les labels et désactiver son routage dans **sa propre stack**, uniquement après avoir confirmé qu'il n'est plus utilisé. Ne pas supprimer les réseaux partagés.

Les sorties détaillées ont confirmé le conflit de routeur décrit au début du guide. Le domaine de l'application actuelle était déjà correct ; c'est le nom de routeur partagé avec l'ancienne installation qui faisait rejeter la configuration.

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
  unset POSTGRES_PASSWORD PIN_PEPPER APP_TAG POSTGRES_VOLUME PROXY_SUBNET PROXY_GATEWAY
  docker compose -p chrono --env-file .env.production -f compose.production.yml config --quiet
  docker compose -p chrono --env-file .env.production -f compose.production.yml up -d --build --wait
)
```

Puis suivre l'étape 5. Le premier membre crée lui-même son compte ; aucun code par défaut n'est livré.

## Commandes utiles après installation

Sauvegarder la base :

```sh
cd /opt/countdown
(
  set -eu
  umask 077
  mkdir -p backups
  backup="backups/chrono-$(date -u +%Y%m%dT%H%M%SZ).dump"
  docker exec chrono-postgres-1 pg_dump -U chrono -d chrono -Fc > "$backup.partial"
  test -s "$backup.partial"
  mv "$backup.partial" "$backup"
  printf 'Sauvegarde créée : %s\n' "$backup"
)
```

Conserver hors du VPS les dumps, une copie chiffrée de `.env.production` et la sauvegarde du volume ACME du Traefik central. Les sauvegardes contiennent des données privées. Ne jamais lancer `down -v` pour une simple mise à jour.

Pour une prochaine mise à jour : transférer les fichiers, sauvegarder, puis reprendre l'étape 4. Ne pas relancer la préparation des secrets si la configuration est déjà correcte.

Réinitialiser un code oublié, après vérification de l'identité du membre (remplacer `identifiant`) :

```sh
cd /opt/countdown
docker compose -p chrono --env-file .env.production -f compose.production.yml exec app node backend/reset-pin.js identifiant
```

Le nouveau code s'affiche une seule fois ; le transmettre en privé. Les sessions du compte sont révoquées. Les codes ont quatre chiffres : cette protection reste limitée pour des données sensibles malgré le hachage et la limitation des tentatives.

Les anciens objectifs sans propriétaire restent conservés mais invisibles aux membres ; leur attribution nécessite une intervention ciblée après identification du propriétaire.

Pour une restauration ou un retour à une version précédente, voir [maintenance.md](maintenance.md). Une restauration peut écraser les données : elle n'est pas une étape de résolution du 404.

Références : [labels Docker Traefik](https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/docker/), [nom de projet Compose](https://docs.docker.com/compose/how-tos/project-name/).
