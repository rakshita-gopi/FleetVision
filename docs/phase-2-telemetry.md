# Phase 2 — Telemetry & Real-Time Pipeline

## Architecture

```text
Simulator / Mobile → POST /api/v1/telemetry/ → Kafka (fleet.telemetry)
  → telemetry_consumer → TimescaleDB (history) + Redis (vehicle:{uuid}:state) + WebSocket
  → Next.js Live Tracking + /telemetry/[id]
```

## Compose services

| Service | Image / role |
|---------|----------------|
| `db` | `timescale/timescaledb:2.17.2-pg16` |
| `redis` | `redis:7-alpine` |
| `kafka` | `apache/kafka:3.8.1` (KRaft) |
| `backend` | Django ASGI (Daphne) + Channels |
| `telemetry-consumer` | `python manage.py telemetry_consumer` |

**First-time Timescale switch:** Compose uses volume `fleetvision_tsdata` (separate from the old Postgres volume). Demo data is re-seeded on first start.

```bash
docker compose up -d --build
```

## APIs

| Method | Path | Source |
|--------|------|--------|
| POST | `/api/v1/telemetry/` | Kafka produce |
| GET | `/api/v1/vehicles/{id}/live/` | Redis |
| GET | `/api/v1/vehicles/{id}/telemetry/?from=&to=&limit=` | TimescaleDB |
| GET | `/api/v1/fleet/live/` | Redis |
| WS | `/ws/fleet/` | Channel layer |
| GET | `/api/v1/system/health/` | expanded checks |

## Simulator

```bash
# API stack must be up; demo vehicles seeded
cd /path/to/FleetVision
pip install requests   # if needed outside Docker
python -m simulator
SIMULATOR_VEHICLE_COUNT=5 python -m simulator
```

Env: `SIMULATOR_API_URL`, `SIMULATOR_USERNAME`, `SIMULATOR_PASSWORD`, `SIMULATOR_INTERVAL`, `SIMULATOR_VEHICLE_IDS`.

## Frontend

- Live Tracking polls `/fleet/live/` every 4s and prefers WebSocket `ws://host/ws/fleet/`
- Telemetry dashboard: `/telemetry/{vehicleId}`

## Failure-test checklist (PDF §§46–49)

- [ ] Invalid latitude `200` → 400
- [ ] Unknown vehicle UUID → 400 Vehicle not found
- [ ] Duplicate `event_id` → single Timescale row
- [ ] Redis flush → history still in Timescale; live rebuilds when simulator runs
- [ ] Frontend refresh → live state from Redis/API
- [ ] Health shows timescaledb + kafka; consumer healthy after consumer starts

## Completion criteria

Timescale hypertable, Kafka topic, producer/consumer, Redis `vehicle:{uuid}:state`, simulator (1→5), ingest/live/history APIs, live map, WebSocket (with poll fallback), expanded health.
