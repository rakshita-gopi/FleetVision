import uuid
from django.db import models


class NotificationType(models.TextChoices):
    INSURANCE_EXPIRY = "Insurance Expiry", "Insurance Expiry"
    LICENSE_EXPIRY = "License Expiry", "License Expiry"
    MAINTENANCE_DUE = "Maintenance Due", "Maintenance Due"
    TRIP_STARTED = "Trip Started", "Trip Started"
    TRIP_COMPLETED = "Trip Completed", "Trip Completed"
    FUEL_ALERT = "Fuel Alert", "Fuel Alert"
    AI_ALERT = "AI Alert", "AI Alert"
    AI_RECOMMENDATION = "AI Recommendation", "AI Recommendation"
    RENTAL_DUE_SOON = "Rental Due Soon", "Rental Due Soon"
    RENTAL_DUE_TODAY = "Rental Due Today", "Rental Due Today"
    RENTAL_OVERDUE = "Rental Overdue", "Rental Overdue"
    ANOMALY_IDLE = "Anomaly Idle", "Anomaly Idle"
    ANOMALY_UNASSIGNED = "Anomaly Unassigned", "Anomaly Unassigned"
    ANOMALY_UNDERUSE = "Anomaly Underuse", "Anomaly Underuse"
    ANOMALY_MISUSE = "Anomaly Misuse", "Anomaly Misuse"


class NotificationSeverity(models.TextChoices):
    INFO = "info", "Info"
    WARNING = "warning", "Warning"
    CRITICAL = "critical", "Critical"


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NotificationType.choices)
    severity = models.CharField(
        max_length=16, choices=NotificationSeverity.choices, default=NotificationSeverity.INFO
    )
    related_rental_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    related_asset_id = models.CharField(max_length=64, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]


class AIReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_type = models.CharField(max_length=100)
    summary = models.TextField()
    generated_by = models.CharField(max_length=100, default="GPT")
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_reports"
        ordering = ["-generated_at"]
