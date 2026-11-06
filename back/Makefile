.PHONY: help install dev up down logs migrate makemigration seed test lint fmt clean

help:            ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install:         ## Installe les dépendances Python
	cd backend && pip install -r requirements.txt

dev:             ## Lance l'API en rechargement à chaud
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

up:              ## Démarre la pile Docker
	docker compose up --build -d

down:            ## Arrête la pile Docker
	docker compose down

logs:            ## Affiche les logs de l'API
	docker compose logs -f api

migrate:         ## Applique les migrations
	cd backend && alembic upgrade head

makemigration:   ## Crée une migration (make makemigration m="message")
	cd backend && alembic revision --autogenerate -m "$(m)"

seed:            ## Initialise Super Admin et types de biens
	cd backend && python -m app.database.init_db

test:            ## Lance la suite de tests
	cd backend && POSTGRES_DB=immoflow_test pytest -v

clean:           ## Nettoie les fichiers temporaires
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
