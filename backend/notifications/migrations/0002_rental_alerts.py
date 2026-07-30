from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="severity",
            field=models.CharField(
                choices=[("info", "Info"), ("warning", "Warning"), ("critical", "Critical")],
                default="info",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="related_rental_id",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="notification",
            name="related_asset_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="notification",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(
                choices=[
                    ("Insurance Expiry", "Insurance Expiry"),
                    ("License Expiry", "License Expiry"),
                    ("Maintenance Due", "Maintenance Due"),
                    ("Trip Started", "Trip Started"),
                    ("Trip Completed", "Trip Completed"),
                    ("Fuel Alert", "Fuel Alert"),
                    ("AI Alert", "AI Alert"),
                    ("AI Recommendation", "AI Recommendation"),
                    ("Rental Due Soon", "Rental Due Soon"),
                    ("Rental Due Today", "Rental Due Today"),
                    ("Rental Overdue", "Rental Overdue"),
                ],
                max_length=50,
            ),
        ),
    ]
