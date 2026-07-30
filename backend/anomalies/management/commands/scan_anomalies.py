from django.core.management.base import BaseCommand
from anomalies.services import detect_anomalies


class Command(BaseCommand):
    help = "Scan fleet for idle / unassigned / underuse / misuse anomalies and emit notifications"

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-notify",
            action="store_true",
            help="Detect only; do not write Notification rows",
        )

    def handle(self, *args, **options):
        result = detect_anomalies(emit_notifications=not options["no_notify"])
        self.stdout.write(
            self.style.SUCCESS(
                f"Anomalies: {result['total']} (notified {result.get('notifications_created', 0)}) "
                f"counts={result['counts']}"
            )
        )
