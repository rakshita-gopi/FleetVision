from django.core.management.base import BaseCommand
from notifications.services import scan_rental_due_alerts


class Command(BaseCommand):
    help = "Scan rentals and emit due-soon / due-today / overdue notifications"

    def handle(self, *args, **options):
        result = scan_rental_due_alerts()
        self.stdout.write(self.style.SUCCESS(f"Scan complete: {result}"))
