"""Per-agent parameter schemas — each agent exposes different configurable fields."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def _field(name: str, label: str, ftype: str, **kwargs) -> dict:
    return {"name": name, "label": label, "type": ftype, **kwargs}


AGENT_PARAM_SCHEMAS: dict[str, list[dict[str, Any]]] = {
    "orchestrator": [
        _field("priority", "Priority mode", "select", options=["balanced", "utilisation", "risk", "revenue"], default="balanced"),
        _field("max_delegations", "Max sub-agent hops", "number", min=1, max=5, default=3),
        _field("auto_route", "Auto-route intents", "toggle", default=True),
        _field("brief_style", "Brief style", "select", options=["ops", "executive", "technical"], default="ops"),
    ],
    "dispatch": [
        _field("mode", "Dispatch mode", "select", options=["checkout", "checkin", "both"], default="both"),
        _field("overdue_only", "Overdue rentals only", "toggle", default=True),
        _field("require_operator", "Require operator on checkout", "toggle", default=True),
        _field("grace_hours", "Grace period (hours)", "number", min=0, max=72, default=4),
        _field("site_filter", "Site filter (optional)", "text", default="", placeholder="SITE001"),
    ],
    "demand": [
        _field("horizon_days", "Forecast horizon (days)", "number", min=3, max=30, default=7),
        _field("lookback_days", "History lookback (days)", "number", min=7, max=90, default=28),
        _field("category", "Equipment category", "select", options=["all", "excavator", "loader", "dozer", "generator"], default="all"),
        _field("shortfall_threshold", "Shortfall alert units", "number", min=1, max=50, default=2),
        _field("preposition", "Propose preposition", "toggle", default=True),
    ],
    "anomaly": [
        _field("kinds", "Detect kinds", "multiselect", options=["long_idle", "unassigned", "underuse", "potential_misuse"], default=["long_idle", "unassigned", "underuse", "potential_misuse"]),
        _field("idle_threshold", "Idle ratio threshold", "slider", min=0.5, max=0.95, step=0.05, default=0.75),
        _field("fuel_drop_pct", "Fuel drop alert %", "number", min=10, max=80, default=25),
        _field("util_floor", "Underuse util % floor", "number", min=10, max=60, default=35),
        _field("notify", "Emit notifications", "toggle", default=True),
        _field("top_n", "Notify top N", "number", min=5, max=50, default=30),
    ],
    "alert": [
        _field("due_soon_days", "Due-soon window (days)", "number", min=1, max=14, default=3),
        _field("include_today", "Include due today", "toggle", default=True),
        _field("include_overdue", "Include overdue", "toggle", default=True),
        _field("severity_floor", "Min severity", "select", options=["info", "warning", "critical"], default="warning"),
        _field("auto_propose_return", "Auto-propose returns", "toggle", default=True),
    ],
    "utilisation": [
        _field("idle_status", "Target statuses", "multiselect", options=["IDLE", "AVAILABLE"], default=["IDLE", "AVAILABLE"]),
        _field("min_engine_hours", "Min engine hours", "number", min=0, max=20000, default=0),
        _field("propose_reallocate", "Propose reallocate", "toggle", default=True),
        _field("target_site", "Preferred site", "text", default="", placeholder="SITE002"),
        _field("batch_size", "Max proposals", "number", min=1, max=20, default=5),
    ],
    "maintenance": [
        _field("hours_threshold", "Engine hours threshold", "number", min=100, max=50000, default=8000),
        _field("action", "Default action", "select", options=["inspect", "maintain"], default="inspect"),
        _field("include_in_maint", "Include already in maintenance", "toggle", default=False),
        _field("category", "Category filter", "select", options=["all", "excavator", "loader", "dozer"], default="all"),
    ],
}

WORKER_PARAM_SCHEMAS: dict[str, list[dict[str, Any]]] = {
    "telemetry_worker": [
        _field("lookback_days", "Lookback days", "number", min=1, max=30, default=7),
        _field("sample_limit", "Sample limit", "number", min=50, max=2000, default=500),
    ],
    "scan_worker": [
        _field("parallel", "Run jobs in parallel", "toggle", default=False),
        _field("retry", "Retry on failure", "number", min=0, max=3, default=1),
    ],
    "forecast_worker": [
        _field("method", "Method", "select", options=["moving_average", "weekday_aware"], default="weekday_aware"),
    ],
    "notification_worker": [
        _field("dedupe_hours", "Dedupe window (h)", "number", min=1, max=72, default=18),
        _field("channels", "Channels", "multiselect", options=["in_app", "email"], default=["in_app"]),
    ],
    "proposal_worker": [
        _field("require_manager", "Manager approval only", "toggle", default=True),
    ],
    "rental_state_worker": [
        _field("dry_run", "Dry run (no writes)", "toggle", default=False),
    ],
}


def enrich_agents(agents: list[dict]) -> list[dict]:
    out = []
    for a in agents:
        row = deepcopy(a)
        schema = AGENT_PARAM_SCHEMAS.get(a["id"], [])
        row["params_schema"] = schema
        row["default_params"] = {f["name"]: f.get("default") for f in schema}
        out.append(row)
    return out


def enrich_workers(workers: list[dict]) -> list[dict]:
    out = []
    for w in workers:
        row = deepcopy(w)
        schema = WORKER_PARAM_SCHEMAS.get(w["id"], [])
        row["params_schema"] = schema
        row["default_params"] = {f["name"]: f.get("default") for f in schema}
        out.append(row)
    return out
