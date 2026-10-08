# WeeklyMenus

Application web en français avec backend Python et SQLite, sans dépendance externe.

Démarrer : `python server.py`, puis ouvrir l’adresse affichée. Le backend sert aussi l’interface ; ne pas utiliser `python -m http.server`.

La base `weeklymenus.db` est créée à côté de `server.py`. Lors de la première ouverture, les données locales du navigateur sont importées si la base est vierge ; sinon, les données de la base sont utilisées. Le stockage local original reste conservé. Utiliser le même navigateur et la même adresse que pour le prototype afin de retrouver ces données.

Les quantités et noms des ingrédients sont stockés séparément. Les écritures sont transactionnelles et un conflit entre onglets demande un rechargement plutôt que d’écraser les données.

Pour sauvegarder, arrêter le serveur puis copier `weeklymenus.db`. Le serveur écoute uniquement sur la machine locale ; pas d’authentification ni de déploiement multi-utilisateur.
