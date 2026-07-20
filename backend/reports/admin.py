from django.contrib import admin
from .models import GeneratedReport


@admin.register(GeneratedReport)
class GeneratedReportAdmin(admin.ModelAdmin):
    list_display = ("report_type", "default_format", "requested_by", "created_at")
    list_filter = ("report_type", "default_format", "created_at")
    search_fields = ("report_type", "requested_by__email")
