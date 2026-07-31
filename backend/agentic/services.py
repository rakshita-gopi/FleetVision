from datetime import date, timedelta
from typing import Any

from django.db.models import Avg, Count, Q
from django.utils import timezone

from common.lookup import get_by_uuid_or_code, is_uuid
from ai_assistant.services import call_ollama
from equipment.models import Equipment, EquipmentStatus
from rentals.models import Rental, RentalStatus
from .models import ActionProposal, AgentMessage, AgentSession


def search_equipment(query: str = "", status: str | None = None, limit: int = 20) -> list[dict]:
    qs = Equipment.objects.select_related("model_ref", "current_site").all()
    if status:
        qs = qs.filter(current_status=status.upper())
    if query:
        qs = qs.filter(
            Q(asset_id__icontains=query)
            | Q(serial_number__icontains=query)
            | Q(model_ref__model__icontains=query)
            | Q(model_ref__category__icontains=query)
        )
    rows = []
    for eq in qs[:limit]:
        rows.append(
            {
                "id": str(eq.id),
                "asset_id": eq.asset_id,
                "status": eq.current_status,
                "model": eq.model_ref.model if eq.model_ref else "",
                "category": eq.model_ref.category if eq.model_ref else "",
                "site": eq.current_site.site_id if eq.current_site else None,
                "engine_hours": eq.total_engine_hours,
            }
        )
    return rows


def list_overdue_rentals(limit: int = 20) -> list[dict]:
    today = date.today()
    qs = (
        Rental.objects.select_related("equipment", "site", "operator")
        .filter(
            rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE],
            expected_return_date__lt=today,
            actual_return_date__isnull=True,
        )
        .order_by("expected_return_date")[:limit]
    )
    return [
        {
            "rental_id": r.rental_id,
            "id": str(r.id),
            "asset_id": r.equipment.asset_id,
            "site_id": r.site.site_id if r.site else None,
            "operator_id": r.operator.operator_id if r.operator else None,
            "customer_name": r.customer_name or "",
            "expected_return_date": str(r.expected_return_date),
            "days_overdue": (today - r.expected_return_date).days if r.expected_return_date else 0,
        }
        for r in qs
    ]


def utilisation_summary() -> dict[str, Any]:
    status_counts = dict(
        Equipment.objects.values("current_status").annotate(c=Count("id")).values_list("current_status", "c")
    )
    avg_hours = Equipment.objects.aggregate(avg=Avg("total_engine_hours"))["avg"] or 0
    idle = status_counts.get(EquipmentStatus.IDLE, 0)
    available = status_counts.get(EquipmentStatus.AVAILABLE, 0)
    active = status_counts.get(EquipmentStatus.ACTIVE, 0)
    total = sum(status_counts.values()) or 1
    return {
        "status_counts": status_counts,
        "avg_engine_hours": round(float(avg_hours), 1),
        "utilisation_pct": round(100 * active / total, 1),
        "idle_count": idle,
        "available_count": available,
        "active_count": active,
        "overdue_rentals": len(list_overdue_rentals(limit=500)),
        "underutilised_hint": idle + available,
    }


def propose_action(
    *,
    user,
    session: AgentSession | None,
    action_type: str,
    rationale: str,
    asset_id: str | None = None,
    rental_id: str | None = None,
    payload: dict | None = None,
) -> ActionProposal:
    equipment = None
    rental = None
    if asset_id:
        equipment = get_by_uuid_or_code(Equipment, str(asset_id).strip(), "asset_id")
        if equipment is None:
            # Final fallback — never pass asset codes into UUID FK fields
            equipment = Equipment.objects.filter(asset_id__iexact=str(asset_id).strip()).first()
    if rental_id:
        rental = get_by_uuid_or_code(Rental, str(rental_id).strip(), "rental_id")
        if rental is None:
            rental = Rental.objects.filter(rental_id__iexact=str(rental_id).strip()).first()
        if rental and not equipment:
            equipment = rental.equipment
    return ActionProposal.objects.create(
        session=session,
        action_type=action_type,
        equipment=equipment,
        rental=rental,
        rationale=rationale,
        payload=payload or {},
        status=ActionProposal.Status.PENDING,
        created_by=user,
    )


def execute_proposal(proposal: ActionProposal) -> str:
    """Apply a human-approved action to equipment/rental state."""
    eq = proposal.equipment
    rental = proposal.rental
    action = proposal.action_type

    if action == ActionProposal.ActionType.RETURN and rental and not rental.actual_return_date:
        rental.actual_return_date = date.today()
        rental.rental_status = RentalStatus.COMPLETED
        if rental.check_out_date:
            rental.rental_days = (rental.actual_return_date - rental.check_out_date).days or 1
        rental.save()
        if eq:
            eq.current_status = EquipmentStatus.AVAILABLE
            eq.current_site = None
            eq.current_operator = None
            eq.save()
        return f"Returned {eq.asset_id if eq else rental.rental_id}"

    if action == ActionProposal.ActionType.MAINTAIN and eq:
        eq.current_status = EquipmentStatus.MAINTENANCE
        eq.save()
        return f"Flagged {eq.asset_id} for maintenance"

    if action == ActionProposal.ActionType.INSPECT and eq:
        payload = dict(proposal.payload or {})
        payload["inspect_requested"] = True
        payload["inspect_at"] = timezone.now().isoformat()
        proposal.payload = payload
        proposal.save(update_fields=["payload"])
        return f"Inspection flagged for {eq.asset_id}"

    if action == ActionProposal.ActionType.EXTEND and rental:
        days = int((proposal.payload or {}).get("days") or 7)
        if rental.expected_return_date:
            rental.expected_return_date = rental.expected_return_date + timedelta(days=days)
        else:
            rental.expected_return_date = date.today() + timedelta(days=days)
        rental.save()
        return f"Extended {rental.rental_id} by {days} days"

    if action == ActionProposal.ActionType.REALLOCATE and eq:
        site_id = (proposal.payload or {}).get("site_id")
        if site_id:
            from sites.models import Site

            site = get_by_uuid_or_code(Site, site_id, "site_id")
            if site:
                eq.current_site = site
                eq.current_status = EquipmentStatus.ACTIVE
                eq.save()
                return f"Reallocated {eq.asset_id} to {site.site_id}"
        return f"Reallocate recorded for {eq.asset_id} (no site change)"

    if action == ActionProposal.ActionType.RETAIN and eq:
        return f"Retain decision recorded for {eq.asset_id}"

    return f"Action {action} recorded"


def _rule_based_reply(
    message: str,
    session: AgentSession,
    user,
    *,
    agent_id: str | None = None,
) -> tuple[str, list, list]:
    """Deterministic offline agent: tool results + optional ActionProposal."""
    lower = message.lower()
    tools: list[dict] = []
    proposals: list[ActionProposal] = []

    # Prefer domain agent intent over keyword collisions (e.g. "underuse" matching "under")
    if agent_id == "anomaly" or any(
        k in lower for k in ("anomaly", "misuse", "unassigned", "underuse", "long idle")
    ):
        from anomalies.services import detect_anomalies

        scan = detect_anomalies(emit_notifications=False)
        tools.append({"tool": "detect_anomalies", "result_count": scan.get("total", 0)})
        text = (
            f"Anomaly scan found {scan.get('total', 0)} signal(s). "
            f"Breakdown: {scan.get('counts') or {}}."
        )
        narrative = (scan.get("narrative") or {}).get("text")
        if narrative:
            text = narrative
        top = (scan.get("anomalies") or [])[:1]
        if top:
            a = top[0]
            prop = propose_action(
                user=user,
                session=session,
                action_type=ActionProposal.ActionType.INSPECT,
                rationale=a.get("detail") or a.get("title") or "Review anomaly finding.",
                asset_id=a.get("asset_id"),
                rental_id=a.get("rental_id"),
                payload={"kind": a.get("kind"), "score": a.get("score")},
            )
            proposals.append(prop)
            text += f"\n\nProposed: **inspect** `{a.get('asset_id')}` (proposal {prop.id})."
        return text, tools, proposals

    overdue = list_overdue_rentals()
    util = utilisation_summary()
    tools.append({"tool": "list_overdue_rentals", "result_count": len(overdue)})
    tools.append({"tool": "utilisation_summary", "result": util})

    if agent_id == "alert" or any(k in lower for k in ("overdue", "late", "return", "due soon", "due today")):
        if overdue:
            lines = [f"- {o['rental_id']} ({o['asset_id']}) overdue {o['days_overdue']}d" for o in overdue[:8]]
            text = "Overdue rentals:\n" + "\n".join(lines)
            first = overdue[0]
            prop = propose_action(
                user=user,
                session=session,
                action_type=ActionProposal.ActionType.RETURN,
                rationale=f"Rental {first['rental_id']} is {first['days_overdue']} days overdue.",
                asset_id=first["asset_id"],
                rental_id=first["rental_id"],
            )
            proposals.append(prop)
            text += f"\n\nProposed action: **return** `{first['asset_id']}` (proposal {prop.id}). Approve or reject in the panel."
        else:
            text = "No overdue rentals right now."
        return text, tools, proposals

    if agent_id in ("utilisation", "orchestrator", "dispatch") or any(
        k in lower for k in ("util", "idle", "available", "realloc")
    ):
        text = (
            f"Fleet utilisation ~{util['utilisation_pct']}% "
            f"(active={util['active_count']}, available={util['available_count']}, idle={util['idle_count']}). "
            f"Avg engine hours: {util['avg_engine_hours']}."
        )
        idle_eq = search_equipment(status="IDLE", limit=5)
        tools.append({"tool": "search_equipment", "status": "IDLE", "result_count": len(idle_eq)})
        if idle_eq:
            eq = idle_eq[0]
            prop = propose_action(
                user=user,
                session=session,
                action_type=ActionProposal.ActionType.REALLOCATE,
                rationale=f"{eq['asset_id']} is idle and could be reallocated.",
                asset_id=eq["asset_id"],
                payload={"suggested": True},
            )
            proposals.append(prop)
            text += f"\n\nProposed: **reallocate** `{eq['asset_id']}` (proposal {prop.id})."
        return text, tools, proposals

    if agent_id == "maintenance" or any(k in lower for k in ("maintain", "inspect", "service", "fault")):
        maint = search_equipment(status="MAINTENANCE", limit=5)
        high_hours = list(
            Equipment.objects.order_by("-total_engine_hours").select_related("model_ref")[:5]
        )
        tools.append({"tool": "search_equipment", "status": "MAINTENANCE", "result_count": len(maint)})
        target = high_hours[0] if high_hours else None
        text = f"{len(maint)} assets currently in maintenance."
        if target:
            prop = propose_action(
                user=user,
                session=session,
                action_type=ActionProposal.ActionType.INSPECT,
                rationale=f"{target.asset_id} has high engine hours ({target.total_engine_hours}).",
                asset_id=target.asset_id,
            )
            proposals.append(prop)
            text += f" Proposed: **inspect** `{target.asset_id}` (proposal {prop.id})."
        return text, tools, proposals

    if any(k in lower for k in ("search", "find", "equipment", "excavator", "loader", "eqx")):
        # extract token that looks like asset id
        token = ""
        for part in message.replace(",", " ").split():
            if part.upper().startswith("EQX") or part.upper().startswith("MOD"):
                token = part.upper()
                break
        results = search_equipment(query=token or message.split()[-1], limit=10)
        tools.append({"tool": "search_equipment", "query": token or message, "result_count": len(results)})
        if not results:
            return "No matching equipment found.", tools, proposals
        lines = [f"- {r['asset_id']} {r['model']} ({r['category']}) — {r['status']}" for r in results[:10]]
        return "Equipment matches:\n" + "\n".join(lines), tools, proposals

    # default brief
    text = (
        f"Rental-IQ snapshot: {util['active_count']} active, {util['available_count']} available, "
        f"{util['idle_count']} idle, {util['overdue_rentals']} overdue rentals. "
        "Ask about overdue returns, utilisation, maintenance, or search an asset like EQX0001."
    )
    return text, tools, proposals


def run_agent_chat(
    *,
    user,
    message: str,
    session_id: str | None = None,
    agent_id: str | None = None,
    forced_answer: str | None = None,
) -> dict:
    if session_id and is_uuid(session_id):
        session = AgentSession.objects.filter(id=session_id, user=user).first()
        if not session:
            session = AgentSession.objects.create(user=user, title=message[:60])
    else:
        session = AgentSession.objects.create(user=user, title=message[:60] or "Agentic session")

    AgentMessage.objects.create(session=session, role=AgentMessage.Role.USER, content=message)

    if forced_answer:
        reply, tools, proposals = forced_answer, [], []
    else:
        # Prefer deterministic tools; optionally enrich with LLM prose
        reply, tools, proposals = _rule_based_reply(message, session, user, agent_id=agent_id)

    if not forced_answer:
        system = (
            "You are Rental-IQ Agentic Mode. Be concise. Do not invent asset IDs. "
            "Human approval is required before actions execute."
        )
        llm = call_ollama(
            f"User asked: {message}\n\nTool facts:\n{reply}\n\nRewrite a short helpful answer (keep proposal IDs).",
            system_msg=system,
            timeout=12,
        )
        final = llm.strip() if llm else reply
    else:
        final = reply

    AgentMessage.objects.create(
        session=session,
        role=AgentMessage.Role.ASSISTANT,
        content=final,
        tool_trace=tools,
    )
    session.save(update_fields=["updated_at"])

    from .serializers import ActionProposalSerializer

    return {
        "session_id": str(session.id),
        "answer": final,
        "tool_trace": tools,
        "proposals": ActionProposalSerializer(proposals, many=True).data,
    }
