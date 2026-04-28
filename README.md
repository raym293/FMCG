# FMCG Supply Chain Digital Twin

Enterprise-oriented starter implementation for a P&G-style Supply Chain Digital Twin platform.

## Make Targets (root)

```bash
make help
make db-up
make backend-install backend-run
make mcp-install mcp-run
make frontend-install frontend-dev
```

## Monorepo Structure

- `backend/`: FastAPI services, forecasting/routing/optimization logic, and SQL artifacts.
- `mcp-server/`: MCP tools exposing inventory context and what-if simulation.
- `frontend/`: React + Tailwind + Tremor executive dashboard.
- `docker-compose.yml`: Local PostgreSQL + TimescaleDB runtime.

## Quick Start

1. Start database:
   ```bash
   docker compose up -d
   ```
2. Run backend:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python -m unittest discover -s tests
   uvicorn app.main:app --reload
   ```
   Optional DB seed (after DB up):
   ```bash
   psql postgresql://postgres:postgres@localhost:5432/fmcg -f sql/seed.sql
   ```
3. Run MCP server:
   ```bash
   cd mcp-server
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python server.py
   ```
4. Run frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
