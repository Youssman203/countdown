#!/bin/sh
# Read-only diagnostics; never print container environment variables.
set -u
cd "$(dirname "$0")/.."
printf '\n--- Conteneurs ---\n'
sh deploy/compose.sh ps -a
printf '\n--- Application et migration ---\n'
sh deploy/compose.sh logs --tail=50 app migrate
printf '\n--- Labels Traefik des conteneurs actifs ---\n'
for container in $(docker ps -q --filter label=traefik.enable=true); do
  docker inspect --format '{{.Name}}{{range $key, $value := .Config.Labels}}{{if eq $key "traefik.docker.network"}} {{$key}}={{$value}}{{else if and (ge (len $key) 21) (eq (slice $key 0 21) "traefik.http.routers.")}} {{$key}}={{$value}}{{end}}{{end}}' "$container"
done
printf '\n--- Application directe ---\n'
app_ip=$(docker inspect --format '{{with index .NetworkSettings.Networks "spicy_web"}}{{.IPAddress}}{{end}}' chrono-app-1)
if [ -n "$app_ip" ]; then
  curl --connect-timeout 5 --max-time 15 -sS -o /dev/null -w 'Page directe : HTTP %{http_code}\n' "http://$app_ip:3001/"
  curl --connect-timeout 5 --max-time 15 -sS "http://$app_ip:3001/api/health"
fi
printf '\n--- HTTPS via Traefik local (sans DNS) ---\n'
curl --connect-timeout 5 --max-time 15 -sS -I --resolve spicy-drc.tech:443:127.0.0.1 https://spicy-drc.tech/
printf '\n--- HTTPS via DNS public ---\n'
curl --connect-timeout 5 --max-time 15 -sS -I https://spicy-drc.tech/
printf '\n--- Traefik (si son nom contient traefik) ---\n'
for container in $(docker ps --filter name=traefik --format '{{.Names}}'); do
  printf '\n%s\n' "$container"
  docker logs --tail=100 "$container" 2>&1
done
