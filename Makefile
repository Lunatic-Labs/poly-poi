.PHONY: help setup backend frontend lint typecheck db-push db-local-start db-local-stop db-local-reset

help:
	@echo "PolyPOI — Development Commands"
	@echo ""
	@echo "  First-time setup:"
	@echo "    make setup            Install Python + Node dependencies"
	@echo "    → Get .env.local with Supabase credentials from a teammate, or:"
	@echo "    → Create a free Supabase project at supabase.com and run: make db-push"
	@echo ""
	@echo "  Run:"
	@echo "    make backend          FastAPI dev server  → http://localhost:8000"
	@echo "    make frontend         Vite dev server     → http://localhost:5173"
	@echo ""
	@echo "  Database (schema manager only — requires Supabase CLI):"
	@echo "    make db-push          Apply pending migrations to linked Supabase project"
	@echo "    make db-local-start   Start local Supabase via Docker (optional)"
	@echo "    make db-local-stop    Stop local Supabase"
	@echo "    make db-local-reset   Reset local DB and re-run all migrations"
	@echo ""
	@echo "  Quality:"
	@echo "    make lint             ruff + eslint"
	@echo "    make typecheck        tsc --noEmit"

setup:
	@echo "→ Installing backend dependencies..."
	cd backend && python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
	@echo "→ Installing frontend dependencies..."
	cd frontend && npm install
	@echo "→ Installing pre-commit hooks..."
	cd backend && .venv/bin/pre-commit install
	@cp -n .env.example .env.local || true
	@echo ""
	@echo "✓ Done. Fill in .env.local with your Supabase credentials, then:"
	@echo "  make backend   (terminal 1)"
	@echo "  make frontend  (terminal 2)"

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

# Schema management — only needed by whoever owns migrations
db-push:
	supabase db push

db-local-start:
	supabase start

db-local-stop:
	supabase stop

db-local-reset:
	supabase db reset

test-backend:
	cd backend && .venv/bin/pytest -v

test-frontend:
	cd frontend && npm test -- --passWithNoTests

test: test-backend test-frontend

lint:
	cd backend && .venv/bin/ruff check app && .venv/bin/ruff format --check app
	cd frontend && npm run lint

typecheck:
	cd frontend && npm run typecheck
