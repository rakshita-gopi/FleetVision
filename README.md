# FleetVision AI

AI-Powered Fleet Management System — Django REST API + Next.js dashboard for vehicles, drivers, trips, fuel, maintenance, expenses, GPS, and LLM reports.

## Architecture (separated)

| Piece | How it runs |
|-------|-------------|
| **Backend API** | Docker (`backend` + PostgreSQL) |
| **Frontend** | Local Node (`cd frontend && npm run dev`) |
| **Ollama AI** | Local on your machine (optional; backend reaches it via `host.docker.internal`) |

```
┌────────────────────┐     HTTP :8000      ┌──────────────────────────┐
│  Frontend (npm)    │ ──────────────────► │  Backend container       │
│  localhost:3000    │                     │  Django / Gunicorn       │
└────────────────────┘                     │         │                │
                                           │         ▼                │
                                           │  PostgreSQL container    │
                                           └──────────┬───────────────┘
                                                      │ host.docker.internal
                                                      ▼
                                           ┌──────────────────────────┐
                                           │  Ollama on host (optional)│
                                           └──────────────────────────┘
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)
- Node.js LTS (for frontend only)
- Optional: [Ollama](https://ollama.com) + `ollama pull qwen3:8b` for AI features

---

## 1. Start the backend with Docker

From the **repo root** (`FleetVision/`):

```bash
# First time / after dependency changes
docker compose build

# Start PostgreSQL + Django API
docker compose up -d

# Follow logs
docker compose logs -f backend
```

What this starts:

| Service | URL / port |
|---------|------------|
| API | http://localhost:8000 |
| API docs | http://localhost:8000/api/docs/ |
| PostgreSQL | localhost:5432 (user/db/password: `fleetvision`) |

On first start the container will:

1. Wait for Postgres  
2. Run migrations  
3. Seed demo data  
4. Serve the API on port **8000**

### Useful Docker commands

```bash
# Status
docker compose ps

# Stop everything
docker compose down

# Stop and delete DB volume (fresh database)
docker compose down -v

# Rebuild after Dockerfile / requirements changes
docker compose up -d --build

# Shell into API container
docker compose exec backend sh

# Run a management command
docker compose exec backend python manage.py seed_demo
```

### If port 5432 is already in use

Your Mac may already run Homebrew Postgres. Either stop it, or remap the compose port:

```bash
# in a .env file at repo root (optional)
POSTGRES_PORT=5433
```

Then `docker compose up -d` again. The **backend container still talks to `db:5432` internally** — only the host mapping changes.

### Backend env (`backend/.env.docker`)

Compose loads `backend/.env.docker`. Important keys:

```
SECRET_KEY=...
DEBUG=True
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen3:8b
GOOGLE_CLIENT_ID=
```

`DATABASE_URL` is overridden by Compose to point at the `db` service.

---

## 2. Run the frontend separately (not in Docker)

```bash
cd frontend
cp .env.local.example .env.local   # if you don't have one yet
```

Ensure `frontend/.env.local` points at the Docker API:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

```bash
npm install
npm run dev
```

Open **http://localhost:3000**

---

## 3. Optional: Ollama (AI)

On the host (not inside Docker):

```bash
brew services start ollama
ollama pull qwen3:8b
```

Backend containers use `http://host.docker.internal:11434` to reach it. If Ollama is down, reports/AI fall back to rule-based text.

---

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Administrator | admin@fleetvision.ai | admin123 |
| Fleet Manager | manager@fleetvision.ai | manager123 |
| Driver | driver1@fleetvision.ai | driver123 |

---

## Local backend without Docker (optional)

If you prefer not to use Docker for the API:

```bash
cd backend
cp .env.example .env
# set DATABASE_URL to your local Postgres
/usr/bin/python3 -m pip install -r requirements.txt
/usr/bin/python3 manage.py migrate
/usr/bin/python3 manage.py seed_demo
/usr/bin/python3 manage.py runserver 8000
# or: ./run.sh
```

---

## Google Sign-In (optional)

1. Create a Web OAuth client in Google Cloud Console  
2. JS origin: `http://localhost:3000`  
3. Set the same Client ID in:
   - `backend/.env.docker` → `GOOGLE_CLIENT_ID=...`
   - `frontend/.env.local` → `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...`
4. Restart: `docker compose up -d --force-recreate backend` and restart `npm run dev`

---

## Project layout

```
FleetVision/
├── docker-compose.yml      # Backend stack only (db + api)
├── backend/                # Django API (Dockerized)
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── .env.docker
│   └── ...
└── frontend/               # Next.js app (run with npm)
    ├── Dockerfile          # Optional production image (not used by compose)
    └── ...
```

## API documentation

Swagger: **http://localhost:8000/api/docs/**
