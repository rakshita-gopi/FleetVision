from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from statistics import mean, pstdev

from django.db.models import Q
from django.utils import timezone

from common.lookup import is_uuid
from ai_assistant.services import call_ollama
from equipment.models import Equipment, EquipmentStatus
from notifications.models import Notification, NotificationSeverity, NotificationType
from rentals.models import Rental, RentalStatus
from telemetry.models import VehicleTelemetry
from usage_logging.services import rental_usage_row


KIND_TO_TYPE = {
    "long_idle": NotificationType.ANOMALY_IDLE,
    "unassigned": NotificationType.ANOMALY_UNASSIGNED,
    "underuse": NotificationType.ANOMALY_UNDERUSE,
    "potential_misuse": NotificationType.ANOMALY_MISUSE,
}

KIND_TO_SEVERITY = {
    "critical": NotificationSeverity.CRITICAL,
    "warning": NotificationSeverity.WARNING,
    "info": NotificationSeverity.INFO,
}


def _dedupe(asset_id: str, ntype: str, hours: int = 18) -> bool:
    cutoff = timezone.now() - timedelta(hours=hours)
    return Notification.objects.filter(
        related_asset_id=asset_id,
        notification_type=ntype,
        created_at__gte=cutoff,
    ).exists()


def _emit(anomalies: list[dict], *, limit: int = 30) -> int:
    created = 0
    for item in anomalies[:limit]:
        ntype = KIND_TO_TYPE.get(item["kind"])
        if not ntype:
            continue
        asset_id = item["asset_id"]
        if _dedupe(asset_id, ntype):
            continue
        Notification.objects.create(
            title=item["title"],
            message=item["detail"],
            notification_type=ntype,
            severity=KIND_TO_SEVERITY.get(item["severity"], NotificationSeverity.WARNING),
            related_asset_id=asset_id,
            related_rental_id=item.get("rental_id") or "",
            metadata=item.get("signals") or {},
        )
        created += 1
    return created


def detect_anomalies(*, emit_notifications: bool = True) -> dict:
    """
    Statistical + rule anomaly detection over equipment/rentals/telemetry.
    Categories: unassigned, long_idle, underuse, potential_misuse.
    Optional Qwen narrative when Ollama is available.
    """
    now = timezone.now()
    lookback = now - timedelta(days=7)
    anomalies: list[dict] = []

    fuel_drops: dict[str, list[float]] = defaultdict(list)
    idle_ratios: dict[str, list[float]] = defaultdict(list)

    recent_ids = list(
        VehicleTelemetry.objects.filter(time__gte=lookback)
        .values_list("vehicle_id", flat=True)
        .distinct()[:200]
    )
    for vid in recent_ids:
        if not is_uuid(vid):
            continue
        try:
            qs = VehicleTelemetry.objects.filter(vehicle_id=vid, time__gte=lookback).order_by("time")
        except Exception:
            continue
        fuels = list(qs.exclude(fuel_level__isnull=True).values_list("fuel_level", flat=True)[:500])
        if len(fuels) >= 4:
            drop = max(0.0, float(fuels[0]) - float(fuels[-1]))
            fuel_drops[str(vid)].append(drop)
        points = qs.count()
        if points:
            idle_n = qs.filter(Q(speed__lte=1) | Q(speed__isnull=True)).count()
            idle_ratios[str(vid)].append(idle_n / points)

    all_drops = [d for vals in fuel_drops.values() for d in vals]
    all_idle = [d for vals in idle_ratios.values() for d in vals]
    drop_mean = mean(all_drops) if all_drops else 0
    drop_std = pstdev(all_drops) if len(all_drops) > 1 else 0
    idle_mean = mean(all_idle) if all_idle else 0
    idle_std = pstdev(all_idle) if len(all_idle) > 1 else 0

    drop_thresh = max(25.0, drop_mean + 1.5 * drop_std) if all_drops else 30.0
    idle_thresh = max(0.75, idle_mean + 1.25 * idle_std) if all_idle else 0.8

    for eq in Equipment.objects.filter(
        current_status__in=[EquipmentStatus.AVAILABLE, EquipmentStatus.IDLE, EquipmentStatus.ACTIVE]
    ).select_related("model_ref", "current_operator", "current_site")[:300]:
        vid = str(eq.id)

        if eq.current_status == EquipmentStatus.ACTIVE and not eq.current_operator_id:
            anomalies.append(
                {
                    "kind": "unassigned",
                    "severity": "warning",
                    "asset_id": eq.asset_id,
                    "equipment_id": vid,
                    "title": f"Unassigned while active: {eq.asset_id}",
                    "detail": "Asset marked ACTIVE without an operator — possession / accountability gap.",
                    "score": 70,
                    "signals": {
                        "status": eq.current_status,
                        "site": eq.current_site.site_id if eq.current_site else None,
                    },
                }
            )
        elif eq.current_status == EquipmentStatus.IDLE and not eq.current_site_id:
            anomalies.append(
                {
                    "kind": "unassigned",
                    "severity": "info",
                    "asset_id": eq.asset_id,
                    "equipment_id": vid,
                    "title": f"Idle with no site: {eq.asset_id}",
                    "detail": "Idle asset has no current site — hard to preposition or audit.",
                    "score": 45,
                    "signals": {"status": eq.current_status},
                }
            )

        if eq.current_status == EquipmentStatus.IDLE:
            anomalies.append(
                {
                    "kind": "long_idle",
                    "severity": "warning",
                    "asset_id": eq.asset_id,
                    "equipment_id": vid,
                    "title": f"Long idle status: {eq.asset_id}",
                    "detail": (
                        f"{eq.model_ref.category if eq.model_ref else 'Asset'} sitting IDLE — "
                        "underuse / yard drag risk."
                    ),
                    "score": 52,
                    "signals": {
                        "status": eq.current_status,
                        "engine_hours": eq.total_engine_hours,
                        "category": eq.model_ref.category if eq.model_ref else None,
                    },
                }
            )

        if fuel_drops.get(vid):
            drop = fuel_drops[vid][0]
            if drop >= drop_thresh:
                anomalies.append(
                    {
                        "kind": "potential_misuse",
                        "severity": "critical",
                        "asset_id": eq.asset_id,
                        "equipment_id": vid,
                        "title": f"Unusual fuel burn: {eq.asset_id}",
                        "detail": (
                            f"Fuel dropped ~{drop:.0f}% over 7d (fleet threshold {drop_thresh:.0f}%). "
                            "Possible misuse, leak, or unlogged work."
                        ),
                        "score": min(98, 60 + drop),
                        "signals": {"fuel_drop_pct": round(drop, 1), "threshold": round(drop_thresh, 1)},
                    }
                )

        if idle_ratios.get(vid):
            ratio = idle_ratios[vid][0]
            if ratio >= idle_thresh and eq.current_status in (
                EquipmentStatus.ACTIVE,
                EquipmentStatus.IDLE,
            ):
                anomalies.append(
                    {
                        "kind": "long_idle",
                        "severity": "warning",
                        "asset_id": eq.asset_id,
                        "equipment_id": vid,
                        "title": f"High idle telematics: {eq.asset_id}",
                        "detail": (
                            f"~{ratio * 100:.0f}% of recent samples show near-zero speed "
                            f"(fleet idle threshold {idle_thresh * 100:.0f}%)."
                        ),
                        "score": round(40 + ratio * 50, 1),
                        "signals": {"idle_ratio": round(ratio, 3), "threshold": round(idle_thresh, 3)},
                    }
                )

    active = (
        Rental.objects.filter(rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE])
        .select_related("equipment", "equipment__model_ref", "operator", "site")[:80]
    )
    for rental in active:
        try:
            usage = rental_usage_row(rental)
        except Exception:
            continue
        util = usage.get("utilisation_pct") or 0
        idle_h = usage.get("idle_hours") or 0
        window = usage.get("rental_window_hours") or 0
        fuel_rate = usage.get("fuel_burn_rate_pct_per_hour")
        asset = rental.equipment.asset_id

        if window >= 8 and util < 35:
            anomalies.append(
                {
                    "kind": "underuse",
                    "severity": "warning",
                    "asset_id": asset,
                    "equipment_id": str(rental.equipment_id),
                    "rental_id": rental.rental_id,
                    "title": f"Underused on rent: {asset}",
                    "detail": (
                        f"Rental {rental.rental_id} utilisation {util}% over {window}h "
                        f"({idle_h}h idle). Consider reallocation."
                    ),
                    "score": round(100 - util, 1),
                    "signals": {"utilisation_pct": util, "idle_hours": idle_h, "window_hours": window},
                }
            )

        if not rental.operator_id:
            anomalies.append(
                {
                    "kind": "unassigned",
                    "severity": "critical",
                    "asset_id": asset,
                    "equipment_id": str(rental.equipment_id),
                    "rental_id": rental.rental_id,
                    "title": f"Rental without operator: {asset}",
                    "detail": f"{rental.rental_id} is {rental.rental_status} but has no operator assigned.",
                    "score": 85,
                    "signals": {"rental_status": rental.rental_status},
                }
            )

        if fuel_rate is not None and fuel_rate >= max(10.0, drop_thresh / max(window, 1)):
            anomalies.append(
                {
                    "kind": "potential_misuse",
                    "severity": "critical",
                    "asset_id": asset,
                    "equipment_id": str(rental.equipment_id),
                    "rental_id": rental.rental_id,
                    "title": f"High burn on rent: {asset}",
                    "detail": (
                        f"Fuel burn ~{fuel_rate}%/h on {rental.rental_id} — "
                        "investigate misuse or inefficient operation."
                    ),
                    "score": min(99, 50 + fuel_rate * 3),
                    "signals": {"fuel_burn_rate_pct_per_hour": fuel_rate},
                }
            )

    best: dict[tuple[str, str], dict] = {}
    for a in anomalies:
        key = (a["asset_id"], a["kind"])
        if key not in best or a["score"] > best[key]["score"]:
            best[key] = a
    ranked = sorted(best.values(), key=lambda x: -x["score"])

    counts: dict[str, int] = defaultdict(int)
    for a in ranked:
        counts[a["kind"]] += 1

    notified = 0
    if emit_notifications:
        notified = _emit(ranked, limit=30)

    narrative = _llm_brief(ranked[:12], dict(counts))

    return {
        "as_of": now.isoformat(),
        "method": "zscore_thresholds + rental_utilisation_rules + optional_qwen",
        "baselines": {
            "fuel_drop_mean": round(drop_mean, 2),
            "fuel_drop_threshold": round(drop_thresh, 2),
            "idle_ratio_mean": round(idle_mean, 3),
            "idle_ratio_threshold": round(idle_thresh, 3),
        },
        "counts": dict(counts),
        "total": len(ranked),
        "notifications_created": notified,
        "anomalies": ranked[:60],
        "narrative": narrative,
    }


def _llm_brief(anomalies: list[dict], counts: dict) -> dict:
    system = (
        "You are Rental-IQ risk analyst. Summarize asset anomalies in 5-7 bullets. "
        "Prioritize critical misuse and unassigned active rentals. Do not invent assets."
    )
    prompt = f"Counts: {counts}\nTop anomalies: {anomalies}\nWrite an actionable ops brief."
    llm = call_ollama(prompt, system_msg=system, timeout=16)
    if llm:
        return {"source": "qwen3", "text": llm.strip()}

    lines = [f"Detected {sum(counts.values())} anomaly signal(s)."]
    if counts:
        lines[0] += " " + ", ".join(f"{k.replace('_', ' ')}: {v}" for k, v in counts.items()) + "."
    for a in anomalies[:6]:
        lines.append(f"• [{a['kind']}/{a['severity']}] {a['title']} — {a['detail']}")
    if not anomalies:
        lines.append("• No material misuse / idle / unassigned signals right now.")
    return {"source": "rules", "text": "\n".join(lines)}
