from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rentals", "0001_rental_iq_mvp"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="rental",
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddField(
            model_name="rental",
            name="transaction_id",
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="rental",
            name="customer_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="rental",
            name="customer_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="rental",
            name="check_out_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="rental",
            name="check_in_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="rental",
            name="checkout_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="rental",
            name="checkin_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="rental",
            name="invoice_number",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="rental",
            name="qr_expired",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="rental",
            name="rental_status",
            field=models.CharField(
                choices=[
                    ("PENDING_CHECKOUT", "Pending Checkout"),
                    ("ACTIVE", "Active"),
                    ("COMPLETED", "Completed"),
                    ("OVERDUE", "Overdue"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="PENDING_CHECKOUT",
                max_length=32,
            ),
        ),
    ]
