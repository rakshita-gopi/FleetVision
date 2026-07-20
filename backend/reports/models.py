import uuid
from django.db import models


class ReportFormat(models.TextChoices):
    PDF = "pdf", "PDF"
    JSON = "json", "JSON"
    CSV = "csv", "CSV"


class GeneratedReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_type = models.CharField(max_length=50)
    requested_sections = models.JSONField(default=list, blank=True)
    requested_by = models.ForeignKey(
        "authentication.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_reports",
    )
    default_format = models.CharField(max_length=10, choices=ReportFormat.choices, default=ReportFormat.PDF)
    llm_summary = models.TextField(blank=True)
    filters = models.JSONField(default=dict, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "generated_reports"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.report_type} ({self.default_format})"
