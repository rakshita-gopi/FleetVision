# Merge authentication migration leaves
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0002_operator_customer_roles"),
        ("authentication", "0002_user_google_id"),
    ]

    operations = []
