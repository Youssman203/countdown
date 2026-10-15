# Vérification — version membres et production

Contrôles effectués le 15 octobre 2026.

- `npm test` : **13 tests réussis**. Le SQL est exécuté dans PGlite (PostgreSQL embarqué), avec migration relancée pour vérifier son idempotence.
- Vérification HTTP : inscription, identifiant normalisé, PIN avec zéro initial, cookie sécurisé, données sensibles absentes des réponses, refus des requêtes anonymes ou d’origine incorrecte.
- Deux comptes distincts : objectifs séparés, modification et suppression croisées refusées, thèmes séparés, anciens objectifs sans propriétaire invisibles.
- Limitation par identifiant persistante après recréation de l’application, expiration/révocation des sessions, jetons stockés sous forme de condensats, erreurs sans détails internes.
- `npm run build` : compilation de production réussie.
- `docker compose ... config --quiet` : configurations application et Traefik valides avec les fichiers d’exemple.
- Navigateur sur un serveur temporaire servant le build et PostgreSQL embarqué : inscription, connexion, création d’objectif, rechargement avec conservation de la session et de l’objectif, déconnexion.
- Page de connexion vérifiée à 390 et 1440 pixels : aucun débordement horizontal. Capture `espace-membre.png`.
- Le message d’expiration ne s’affiche plus à la première visite sans session.

## Limites de cette vérification

Docker Desktop n’était pas démarré. Aucune image Docker n’a été construite ni exécutée ici ; les scripts de sauvegarde/restauration et la réinitialisation administrative doivent encore être essayés sur la stack Linux. PGlite valide le SQL et les routes, mais pas le transport réseau du pilote pg ni le fonctionnement des volumes Docker.

Le domaine, ses DNS, le Traefik central, les certificats ACME et l’IP cliente derrière le proxy doivent être vérifiés sur le serveur cible suivant `production.md`. Aucun déploiement public n’a été effectué. Le serveur temporaire de vérification est arrêté après les essais ; ses comptes de test ne sont pas livrés.

L’ancienne capture `apercu-desktop.png` illustre le tableau de bord avant l’ajout des comptes, avec des données de démonstration. Elle ne représente pas une base de production.
