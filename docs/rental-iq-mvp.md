# Rental-IQ MVP (Slice A)

Smart equipment rental ops on the existing Next.js + Django stack.

## Stack

- **Frontend:** Next.js (`frontend/`) — Manual Mode pages + Agentic Mode chat
- **Backend:** Django REST (`backend/`) — equipment, sites, operators, rentals, agentic
- **Infra:** Docker Compose — TimescaleDB, Redis, Kafka, API, telemetry consumer

## Run

```bash
# API + data plane
docker compose up -d --build

# UI
cd frontend && npm install && npm run dev
```

- App: http://localhost:3000  
- API: http://localhost:8000/api/v1/  
- Docs: http://localhost:8000/api/docs/

**Login:** `admin@fleetvision.ai` / `admin123`

On first boot the API runs `seed_rental_dataset` when `SEED_RENTAL=true` (default in `backend/.env.docker`), reading CSVs from `/dataset` (compose mounts `cat_smart_rental_dataset/`).

After updating compose, recreate once so the mount applies:

```bash
docker compose up -d backend --force-recreate
```

Manual reseed:

```bash
docker compose exec backend python manage.py seed_rental_dataset --force --telemetry-limit 500
```

## What to click

1. **Dashboard** — available / active / idle / overdue KPIs  
2. **Equipment** — asset list + LAM strip (status, site, hours, live)  
3. **Rentals** — check-out / check-in  
4. **Sites** — map pins  
5. **Live Map** — Redis live telemetry keyed by equipment UUID  
6. **Agentic Mode** — chat → ActionProposal → Approve / Reject  

## Key APIs

| Method | Path |
|--------|------|
| GET | `/api/v1/equipment/` |
| GET | `/api/v1/equipment/dashboard/` |
| GET | `/api/v1/rentals/` |
| POST | `/api/v1/rentals/check-out/` |
| POST | `/api/v1/rentals/{id}/check-in/` |
| GET | `/api/v1/sites/` `/operators/` |
| GET | `/api/v1/fleet/live/` |
| POST | `/api/v1/telemetry/` (`vehicle_id` **or** `equipment_id` **or** `asset_id`) |
| POST | `/api/v1/agentic/chat/` |
| POST | `/api/v1/agentic/proposals/{id}/approve/` |
| POST | `/api/v1/agentic/proposals/{id}/reject/` |

## Optional telemetry

After equipment is seeded, map simulator events to equipment UUIDs (or post with `asset_id`):

```bash
# from repo root, with API up and a JWT
python -m simulator
```

## Env flags

| Var | Default | Meaning |
|-----|---------|---------|
| `SEED_DEMO` | true | Legacy fleet demo user/vehicles |
| `SEED_RENTAL` | true | Import CAT smart rental CSVs |
| `RENTAL_DATASET_PATH` | `/dataset` | CSV directory inside container |
| `TELEMETRY_SEED_LIMIT` | 500 | Rows from `telemetry_24h_5min.csv` |

## QR Check-In / Check-Out desk

Separate sidebar module (**QR Check-In/Out**) implementing the rental possession workflow:

1. Manager generates check-out QR → creates `PENDING_CHECKOUT` rental (`RNT#####` + `TXN-YYYYMMDD-#####`)
2. QR encodes **only** `rental_id`
3. Operator scans → sees equipment, customer, operator, health, fuel, GPS
4. Confirm Checkout → `ACTIVE` + snapshots
5. Scan again on return → Confirm Check-In → `COMPLETED`, invoice number, QR expired

```bash
# after Docker is up
docker compose exec backend python manage.py migrate
```

APIs under `/api/v1/qr-desk/`: `generate/`, `scan/`, `confirm-checkout/`, `confirm-checkin/`, `open/`.

