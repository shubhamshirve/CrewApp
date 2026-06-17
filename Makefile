.PHONY: up down logs build restart shell-backend shell-frontend \
        seed reset reset-seed \
        health install-backend install-frontend \
        test-backend lint-backend lint-frontend

# ────────────────────────────────────────────────────────────────────────────
# Docker Compose
# ────────────────────────────────────────────────────────────────────────────

## Start all services (build if needed)
up:
	docker compose up -d --build

## Stop all services
down:
	docker compose down

## Follow all service logs
logs:
	docker compose logs -f

## Follow backend logs only
logs-backend:
	docker compose logs -f backend

## Follow frontend logs only
logs-frontend:
	docker compose logs -f frontend

## Rebuild all images from scratch (no cache)
build:
	docker compose build --no-cache

## Restart all containers
restart:
	docker compose restart

## Open a shell inside the backend container
shell-backend:
	docker compose exec backend /bin/bash

## Open a shell inside the frontend container
shell-frontend:
	docker compose exec frontend /bin/sh

# ────────────────────────────────────────────────────────────────────────────
# Database Scripts
# ────────────────────────────────────────────────────────────────────────────

## Seed sample data (idempotent — skips existing records)
seed:
	docker compose exec backend python /app/scripts/seed_data.py

## Prompt before wiping all collections
reset:
	docker compose exec backend python /app/scripts/reset_db.py

## Wipe all data without confirmation + re-seed demo data
reset-seed:
	docker compose exec backend python /app/scripts/reset_db.py --yes --seed

## Show collections that would be wiped (dry-run)
reset-list:
	docker compose exec backend python /app/scripts/reset_db.py --list

# ────────────────────────────────────────────────────────────────────────────
# Local Development (without Docker)
# ────────────────────────────────────────────────────────────────────────────

## Install Python backend dependencies
install-backend:
	cd backend && pip install -r requirements.txt

## Install frontend dependencies (pnpm for Docker builds; yarn for local dev)
install-frontend:
	cd frontend && yarn install

## Check backend API health
health:
	@curl -sf http://localhost:8001/api/health | python3 -m json.tool || echo "Backend not responding"

# ────────────────────────────────────────────────────────────────────────────
# Quality
# ────────────────────────────────────────────────────────────────────────────

## Run backend tests with pytest
test-backend:
	cd backend && pytest tests/ -v

## Lint backend Python code
lint-backend:
	cd backend && ruff check . --fix

## Lint frontend TypeScript/JS code
lint-frontend:
	cd frontend && yarn eslint src/ --max-warnings=0

# ────────────────────────────────────────────────────────────────────────────
# Help
# ────────────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  CrewBook Makefile commands:"
	@echo ""
	@echo "  Docker:"
	@echo "    make up             Start all services (build if needed)"
	@echo "    make down           Stop all services"
	@echo "    make logs           Follow all service logs"
	@echo "    make build          Rebuild all images from scratch"
	@echo "    make restart        Restart all containers"
	@echo "    make shell-backend  Shell into backend container"
	@echo ""
	@echo "  Database:"
	@echo "    make seed           Insert sample data (idempotent)"
	@echo "    make reset          Wipe all data (prompts for confirmation)"
	@echo "    make reset-seed     Wipe + immediately re-seed demo data"
	@echo ""
	@echo "  Local Dev:"
	@echo "    make health         Check API health"
	@echo "    make test-backend   Run backend tests"
	@echo "    make lint-backend   Lint Python code"
	@echo "    make lint-frontend  Lint frontend code"
	@echo ""
