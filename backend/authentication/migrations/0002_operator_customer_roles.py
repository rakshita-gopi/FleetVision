# Generated manually for Operator / Customer roles
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[
                    ("Administrator", "Administrator"),
                    ("Fleet Manager", "Fleet Manager"),
                    ("Operator", "Operator"),
                    ("Customer", "Customer"),
                    ("Driver", "Driver"),
                    ("Mechanic", "Mechanic"),
                ],
                default="Fleet Manager",
                max_length=50,
            ),
        ),
    ]
