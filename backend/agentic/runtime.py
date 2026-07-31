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
from .schemas import enrich_agents, enrich_workers
from .flows import flow_for_domain


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


def catalog(domain: str | None = None) -> dict:
    data = {
        "protocol": "ag-ui-inspired",
        "version": "1.2",
        "agents": enrich_agents(AGENTS),
        "workers": enrich_workers(WORKERS),
        "domains": [
            {"id": "dashboard", "label": "Dashboard", "href": "/agentic"},
            {"id": "dispatch", "label": "Dispatch Hub", "href": "/agentic/dispatch"},
            {"id": "demand", "label": "Demand Forecast", "href": "/agentic/demand"},
            {"id": "anomalies", "label": "Anomaly Desk", "href": "/agentic/anomalies"},
            {"id": "alerts", "label": "Alerts & Notifications", "href": "/agentic/alerts"},
        ],
    }
    if domain:
        data["flow"] = flow_for_domain(domain)
    return data



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


def run_agui_turn(
    *,
    user,
    message: str,
    session_id: str | None = None,
    agent_id: str | None = None,
    config: dict | None = None,
) -> dict:
    """
    Execute one agent turn and return AG-UI style events + shared state + chat result.
    `config` carries per-agent / model parameters from the flow canvas.
    """
    run_id = str(uuid4())
    cfg = config or {}
    agent_cfg = cfg.get("agent") or {}
    events: list[dict] = []
    state: dict[str, Any] = {
        "active_agent": None,
        "active_workers": [],
        "logs": [],
        "tool_results": {},
        "interrupt": None,
        "config": cfg,
    }

    events.append(_evt("RUN_STARTED", run_id=run_id, message=message, config=cfg))
    target = agent_id or _route_agent(message)
    agent_meta = next((a for a in AGENTS if a["id"] == target), AGENTS[0])
    state["active_agent"] = agent_meta["id"]
    events.append(
        _evt(
            "STATE_DELTA",
            run_id=run_id,
            delta={
                "active_agent": agent_meta["id"],
                "agent_name": agent_meta["name"],
                "agent_config": agent_cfg,
            },
        )
    )
    events.append(
        _evt(
            "THINKING",
            run_id=run_id,
            agent_id=agent_meta["id"],
            content=(
                f"Routing to {agent_meta['name']} with config keys={list(agent_cfg.keys()) or 'defaults'}. "
                f"{agent_meta['role']}"
            ),
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
        notify = bool(agent_cfg.get("notify", True))
        use_worker(
            "scan_worker",
            "detect_anomalies",
            lambda: detect_anomalies(emit_notifications=notify),
        )
        if notify:
            use_worker("notification_worker", "emit_notifications", lambda: {"emitted": True, "top_n": agent_cfg.get("top_n", 30)})
    elif target == "alert":
        due_soon = int(agent_cfg.get("due_soon_days") or 3)
        use_worker("scan_worker", "scan_rental_alerts", lambda: scan_rental_due_alerts(due_soon_days=due_soon))
        use_worker("telemetry_worker", "list_overdue_rentals", list_overdue_rentals)
    elif target == "demand":
        horizon = int(agent_cfg.get("horizon_days") or 7)
        lookback = int(agent_cfg.get("lookback_days") or 28)
        use_worker(
            "forecast_worker",
            "build_forecast",
            lambda: build_forecast(horizon_days=horizon, lookback_days=lookback),
        )
    elif target == "dispatch":
        use_worker("rental_state_worker", "list_overdue_rentals", list_overdue_rentals)
        use_worker("telemetry_worker", "utilisation_summary", utilisation_summary)
    elif target in ("utilisation", "maintenance", "orchestrator"):
        use_worker("telemetry_worker", "utilisation_summary", utilisation_summary)
        status = "IDLE"
        idle_statuses = agent_cfg.get("idle_status") or ["IDLE"]
        if isinstance(idle_statuses, list) and idle_statuses:
            status = str(idle_statuses[0])
        batch = int(agent_cfg.get("batch_size") or 8)
        use_worker("telemetry_worker", "search_equipment", lambda: search_equipment(status=status, limit=batch))

    # Enrich message with config so rule/LLM reply reflects settings
    enriched = message
    if agent_cfg:
        enriched = f"{message}\n\n[agent_config={agent_cfg}]"

    report = build_run_report(target, state["tool_results"])
    chat = run_agent_chat(
        user=user,
        message=enriched,
        session_id=session_id,
        agent_id=target,
        forced_answer=report or None,
    )
    # Prefer ops report built from worker tools over generic chat routing
    answer = report or chat.get("answer") or "Run complete."
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
            content=answer,
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
        "answer": answer,
        "report": answer,
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
    """Short human-readable tool summary (not raw key dumps)."""
    if result is None:
        return "No result"
    if isinstance(result, dict):
        if "emitted" in result:
            return "Notifications queued" if result.get("emitted") else "Notifications skipped"
        if result.get("total") is not None and "counts" in result:
            counts = result.get("counts") or {}
            parts = [f"{k.replace('_', ' ')} {v}" for k, v in counts.items()]
            base = f"{result['total']} anomal{'y' if result['total'] == 1 else 'ies'} found"
            return f"{base}" + (f" ({', '.join(parts)})" if parts else "")
        if "buckets" in result or ("due_soon" in result and "overdue" in result):
            buckets = result.get("buckets") or {
                k: result.get(k, 0) for k in ("due_soon", "due_today", "overdue") if k in result
            }
            return (
                f"Due soon {buckets.get('due_soon', 0)}, "
                f"due today {buckets.get('due_today', 0)}, "
                f"overdue {buckets.get('overdue', 0)}"
            )
        if "created" in result:
            return f"Created {result['created']} alert(s)"
        if "utilisation_pct" in result:
            return (
                f"Utilisation {result.get('utilisation_pct')}% · "
                f"{result.get('active_count', 0)} active · {result.get('idle_count', 0)} idle"
            )
        if "forecasts" in result or "forecasts_sample" in result:
            n = len(result.get("forecasts") or result.get("forecasts_sample") or [])
            return f"Forecast ready for {n} site(s)"
        if "summary" in result:
            return str(result["summary"])[:160]
        if "count" in result:
            return f"{result['count']} proposal(s)"
        return "Completed"
    if isinstance(result, list):
        if not result:
            return "None found"
        return f"Found {len(result)} item(s)"
    return str(result)[:160]


def build_run_report(agent_id: str, tool_results: dict[str, Any]) -> str:
    """Turn worker tool payloads into a readable ops brief for the UI dialog."""
    if agent_id == "anomaly":
        data = tool_results.get("detect_anomalies")
        if not data:
            return "Anomaly scan did not finish. Please run the flow again."
        total = int(data.get("total") or 0)
        counts = data.get("counts") or {}
        lines = [
            f"Anomaly Desk scan complete — {total} finding{'s' if total != 1 else ''}."
        ]
        if counts:
            pretty = ", ".join(f"{k.replace('_', ' ')}: {v}" for k, v in counts.items())
            lines.append(f"Breakdown: {pretty}.")
        notified = data.get("notifications_created")
        if notified:
            lines.append(f"{notified} alert(s) were added to Alerts & Notify.")
        narrative = (data.get("narrative") or {}).get("text")
        sample = data.get("anomalies") or data.get("anomalies_sample") or []
        if narrative:
            lines.append("")
            lines.append(str(narrative).strip())
        elif sample:
            lines.append("")
            lines.append("Top findings:")
            for a in sample[:8]:
                kind = (a.get("kind") or "signal").replace("_", " ")
                title = a.get("title") or a.get("asset_id") or "Finding"
                detail = a.get("detail") or ""
                lines.append(f"• [{kind}] {title} — {detail}")
        elif total == 0:
            lines.append("No misuse, idle, unassigned, or underuse signals right now.")
        return "\n".join(lines)

    if agent_id == "alert":
        alerts = tool_results.get("scan_rental_alerts") or {}
        overdue = tool_results.get("list_overdue_rentals") or []
        buckets = alerts.get("buckets") or {}
        created = alerts.get("created")
        if isinstance(created, list):
            created_n = len(created)
        else:
            created_n = int(created or 0)

        # Prefer live desk counts when the scan only reports newly created alerts (deduped runs look empty)
        from datetime import date, timedelta
        from rentals.models import Rental, RentalStatus

        today = date.today()
        open_qs = Rental.objects.filter(
            rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE],
            actual_return_date__isnull=True,
            expected_return_date__isnull=False,
        )
        live_overdue = open_qs.filter(expected_return_date__lt=today).count()
        live_today = open_qs.filter(expected_return_date=today).count()
        live_soon = open_qs.filter(
            expected_return_date__gt=today,
            expected_return_date__lte=today + timedelta(days=3),
        ).count()

        lines = [
            "Alert scan complete.",
            (
                f"Desk now: due soon {live_soon}, due today {live_today}, overdue {live_overdue}."
            ),
        ]
        if created_n:
            lines.append(f"{created_n} new notification(s) were created for the desk.")
        elif buckets:
            lines.append(
                f"Scan buckets (new only): soon {buckets.get('due_soon', 0)}, "
                f"today {buckets.get('due_today', 0)}, overdue {buckets.get('overdue', 0)}."
            )
        if isinstance(overdue, list) and overdue:
            lines.append("")
            lines.append(f"{len(overdue)} overdue rental(s) need follow-up:")
            for o in overdue[:8]:
                lines.append(
                    f"• {o.get('rental_id')} ({o.get('asset_id')}) — "
                    f"{o.get('days_overdue')} day(s) past due"
                    + (f" · {o.get('customer_name')}" if o.get("customer_name") else "")
                )
        elif live_soon or live_today:
            lines.append("")
            lines.append("No overdue items — focus on due-today / due-soon returns on Alerts & Notify.")
        else:
            lines.append("No overdue rentals right now.")
        return "\n".join(lines)

    if agent_id == "demand":
        data = tool_results.get("build_forecast") or {}
        forecasts = data.get("forecasts") or data.get("forecasts_sample") or []
        shortfalls = data.get("shortfalls") or data.get("hotspots") or []
        lines = ["Demand forecast run complete."]
        if forecasts:
            lines.append(f"Generated outlook for {len(forecasts)} site(s).")
        if shortfalls:
            lines.append("")
            lines.append("Sites that may need preposition:")
            for s in shortfalls[:8]:
                if isinstance(s, dict):
                    lines.append(
                        f"• {s.get('site_id') or s.get('site_name')}: "
                        f"{s.get('message') or s.get('shortfall') or 'shortfall risk'}"
                    )
                else:
                    lines.append(f"• {s}")
        elif not forecasts:
            lines.append("No forecast rows returned — seed site demand if the table is empty.")
        else:
            lines.append("No critical shortfalls in this window.")
        return "\n".join(lines)

    if agent_id == "dispatch":
        overdue = tool_results.get("list_overdue_rentals") or []
        util = tool_results.get("utilisation_summary") or {}
        lines: list[str] = []
        if isinstance(overdue, list) and overdue:
            lines.append(f"Dispatch desk: {len(overdue)} overdue rental(s) need check-in follow-up.")
            for o in overdue[:8]:
                who = o.get("customer_name") or o.get("site_id") or "yard"
                lines.append(
                    f"• {o.get('rental_id')} ({o.get('asset_id')}) — "
                    f"{o.get('days_overdue')} day(s) overdue · {who}"
                )
        else:
            lines.append("No overdue rentals in this window — check due-soon and active contracts next.")
        if util:
            lines.append("")
            lines.append(
                f"Fleet snapshot: {util.get('utilisation_pct')}% utilisation "
                f"({util.get('active_count', 0)} active, "
                f"{util.get('available_count', 0)} available, "
                f"{util.get('idle_count', 0)} idle)."
            )
        return "\n".join(lines)

    util = tool_results.get("utilisation_summary") or {}
    equip = tool_results.get("search_equipment") or []
    lines = []
    if util:
        lines.append(
            f"Fleet utilisation is about {util.get('utilisation_pct')}% "
            f"with {util.get('active_count', 0)} active, "
            f"{util.get('available_count', 0)} available, and "
            f"{util.get('idle_count', 0)} idle assets "
            f"({util.get('overdue_rentals', 0)} overdue rentals)."
        )
    if isinstance(equip, list) and equip:
        lines.append("")
        lines.append(f"Sample of {len(equip)} matching asset(s):")
        for e in equip[:8]:
            if isinstance(e, dict):
                lines.append(
                    f"• {e.get('asset_id')} — {e.get('model') or e.get('category') or 'equipment'} "
                    f"({e.get('status')})"
                )
    if lines:
        return "\n".join(lines)
    return ""
