# Restauration et retour à une version précédente

Ces opérations sont réservées à une restauration volontaire, pas à la correction d'un problème de routage. Le guide principal est [production.md](production.md).

Une restauration remplace les données actuelles par celles du dump. Faire d'abord une sauvegarde avec le bloc de commandes du guide de production. Vérifier le nom du volume, le dump choisi et la présence du `PIN_PEPPER` correspondant à la sauvegarde. Tester d'abord le dump dans une base séparée.

Après avoir remplacé `NOM.dump` par le fichier réellement choisi :

```sh
cd /opt/countdown
(
  set -eu
  test -s backups/NOM.dump
  docker compose -p chrono --env-file .env.production -f compose.production.yml stop app
  docker compose -p chrono --env-file .env.production -f compose.production.yml exec -T postgres pg_restore -U chrono -d chrono --clean --if-exists --exit-on-error < backups/NOM.dump
  docker compose -p chrono --env-file .env.production -f compose.production.yml run --rm migrate
  docker compose -p chrono --env-file .env.production -f compose.production.yml up -d --no-deps --wait app
)
```

Si une étape échoue, ne pas redémarrer l'application avant d'avoir compris l'erreur. Un retour à une ancienne image doit rester compatible avec le schéma de la base ; sinon restaurer une sauvegarde compatible pendant l'arrêt.

Pour conserver plusieurs versions de l'image, renseigner un `APP_TAG` distinct dans `.env.production` avant chaque construction. Pour des constructions reproductibles, épingler les images Node, PostgreSQL et Traefik à des digests validés et prévoir leurs mises à jour de sécurité.
