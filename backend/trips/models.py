import uuid
from django.db import models
from drivers.models import Driver
from vehicles.models import Vehicle


class TripStatus(models.TextChoices):
    SCHEDULED = "Scheduled", "Scheduled"
    STARTED = "Started", "Started"
    IN_PROGRESS = "In Progress", "In Progress"
    COMPLETED = "Completed", "Completed"
    CANCELLED = "Cancelled", "Cancelled"


class Trip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="trips")
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name="trips")
    source = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    estimated_arrival = models.DateTimeField(null=True, blank=True)
    distance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    trip_status = models.CharField(max_length=20, choices=TripStatus.choices, default=TripStatus.SCHEDULED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "trips"
        indexes = [
            models.Index(fields=["vehicle"]),
            models.Index(fields=["driver"]),
            models.Index(fields=["trip_status"]),
        ]

    def __str__(self):
        return f"{self.source} → {self.destination}"
