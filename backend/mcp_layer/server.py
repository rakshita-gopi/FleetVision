"""
Rental-IQ MCP server (stdio).

Run:
  cd backend && python manage.py run_mcp_server

Cursor / Claude Desktop example (mcp.json):
  {
    "mcpServers": {
      "rental-iq": {
        "command": "docker",
        "args": ["compose", "exec", "-T", "backend", "python", "manage.py", "run_mcp_server"]
      }
    }
  }
"""
from __future__ import annotations

import json

from mcp.server.fastmcp import FastMCP

from .tools_registry import (
    tool_demand_forecast,
    tool_dispatch_desk,
    tool_fleet_live,
    tool_fleet_utilisation,
    tool_list_overdue_rentals,
    tool_rewards_leaderboard,
    tool_scan_anomalies,
    tool_scan_rental_alerts,
    tool_search_equipment,
)

mcp = FastMCP(
    "rental-iq",
    instructions=(
        "Rental-IQ MCP tools for smart equipment rental: dispatch desk, overdue returns, "
        "anomalies, demand forecast, utilisation, live fleet, and customer rewards."
    ),
)


@mcp.tool()
def fleet_utilisation() -> str:
    """Fleet utilisation snapshot (active / idle / available / overdue)."""
    return json.dumps(tool_fleet_utilisation(), indent=2)


@mcp.tool()
def search_equipment(query: str = "", status: str = "", limit: int = 15) -> str:
    """Search equipment by asset/model/category; optional status filter."""
    return json.dumps(tool_search_equipment(query=query, status=status, limit=limit), indent=2)


@mcp.tool()
def list_overdue_rentals(limit: int = 20) -> str:
    """List overdue open rentals needing check-in."""
    return json.dumps(tool_list_overdue_rentals(limit=limit), indent=2)


@mcp.tool()
def dispatch_desk() -> str:
    """Dispatch Hub desk details: pending QR, possessions, due/overdue, eligible assets."""
    return json.dumps(tool_dispatch_desk(), indent=2)


@mcp.tool()
def scan_anomalies(emit_notifications: bool = False) -> str:
    """Detect idle / unassigned / underuse / misuse anomalies."""
    return json.dumps(tool_scan_anomalies(emit_notifications=emit_notifications), indent=2)


@mcp.tool()
def scan_rental_alerts(due_soon_days: int = 3) -> str:
    """Scan due-soon / due-today / overdue rentals and notify."""
    return json.dumps(tool_scan_rental_alerts(due_soon_days=due_soon_days), indent=2)


@mcp.tool()
def demand_forecast(horizon_days: int = 7, lookback_days: int = 28) -> str:
    """Site demand forecast for preposition planning."""
    return json.dumps(
        tool_demand_forecast(horizon_days=horizon_days, lookback_days=lookback_days),
        indent=2,
    )


@mcp.tool()
def rewards_leaderboard(limit: int = 10) -> str:
    """Customer rewards leaderboard."""
    return json.dumps(tool_rewards_leaderboard(limit=limit), indent=2)


@mcp.tool()
def fleet_live(limit: int = 20) -> str:
    """Live Redis fleet telemetry sample."""
    return json.dumps(tool_fleet_live(limit=limit), indent=2)


@mcp.resource("rental-iq://dispatch/desk")
def resource_dispatch_desk() -> str:
    """Current Dispatch Hub desk snapshot as JSON."""
    return json.dumps(tool_dispatch_desk(), indent=2)


@mcp.resource("rental-iq://fleet/utilisation")
def resource_utilisation() -> str:
    """Current fleet utilisation snapshot as JSON."""
    return json.dumps(tool_fleet_utilisation(), indent=2)


@mcp.prompt()
def dispatch_ops_brief() -> str:
    """Prompt template for a Dispatch Hub ops brief."""
    return (
        "Using dispatch_desk and list_overdue_rentals, write a short yard-desk brief: "
        "pending QR checkouts, overdue returns to chase, due today, and assets ready for new QR. "
        "Be concrete with rental IDs and asset codes. Do not invent data."
    )


@mcp.prompt()
def anomaly_risk_brief() -> str:
    """Prompt template for an anomaly risk brief."""
    return (
        "Call scan_anomalies (without notifications unless asked). Summarise top misuse, "
        "unassigned, idle, and underuse findings with asset IDs and recommended next actions."
    )


def run_stdio() -> None:
    mcp.run(transport="stdio")
