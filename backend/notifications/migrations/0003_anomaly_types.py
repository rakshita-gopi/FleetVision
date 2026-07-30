from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0002_rental_alerts"),
    ]

    operations = [
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
                    ("Anomaly Idle", "Anomaly Idle"),
                    ("Anomaly Unassigned", "Anomaly Unassigned"),
                    ("Anomaly Underuse", "Anomaly Underuse"),
                    ("Anomaly Misuse", "Anomaly Misuse"),
                ],
                max_length=50,
            ),
        ),
    ]
