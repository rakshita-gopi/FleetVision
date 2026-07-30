from datetime import date, timedelta

from django.db.models import Q
from django.utils import timezone

from rentals.models import Rental, RentalStatus
from .models import Notification, NotificationSeverity, NotificationType


def _open_rentals():
    return Rental.objects.select_related("equipment", "operator", "site").filter(
        rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE],
        actual_return_date__isnull=True,
        expected_return_date__isnull=False,
    )


def _already_notified(rental_id: str, ntype: str, within_hours: int = 20) -> bool:
    cutoff = timezone.now() - timedelta(hours=within_hours)
    return Notification.objects.filter(
        related_rental_id=rental_id,
        notification_type=ntype,
        created_at__gte=cutoff,
    ).exists()


def _emit(rental: Rental, ntype: str, severity: str, title: str, message: str, extra: dict | None = None):
    if _already_notified(rental.rental_id, ntype):
        return None
    # Flip ACTIVE → OVERDUE when past due
    if ntype == NotificationType.RENTAL_OVERDUE and rental.rental_status == RentalStatus.ACTIVE:
        rental.rental_status = RentalStatus.OVERDUE
        rental.save(update_fields=["rental_status", "updated_at"])
    return Notification.objects.create(
        title=title,
        message=message,
        notification_type=ntype,
        severity=severity,
        related_rental_id=rental.rental_id,
        related_asset_id=rental.equipment.asset_id,
        metadata={
            "expected_return_date": str(rental.expected_return_date),
            "customer_name": rental.customer_name,
            "operator": rental.operator.name if rental.operator else None,
            "site_id": rental.site.site_id if rental.site else None,
            **(extra or {}),
        },
    )


def scan_rental_due_alerts(*, due_soon_days: int = 3) -> dict:
    """
    Auto-notify for rentals:
    - due within N days
    - due today
    - overdue
    Dedupes so the same alert type isn't re-emitted within ~20h.
    """
    today = date.today()
    created = []
    buckets = {"due_soon": 0, "due_today": 0, "overdue": 0}

    for rental in _open_rentals():
        due = rental.expected_return_date
        asset = rental.equipment.asset_id
        days = (due - today).days

        if days < 0:
            n = _emit(
                rental,
                NotificationType.RENTAL_OVERDUE,
                NotificationSeverity.CRITICAL,
                f"Overdue: {asset}",
                f"Rental {rental.rental_id} ({asset}) was due {due} "
                f"({abs(days)} day(s) overdue). Arrange check-in immediately.",
                {"days_overdue": abs(days)},
            )
            if n:
                created.append(n)
                buckets["overdue"] += 1
        elif days == 0:
            n = _emit(
                rental,
                NotificationType.RENTAL_DUE_TODAY,
                NotificationSeverity.WARNING,
                f"Due today: {asset}",
                f"Rental {rental.rental_id} ({asset}) is due for return today ({due}). "
                f"Confirm operator / site readiness for check-in.",
                {"days_until": 0},
            )
            if n:
                created.append(n)
                buckets["due_today"] += 1
        elif 0 < days <= due_soon_days:
            n = _emit(
                rental,
                NotificationType.RENTAL_DUE_SOON,
                NotificationSeverity.INFO,
                f"Due in {days}d: {asset}",
                f"Rental {rental.rental_id} ({asset}) is due on {due} "
                f"({days} day(s) remaining). Pre-schedule return logistics.",
                {"days_until": days},
            )
            if n:
                created.append(n)
                buckets["due_soon"] += 1

    return {
        "created": len(created),
        "buckets": buckets,
        "notification_ids": [str(n.id) for n in created],
    }


def list_alert_board():
    """Structured board for Alerts & Notify tab."""
    today = date.today()
    overdue, due_today, due_soon = [], [], []
    for rental in _open_rentals().order_by("expected_return_date"):
        due = rental.expected_return_date
        days = (due - today).days
        row = {
            "rental_id": rental.rental_id,
            "asset_id": rental.equipment.asset_id,
            "customer_name": rental.customer_name,
            "operator_name": rental.operator.name if rental.operator else None,
            "site_id": rental.site.site_id if rental.site else None,
            "expected_return_date": str(due),
            "days": days,
            "rental_status": rental.rental_status,
        }
        if days < 0:
            row["bucket"] = "overdue"
            overdue.append(row)
        elif days == 0:
            row["bucket"] = "due_today"
            due_today.append(row)
        elif days <= 3:
            row["bucket"] = "due_soon"
            due_soon.append(row)

    recent = Notification.objects.filter(
        notification_type__in=[
            NotificationType.RENTAL_DUE_SOON,
            NotificationType.RENTAL_DUE_TODAY,
            NotificationType.RENTAL_OVERDUE,
        ]
    )[:40]

    return {
        "counts": {
            "overdue": len(overdue),
            "due_today": len(due_today),
            "due_soon": len(due_soon),
            "unread": Notification.objects.filter(is_read=False).count(),
        },
        "overdue": overdue,
        "due_today": due_today,
        "due_soon": due_soon,
        "notifications": [
            {
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "notification_type": n.notification_type,
                "severity": n.severity,
                "related_rental_id": n.related_rental_id,
                "related_asset_id": n.related_asset_id,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
                "metadata": n.metadata,
            }
            for n in recent
        ],
    }
