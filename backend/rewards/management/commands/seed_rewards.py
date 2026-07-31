from django.core.management.base import BaseCommand

from common.permissions import IsFleetManagerOrAdmin  # noqa: F401 — keep import graph stable
from rewards.services import award_for_completed_rentals, ensure_customer_profiles


class Command(BaseCommand):
    help = "Seed customer reward profiles and backfill points from completed rentals"

    def handle(self, *args, **options):
        created = ensure_customer_profiles()
        awarded = award_for_completed_rentals()
        self.stdout.write(self.style.SUCCESS(f"Profiles ensured/created={created}, points events={awarded}"))
