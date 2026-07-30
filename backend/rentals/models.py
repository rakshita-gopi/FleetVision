import uuid
from django.db import models


class RentalStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    COMPLETED = "COMPLETED", "Completed"
    OVERDUE = "OVERDUE", "Overdue"
    CANCELLED = "CANCELLED", "Cancelled"


class Rental(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rental_id = models.CharField(max_length=32, unique=True)
    equipment = models.ForeignKey("equipment.Equipment", on_delete=models.CASCADE, related_name="rentals")
    site = models.ForeignKey("sites.Site", on_delete=models.SET_NULL, null=True, blank=True, related_name="rentals")
    operator = models.ForeignKey(
        "operators.Operator", on_delete=models.SET_NULL, null=True, blank=True, related_name="rentals"
    )
    check_out_date = models.DateField(null=True, blank=True)
    expected_return_date = models.DateField(null=True, blank=True)
    actual_return_date = models.DateField(null=True, blank=True)
    rental_days = models.IntegerField(default=0)
    daily_rate = models.FloatField(default=0)
    rental_status = models.CharField(max_length=32, choices=RentalStatus.choices, default=RentalStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rentals"
        ordering = ["-check_out_date"]

    def __str__(self):
        return self.rental_id
