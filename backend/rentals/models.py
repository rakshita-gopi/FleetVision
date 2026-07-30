import uuid
from django.db import models


class RentalStatus(models.TextChoices):
    PENDING_CHECKOUT = "PENDING_CHECKOUT", "Pending Checkout"
    ACTIVE = "ACTIVE", "Active"
    COMPLETED = "COMPLETED", "Completed"
    OVERDUE = "OVERDUE", "Overdue"
    CANCELLED = "CANCELLED", "Cancelled"


class Rental(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rental_id = models.CharField(max_length=32, unique=True)
    transaction_id = models.CharField(max_length=64, unique=True, null=True, blank=True)
    equipment = models.ForeignKey("equipment.Equipment", on_delete=models.CASCADE, related_name="rentals")
    site = models.ForeignKey("sites.Site", on_delete=models.SET_NULL, null=True, blank=True, related_name="rentals")
    operator = models.ForeignKey(
        "operators.Operator", on_delete=models.SET_NULL, null=True, blank=True, related_name="rentals"
    )
    customer_id = models.CharField(max_length=64, blank=True, default="")
    customer_name = models.CharField(max_length=255, blank=True, default="")
    check_out_date = models.DateField(null=True, blank=True)
    expected_return_date = models.DateField(null=True, blank=True)
    actual_return_date = models.DateField(null=True, blank=True)
    check_out_at = models.DateTimeField(null=True, blank=True)
    check_in_at = models.DateTimeField(null=True, blank=True)
    rental_days = models.IntegerField(default=0)
    daily_rate = models.FloatField(default=0)
    rental_status = models.CharField(
        max_length=32, choices=RentalStatus.choices, default=RentalStatus.PENDING_CHECKOUT
    )
    checkout_snapshot = models.JSONField(default=dict, blank=True)
    checkin_snapshot = models.JSONField(default=dict, blank=True)
    invoice_number = models.CharField(max_length=64, blank=True, default="")
    qr_expired = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rentals"
        ordering = ["-created_at"]

    def __str__(self):
        return self.rental_id
