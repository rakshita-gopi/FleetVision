import uuid
from django.db import models
from drivers.models import Driver
from trips.models import Trip
from vehicles.models import Vehicle


class VehicleLocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.OneToOneField(Vehicle, on_delete=models.CASCADE, related_name="location")
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    speed = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    heading = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "vehicle_locations"
        indexes = [models.Index(fields=["vehicle"])]


class GPSHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="gps_history")
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    speed = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "gps_history"
        indexes = [models.Index(fields=["trip"])]
