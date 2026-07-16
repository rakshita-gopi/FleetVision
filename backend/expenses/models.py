import uuid
from django.db import models
from vehicles.models import Vehicle


class ExpenseCategory(models.TextChoices):
    FUEL = "Fuel", "Fuel"
    MAINTENANCE = "Maintenance", "Maintenance"
    INSURANCE = "Insurance", "Insurance"
    TOLL = "Toll", "Toll"
    PARKING = "Parking", "Parking"
    DRIVER_ALLOWANCE = "Driver Allowance", "Driver Allowance"
    MISCELLANEOUS = "Miscellaneous", "Miscellaneous"


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="expenses")
    expense_category = models.CharField(max_length=50, choices=ExpenseCategory.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField()
    description = models.TextField(blank=True)

    class Meta:
        db_table = "expenses"
        indexes = [models.Index(fields=["vehicle"])]
