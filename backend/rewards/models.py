import uuid
from django.conf import settings
from django.db import models


class RewardTier(models.TextChoices):
    BRONZE = "Bronze", "Bronze"
    SILVER = "Silver", "Silver"
    GOLD = "Gold", "Gold"
    PLATINUM = "Platinum", "Platinum"


class CustomerRewardAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reward_account", null=True, blank=True
    )
    customer_id = models.CharField(max_length=64, unique=True, db_index=True)
    customer_name = models.CharField(max_length=255, blank=True, default="")
    points_balance = models.IntegerField(default=0)
    lifetime_points = models.IntegerField(default=0)
    tier = models.CharField(max_length=32, choices=RewardTier.choices, default=RewardTier.BRONZE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customer_reward_accounts"
        ordering = ["-points_balance"]

    def __str__(self):
        return f"{self.customer_id} ({self.points_balance} pts)"


class RewardLedgerEntry(models.Model):
    class EntryType(models.TextChoices):
        EARN = "earn", "Earn"
        REDEEM = "redeem", "Redeem"
        ADJUST = "adjust", "Adjust"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account = models.ForeignKey(CustomerRewardAccount, on_delete=models.CASCADE, related_name="ledger")
    entry_type = models.CharField(max_length=16, choices=EntryType.choices)
    points = models.IntegerField()
    reason = models.CharField(max_length=255)
    rental_id = models.CharField(max_length=64, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reward_ledger"
        ordering = ["-created_at"]
