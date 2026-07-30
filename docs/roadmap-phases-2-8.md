# FleetVision AI 2.0 — Roadmap (Phases 2–8)

Phase 1 (Foundation) and **Phase 2 (Telemetry)** are implemented. Later phases stay planned until their own docs are written.

```text
Foundation ✓ → Telemetry ✓ → Digital Twin → Intelligence → Agents → Digital Workers → Resilience → 3D
```

## Phase 2 — Telemetry (done)

See [phase-2-telemetry.md](phase-2-telemetry.md).

- Kafka `fleet.telemetry`
- TimescaleDB `vehicle_telemetry` hypertable
- Redis `vehicle:{uuid}:state`
- GPS simulator
- Live Tracking + WebSocket `/ws/fleet/`

## Phase 3 — Digital Twin

- Twin state engine combining Postgres identity + Redis now + Timescale history
- Component health and derived metrics

## Phase 4 — Intelligence

- Rules, anomalies, predictive ML, Ollama insights

## Phase 5 — Agents

- LangGraph supervisor + specialist agents

## Phase 6 — Digital Workers

- Work orders, approvals, scheduling

## Phase 7 — Resilience

- Edge / low-power / offline / confidence

## Phase 8 — 3D Twin

- Three.js / R3F / GLTF

## Next

**Phase 3 — Digital Twin State Engine**
