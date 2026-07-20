import uuid
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("authentication", "0002_user_google_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="GeneratedReport",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("report_type", models.CharField(max_length=50)),
                ("requested_sections", models.JSONField(blank=True, default=list)),
                ("default_format", models.CharField(choices=[("pdf", "PDF"), ("json", "JSON"), ("csv", "CSV")], default="pdf", max_length=10)),
                ("llm_summary", models.TextField(blank=True)),
                ("filters", models.JSONField(blank=True, default=dict)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "requested_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="generated_reports",
                        to="authentication.user",
                    ),
                ),
            ],
            options={
                "db_table": "generated_reports",
                "ordering": ["-created_at"],
            },
        ),
    ]
