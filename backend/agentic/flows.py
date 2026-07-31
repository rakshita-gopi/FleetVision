"""Domain-specific React Flow graphs — each agent gets unique nodes & wiring."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def _n(nid: str, ntype: str, x: float, y: float, title: str, subtitle: str = "", **extra) -> dict:
    return {
        "id": nid,
        "type": ntype,
        "position": {"x": x, "y": y},
        "data": {"title": title, "subtitle": subtitle, **extra},
    }


def _e(eid: str, source: str, target: str, color: str, sh: str = "out-0", th: str = "in-0") -> dict:
    return {
        "id": eid,
        "source": source,
        "target": target,
        "sourceHandle": sh,
        "targetHandle": th,
        "color": color,
    }


FLOW_GRAPHS: dict[str, dict[str, Any]] = {
    "dashboard": {
        "agent_id": "orchestrator",
        "default_prompt": "Summarise fleet utilisation, overdue risk, and top actions across agents.",
        "default_workers": ["telemetry_worker", "scan_worker", "proposal_worker"],
        "nodes": [
            _n("user", "userNode", 40, 80, "Ops brief", "Ask the orchestrator"),
            _n("model", "modelNode", 40, 280, "Model", "Qwen3 · Ollama"),
            _n("util", "toolsNode", 40, 460, "Fleet snapshot", "Utilisation worker"),
            _n("agent", "agentNode", 420, 200, "Fleet Orchestrator", "Routes to specialists"),
            _n("worker", "workerNode", 820, 160, "Action board", "Awaiting run…"),
            _n("hitl", "toolsNode", 820, 420, "HITL queue", "Approve / reject"),
        ],
        "edges": [
            _e("e1", "user", "agent", "#c084fc", "out-0", "in-0"),
            _e("e2", "model", "agent", "#a855f7", "out-0", "in-1"),
            _e("e3", "util", "agent", "#818cf8", "out-0", "in-2"),
            _e("e4", "agent", "worker", "#ec4899", "out-0", "in-0"),
            _e("e5", "agent", "hitl", "#f59e0b", "out-0", "in-0"),
        ],
    },
    "dispatch": {
        "agent_id": "dispatch",
        "default_prompt": "List overdue returns and propose dispatch follow-up check-ins.",
        "default_workers": ["rental_state_worker", "telemetry_worker", "proposal_worker"],
        "nodes": [
            _n("user", "userNode", 30, 40, "Yard desk", "Checkout / return intent"),
            _n("qr", "toolsNode", 30, 220, "QR / possession", "Dispatch Hub tools"),
            _n("model", "modelNode", 30, 400, "Model", "Qwen3 · Ollama"),
            _n("agent", "agentNode", 380, 180, "Dispatch Agent", "Possession & returns"),
            _n("overdue", "toolsNode", 380, 420, "Overdue scan", "Active past due"),
            _n("worker", "workerNode", 760, 200, "Dispatch output", "Awaiting run…"),
        ],
        "edges": [
            _e("e1", "user", "agent", "#0d9488", "out-0", "in-0"),
            _e("e2", "qr", "agent", "#14b8a6", "out-0", "in-1"),
            _e("e3", "model", "agent", "#a855f7", "out-0", "in-2"),
            _e("e4", "overdue", "agent", "#f97316", "out-0", "in-1"),
            _e("e5", "agent", "worker", "#ec4899", "out-0", "in-0"),
        ],
    },
    "demand": {
        "agent_id": "demand",
        "default_prompt": "Run a 7-day demand forecast and highlight sites needing preposition.",
        "default_workers": ["forecast_worker", "proposal_worker"],
        "nodes": [
            _n("user", "userNode", 40, 60, "Planner", "Demand question"),
            _n("history", "toolsNode", 40, 260, "Site demand history", "CSV / DB lookback"),
            _n("model", "modelNode", 40, 440, "Model", "Qwen3 · Ollama"),
            _n("agent", "agentNode", 400, 200, "Demand Agent", "Forecast + preposition"),
            _n("forecast", "toolsNode", 400, 420, "Forecast worker", "Moving average"),
            _n("worker", "workerNode", 780, 220, "Preposition plan", "Awaiting run…"),
        ],
        "edges": [
            _e("e1", "user", "agent", "#2563eb", "out-0", "in-0"),
            _e("e2", "history", "forecast", "#3b82f6", "out-0", "in-0"),
            _e("e3", "forecast", "agent", "#60a5fa", "out-0", "in-1"),
            _e("e4", "model", "agent", "#a855f7", "out-0", "in-2"),
            _e("e5", "agent", "worker", "#ec4899", "out-0", "in-0"),
        ],
    },
    "anomalies": {
        "agent_id": "anomaly",
        "default_prompt": "Scan for misuse, long idle, unassigned, and underuse anomalies.",
        "default_workers": ["scan_worker", "notification_worker", "proposal_worker"],
        "nodes": [
            _n("user", "userNode", 20, 40, "Risk desk", "What to scan"),
            _n("telem", "toolsNode", 20, 200, "Telemetry 7d", "Fuel · idle ratio"),
            _n("rules", "toolsNode", 20, 360, "Z-score rules", "Thresholds"),
            _n("model", "modelNode", 20, 520, "Model", "Qwen brief"),
            _n("agent", "agentNode", 380, 240, "Anomaly Agent", "Misuse / idle / underuse"),
            _n("notify", "toolsNode", 700, 80, "Notify worker", "Bell alerts"),
            _n("worker", "workerNode", 700, 280, "Findings", "Awaiting run…"),
        ],
        "edges": [
            _e("e1", "user", "agent", "#dc2626", "out-0", "in-0"),
            _e("e2", "telem", "agent", "#f87171", "out-0", "in-1"),
            _e("e3", "rules", "agent", "#fb7185", "out-0", "in-1"),
            _e("e4", "model", "agent", "#a855f7", "out-0", "in-2"),
            _e("e5", "agent", "notify", "#ea580c", "out-0", "in-0"),
            _e("e6", "agent", "worker", "#ec4899", "out-0", "in-0"),
        ],
    },
    "alerts": {
        "agent_id": "alert",
        "default_prompt": "Scan due-soon / overdue rentals and escalate critical alerts.",
        "default_workers": ["scan_worker", "notification_worker", "rental_state_worker"],
        "nodes": [
            _n("user", "userNode", 40, 80, "Alert desk", "Due / overdue intent"),
            _n("calendar", "toolsNode", 40, 280, "Return calendar", "Due soon window"),
            _n("model", "modelNode", 40, 460, "Model", "Qwen3 · Ollama"),
            _n("agent", "agentNode", 400, 200, "Alert Agent", "Notify & escalate"),
            _n("bell", "toolsNode", 760, 80, "Notification worker", "In-app bell"),
            _n("worker", "workerNode", 760, 280, "Alert summary", "Awaiting run…"),
        ],
        "edges": [
            _e("e1", "user", "agent", "#ea580c", "out-0", "in-0"),
            _e("e2", "calendar", "agent", "#fb923c", "out-0", "in-1"),
            _e("e3", "model", "agent", "#a855f7", "out-0", "in-2"),
            _e("e4", "agent", "bell", "#f59e0b", "out-0", "in-0"),
            _e("e5", "agent", "worker", "#ec4899", "out-0", "in-0"),
        ],
    },
}


def flow_for_domain(domain: str) -> dict:
    graph = FLOW_GRAPHS.get(domain) or FLOW_GRAPHS["dashboard"]
    return deepcopy(graph)
