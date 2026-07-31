from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from django.db.models import Avg, Count, Max, Min, Q
from django.utils import timezone

from common.lookup import is_uuid
from rentals.models import Rental, RentalStatus
from telemetry.consumers.processor import get_live_state
from telemetry.models import VehicleTelemetry


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _window_bounds(rental: Rental) -> tuple[datetime, datetime]:
    start = rental.check_out_at
    if not start and rental.check_out_date:
        start = datetime.combine(rental.check_out_date, datetime.min.time())
        start = _aware(start)
    if not start:
        start = rental.created_at
    start = _aware(start) or timezone.now()

    if rental.check_in_at:
        end = _aware(rental.check_in_at)
    elif rental.actual_return_date:
        end = _aware(datetime.combine(rental.actual_return_date, datetime.max.time().replace(microsecond=0)))
    else:
        end = timezone.now()
    end = end or timezone.now()
    if end < start:
        end = start
    return start, end


def _telemetry_qs(equipment_id: UUID, start: datetime, end: datetime):
    return VehicleTelemetry.objects.filter(vehicle_id=equipment_id, time__gte=start, time__lte=end)


def _compute_usage(rental: Rental) -> dict[str, Any]:
    eq = rental.equipment
    start, end = _window_bounds(rental)
    wall_hours = max(0.0, (end - start).total_seconds() / 3600.0)

    checkout = rental.checkout_snapshot or {}
    checkin = rental.checkin_snapshot or {}

    start_fuel = checkout.get("fuel_level")
    end_fuel = checkin.get("fuel_level")
    start_hours = checkout.get("engine_hours")
    end_hours = checkin.get("engine_hours")

    qs = _telemetry_qs(eq.id, start, end)
    agg = qs.aggregate(
        points=Count("id"),
        fuel_min=Min("fuel_level"),
        fuel_max=Max("fuel_level"),
        fuel_avg=Avg("fuel_level"),
        odo_min=Min("odometer"),
        odo_max=Max("odometer"),
        first_time=Min("time"),
        last_time=Max("time"),
    )
    points = agg["points"] or 0

    # Prefer telemetry extremes when snapshots missing
    if start_fuel is None and agg["fuel_max"] is not None:
        # earliest fuel: take first non-null chronologically via order
        first = qs.exclude(fuel_level__isnull=True).order_by("time").values_list("fuel_level", flat=True).first()
        start_fuel = first
    if end_fuel is None and agg["fuel_min"] is not None:
        last = qs.exclude(fuel_level__isnull=True).order_by("-time").values_list("fuel_level", flat=True).first()
        end_fuel = last

    if start_hours is None and agg["odo_min"] is not None:
        start_hours = agg["odo_min"]
    if end_hours is None and agg["odo_max"] is not None:
        end_hours = agg["odo_max"]
    if end_hours is None:
        end_hours = eq.total_engine_hours
    if start_hours is None:
        start_hours = eq.total_engine_hours

    try:
        runtime_hours = max(0.0, float(end_hours or 0) - float(start_hours or 0))
    except (TypeError, ValueError):
        runtime_hours = 0.0

    # If no engine-hour delta but we have telem samples, estimate working vs idle from speed/rpm
    idle_samples = 0
    working_samples = 0
    if points:
        idle_samples = qs.filter(Q(speed__lte=1) | Q(speed__isnull=True), Q(rpm__lt=800) | Q(rpm__isnull=True)).count()
        # working: moving or high rpm
        working_samples = qs.filter(Q(speed__gt=1) | Q(rpm__gte=800)).count()
        sampled = idle_samples + working_samples
        if sampled and runtime_hours <= 0 and wall_hours > 0:
            # Estimate runtime as wall * working share
            runtime_hours = wall_hours * (working_samples / sampled)

    if points and wall_hours > 0:
        idle_ratio_samples = idle_samples / max(points, 1)
        idle_hours = wall_hours * idle_ratio_samples
    else:
        idle_hours = max(0.0, wall_hours - runtime_hours)

    # Cap idle to window
    idle_hours = min(idle_hours, wall_hours)
    productive = max(0.0, min(runtime_hours, wall_hours))

    fuel_used = None
    try:
        if start_fuel is not None and end_fuel is not None:
            fuel_used = max(0.0, float(start_fuel) - float(end_fuel))
    except (TypeError, ValueError):
        fuel_used = None

    fuel_rate = None  # % points per productive hour (proxy when tank %)
    if fuel_used is not None and productive > 0.05:
        fuel_rate = round(fuel_used / productive, 2)

    utilisation_pct = round(100.0 * productive / wall_hours, 1) if wall_hours > 0.05 else 0.0
    idle_pct = round(100.0 * idle_hours / wall_hours, 1) if wall_hours > 0.05 else 0.0

    # Efficiency score: reward high utilisation, penalise high idle & steep fuel burn
    efficiency = utilisation_pct
    if idle_pct > 40:
        efficiency -= (idle_pct - 40) * 0.5
    if fuel_rate is not None and fuel_rate > 8:
        efficiency -= min(20, (fuel_rate - 8) * 2)
    efficiency = round(max(0.0, min(100.0, efficiency)), 1)

    if utilisation_pct >= 70 and idle_pct <= 30:
        grade = "Efficient"
    elif utilisation_pct >= 45:
        grade = "Moderate"
    else:
        grade = "Under-utilised"

    live = get_live_state(str(eq.id)) or {}
    location = {
        "latitude": live.get("latitude"),
        "longitude": live.get("longitude"),
        "last_updated": live.get("last_updated"),
        "source": "live" if live else "none",
    }
    if location["latitude"] is None:
        last_loc = qs.exclude(latitude__isnull=True).order_by("-time").values("latitude", "longitude", "time").first()
        if last_loc:
            location = {
                "latitude": last_loc["latitude"],
                "longitude": last_loc["longitude"],
                "last_updated": last_loc["time"].isoformat() if last_loc["time"] else None,
                "source": "telemetry",
            }
        elif checkout.get("gps"):
            location = {
                "latitude": (checkout.get("gps") or {}).get("latitude"),
                "longitude": (checkout.get("gps") or {}).get("longitude"),
                "last_updated": checkout.get("confirmed_at"),
                "source": "checkout_snapshot",
            }

    return {
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "rental_window_hours": round(wall_hours, 2),
        "runtime_hours": round(productive, 2),
        "idle_hours": round(idle_hours, 2),
        "utilisation_pct": utilisation_pct,
        "idle_pct": idle_pct,
        "efficiency_score": efficiency,
        "efficiency_grade": grade,
        "fuel_start_pct": round(float(start_fuel), 1) if start_fuel is not None else None,
        "fuel_end_pct": round(float(end_fuel), 1) if end_fuel is not None else (live.get("fuel_level")),
        "fuel_used_pct": round(fuel_used, 1) if fuel_used is not None else None,
        "fuel_burn_rate_pct_per_hour": fuel_rate,
        "engine_hours_start": round(float(start_hours), 1) if start_hours is not None else None,
        "engine_hours_end": round(float(end_hours), 1) if end_hours is not None else None,
        "telemetry_points": points,
        "idle_samples": idle_samples,
        "working_samples": working_samples,
        "current_location": location,
        "live_fuel_pct": live.get("fuel_level"),
        "live_speed": live.get("speed"),
        "live_rpm": live.get("rpm"),
    }


def rental_usage_row(rental: Rental) -> dict[str, Any]:
    usage = _compute_usage(rental)
    op = rental.operator
    return {
        "id": str(rental.id),
        "rental_id": rental.rental_id,
        "transaction_id": rental.transaction_id,
        "rental_status": rental.rental_status,
        "asset_id": rental.equipment.asset_id,
        "equipment_id": str(rental.equipment_id),
        "model": rental.equipment.model_ref.model if rental.equipment.model_ref else "",
        "category": rental.equipment.model_ref.category if rental.equipment.model_ref else "",
        "customer_id": rental.customer_id,
        "customer_name": rental.customer_name,
        "site_id": rental.site.site_id if rental.site else None,
        "site_name": rental.site.site_name if rental.site else None,
        "operator": {
            "id": op.operator_id if op else None,
            "name": op.name if op else None,
            "certification": op.certification if op else None,
            "shift": op.shift if op else None,
            "experience_years": op.experience_years if op else None,
            "status": op.status if op else None,
        },
        "check_out_at": rental.check_out_at.isoformat() if rental.check_out_at else None,
        "check_in_at": rental.check_in_at.isoformat() if rental.check_in_at else None,
        "expected_return_date": str(rental.expected_return_date) if rental.expected_return_date else None,
        "daily_rate": rental.daily_rate,
        **usage,
    }


def list_usage_logs(*, status: str | None = None, q: str | None = None, limit: int = 80) -> list[dict]:
    qs = Rental.objects.select_related(
        "equipment", "equipment__model_ref", "operator", "site"
    ).exclude(rental_status=RentalStatus.PENDING_CHECKOUT).exclude(rental_status=RentalStatus.CANCELLED)

    if status == "active":
        qs = qs.filter(rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE])
    elif status == "completed":
        qs = qs.filter(rental_status=RentalStatus.COMPLETED)
    elif status:
        qs = qs.filter(rental_status=status.upper())

    if q:
        qs = qs.filter(
            Q(rental_id__icontains=q)
            | Q(equipment__asset_id__icontains=q)
            | Q(customer_name__icontains=q)
            | Q(operator__name__icontains=q)
            | Q(operator__operator_id__icontains=q)
        )

    rows = [rental_usage_row(r) for r in qs.order_by("-created_at")[:limit]]
    return rows


def usage_detail(rental_id: str) -> dict[str, Any] | None:
    qs = Rental.objects.select_related("equipment", "equipment__model_ref", "operator", "site")
    rental = None
    if is_uuid(rental_id):
        rental = qs.filter(id=rental_id).first()
    if not rental:
        rental = qs.filter(rental_id__iexact=str(rental_id)).first()
    if not rental:
        return None

    row = rental_usage_row(rental)
    start, end = _window_bounds(rental)
    qs = _telemetry_qs(rental.equipment_id, start, end).order_by("time")

    # Downsample for chart (max ~120 points)
    total = qs.count()
    step = max(1, total // 120) if total else 1
    series = []
    for i, point in enumerate(qs.iterator()):
        if i % step != 0 and i != total - 1:
            continue
        series.append(
            {
                "time": point.time.isoformat(),
                "fuel_level": point.fuel_level,
                "speed": point.speed,
                "rpm": point.rpm,
                "engine_hours": point.odometer,
                "latitude": point.latitude,
                "longitude": point.longitude,
            }
        )

    row["series"] = series
    row["checkout_snapshot"] = rental.checkout_snapshot or {}
    row["checkin_snapshot"] = rental.checkin_snapshot or {}
    return row


def usage_summary(rows: list[dict]) -> dict[str, Any]:
    if not rows:
        return {
            "rentals": 0,
            "active": 0,
            "avg_utilisation_pct": 0,
            "avg_efficiency_score": 0,
            "total_runtime_hours": 0,
            "total_idle_hours": 0,
            "total_fuel_used_pct": 0,
        }
    active = sum(1 for r in rows if r["rental_status"] in (RentalStatus.ACTIVE, RentalStatus.OVERDUE))
    util = [r["utilisation_pct"] for r in rows]
    eff = [r["efficiency_score"] for r in rows]
    fuel = [r["fuel_used_pct"] for r in rows if r.get("fuel_used_pct") is not None]
    return {
        "rentals": len(rows),
        "active": active,
        "avg_utilisation_pct": round(sum(util) / len(util), 1),
        "avg_efficiency_score": round(sum(eff) / len(eff), 1),
        "total_runtime_hours": round(sum(r["runtime_hours"] for r in rows), 1),
        "total_idle_hours": round(sum(r["idle_hours"] for r in rows), 1),
        "total_fuel_used_pct": round(sum(fuel), 1) if fuel else 0,
    }
