import uuid
from django.db import models


class VehicleStatus(models.TextChoices):
    AVAILABLE = "Available", "Available"
    ON_TRIP = "On Trip", "On Trip"
    UNDER_MAINTENANCE = "Under Maintenance", "Under Maintenance"
    INACTIVE = "Inactive", "Inactive"


class VehicleType(models.TextChoices):
    TRUCK = "Truck", "Truck"
    VAN = "Van", "Van"
    CAR = "Car", "Car"
    BUS = "Bus", "Bus"
    BIKE = "Bike", "Bike"


class FuelType(models.TextChoices):
    PETROL = "Petrol", "Petrol"
    DIESEL = "Diesel", "Diesel"
    CNG = "CNG", "CNG"
    ELECTRIC = "Electric", "Electric"
    HYBRID = "Hybrid", "Hybrid"


class Vehicle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle_number = models.CharField(max_length=50, unique=True)
    registration_number = models.CharField(max_length=50, unique=True)
    vehicle_type = models.CharField(max_length=30, choices=VehicleType.choices, default=VehicleType.TRUCK)
    manufacturer = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    manufacturing_year = models.PositiveIntegerField()
    fuel_type = models.CharField(max_length=20, choices=FuelType.choices)
    engine_number = models.CharField(max_length=100, blank=True)
    chassis_number = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    insurance_expiry = models.DateField(null=True, blank=True)
    fitness_expiry = models.DateField(null=True, blank=True)
    pollution_expiry = models.DateField(null=True, blank=True)
    odometer = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=30, choices=VehicleStatus.choices, default=VehicleStatus.AVAILABLE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vehicles"
        indexes = [
            models.Index(fields=["vehicle_number"]),
            models.Index(fields=["registration_number"]),
        ]

    def __str__(self):
        return self.vehicle_number
