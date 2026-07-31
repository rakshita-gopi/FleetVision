from __future__ import annotations

from django.db import transaction
from django.db.models import Sum

from authentication.models import User, UserRole
from rentals.models import Rental, RentalStatus
from .models import CustomerRewardAccount, RewardLedgerEntry, RewardTier


POINTS_PER_RENTAL_DAY = 10
POINTS_PER_DOLLAR = 1  # 1 pt per currency unit of daily_rate * days


def tier_for_lifetime(points: int) -> str:
    if points >= 5000:
        return RewardTier.PLATINUM
    if points >= 2000:
        return RewardTier.GOLD
    if points >= 500:
        return RewardTier.SILVER
    return RewardTier.BRONZE


def ensure_customer_profiles() -> int:
    created = 0
    # From users with Customer role
    for u in User.objects.filter(role=UserRole.CUSTOMER):
        cid = f"CUST-{u.email.split('@')[0].upper()}"
        _, was = CustomerRewardAccount.objects.get_or_create(
            customer_id=cid,
            defaults={"user": u, "customer_name": u.full_name, "points_balance": 0, "lifetime_points": 0},
        )
        if was:
            created += 1
        else:
            acc = CustomerRewardAccount.objects.get(customer_id=cid)
            if not acc.user_id:
                acc.user = u
                acc.customer_name = u.full_name
                acc.save(update_fields=["user", "customer_name", "updated_at"])

    # From rental customer ids
    rows = (
        Rental.objects.exclude(customer_id="")
        .values("customer_id", "customer_name")
        .annotate(n=Sum("daily_rate"))
    )
    for row in rows:
        cid = row["customer_id"]
        _, was = CustomerRewardAccount.objects.get_or_create(
            customer_id=cid,
            defaults={"customer_name": row["customer_name"] or cid, "points_balance": 0, "lifetime_points": 0},
        )
        if was:
            created += 1
    return created


def _points_for_rental(rental: Rental) -> int:
    days = rental.rental_days or 1
    rate = float(rental.daily_rate or 0)
    return max(10, int(days * POINTS_PER_RENTAL_DAY + rate * days * 0.05))


@transaction.atomic
def award_for_completed_rentals(*, limit: int = 500) -> int:
    awarded = 0
    qs = (
        Rental.objects.filter(rental_status=RentalStatus.COMPLETED)
        .exclude(customer_id="")
        .order_by("-updated_at")[:limit]
    )
    for rental in qs:
        exists = RewardLedgerEntry.objects.filter(
            rental_id=rental.rental_id, entry_type=RewardLedgerEntry.EntryType.EARN
        ).exists()
        if exists:
            continue
        account, _ = CustomerRewardAccount.objects.get_or_create(
            customer_id=rental.customer_id,
            defaults={"customer_name": rental.customer_name or rental.customer_id},
        )
        pts = _points_for_rental(rental)
        account.points_balance += pts
        account.lifetime_points += pts
        account.tier = tier_for_lifetime(account.lifetime_points)
        account.save()
        RewardLedgerEntry.objects.create(
            account=account,
            entry_type=RewardLedgerEntry.EntryType.EARN,
            points=pts,
            reason=f"Completed rental {rental.rental_id}",
            rental_id=rental.rental_id,
            metadata={"days": rental.rental_days, "daily_rate": float(rental.daily_rate or 0)},
        )
        awarded += 1
    return awarded


@transaction.atomic
def redeem_points(*, customer_id: str, points: int, reason: str = "Redemption") -> CustomerRewardAccount:
    if points <= 0:
        raise ValueError("points must be positive")
    account = CustomerRewardAccount.objects.filter(customer_id=customer_id).first()
    if not account:
        raise ValueError("Reward account not found")
    if account.points_balance < points:
        raise ValueError("Insufficient points")
    account.points_balance -= points
    account.save(update_fields=["points_balance", "updated_at"])
    RewardLedgerEntry.objects.create(
        account=account,
        entry_type=RewardLedgerEntry.EntryType.REDEEM,
        points=-points,
        reason=reason,
    )
    return account


def account_summary(account: CustomerRewardAccount) -> dict:
    ledger = list(account.ledger.all()[:20])
    return {
        "customer_id": account.customer_id,
        "customer_name": account.customer_name,
        "points_balance": account.points_balance,
        "lifetime_points": account.lifetime_points,
        "tier": account.tier,
        "ledger": [
            {
                "id": str(e.id),
                "entry_type": e.entry_type,
                "points": e.points,
                "reason": e.reason,
                "rental_id": e.rental_id,
                "created_at": e.created_at.isoformat(),
            }
            for e in ledger
        ],
    }


def leaderboard(limit: int = 20) -> list[dict]:
    return [
        {
            "customer_id": a.customer_id,
            "customer_name": a.customer_name,
            "points_balance": a.points_balance,
            "lifetime_points": a.lifetime_points,
            "tier": a.tier,
        }
        for a in CustomerRewardAccount.objects.order_by("-lifetime_points")[:limit]
    ]
