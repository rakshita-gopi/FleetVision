"""
Rental-IQ agent & worker catalog.

AG-UI inspired: agents stream events (RUN_STARTED, THINKING, TOOL_CALL, STATE_DELTA,
TEXT_MESSAGE, INTERRUPT / human-in-the-loop, RUN_FINISHED). Workers are deterministic
tool executors agents can invoke.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone as dt_tz
from typing import Any, Callable
from uuid import uuid4

from anomalies.services import detect_anomalies
from demand.services import build_forecast
from notifications.services import scan_rental_due_alerts
from .services import (
    list_overdue_rentals,
    propose_action,
    run_agent_chat,
    search_equipment,
    utilisation_summary,
)
from .models import ActionProposal


# ---- Catalog (domain design) -------------------------------------------------

AGENTS: list[dict[str, Any]] = [
    {
        "id": "orchestrator",
        "name": "Fleet Orchestrator",
        "role": "Routes intents to specialist agents; keeps shared AG-UI state.",
        "domain": "dashboard",
        "capabilities": ["route", "summarise", "delegate"],
        "status": "idle",
        "color": "#ca8a04",
    },
    {
        "id": "dispatch",
        "name": "Dispatch Agent",
        "role": "Automates checkout/check-in, QR possession, operator assignment.",
        "domain": "dispatch",
        "capabilities": ["checkout", "checkin", "assign_operator", "open_rentals"],
        "status": "idle",
        "color": "#0d9488",
    },
    {
        "id": "demand",
        "name": "Demand Agent",
        "role": "Forecasts site demand and proposes preposition of idle assets.",
        "domain": "demand",
        "capabilities": ["forecast", "preposition", "hotspots"],
        "status": "idle",
        "color": "#2563eb",
    },
    {
        "id": "anomaly",
        "name": "Anomaly Agent",
        "role": "Detects idle, unassigned, underuse, and potential misuse.",
        "domain": "anomalies",
        "capabilities": ["scan_idle", "scan_misuse", "scan_underuse"],
        "status": "idle",
        "color": "#dc2626",
    },
    {
        "id": "alert",
        "name": "Alert Agent",
        "role": "Watches due-soon / due-today / overdue rentals and notifies.",
        "domain": "alerts",
        "capabilities": ["scan_due", "notify", "escalate"],
        "status": "idle",
        "color": "#ea580c",
    },
    {
        "id": "utilisation",
        "name": "Utilisation Agent",
        "role": "Finds idle capacity and proposes reallocation / retain decisions.",
        "domain": "dashboard",
        "capabilities": ["utilisation", "reallocate", "retain"],
        "status": "idle",
        "color": "#7c3aed",
    },
    {
        "id": "maintenance",
        "name": "Maintenance Agent",
        "role": "Flags high-hour assets for inspect / maintain with HITL approval.",
        "domain": "dashboard",
        "capabilities": ["inspect", "maintain"],
        "status": "idle",
        "color": "#64748b",
    },
]

WORKERS: list[dict[str, Any]] = [
    {
        "id": "telemetry_worker",
        "name": "Telemetry Worker",
        "kind": "data",
        "description": "Reads recent telematics samples for fuel/idle signals.",
        "tools": ["search_equipment", "utilisation_summary"],
    },
    {
        "id": "scan_worker",
        "name": "Scan Worker",
        "kind": "job",
        "description": "Runs rental-due and anomaly detection jobs.",
        "tools": ["scan_rental_alerts", "detect_anomalies"],
    },
    {
        "id": "forecast_worker",
        "name": "Forecast Worker",
        "kind": "job",
        "description": "Builds site demand forecasts and shortfall lists.",
        "tools": ["build_forecast"],
    },
    {
        "id": "notification_worker",
        "name": "Notification Worker",
        "kind": "side_effect",
        "description": "Persists Notification rows for the bell / alerts desk.",
        "tools": ["emit_notifications"],
    },
    {
        "id": "proposal_worker",
        "name": "Proposal Worker",
        "kind": "hitl",
        "description": "Creates ActionProposal records awaiting human approve/reject.",
        "tools": ["propose_action"],
    },
    {
        "id": "rental_state_worker",
        "name": "Rental State Worker",
        "kind": "executor",
        "description": "Applies approved return / extend / reallocate mutations.",
        "tools": ["execute_proposal", "list_overdue_rentals"],
    },
]


def catalog() -> dict:
    return {
        "protocol": "ag-ui-inspired",
        "version": "1.0",
        "agents": deepcopy(AGENTS),
        "workers": deepcopy(WORKERS),
        "domains": [
            {"id": "dashboard", "label": "Dashboard", "href": "/agentic"},
            {"id": "dispatch", "label": "Dispatch Hub", "href": "/agentic/dispatch"},
            {"id": "demand", "label": "Demand Forecast", "href": "/agentic/demand"},
            {"id": "anomalies", "label": "Anomaly Desk", "href": "/agentic/anomalies"},
            {"id": "alerts", "label": "Alerts & Notifications", "href": "/agentic/alerts"},
        ],
    }


def _evt(etype: str, **payload) -> dict:
    return {
        "type": etype,
        "id": str(uuid4()),
        "timestamp": datetime.now(dt_tz.utc).isoformat(),
        **payload,
    }


def _route_agent(message: str) -> str:
    lower = message.lower()
    if any(k in lower for k in ("dispatch", "checkout", "check-in", "checkin", "qr", "possess")):
        return "dispatch"
    if any(k in lower for k in ("demand", "forecast", "preposition", "shortfall")):
        return "demand"
    if any(k in lower for k in ("anomaly", "misuse", "idle", "underuse", "unassigned")):
        return "anomaly"
    if any(k in lower for k in ("alert", "overdue", "due soon", "due today", "notify")):
        return "alert"
    if any(k in lower for k in ("maintain", "inspect", "service")):
        return "maintenance"
    if any(k in lower for k in ("util", "realloc", "available")):
        return "utilisation"
    return "orchestrator"


def run_agui_turn(*, user, message: str, session_id: str | None = None, agent_id: str | None = None) -> dict:
    """
    Execute one agent turn and return AG-UI style events + shared state + chat result.
    """
    run_id = str(uuid4())
    events: list[dict] = []
    state: dict[str, Any] = {
        "active_agent": None,
        "active_workers": [],
        "logs": [],
        "tool_results": {},
        "interrupt": None,
    }

    events.append(_evt("RUN_STARTED", run_id=run_id, message=message))
    target = agent_id or _route_agent(message)
    agent_meta = next((a for a in AGENTS if a["id"] == target), AGENTS[0])
    state["active_agent"] = agent_meta["id"]
    events.append(
        _evt(
            "STATE_DELTA",
            run_id=run_id,
            delta={"active_agent": agent_meta["id"], "agent_name": agent_meta["name"]},
        )
    )
    events.append(
        _evt(
            "THINKING",
            run_id=run_id,
            agent_id=agent_meta["id"],
            content=f"Routing to {agent_meta['name']}: {agent_meta['role']}",
        )
    )

    # Domain-specific worker invocations
    workers_used: list[str] = []

    def use_worker(wid: str, tool: str, fn: Callable[[], Any]):
        workers_used.append(wid)
        state["active_workers"] = list(dict.fromkeys(workers_used))
        events.append(_evt("TOOL_CALL_START", run_id=run_id, worker_id=wid, tool=tool, agent_id=agent_meta["id"]))
        try:
            result = fn()
            state["tool_results"][tool] = result if not isinstance(result, (list, dict)) or _small(result) else _shrink(result)
            events.append(
                _evt(
                    "TOOL_CALL_END",
                    run_id=run_id,
                    worker_id=wid,
                    tool=tool,
                    ok=True,
                    summary=_summary(result),
                )
            )
            state["logs"].append({"worker": wid, "tool": tool, "ok": True, "summary": _summary(result)})
            return result
        except Exception as exc:  # noqa: BLE001
            events.append(
                _evt("TOOL_CALL_END", run_id=run_id, worker_id=wid, tool=tool, ok=False, summary=str(exc)[:200])
            )
            state["logs"].append({"worker": wid, "tool": tool, "ok": False, "summary": str(exc)[:200]})
            return None

    if target == "anomaly":
        use_worker("scan_worker", "detect_anomalies", lambda: detect_anomalies(emit_notifications=True))
        use_worker("notification_worker", "emit_notifications", lambda: {"emitted": True})
    elif target == "alert":
        use_worker("scan_worker", "scan_rental_alerts", scan_rental_due_alerts)
        use_worker("telemetry_worker", "list_overdue_rentals", list_overdue_rentals)
    elif target == "demand":
        use_worker("forecast_worker", "build_forecast", lambda: build_forecast(horizon_days=7, lookback_days=28))
    elif target == "dispatch":
        use_worker("rental_state_worker", "list_overdue_rentals", list_overdue_rentals)
        use_worker("telemetry_worker", "utilisation_summary", utilisation_summary)
    elif target in ("utilisation", "maintenance", "orchestrator"):
        use_worker("telemetry_worker", "utilisation_summary", utilisation_summary)
        use_worker("telemetry_worker", "search_equipment", lambda: search_equipment(status="IDLE", limit=8))

    # Shared chat / proposal path (HITL)
    chat = run_agent_chat(user=user, message=message, session_id=session_id)
    proposals = chat.get("proposals") or []
    if proposals:
        use_worker(
            "proposal_worker",
            "propose_action",
            lambda: {"count": len(proposals), "ids": [p.get("id") for p in proposals]},
        )
        state["interrupt"] = {
            "type": "human_in_the_loop",
            "reason": "Action proposals require approve / reject before execution.",
            "proposals": proposals,
        }
        events.append(
            _evt(
                "INTERRUPT",
                run_id=run_id,
                agent_id=agent_meta["id"],
                reason=state["interrupt"]["reason"],
                proposals=proposals,
            )
        )

    events.append(
        _evt(
            "TEXT_MESSAGE_CONTENT",
            run_id=run_id,
            agent_id=agent_meta["id"],
            role="assistant",
            content=chat.get("answer") or "",
        )
    )
    events.append(
        _evt(
            "STATE_DELTA",
            run_id=run_id,
            delta={
                "active_workers": state["active_workers"],
                "logs": state["logs"][-12:],
                "session_id": chat.get("session_id"),
            },
        )
    )
    events.append(_evt("RUN_FINISHED", run_id=run_id, agent_id=agent_meta["id"], session_id=chat.get("session_id")))

    return {
        "run_id": run_id,
        "protocol": "ag-ui-inspired",
        "agent": agent_meta,
        "events": events,
        "state": state,
        "session_id": chat.get("session_id"),
        "answer": chat.get("answer"),
        "tool_trace": chat.get("tool_trace"),
        "proposals": proposals,
    }


def _small(obj: Any) -> bool:
    try:
        import json

        return len(json.dumps(obj, default=str)) < 4000
    except Exception:
        return False


def _shrink(obj: Any) -> Any:
    if isinstance(obj, dict):
        keys = list(obj.keys())[:20]
        out = {k: obj[k] for k in keys if k not in ("anomalies", "forecasts", "notifications")}
        if "anomalies" in obj and isinstance(obj["anomalies"], list):
            out["anomalies_sample"] = obj["anomalies"][:5]
            out["total"] = obj.get("total", len(obj["anomalies"]))
        if "forecasts" in obj and isinstance(obj["forecasts"], list):
            out["forecasts_sample"] = obj["forecasts"][:5]
        if "counts" in obj:
            out["counts"] = obj["counts"]
        if "summary" in obj:
            out["summary"] = obj["summary"]
        return out
    if isinstance(obj, list):
        return obj[:8]
    return obj


def _summary(result: Any) -> str:
    if result is None:
        return "empty"
    if isinstance(result, dict):
        if "total" in result:
            return f"total={result['total']}"
        if "created" in result:
            return f"created={result['created']}"
        if "counts" in result:
            return f"counts={result['counts']}"
        if "summary" in result:
            return str(result["summary"])[:160]
        return f"keys={list(result.keys())[:8]}"
    if isinstance(result, list):
        return f"{len(result)} rows"
    return str(result)[:160]
