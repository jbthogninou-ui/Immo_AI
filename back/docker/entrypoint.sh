#!/usr/bin/env bash
# Attend la base, applique les migrations, initialise puis démarre l'API.
set -euo pipefail

echo "→ Attente de PostgreSQL (${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432})…"
until python -c "
import socket, os, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect((os.getenv('POSTGRES_HOST', 'db'), int(os.getenv('POSTGRES_PORT', '5432'))))
except OSError:
    sys.exit(1)
" 2>/dev/null; do
    sleep 1
done
echo "✓ PostgreSQL disponible"

echo "→ Application des migrations Alembic…"
alembic upgrade head

echo "→ Initialisation des données de référence…"
python -m app.database.init_db

echo "→ Démarrage de l'API"
exec "$@"
