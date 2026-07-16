import uuid
from django.db import models
from drivers.models import Driver
from vehicles.models import Vehicle


class FuelLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="fuel_logs")
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True, related_name="fuel_logs")
    fuel_station = models.CharField(max_length=255, blank=True)
    fuel_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    fuel_cost = models.DecimalField(max_digits=12, decimal_places=2)
    mileage = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    fuel_date = models.DateField()

    class Meta:
        db_table = "fuel_logs"
        indexes = [models.Index(fields=["vehicle"])]
