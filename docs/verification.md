# Vérifications effectuées

- Installation npm : réussie, aucune vulnérabilité signalée à l’installation.
- Tests Node : 7 tests réussis (routes CRUD, validation, erreurs, calcul du temps, fuseaux et progression).
- Compilation Vite de production : réussie.
- Navigateur en mode démo : création, modification de l’heure avec secondes, suppression confirmée, recherche, filtre de catégorie, thème, sélection d’une date et préremplissage du formulaire vérifiés.
- Affichage contrôlé à 390 px et 1440 px, sans débordement horizontal ; navigation mobile avec libellés accessibles.
- PostgreSQL réel : non vérifié, car le moteur Docker Desktop était arrêté. Les tests API utilisent un substitut de la couche PostgreSQL. Le schéma et les commandes de démarrage sont fournis dans le README.

Le fichier `apercu-desktop.png` présente le tableau de bord avec les données de démonstration, indépendantes des données PostgreSQL.
