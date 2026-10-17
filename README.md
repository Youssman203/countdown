# CHRONO — Chaque seconde compte.

Application de gestion d’objectifs en français, inspirée des centres de contrôle tactiques : chiffres LCD, interface sombre, accents ambre/cyan/émeraude, précision à la seconde et calendrier interactif.

Chaque membre possède son compte, ses objectifs et son thème. Inscription publique avec nom, identifiant unique et code personnel de quatre chiffres. Les sessions sont enregistrées dans PostgreSQL et transmises par cookie HTTP-only.

## Déploiement public

Le domaine est **spicy-drc.tech**. Suivre [le guide VPS, étape par étape](docs/production.md), avec les blocs à copier-coller pour corriger l'installation existante : sauvegarde, conservation des secrets et du volume, construction, migration et vérification HTTPS. Projet Docker : `chrono` ; réseau : `spicy_web` ; routeur Traefik : `chrono-spicy-drc`. Le guide donne toutes les commandes Docker directement, sans fichier `.sh` à lancer. Le fichier `compose.production.yml` est autonome ; ne pas le combiner avec le compose de développement.

## Démarrage local

Prérequis : Node.js 22.12+ ou 24, npm, PostgreSQL 17 ou Docker Desktop avec les conteneurs Linux démarré.

```powershell
npm.cmd ci
Copy-Item backend/.env.example backend/.env
docker compose up -d
npm.cmd run db:migrate
npm.cmd run dev
```

Ouvrir http://localhost:5173, créer un compte puis se connecter. Vite transmet `/api` à Express sur le port 3001. Pour une base existante, définir `DATABASE_URL` dans `backend/.env` et exécuter la migration. Les secrets fournis pour le développement ne sont pas destinés à la production. La base est nécessaire ; la démo locale a été retirée de l’espace membre.

## Structure

```text
backend/
  server.js                 Serveur et arrêt propre
  app.js                    Express, protection des origines, fichiers statiques
  auth.js                   Inscription, connexion, sessions, limitations
  config.js                 Validation des paramètres de production
  db.js                     Pool PostgreSQL
  migrate.js                Migration transactionnelle idempotente
  reset-pin.js              Réinitialisation administrative d’un code oublié
  routes/objectives.js      CRUD isolé par propriétaire, validation Zod
  test/api.test.js           Tests HTTP avec PostgreSQL embarqué (PGlite)
frontend/
  src/components/
    MemberApp.jsx           Connexion, inscription et session
    Dashboard.jsx           Synchronisation, recherche, tri et thèmes
    CountdownCard.jsx       Affichage LCD, progression et alertes
    CalendarView.jsx        Calendrier et échéances
    AddEditModal.jsx        Création, édition et suppression
  src/lib/api.js            REST, délai maximal et expiration de session
  src/lib/time.js           Dates locales et progression
  src/styles.css            Tailwind v4 et interface responsive
  test/time.test.js         Tests temporels
database/schema.sql         Comptes, sessions, limitations et objectifs
Dockerfile                  Construction multi-stage de production
compose.production.yml      Application, migration, PostgreSQL privé
deploy/traefik/              Modèle pour votre Traefik central
deploy/init-env.mjs          Génération des secrets
```

## API

Les objectifs exigent une session. Toute mutation doit porter l’en-tête `Origin` correspondant au site ; le navigateur s’en charge. Les API ne sont pas accessibles depuis une origine externe.

| Méthode | Route                 | Fonction                                    |
| ------- | --------------------- | ------------------------------------------- |
| GET     | `/api/health`         | Connexion PostgreSQL                        |
| POST    | `/api/auth/register`  | Créer un compte (`username`, `name`, `pin`) |
| POST    | `/api/auth/login`     | Se connecter (`username`, `pin`)            |
| POST    | `/api/auth/logout`    | Révoquer la session                         |
| GET     | `/api/auth/me`        | Membre connecté                             |
| PATCH   | `/api/auth/me`        | Enregistrer le thème (`accent`)             |
| GET     | `/api/objectives`     | Objectifs du membre connecté                |
| POST    | `/api/objectives`     | Créer un objectif                           |
| PUT     | `/api/objectives/:id` | Modifier son objectif                       |
| DELETE  | `/api/objectives/:id` | Supprimer son objectif                      |

Exemple POST/PUT :

```json
{
  "title": "Lancement du projet Horizon",
  "description": "Finaliser les livrables.",
  "target_date": "2027-10-27T09:00:00+02:00",
  "category": "Professionnel",
  "color_theme": "amber"
}
```

Le serveur détermine le propriétaire à partir de la session ; aucun `user_id` envoyé par le client n’est accepté. Les UUID et dates de création sont générés par PostgreSQL. Dates cibles avec `Z` ou décalage UTC obligatoire. L’interface convertit la saisie locale en ISO UTC.

Erreurs JSON : 400 saisie invalide, 401 connexion requise, 403 origine refusée, 404 objectif inexistant ou appartenant à autrui, 409 identifiant déjà utilisé, 413 requête trop volumineuse, 429 trop de tentatives, 503 indisponibilité du service.

## Interface

- Un seul intervalle partagé actualise les compteurs chaque seconde.
- L’objectif actif le plus proche correspondant aux filtres est mis en avant.
- Progression depuis la création, bornée entre 0 et 100 % ; urgence visuelle sous 48 heures.
- Les échéances atteintes restent consultables : cela ne signifie pas que l’objectif est accompli.
- Calendrier du lundi au dimanche, navigation mensuelle, détails et création au jour choisi.
- Catégories libres, recherche, tri, modale accessible avec confirmation de suppression.
- Thème sauvegardé par membre ; aucune donnée membre dans `localStorage`.
- Chargement à la connexion et mutations mises à jour dans la session ; pas de synchronisation collaborative en temps réel.

## Vérifications

```sh
npm test
npm run build
```

Les tests exécutent le SQL dans PGlite, moteur PostgreSQL embarqué : migration, inscription, connexion, séparation entre deux comptes, expiration/révocation des sessions, limitation et protection des origines. Ils ne remplacent pas l’essai des conteneurs et de Traefik sur le serveur Linux. Voir le [rapport de vérification](docs/verification.md).

Pour arrêter PostgreSQL local sans supprimer les données : `docker compose down`. Le volume `chrono_data` est conservé.
