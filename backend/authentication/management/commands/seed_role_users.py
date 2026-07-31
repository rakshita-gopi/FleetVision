from django.core.management.base import BaseCommand
from authentication.models import User, UserRole


ROLE_USERS = [
    {
        "email": "admin@fleetvision.ai",
        "password": "admin123",
        "full_name": "System Administrator",
        "role": UserRole.ADMINISTRATOR,
        "is_staff": True,
        "is_superuser": True,
        "phone": "+91 9876543210",
    },
    {
        "email": "manager@fleetvision.ai",
        "password": "manager123",
        "full_name": "Yard Manager",
        "role": UserRole.FLEET_MANAGER,
        "phone": "+91 9876543211",
    },
    {
        "email": "operator@fleetvision.ai",
        "password": "operator123",
        "full_name": "Site Operator",
        "role": UserRole.OPERATOR,
        "phone": "+91 9876543212",
    },
    {
        "email": "customer@fleetvision.ai",
        "password": "customer123",
        "full_name": "Acme Earthworks",
        "role": UserRole.CUSTOMER,
        "phone": "+91 9876543213",
    },
]


class Command(BaseCommand):
    help = "Ensure admin / manager / operator / customer demo logins exist"

    def handle(self, *args, **options):
        for row in ROLE_USERS:
            email = row["email"]
            password = row["password"]
            defaults = {
                "full_name": row["full_name"],
                "role": row["role"],
                "phone": row.get("phone", ""),
                "is_staff": row.get("is_staff", False),
                "is_superuser": row.get("is_superuser", False),
                "is_active": True,
            }
            user = User.objects.filter(email=email).first()
            if not user:
                user = User.objects.create_user(email=email, password=password, **defaults)
                self.stdout.write(self.style.SUCCESS(f"Created {email} / {password}"))
            else:
                for k, v in defaults.items():
                    setattr(user, k, v)
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.WARNING(f"Updated {email} / {password}"))

        self.stdout.write("")
        self.stdout.write("Demo logins:")
        self.stdout.write("  admin@fleetvision.ai    / admin123     (Administrator)")
        self.stdout.write("  manager@fleetvision.ai  / manager123   (Fleet Manager)")
        self.stdout.write("  operator@fleetvision.ai / operator123  (Operator)")
        self.stdout.write("  customer@fleetvision.ai / customer123  (Customer)")
