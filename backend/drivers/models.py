import uuid
from django.db import models
from authentication.models import User


class DriverStatus(models.TextChoices):
    AVAILABLE = "Available", "Available"
    ON_TRIP = "On Trip", "On Trip"
    ON_LEAVE = "On Leave", "On Leave"
    INACTIVE = "Inactive", "Inactive"


class Driver(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    license_number = models.CharField(max_length=50, unique=True)
    license_expiry = models.DateField()
    address = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=50, blank=True)
    blood_group = models.CharField(max_length=10, blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    joining_date = models.DateField()
    status = models.CharField(max_length=20, choices=DriverStatus.choices, default=DriverStatus.AVAILABLE)
    assigned_vehicle = models.ForeignKey(
        "vehicles.Vehicle", on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_drivers"
    )

    class Meta:
        db_table = "drivers"
        indexes = [models.Index(fields=["license_number"])]

    def __str__(self):
        return self.user.full_name
