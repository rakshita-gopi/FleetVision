import uuid
from django.db import models
from vehicles.models import Vehicle


class MaintenanceRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="maintenance_records")
    mechanic_name = models.CharField(max_length=255)
    service_type = models.CharField(max_length=100)
    service_date = models.DateField()
    next_service_date = models.DateField(null=True, blank=True)
    repair_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    remarks = models.TextField(blank=True)

    class Meta:
        db_table = "maintenance"
        indexes = [models.Index(fields=["vehicle"])]
