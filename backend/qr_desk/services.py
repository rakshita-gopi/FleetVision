from datetime import date

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from equipment.models import Equipment, EquipmentStatus
from operators.models import Operator
from rentals.models import Rental, RentalStatus
from sites.models import Site
from telemetry.consumers.processor import get_live_state


def _next_rental_id() -> str:
    n = Rental.objects.count() + 1
    code = f"RNT{n:05d}"
    while Rental.objects.filter(rental_id=code).exists():
        n += 100
        code = f"RNT{n:05d}"
    return code


def _next_txn_id() -> str:
    today = timezone.now().strftime("%Y%m%d")
    prefix = f"TXN-{today}-"
    count = Rental.objects.filter(transaction_id__startswith=prefix).count() + 1
    code = f"{prefix}{count:05d}"
    while Rental.objects.filter(transaction_id=code).exists():
        count += 1
        code = f"{prefix}{count:05d}"
    return code


def _live_machine(equipment: Equipment) -> dict:
    live = get_live_state(str(equipment.id)) or {}
    return {
        "asset_id": equipment.asset_id,
        "status": equipment.current_status,
        "engine_hours": equipment.total_engine_hours,
        "model": equipment.model_ref.model if equipment.model_ref else "",
        "category": equipment.model_ref.category if equipment.model_ref else "",
        "health": "OK" if equipment.current_status != EquipmentStatus.MAINTENANCE else "NEEDS_SERVICE",
        "fuel_level": live.get("fuel_level"),
        "latitude": live.get("latitude"),
        "longitude": live.get("longitude"),
        "speed": live.get("speed"),
        "rpm": live.get("rpm"),
        "engine_temperature": live.get("engine_temperature"),
        "last_updated": live.get("last_updated"),
        "has_live_telemetry": bool(live),
    }


def build_scan_payload(rental: Rental) -> dict:
    eq = rental.equipment
    machine = _live_machine(eq)
    status = rental.rental_status

    if rental.qr_expired or status == RentalStatus.COMPLETED:
        return {
            "valid": False,
            "mode": "expired",
            "message": "Rental Completed — QR Expired. Please contact Rental Manager.",
            "rental_id": rental.rental_id,
            "transaction_id": rental.transaction_id,
            "rental_status": status,
            "invoice_number": rental.invoice_number,
        }

    if status == RentalStatus.CANCELLED:
        return {
            "valid": False,
            "mode": "invalid",
            "message": "QR Invalid — rental was cancelled. Please contact Rental Manager.",
            "rental_id": rental.rental_id,
            "rental_status": status,
        }

    if status == RentalStatus.PENDING_CHECKOUT:
        mode = "checkout"
        message = "Scan OK — confirm checkout to take possession."
    elif status in (RentalStatus.ACTIVE, RentalStatus.OVERDUE):
        mode = "checkin"
        message = "Active rental — confirm return / check-in."
    else:
        mode = "invalid"
        message = "QR Invalid. Please contact Rental Manager."

    return {
        "valid": mode in ("checkout", "checkin"),
        "mode": mode,
        "message": message,
        "rental_id": rental.rental_id,
        "transaction_id": rental.transaction_id,
        "rental_status": status,
        "expected_return_date": str(rental.expected_return_date) if rental.expected_return_date else None,
        "customer": {"id": rental.customer_id, "name": rental.customer_name},
        "operator": {
            "id": rental.operator.operator_id if rental.operator else None,
            "name": rental.operator.name if rental.operator else None,
        },
        "site": {
            "id": rental.site.site_id if rental.site else None,
            "name": rental.site.site_name if rental.site else None,
        },
        "equipment": machine,
        "daily_rate": rental.daily_rate,
        "check_out_at": rental.check_out_at.isoformat() if rental.check_out_at else None,
        "qr_payload": rental.rental_id,
    }


@transaction.atomic
def generate_checkout_qr(
    *,
    equipment_id: str,
    operator_id: str | None = None,
    site_id: str | None = None,
    customer_id: str = "",
    customer_name: str = "",
    expected_return_date: str | None = None,
    daily_rate: float = 500,
) -> Rental:
    equipment = Equipment.objects.filter(Q(id=equipment_id) | Q(asset_id=equipment_id)).first()
    if not equipment:
        raise ValueError("Equipment not found")
    if equipment.current_status not in (EquipmentStatus.AVAILABLE, EquipmentStatus.IDLE):
        raise ValueError("Equipment not available for checkout QR")

    # Block if already pending or active on this asset
    busy = Rental.objects.filter(
        equipment=equipment,
        rental_status__in=[RentalStatus.PENDING_CHECKOUT, RentalStatus.ACTIVE, RentalStatus.OVERDUE],
    ).exists()
    if busy:
        raise ValueError("Equipment already has an open rental")

    site = Site.objects.filter(Q(id=site_id) | Q(site_id=site_id)).first() if site_id else None
    operator = (
        Operator.objects.filter(Q(id=operator_id) | Q(operator_id=operator_id)).first() if operator_id else None
    )

    expected = None
    if expected_return_date:
        expected = date.fromisoformat(str(expected_return_date)[:10])

    rental = Rental.objects.create(
        rental_id=_next_rental_id(),
        transaction_id=_next_txn_id(),
        equipment=equipment,
        site=site,
        operator=operator,
        customer_id=customer_id or "",
        customer_name=customer_name or "",
        expected_return_date=expected,
        daily_rate=float(daily_rate or 500),
        rental_status=RentalStatus.PENDING_CHECKOUT,
        check_out_date=None,
        qr_expired=False,
    )
    return rental


@transaction.atomic
def confirm_checkout(rental: Rental, payload: dict | None = None) -> Rental:
    if rental.qr_expired or rental.rental_status == RentalStatus.COMPLETED:
        raise ValueError("QR Expired — rental already completed")
    if rental.rental_status != RentalStatus.PENDING_CHECKOUT:
        raise ValueError(f"Cannot checkout — status is {rental.rental_status}")

    payload = payload or {}
    now = timezone.now()
    machine = _live_machine(rental.equipment)
    snapshot = {
        "confirmed_at": now.isoformat(),
        "gps": {
            "latitude": payload.get("latitude", machine.get("latitude")),
            "longitude": payload.get("longitude", machine.get("longitude")),
        },
        "engine_hours": payload.get("engine_hours", machine.get("engine_hours")),
        "fuel_level": payload.get("fuel_level", machine.get("fuel_level")),
        "health": machine.get("health"),
        "notes": payload.get("notes") or "",
    }

    rental.check_out_at = now
    rental.check_out_date = now.date()
    rental.rental_status = RentalStatus.ACTIVE
    rental.checkout_snapshot = snapshot
    rental.save()

    eq = rental.equipment
    eq.current_status = EquipmentStatus.ACTIVE
    eq.current_site = rental.site
    eq.current_operator = rental.operator
    if snapshot.get("engine_hours") is not None:
        try:
            eq.total_engine_hours = float(snapshot["engine_hours"])
        except (TypeError, ValueError):
            pass
    eq.save()
    return rental


@transaction.atomic
def confirm_checkin(rental: Rental, payload: dict | None = None) -> Rental:
    if rental.qr_expired or rental.rental_status == RentalStatus.COMPLETED:
        raise ValueError("QR Expired — rental already completed. Please contact Rental Manager.")
    if rental.rental_status not in (RentalStatus.ACTIVE, RentalStatus.OVERDUE):
        raise ValueError(f"Cannot check-in — status is {rental.rental_status}")

    payload = payload or {}
    now = timezone.now()
    machine = _live_machine(rental.equipment)
    photos = payload.get("photos") or []
    snapshot = {
        "confirmed_at": now.isoformat(),
        "gps": {
            "latitude": payload.get("latitude", machine.get("latitude")),
            "longitude": payload.get("longitude", machine.get("longitude")),
        },
        "engine_hours": payload.get("engine_hours", machine.get("engine_hours")),
        "fuel_level": payload.get("fuel_level", machine.get("fuel_level")),
        "health": payload.get("health") or machine.get("health"),
        "telemetry": {
            "rpm": machine.get("rpm"),
            "engine_temperature": machine.get("engine_temperature"),
            "speed": machine.get("speed"),
        },
        "photos": photos[:5],
        "notes": payload.get("notes") or "",
    }

    rental.check_in_at = now
    rental.actual_return_date = now.date()
    if rental.check_out_date:
        rental.rental_days = max(1, (rental.actual_return_date - rental.check_out_date).days or 1)
    else:
        rental.rental_days = 1
    rental.rental_status = RentalStatus.COMPLETED
    rental.checkin_snapshot = snapshot
    rental.qr_expired = True
    rental.invoice_number = f"INV-{rental.rental_id}-{now.strftime('%Y%m%d')}"
    rental.save()

    eq = rental.equipment
    eq.current_status = EquipmentStatus.AVAILABLE
    eq.current_site = None
    eq.current_operator = None
    if snapshot.get("engine_hours") is not None:
        try:
            eq.total_engine_hours = float(snapshot["engine_hours"])
        except (TypeError, ValueError):
            pass
    eq.save()
    return rental


def resolve_rental(code: str) -> Rental | None:
    code = (code or "").strip().upper()
    if not code:
        return None
    return (
        Rental.objects.select_related("equipment", "equipment__model_ref", "site", "operator")
        .filter(Q(rental_id__iexact=code) | Q(transaction_id__iexact=code))
        .first()
    )
