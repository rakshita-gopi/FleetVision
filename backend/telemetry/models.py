import uuid

from django.db import models


class TelemetrySource(models.TextChoices):
    SIMULATOR = "SIMULATOR", "Simulator"
    MOBILE = "MOBILE", "Mobile"
    GPS_DEVICE = "GPS_DEVICE", "GPS Device"
    IOT_GATEWAY = "IOT_GATEWAY", "IoT Gateway"
    DATASET = "DATASET", "Dataset"


class VehicleTelemetry(models.Model):
    """Historical telemetry — TimescaleDB hypertable on `time`."""

    time = models.DateTimeField(db_index=True)
    event_id = models.UUIDField(default=uuid.uuid4, editable=False)
    vehicle_id = models.UUIDField(db_index=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    gps_accuracy = models.FloatField(null=True, blank=True)
    speed = models.FloatField(null=True, blank=True)
    heading = models.FloatField(null=True, blank=True)
    rpm = models.IntegerField(null=True, blank=True)
    fuel_level = models.FloatField(null=True, blank=True)
    engine_temperature = models.FloatField(null=True, blank=True)
    battery_voltage = models.FloatField(null=True, blank=True)
    odometer = models.FloatField(null=True, blank=True)
    source = models.CharField(max_length=30, choices=TelemetrySource.choices, default=TelemetrySource.SIMULATOR)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vehicle_telemetry"
        ordering = ["-time"]
        indexes = [
            models.Index(fields=["vehicle_id", "-time"], name="idx_vt_vehicle_time"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["event_id", "time"], name="vehicle_telemetry_event_id_time_key"),
        ]

    def __str__(self):
        return f"{self.vehicle_id} @ {self.time}"
