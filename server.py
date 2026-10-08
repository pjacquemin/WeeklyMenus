"""Serve the local interface and its SQLite API: python server.py."""
import json
import re
import sqlite3
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / 'weeklymenus.db'
STATIC = {'/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css'}


def connect():
    db = sqlite3.connect(DATABASE, timeout=10)
    db.execute('PRAGMA foreign_keys = ON')
    return db


def validate(state):
    if not isinstance(state, dict) or not isinstance(state.get('recipes'), list) or not isinstance(state.get('plans'), dict):
        raise ValueError('Données invalides.')
    ids = set()
    for recipe in state['recipes']:
        if not isinstance(recipe, dict):
            raise ValueError('Recette invalide.')
        for key, limit in [('id', 100), ('name', 100), ('instructions', 20000)]:
            if not isinstance(recipe.get(key), str) or len(recipe[key]) > limit:
                raise ValueError('Recette invalide.')
        if not recipe['id'] or not recipe['name'].strip() or recipe['id'] in ids:
            raise ValueError('Nom ou identifiant de recette invalide.')
        ids.add(recipe['id'])
        if recipe.get('category') not in ('Végétarien', 'Viande', 'Poisson'):
            raise ValueError('Catégorie invalide.')
        for key, maximum in [('time', 600), ('servings', 30)]:
            if type(recipe.get(key)) is not int or not 1 <= recipe[key] <= maximum:
                raise ValueError('Durée ou portions invalides.')
        if not isinstance(recipe.get('ingredients'), list) or not 0 <= len(recipe['ingredients']) <= 200:
            raise ValueError('Ajoutez au moins un ingrédient.')
        for item in recipe['ingredients']:
            if isinstance(item, str):
                # Preserve legacy text when a quantity cannot be identified.
                match = re.match(r'^(\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?(?:\s+(?:kg|g|mg|ml|cl|l|c\. à soupe|c\. à café|branches?|bouquets?|filets?|pavés?))?)\s+(.+)$', item, re.I)
                item = {'quantity': match[1] if match else '', 'name': match[2] if match else item}
            if not isinstance(item, dict) or not isinstance(item.get('name'), str) or not item['name'].strip() or len(item['name']) > 300 or not isinstance(item.get('quantity'), str) or len(item['quantity']) > 60:
                raise ValueError('Ingrédient invalide.')
            if not isinstance(item.get('category', 'À classer'), str) or not item.get('category', 'À classer').strip() or len(item.get('category', 'À classer')) > 100:
                raise ValueError('Rayon invalide.')
    for day, meals in state['plans'].items():
        parsed = date.fromisoformat(day)
        if parsed.isoformat() != day or parsed.weekday() != 0 or not isinstance(meals, list) or len(meals) > 7 or any(meal is not None and (not isinstance(meal, str) or meal not in ids) for meal in meals):
            raise ValueError('Planning invalide.')


def read_state(db):
    revision, initialized = db.execute('SELECT revision, initialized FROM metadata').fetchone()
    recipes = []
    for rid, name, category, minutes, servings, instructions in db.execute('SELECT * FROM recipes ORDER BY rowid'):
        ingredients = [{'quantity': q, 'name': n, 'category': c} for q, n, c in db.execute('SELECT quantity, name, category FROM ingredients WHERE recipe_id=? ORDER BY position', (rid,))]
        recipes.append(dict(id=rid, name=name, category=category, time=minutes, servings=servings, instructions=instructions, ingredients=ingredients))
    plans = {week: [] for (week,) in db.execute('SELECT week FROM weeks')}
    for week, day, rid in db.execute('SELECT week, day, recipe_id FROM planned_meals ORDER BY day'):
        index = (date.fromisoformat(day) - date.fromisoformat(week)).days
        while len(plans[week]) <= index:
            plans[week].append(None)
        plans[week][index] = rid
    return dict(recipes=recipes, plans=plans, revision=revision, initialized=bool(initialized))


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, data):
        content = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/state':
            try:
                with connect() as db:
                    self.respond(200, read_state(db))
            except sqlite3.Error:
                self.respond(500, {'error': 'Lecture de la base impossible.'})
            return
        if path not in STATIC:
            self.send_error(404)
            return
        content = (ROOT / STATIC[path]).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', {'html': 'text/html; charset=utf-8', 'js': 'text/javascript; charset=utf-8', 'css': 'text/css; charset=utf-8'}[STATIC[path].split('.')[-1]])
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_PUT(self):
        if self.path != '/api/state':
            self.send_error(404)
            return
        if self.headers.get('Origin') not in (None, 'http://' + self.headers.get('Host', '')):
            self.respond(403, {'error': 'Origine refusée.'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 2_000_000:
                raise ValueError('Données trop volumineuses ou absentes.')
            state = json.loads(self.rfile.read(length))
            validate(state)
            with connect() as db:
                db.execute('BEGIN IMMEDIATE')
                revision = db.execute('SELECT revision FROM metadata').fetchone()[0]
                if type(state.get('revision')) is not int or state['revision'] != revision:
                    self.respond(409, {'error': 'Les données ont changé dans un autre onglet. Rechargez la page.'})
                    return
                db.execute('DELETE FROM planned_meals')
                db.execute('DELETE FROM weeks')
                db.execute('DELETE FROM recipes')
                for r in state['recipes']:
                    db.execute('INSERT INTO recipes VALUES (?,?,?,?,?,?)', (r['id'], r['name'], r['category'], r['time'], r['servings'], r['instructions']))
                    for position, item in enumerate(r['ingredients']):
                        if isinstance(item, str):
                            match = re.match(r'^(\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?(?:\s+(?:kg|g|mg|ml|cl|l|c\. à soupe|c\. à café|branches?|bouquets?|filets?|pavés?))?)\s+(.+)$', item, re.I)
                            item = {'quantity': match[1] if match else '', 'name': match[2] if match else item}
                        db.execute('INSERT INTO ingredients (recipe_id, position, quantity, name, category) VALUES (?,?,?,?,?)', (r['id'], position, item['quantity'], item['name'], item.get('category', 'À classer')))
                for week, meals in state['plans'].items():
                    db.execute('INSERT INTO weeks VALUES (?)', (week,))
                    for index, rid in enumerate(meals):
                        day = (date.fromisoformat(week) + timedelta(days=index)).isoformat()
                        db.execute('INSERT INTO planned_meals VALUES (?,?,?)', (week, day, rid))
                db.execute('UPDATE metadata SET revision=revision+1, initialized=1')
            self.respond(200, {'revision': revision + 1})
        except (ValueError, TypeError, KeyError, OverflowError):
            self.respond(400, {'error': 'Données invalides. Vérifiez les recettes et les plannings.'})
        except sqlite3.Error:
            self.respond(500, {'error': 'Enregistrement impossible. Réessayez.'})


if __name__ == '__main__':
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS metadata (revision INTEGER NOT NULL, initialized INTEGER NOT NULL);
        INSERT INTO metadata SELECT 0, 0 WHERE NOT EXISTS (SELECT 1 FROM metadata);
        CREATE TABLE IF NOT EXISTS recipes (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, time INTEGER NOT NULL, servings INTEGER NOT NULL, instructions TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ingredients (recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE, position INTEGER, quantity TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(recipe_id, position));
        CREATE TABLE IF NOT EXISTS weeks (week TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS planned_meals (week TEXT REFERENCES weeks(week), day TEXT PRIMARY KEY, recipe_id TEXT REFERENCES recipes(id));
        ''')
        if 'category' not in [row[1] for row in db.execute('PRAGMA table_info(ingredients)')]:
            db.execute("ALTER TABLE ingredients ADD COLUMN category TEXT NOT NULL DEFAULT 'À classer'")
    print('WeeklyMenus : http://127.0.0.1:4173/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 4173), Handler).serve_forever()
