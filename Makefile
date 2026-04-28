SHELL := /bin/bash

.PHONY: help db-up db-down db-logs seed backend-install backend-test backend-run mcp-install mcp-run frontend-install frontend-dev frontend-build clean

help:
	@echo "Available targets:"
	@echo "  db-up            Start PostgreSQL + TimescaleDB"
	@echo "  db-down          Stop database containers"
	@echo "  db-logs          Tail database logs"
	@echo "  seed             Seed PostgreSQL data"
	@echo "  backend-install  Create backend venv and install deps"
	@echo "  backend-test     Run backend unit tests"
	@echo "  backend-run      Run FastAPI server on :8000"
	@echo "  mcp-install      Create MCP venv and install deps"
	@echo "  mcp-run          Run MCP server"
	@echo "  frontend-install Install frontend deps"
	@echo "  frontend-dev     Run frontend dev server on :5173"
	@echo "  frontend-build   Build frontend production bundle"
	@echo "  clean            Remove local build/venv artifacts"

db-up:
	docker compose up -d

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

seed:
	psql postgresql://postgres:postgres@localhost:5432/fmcg -f backend/sql/seed.sql

backend-install:
	cd backend && python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

backend-test:
	cd backend && source .venv/bin/activate && PYTHONPATH=. python -m unittest discover -s tests

backend-run:
	cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

mcp-install:
	cd mcp-server && python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

mcp-run:
	cd mcp-server && source .venv/bin/activate && python server.py

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

clean:
	rm -rf backend/.venv mcp-server/.venv frontend/node_modules frontend/dist

