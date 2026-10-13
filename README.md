# CHRONO — Chaque seconde compte.

Application de gestion d’objectifs en français, inspirée des centres de contrôle tactiques : chiffres LCD dessinés en SVG, interface sombre, accents ambre/cyan/émeraude, précision à la seconde et calendrier interactif.

## Prérequis

- Node.js **22.12+** (ou 24 LTS), npm.
- PostgreSQL 17 ou Docker Desktop démarré avec les conteneurs Linux.

## Démarrage local

Depuis la racine du projet, dans PowerShell :

```powershell
npm.cmd install
Copy-Item backend/.env.example backend/.env
docker compose up -d
npm.cmd run db:migrate
npm.cmd run dev
```

Ouvrir **http://localhost:5173**. Vite transmet `/api` à Express sur le port 3001. Le schéma est initialisé par Docker lors de la création du volume ; `db:migrate` peut être relancé sans supprimer les objectifs.

Pour une installation PostgreSQL existante, créer une base, définir `DATABASE_URL` dans `backend/.env`, puis exécuter `npm.cmd run db:migrate`. Docker n’est pas nécessaire dans ce cas. Aucun objectif d’exemple n’est inséré dans la base réelle.

Les identifiants fournis sont destinés au développement local. Si vous modifiez ceux de Docker dans un `.env` à la racine (modèle `.env.example`), mettez également à jour `DATABASE_URL` dans `backend/.env`. Modifier les variables Docker ne réinitialise pas un volume déjà créé.

### Démo sans PostgreSQL

Lancer `npm.cmd run dev`, puis cliquer sur **Explorer la démo** si la connexion à la base échoue. Les exemples ont des dates relatives au jour courant. Les modifications de la démo sont enregistrées dans `localStorage`, sous la clé `chrono-demo-v1`, séparément des données PostgreSQL. Le bandeau **Mode démo** reste visible. **Connecter PostgreSQL** retente une connexion et charge les données réelles ; aucune donnée de démonstration n’est importée automatiquement. En cas d’échec, **Explorer la démo** retrouve les données locales.

## Structure

```text
backend/
  server.js                Serveur et arrêt propre
  app.js                   Express, erreurs, sécurité HTTP, fichiers de production
  db.js                    Pool PostgreSQL et configuration
  migrate.js               Initialisation idempotente du schéma
  routes/objectives.js     Routes CRUD, validation Zod et SQL paramétré
  test/api.test.js          Tests HTTP avec couche PostgreSQL simulée
frontend/
  src/components/
    Dashboard.jsx          État, synchronisation REST, recherche, tri, thèmes
    CountdownCard.jsx      Affichage LCD, progression et alertes
    CalendarView.jsx       Calendrier mensuel, navigation et échéances
    AddEditModal.jsx       Création, édition, suppression avec confirmation
  src/lib/
    api.js                 Client REST, délai maximal et données de démo
    time.js                Dates locales, compte à rebours et progression
  src/styles.css           Tailwind CSS v4 et design responsive
  test/time.test.js         Tests de calculs temporels
database/schema.sql        Table, contraintes et index PostgreSQL
docker-compose.yml         PostgreSQL persistant
```

## API REST

| Méthode | Route                 | Réponse                           |
| ------- | --------------------- | --------------------------------- |
| GET     | `/api/health`         | État réel de connexion PostgreSQL |
| GET     | `/api/objectives`     | Objectifs triés par date cible    |
| POST    | `/api/objectives`     | Objectif créé, statut 201         |
| PUT     | `/api/objectives/:id` | Remplacement des champs éditables |
| DELETE  | `/api/objectives/:id` | Statut 204                        |

Exemple de corps POST/PUT :

```json
{
  "title": "Lancement du projet Horizon",
  "description": "Finaliser les livrables et préparer le lancement.",
  "target_date": "2026-10-27T09:00:00+02:00",
  "category": "Professionnel",
  "color_theme": "amber"
}
```

`id` et `created_at` sont générés par PostgreSQL et restent inchangés lors d’une modification. Les dates cibles exigent un décalage UTC explicite ou `Z`. L’interface convertit la saisie locale en ISO UTC et affiche ensuite l’heure du navigateur. Le schéma utilise `TIMESTAMPTZ` pour les deux dates.

Validation : titre de 1 à 120 caractères, description de 0 à 2 000, catégorie de 1 à 60, couleur parmi `amber`, `cyan`, `emerald`, identifiant UUID. Erreurs JSON avec `error` : 400 pour une saisie invalide, 404 pour un objectif absent, 413 pour un corps trop volumineux, 503 pour une indisponibilité du serveur/de la base. Les requêtes SQL sont paramétrées.

## Comportement de l’interface

- Un seul intervalle partagé met l’heure à jour chaque seconde ; le calcul repart de l’heure système pour éviter une dérive cumulative.
- L’objectif actif le plus proche correspondant aux filtres est mis en avant. Le tri s’applique aux autres cartes.
- Progression : temps écoulé depuis `created_at` divisé par la durée jusqu’à `target_date`, borné entre 0 et 100 %.
- Alerte lumineuse sous 48 heures ; animations désactivées si le système demande de réduire les mouvements.
- À zéro, le compteur s’arrête et l’objectif rejoint **Échéances passées**. Cela indique que la date est atteinte, pas que l’utilisateur a accompli l’objectif.
- Calendrier du lundi au dimanche, navigation entre mois, sélection du jour, détails/édition et création à la date sélectionnée. Les marqueurs incluent aussi les échéances passées.
- Catégories libres, recherche dans le titre et la description, tri par date croissante/décroissante ou titre.
- Modale native avec focus contenu, retour du focus, Échap, champs accessibles, confirmation de suppression et prévention des doubles soumissions.
- Les données sont rechargées à l’ouverture et après chaque mutation réussie dans cette session. Il n’y a pas de synchronisation multi-utilisateur en temps réel.

## Vérifications et production locale

```powershell
npm.cmd test
npm.cmd run build
$env:NODE_ENV = 'production'
npm.cmd start
```

En production locale, Express sert aussi `frontend/dist` sur **http://localhost:3001**. Les tests HTTP simulent PostgreSQL : ils vérifient les routes, la validation, le paramétrage SQL et les erreurs, mais ne remplacent pas un essai avec une vraie base démarrée.

Cette version est destinée à un usage personnel local, avec écoute sur `127.0.0.1` par défaut. Avant toute exposition publique, ajouter une authentification, l’isolation des objectifs par utilisateur et HTTPS ; CORS ne constitue pas un contrôle d’accès.

Pour arrêter PostgreSQL sans supprimer les données : `docker compose down`. Le volume nommé `chrono_data` est conservé.
