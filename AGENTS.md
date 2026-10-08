# WeeklyMenus

Application web en français : recettes avec ingrédients et sept repas hebdomadaires.

HTML/CSS/JavaScript natifs (`index.html`, `style.css`, `app.js`) ; backend Python standard et SQLite (`server.py`). Lancer `python server.py`. La base locale est exclue de Git.

L’API `/api/state` lit et enregistre recettes et plannings avec transactions et révision pour prévenir les conflits entre onglets. Les ingrédients ont un nom et une quantité séparés. Import initial depuis le stockage local si la base est vierge.

Préférer des changements minimaux. Ne pas lancer de tests. PRODUCT.md contient les besoins ; DESIGN.md documente les décisions visuelles.
