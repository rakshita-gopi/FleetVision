import uuid
from django.db import models


class EquipmentModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model_id = models.CharField(max_length=32, unique=True)
    manufacturer = models.CharField(max_length=100, default="Caterpillar")
    model = models.CharField(max_length=100)
    category = models.CharField(max_length=100)
    gross_power_kw = models.FloatField(null=True, blank=True)
    operating_weight_kg = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "equipment_models"
        ordering = ["model_id"]

    def __str__(self):
        return f"{self.model_id} {self.model}"


class EquipmentStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    ACTIVE = "ACTIVE", "Active"
    IDLE = "IDLE", "Idle"
    MAINTENANCE = "MAINTENANCE", "Maintenance"
    RETIRED = "RETIRED", "Retired"


class Equipment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset_id = models.CharField(max_length=32, unique=True)
    model_ref = models.ForeignKey(
        EquipmentModel, on_delete=models.PROTECT, related_name="assets", null=True, blank=True
    )
    serial_number = models.CharField(max_length=100, blank=True)
    manufacture_year = models.IntegerField(null=True, blank=True)
    acquisition_type = models.CharField(max_length=50, blank=True)
    current_status = models.CharField(max_length=32, choices=EquipmentStatus.choices, default=EquipmentStatus.AVAILABLE)
    current_site = models.ForeignKey(
        "sites.Site", on_delete=models.SET_NULL, null=True, blank=True, related_name="equipment"
    )
    current_operator = models.ForeignKey(
        "operators.Operator", on_delete=models.SET_NULL, null=True, blank=True, related_name="equipment"
    )
    total_engine_hours = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "equipment_assets"
        ordering = ["asset_id"]

    def __str__(self):
        return self.asset_id
