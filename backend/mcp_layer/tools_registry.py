"""
Shared MCP tool registry.

Used by:
- stdio MCP server (Cursor / Claude Desktop)
- HTTP `/api/v1/mcp/` discovery + invoke endpoints
- Agentic Mode catalog (protocol metadata)
"""
from __future__ import annotations

import json
from typing import Any, Callable

from anomalies.services import detect_anomalies
from demand.services import build_forecast
from notifications.services import scan_rental_due_alerts
from agentic.services import (
    dispatch_desk_summary,
    list_overdue_rentals,
    search_equipment,
    utilisation_summary,
)


def _jsonable(obj: Any) -> Any:
    return json.loads(json.dumps(obj, default=str))


def tool_fleet_utilisation() -> dict:
    """Fleet utilisation snapshot (active / idle / available / overdue)."""
    return _jsonable(utilisation_summary())


def tool_search_equipment(query: str = "", status: str = "", limit: int = 15) -> dict:
    """Search equipment by asset code / model / category; optional status filter (AVAILABLE, IDLE, ACTIVE…)."""
    rows = search_equipment(query=query or "", status=status or None, limit=max(1, min(int(limit or 15), 50)))
    return _jsonable({"count": len(rows), "equipment": rows})


def tool_list_overdue_rentals(limit: int = 20) -> dict:
    """List open rentals past expected return (ACTIVE + OVERDUE)."""
    rows = list_overdue_rentals(limit=max(1, min(int(limit or 20), 50)))
    return _jsonable({"count": len(rows), "rentals": rows})


def tool_dispatch_desk() -> dict:
    """Dispatch Hub desk: pending QR checkouts, active possessions, due/overdue, eligible assets."""
    return _jsonable(dispatch_desk_summary())


def tool_scan_anomalies(emit_notifications: bool = False) -> dict:
    """Scan idle / unassigned / underuse / misuse anomalies (optional notifications)."""
    return _jsonable(detect_anomalies(emit_notifications=bool(emit_notifications)))


def tool_scan_rental_alerts(due_soon_days: int = 3) -> dict:
    """Scan due-soon / due-today / overdue rentals and emit notifications."""
    return _jsonable(scan_rental_due_alerts(due_soon_days=max(1, min(int(due_soon_days or 3), 14))))


def tool_demand_forecast(horizon_days: int = 7, lookback_days: int = 28) -> dict:
    """Build site demand forecast for preposition planning."""
    return _jsonable(
        build_forecast(
            horizon_days=max(3, min(int(horizon_days or 7), 30)),
            lookback_days=max(7, min(int(lookback_days or 28), 90)),
        )
    )


def tool_rewards_leaderboard(limit: int = 10) -> dict:
    """Customer rewards leaderboard (points / tier)."""
    from rewards.models import CustomerRewardAccount

    qs = CustomerRewardAccount.objects.order_by("-lifetime_points", "-points_balance")[: max(1, min(int(limit or 10), 50))]
    rows = [
        {
            "customer_id": a.customer_id,
            "customer_name": a.customer_name,
            "points_balance": a.points_balance,
            "lifetime_points": a.lifetime_points,
            "tier": a.tier,
        }
        for a in qs
    ]
    return _jsonable({"count": len(rows), "leaderboard": rows})


def tool_fleet_live(limit: int = 20) -> dict:
    """Live Redis fleet positions / telemetry sample."""
    from telemetry.consumers.processor import get_all_live_states
    from equipment.models import Equipment
    from common.lookup import is_uuid

    states = get_all_live_states()[: max(1, min(int(limit or 20), 100))]
    ids = [s.get("vehicle_id") for s in states if is_uuid(s.get("vehicle_id"))]
    asset_map = {
        str(e.id): e.asset_id for e in Equipment.objects.filter(id__in=ids).only("id", "asset_id")
    }
    for s in states:
        vid = str(s.get("vehicle_id") or "")
        if vid in asset_map:
            s["asset_id"] = asset_map[vid]
    return _jsonable({"count": len(states), "vehicles": states})


TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": "fleet_utilisation",
        "description": "Fleet utilisation snapshot (active / idle / available / overdue counts).",
        "handler": tool_fleet_utilisation,
        "params": {},
    },
    {
        "name": "search_equipment",
        "description": "Search equipment by query and optional status (AVAILABLE, IDLE, ACTIVE, MAINTENANCE).",
        "handler": tool_search_equipment,
        "params": {"query": "str", "status": "str", "limit": "int"},
    },
    {
        "name": "list_overdue_rentals",
        "description": "List overdue open rentals needing check-in follow-up.",
        "handler": tool_list_overdue_rentals,
        "params": {"limit": "int"},
    },
    {
        "name": "dispatch_desk",
        "description": "Full Dispatch Hub desk: pending QR, active possessions, due/overdue, eligible assets.",
        "handler": tool_dispatch_desk,
        "params": {},
    },
    {
        "name": "scan_anomalies",
        "description": "Detect idle / unassigned / underuse / misuse anomalies.",
        "handler": tool_scan_anomalies,
        "params": {"emit_notifications": "bool"},
    },
    {
        "name": "scan_rental_alerts",
        "description": "Scan due-soon / due-today / overdue and create notifications.",
        "handler": tool_scan_rental_alerts,
        "params": {"due_soon_days": "int"},
    },
    {
        "name": "demand_forecast",
        "description": "Site demand forecast for preposition planning.",
        "handler": tool_demand_forecast,
        "params": {"horizon_days": "int", "lookback_days": "int"},
    },
    {
        "name": "rewards_leaderboard",
        "description": "Customer reward points leaderboard.",
        "handler": tool_rewards_leaderboard,
        "params": {"limit": "int"},
    },
    {
        "name": "fleet_live",
        "description": "Live vehicle telemetry / GPS sample from Redis.",
        "handler": tool_fleet_live,
        "params": {"limit": "int"},
    },
]

_HANDLERS: dict[str, Callable[..., Any]] = {t["name"]: t["handler"] for t in TOOL_SPECS}


def list_tools() -> list[dict[str, Any]]:
    return [
        {"name": t["name"], "description": t["description"], "params": t["params"]}
        for t in TOOL_SPECS
    ]


def invoke_tool(name: str, arguments: dict | None = None) -> dict[str, Any]:
    handler = _HANDLERS.get(name)
    if not handler:
        raise ValueError(f"Unknown MCP tool: {name}. Available: {', '.join(_HANDLERS)}")
    args = arguments or {}
    # Drop nullish extras
    clean = {k: v for k, v in args.items() if v is not None and v != ""}
    result = handler(**clean)
    return {"tool": name, "ok": True, "result": result}


def mcp_catalog_block() -> dict[str, Any]:
    return {
        "protocol": "mcp",
        "version": "1.0",
        "transport": ["stdio", "http-api"],
        "server": "rental-iq-mcp",
        "stdio_command": "python manage.py run_mcp_server",
        "http": {
            "tools": "/api/v1/mcp/tools/",
            "call": "/api/v1/mcp/call/",
            "health": "/api/v1/mcp/health/",
        },
        "tools": list_tools(),
    }
