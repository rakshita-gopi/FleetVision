# Phase 1 — Foundation

This document records how FleetVision aligns with the **FleetVision AI 2.0 Phase 1** foundation PDF.

## Goal

A stable platform (Next.js + Django REST + PostgreSQL + Redis + JWT + RBAC) that later phases can extend without rewriting the core.

## What is in place

| Area | Status |
|------|--------|
| Next.js App Router frontend | Yes |
| Django REST + JWT | Yes (`/api/v1/auth/…`) |
| PostgreSQL | Yes (Docker `db` service) |
| Redis cache | Yes (Docker `redis` + `django-redis`) |
| UUID vehicle identity | Yes (`Vehicle.id` UUID PK) |
| Roles | Administrator, Fleet Manager, Driver, Mechanic |
| Domain `services.py` | vehicles, drivers, trips, fuel, maintenance, expenses |
| Health API | `GET /api/v1/system/health/` |
| System UI | `/system` |
| Docker Compose | `db` + `redis` + `backend` |
| Logging | Django `LOGGING` in `config/settings.py` |
| Pagination helper | `common.pagination.StandardResultsSetPagination` |

## API versioning

- **Primary:** `/api/v1/…`
- **Legacy alias (temporary):** `/api/…` (same routes)

Auth “me” endpoint: `GET /api/v1/auth/me/` (alias of `/profile`).

Frontend should set:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Deliberate deviations from the PDF layout

1. **Apps stay flat under `backend/`** (not moved into `backend/apps/`). Moving packages would break imports and migrations for little gain. Service boundaries are enforced via `services.py` instead.
2. **Role enum values** keep display strings (`Administrator`, `Fleet Manager`, …) rather than `ADMIN` / `FLEET_MANAGER` codes, to avoid a data migration. PDF `ADMIN` maps to `ADMINISTRATOR`.
3. **Existing extras** (Live Tracking, Reports, AI Assistant, Google auth) remain available but are **optional**. The Phase 1 dashboard loads fleet metrics without requiring Ollama.

## Event-ready services

Domain writes go through services with `# TODO: publish … event (Kafka — Phase 2)` stubs. No Kafka in Phase 1.

## Local run

```bash
# Backend stack
docker compose up -d

# Frontend
cd frontend && npm run dev
```

- API: http://localhost:8000/
- Health: http://localhost:8000/api/v1/system/health/
- Docs: http://localhost:8000/api/docs/
- App: http://localhost:3000/

## Completion checklist

- [ ] Login as Fleet Manager
- [ ] Dashboard loads metrics (without AI)
- [ ] Create vehicle / driver / trip → start → complete
- [ ] Fuel + maintenance records
- [ ] System page shows PostgreSQL + Redis healthy
- [ ] `docker compose ps` shows db, redis, backend up
