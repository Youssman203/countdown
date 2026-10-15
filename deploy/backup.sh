#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
target="backups/chrono-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file .env.production -f compose.production.yml exec -T postgres pg_dump -U chrono -d chrono -Fc > "$target.partial"
test -s "$target.partial"
mv "$target.partial" "$target"
printf 'Sauvegarde créée : %s\n' "$target"
