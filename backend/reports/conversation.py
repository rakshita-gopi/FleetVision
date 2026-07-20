import json
import re
from typing import Dict, List, Optional, Tuple

from ai_assistant.services import call_ollama

REPORT_TYPES = {
    "overall": ["overall", "executive", "all", "full", "complete", "summary"],
    "vehicle": ["vehicle", "vehicles", "fleet inventory", "truck", "trucks"],
    "driver": ["driver", "drivers", "operator"],
    "trip": ["trip", "trips", "route", "routes", "journey"],
    "fuel": ["fuel", "mileage", "diesel", "petrol", "consumption"],
    "maintenance": ["maintenance", "service", "servicing", "repair"],
    "expense": ["expense", "expenses", "cost", "costs", "spend"],
    "custom": ["custom", "customized", "bespoke", "specific"],
}

FORMATS = {
    "pdf": ["pdf", "document"],
    "json": ["json"],
    "csv": ["csv", "excel", "spreadsheet"],
}

ALL_SECTIONS = ["analytics", "tables", "charts", "history"]
ALL_TABLES = ["vehicles", "drivers", "trips", "fuel", "maintenance", "expenses"]

SYSTEM_PROMPT = (
    "You are FleetVision Report Assistant. Help the user design a fleet report by asking "
    "ONE clarifying question at a time. Be warm, concise, and professional. "
    "When you have enough info, set ready=true and fill config.\n"
    "Return ONLY valid JSON with keys: reply (string), ready (boolean), config (object|null).\n"
    "config fields when ready: report_type, format, lookback_days, sections, custom_tables.\n"
    "report_type one of: overall, vehicle, driver, trip, fuel, maintenance, expense, custom.\n"
    "format one of: pdf, json, csv (default pdf).\n"
    "sections subset of: analytics, tables, charts, history.\n"
)


def _extract_report_type(text: str) -> Optional[str]:
    lower = text.lower()
    for key, aliases in REPORT_TYPES.items():
        if any(a in lower for a in aliases):
            return key
    return None


def _extract_format(text: str) -> Optional[str]:
    lower = text.lower()
    for key, aliases in FORMATS.items():
        if any(re.search(rf"\b{re.escape(a)}\b", lower) for a in aliases):
            return key
    if any(w in lower for w in ["yes", "default", "recommended", "standard", "ok", "sure"]):
        return "pdf"
    return None


def _extract_lookback(text: str) -> Optional[int]:
    lower = text.lower()
    if "month" in lower or "30" in lower:
        return 30
    if "week" in lower or "7" in lower:
        return 7
    if "quarter" in lower or "90" in lower:
        return 90
    if "year" in lower or "365" in lower:
        return 365
    match = re.search(r"(\d+)\s*(?:day|days)", lower)
    if match:
        days = int(match.group(1))
        return max(7, min(365, days))
    match = re.search(r"\b(\d+)\b", lower)
    if match:
        days = int(match.group(1))
        if 7 <= days <= 365:
            return days
    return None


def _extract_sections(text: str) -> Optional[List[str]]:
    lower = text.lower()
    if any(w in lower for w in ["all", "everything", "full", "complete", "yes"]):
        return list(ALL_SECTIONS)
    found = [s for s in ALL_SECTIONS if s in lower]
    if "graph" in lower or "visual" in lower or "chart" in lower:
        if "charts" not in found:
            found.append("charts")
    if "table" in lower and "tables" not in found:
        found.append("tables")
    if "analytic" in lower and "analytics" not in found:
        found.append("analytics")
    return found or None


def _extract_tables(text: str) -> Optional[List[str]]:
    lower = text.lower()
    if any(w in lower for w in ["all", "everything", "full"]):
        return list(ALL_TABLES)
    found = [t for t in ALL_TABLES if t.rstrip("s") in lower or t in lower]
    return found or None


def _merge_state(state: Dict, message: str) -> Dict:
    next_state = dict(state or {})
    if not next_state.get("report_type"):
        rt = _extract_report_type(message)
        if rt:
            next_state["report_type"] = rt
    if not next_state.get("format"):
        fmt = _extract_format(message)
        if fmt:
            next_state["format"] = fmt
    if not next_state.get("lookback_days"):
        days = _extract_lookback(message)
        if days:
            next_state["lookback_days"] = days
    if not next_state.get("sections"):
        sections = _extract_sections(message)
        if sections:
            next_state["sections"] = sections
    if next_state.get("report_type") == "custom" and not next_state.get("custom_tables"):
        tables = _extract_tables(message)
        if tables:
            next_state["custom_tables"] = tables
    return next_state


def _missing_slots(state: Dict) -> Optional[str]:
    if not state.get("report_type"):
        return "report_type"
    if not state.get("format"):
        return "format"
    if not state.get("lookback_days"):
        return "lookback_days"
    if not state.get("sections"):
        return "sections"
    if state.get("report_type") == "custom" and not state.get("custom_tables"):
        return "custom_tables"
    return None


def _question_for(slot: str) -> str:
    questions = {
        "report_type": (
            "Great — what kind of report do you need?\n"
            "• Overall\n• Vehicle\n• Driver\n• Trip\n• Fuel\n• Maintenance\n• Expense\n• Custom"
        ),
        "format": (
            "Which download format would you like?\n"
            "• PDF (recommended)\n• JSON\n• CSV"
        ),
        "lookback_days": (
            "How far back should we look?\n"
            "• 7 days\n• 30 days\n• 90 days\n• or type a custom number of days"
        ),
        "sections": (
            "Which sections should be included?\n"
            "• analytics\n• tables\n• charts\n• history\n"
            "You can say “all” to include everything."
        ),
        "custom_tables": (
            "For your custom report, which data tables should we include?\n"
            "• vehicles\n• drivers\n• trips\n• fuel\n• maintenance\n• expenses\n"
            "Say “all” if you want every table."
        ),
    }
    return questions[slot]


def _build_config(state: Dict) -> Dict:
    return {
        "report_type": state.get("report_type", "overall"),
        "format": state.get("format", "pdf"),
        "lookback_days": int(state.get("lookback_days", 30)),
        "sections": state.get("sections") or list(ALL_SECTIONS),
        "custom_tables": state.get("custom_tables") or [],
    }


def _fallback_turn(message: str, state: Dict) -> Tuple[str, bool, Optional[Dict], Dict]:
    next_state = _merge_state(state, message)
    missing = _missing_slots(next_state)
    if missing:
        return _question_for(missing), False, None, next_state

    config = _build_config(next_state)
    reply = (
        f"Perfect — I'll generate a **{config['report_type']}** report as **{config['format'].upper()}**, "
        f"covering the last **{config['lookback_days']} days**, with sections: "
        f"{', '.join(config['sections'])}.\n\nGenerating your FleetVision report now…"
    )
    return reply, True, config, next_state


def _parse_llm_json(raw: str) -> Optional[Dict]:
    if not raw:
        return None
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                return None
    return None


def process_report_chat(message: str, history: List[Dict], state: Optional[Dict] = None) -> Dict:
    state = dict(state or {})
    transcript = "\n".join(
        f"{m.get('role', 'user')}: {m.get('content', '')}" for m in (history or [])[-12:]
    )
    prompt = (
        f"Current collected preferences: {json.dumps(state)}\n"
        f"Conversation so far:\n{transcript}\n"
        f"user: {message}\n\n"
        "Ask only for missing fields. If everything needed is present, set ready=true "
        "and provide config. Prefer PDF if format is unclear."
    )

    llm_raw = call_ollama(prompt, system_msg=SYSTEM_PROMPT, timeout=20)
    parsed = _parse_llm_json(llm_raw) if llm_raw else None

    if parsed and isinstance(parsed.get("reply"), str):
        next_state = _merge_state(state, message)
        config = parsed.get("config") if parsed.get("ready") else None
        if parsed.get("ready") and isinstance(config, dict):
            # Normalize / fill gaps from local state
            merged = {**_build_config(next_state), **{k: v for k, v in config.items() if v}}
            merged["report_type"] = merged.get("report_type") or next_state.get("report_type") or "overall"
            merged["format"] = (merged.get("format") or "pdf").lower()
            if merged["format"] not in {"pdf", "json", "csv"}:
                merged["format"] = "pdf"
            merged["lookback_days"] = int(merged.get("lookback_days") or 30)
            merged["sections"] = merged.get("sections") or list(ALL_SECTIONS)
            merged["custom_tables"] = merged.get("custom_tables") or []
            next_state.update(
                {
                    "report_type": merged["report_type"],
                    "format": merged["format"],
                    "lookback_days": merged["lookback_days"],
                    "sections": merged["sections"],
                    "custom_tables": merged["custom_tables"],
                }
            )
            return {
                "reply": parsed["reply"],
                "ready": True,
                "config": merged,
                "state": next_state,
            }

        # Not ready — ask next missing slot if LLM didn't ask clearly
        missing = _missing_slots(next_state)
        reply = parsed["reply"]
        if missing and len(reply) < 20:
            reply = _question_for(missing)
        return {
            "reply": reply,
            "ready": False,
            "config": None,
            "state": next_state,
        }

    reply, ready, config, next_state = _fallback_turn(message, state)
    return {"reply": reply, "ready": ready, "config": config, "state": next_state}
