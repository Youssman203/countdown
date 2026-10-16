#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env.production ]; then
  echo 'Fichier .env.production absent : suivre docs/production.md.' >&2
  exit 1
fi
# Pin the project and env file so a directory name or old .env cannot select another database.
unset POSTGRES_PASSWORD PIN_PEPPER APP_TAG POSTGRES_VOLUME PROXY_SUBNET PROXY_GATEWAY
exec docker compose -p chrono --env-file .env.production -f compose.production.yml "$@"
