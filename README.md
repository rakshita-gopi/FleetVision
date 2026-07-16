# FleetVision AI

AI-Powered Fleet Management System — a full-stack enterprise platform for managing vehicles, drivers, trips, maintenance, fuel, expenses, live GPS tracking, and AI-assisted decision support.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | Django 4.2, Django REST Framework |
| Auth | JWT (SimpleJWT) |
| Database | PostgreSQL 16 (local) |
| AI | Ollama — Qwen3:8B |
| Maps | Leaflet + OpenStreetMap |
| Charts | Recharts |

## Prerequisites

- **PostgreSQL 16** — `brew install postgresql@16 && brew services start postgresql@16`
- **Ollama** — `brew install ollama && brew services start ollama && ollama pull qwen3:8b`
- **Node.js** (LTS) and **Python 3.9+**

## Quick Start

### 1. PostgreSQL Setup

```bash
# Create database (one-time)
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
psql postgres -c "CREATE USER fleetvision WITH PASSWORD 'fleetvision';"
psql postgres -c "CREATE DATABASE fleetvision OWNER fleetvision;"
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # already configured for local PostgreSQL + Ollama
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 8000
```

### 3. Ollama (AI)

```bash
brew services start ollama
ollama pull qwen3:8b
```

Ensure `OLLAMA_BASE_URL=http://localhost:11434` and `OLLAMA_MODEL=qwen3:8b` in `backend/.env`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Administrator | admin@fleetvision.ai | admin123 |
| Fleet Manager | manager@fleetvision.ai | manager123 |
| Driver | driver1@fleetvision.ai | driver123 |

## Theme

- **Dark mode** — pure black backgrounds with white text (default)
- **Light mode** — white backgrounds with black text
- Toggle via the sun/moon icon in the top navigation bar

## AI Integration

FleetVision uses **Ollama** with the **Qwen3:8B** model for:
- Fleet AI chat assistant
- Dashboard summaries
- Fuel analysis insights

If Ollama is unavailable, the system falls back to rule-based responses using live fleet data.

## API Documentation

Swagger UI: **http://localhost:8000/api/docs/**

## Environment Variables

### Backend (`backend/.env`)

```
SECRET_KEY=your-secret-key
DEBUG=True
DATABASE_URL=postgres://fleetvision:fleetvision@localhost:5432/fleetvision
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```
