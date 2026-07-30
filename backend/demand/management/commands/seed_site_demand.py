from django.core.management.base import BaseCommand
from demand.services import seed_site_demand


class Command(BaseCommand):
    help = "Seed site_demand.csv into SiteDemand"

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true")

    def handle(self, *args, **options):
        try:
            n = seed_site_demand(force=options["force"])
            self.stdout.write(self.style.SUCCESS(f"Site demand rows: {n}"))
        except FileNotFoundError as exc:
            self.stderr.write(self.style.ERROR(str(exc)))
