from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("authentication", "0002_operator_customer_roles"),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomerRewardAccount",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("customer_id", models.CharField(db_index=True, max_length=64, unique=True)),
                ("customer_name", models.CharField(blank=True, default="", max_length=255)),
                ("points_balance", models.IntegerField(default=0)),
                ("lifetime_points", models.IntegerField(default=0)),
                (
                    "tier",
                    models.CharField(
                        choices=[
                            ("Bronze", "Bronze"),
                            ("Silver", "Silver"),
                            ("Gold", "Gold"),
                            ("Platinum", "Platinum"),
                        ],
                        default="Bronze",
                        max_length=32,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reward_account",
                        to="authentication.user",
                    ),
                ),
            ],
            options={"db_table": "customer_reward_accounts", "ordering": ["-points_balance"]},
        ),
        migrations.CreateModel(
            name="RewardLedgerEntry",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "entry_type",
                    models.CharField(
                        choices=[("earn", "Earn"), ("redeem", "Redeem"), ("adjust", "Adjust")],
                        max_length=16,
                    ),
                ),
                ("points", models.IntegerField()),
                ("reason", models.CharField(max_length=255)),
                ("rental_id", models.CharField(blank=True, default="", max_length=64)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "account",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ledger",
                        to="rewards.customerrewardaccount",
                    ),
                ),
            ],
            options={"db_table": "reward_ledger", "ordering": ["-created_at"]},
        ),
    ]
