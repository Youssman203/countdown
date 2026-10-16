#!/bin/sh
# Adopt the known chrono deployment without regenerating credentials or moving its data.
set -eu
cd "$(dirname "$0")/.."
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
  chrono-app-1 node --input-type=module < deploy/export-running-env.mjs > "$temp"
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
