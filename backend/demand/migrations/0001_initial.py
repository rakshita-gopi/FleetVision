# Generated manually for SiteDemand

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("sites", "0001_rental_iq_mvp"),
    ]

    operations = [
        migrations.CreateModel(
            name="SiteDemand",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("date", models.DateField(db_index=True)),
                ("equipment_category", models.CharField(db_index=True, max_length=100)),
                ("requested_units", models.IntegerField(default=0)),
                ("allocated_units", models.IntegerField(default=0)),
                ("utilisation_pct", models.FloatField(default=0)),
                (
                    "site",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="demand_rows",
                        to="sites.site",
                    ),
                ),
            ],
            options={
                "db_table": "site_demand",
                "ordering": ["-date"],
            },
        ),
        migrations.AddIndex(
            model_name="sitedemand",
            index=models.Index(fields=["site", "equipment_category", "-date"], name="idx_demand_site_cat_date"),
        ),
    ]
