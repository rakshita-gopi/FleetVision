"""Fill empty demo fields and rebase open rental dates so desks/agents always have content."""

from __future__ import annotations

from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction

from equipment.models import Equipment, EquipmentStatus
from operators.models import Operator
from rentals.models import Rental, RentalStatus
from sites.models import Site

CUSTOMERS = [
    ("CUST101", "Chennai Metro Civil"),
    ("CUST102", "TN Infra Pvt Ltd"),
    ("CUST103", "Coromandel Quarries"),
    ("CUST104", "Bayshore Logistics"),
    ("CUST105", "Delta Earthmovers"),
    ("CUST106", "Salem Aggregate Co"),
    ("CUST107", "Tirupati Site Services"),
    ("CUST108", "Kanchipuram Builders"),
]


class Command(BaseCommand):
    help = "Refresh demo desk data: sites/operators on yard assets, overdue + due-soon rentals, customers"

    @transaction.atomic
    def handle(self, *args, **options):
        sites = list(Site.objects.order_by("site_id"))
        operators = list(Operator.objects.order_by("operator_id"))
        if not sites or not operators:
            self.stderr.write(self.style.ERROR("Sites/operators missing — run seed_rental_dataset first"))
            return

        filled_eq = 0
        for i, eq in enumerate(
            Equipment.objects.filter(
                current_status__in=[
                    EquipmentStatus.AVAILABLE,
                    EquipmentStatus.IDLE,
                    EquipmentStatus.MAINTENANCE,
                ]
            ).order_by("asset_id")
        ):
            changed = False
            if not eq.current_site_id:
                eq.current_site = sites[i % len(sites)]
                changed = True
            if not eq.current_operator_id:
                # Yard / workshop lead so Operator is never blank in the UI
                eq.current_operator = operators[i % len(operators)]
                changed = True
            if changed:
                eq.save(update_fields=["current_site", "current_operator", "updated_at"])
                filled_eq += 1

        # Also fill any ACTIVE asset somehow missing site/operator
        for i, eq in enumerate(
            Equipment.objects.filter(current_status=EquipmentStatus.ACTIVE)
            .filter(current_site__isnull=True)
            .order_by("asset_id")
        ):
            eq.current_site = sites[i % len(sites)]
            if not eq.current_operator_id:
                eq.current_operator = operators[i % len(operators)]
            eq.save(update_fields=["current_site", "current_operator", "updated_at"])
            filled_eq += 1

        today = date.today()
        open_rentals = list(
            Rental.objects.filter(
                rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE],
                actual_return_date__isnull=True,
            )
            .select_related("equipment", "site", "operator")
            .order_by("rental_id")
        )

        # Ensure every open rental has site, operator, customer
        for i, r in enumerate(open_rentals):
            changed_fields = []
            if not r.site_id:
                r.site = r.equipment.current_site or sites[i % len(sites)]
                changed_fields.append("site")
            if not r.operator_id:
                r.operator = r.equipment.current_operator or operators[i % len(operators)]
                changed_fields.append("operator")
            if not (r.customer_name or "").strip():
                cid, cname = CUSTOMERS[i % len(CUSTOMERS)]
                r.customer_id = r.customer_id or cid
                r.customer_name = cname
                changed_fields.extend(["customer_id", "customer_name"])
            if changed_fields:
                changed_fields.append("updated_at")
                r.save(update_fields=list(dict.fromkeys(changed_fields)))

        n = len(open_rentals)
        if n == 0:
            self.stdout.write(self.style.WARNING("No open rentals to rebase"))
        else:
            # Shape the desk: ~15 overdue, 2 due today, ~10 due soon (1–3d), rest +5–14d active
            overdue_n = min(15, max(1, n // 4))
            due_today_n = min(2, max(0, n - overdue_n))
            due_soon_n = min(10, max(0, n - overdue_n - due_today_n))

            idx = 0
            for j in range(overdue_n):
                r = open_rentals[idx]
                r.expected_return_date = today - timedelta(days=2 + (j % 10))
                r.rental_status = RentalStatus.OVERDUE
                if not r.check_out_date:
                    r.check_out_date = r.expected_return_date - timedelta(days=14)
                r.save(update_fields=["expected_return_date", "rental_status", "check_out_date", "updated_at"])
                idx += 1

            for j in range(due_today_n):
                r = open_rentals[idx]
                r.expected_return_date = today
                r.rental_status = RentalStatus.ACTIVE
                if not r.check_out_date:
                    r.check_out_date = today - timedelta(days=7)
                r.save(update_fields=["expected_return_date", "rental_status", "check_out_date", "updated_at"])
                idx += 1

            for j in range(due_soon_n):
                r = open_rentals[idx]
                r.expected_return_date = today + timedelta(days=1 + (j % 3))
                r.rental_status = RentalStatus.ACTIVE
                if not r.check_out_date:
                    r.check_out_date = today - timedelta(days=10)
                r.save(update_fields=["expected_return_date", "rental_status", "check_out_date", "updated_at"])
                idx += 1

            k = 0
            while idx < n:
                r = open_rentals[idx]
                r.expected_return_date = today + timedelta(days=5 + (k % 10))
                r.rental_status = RentalStatus.ACTIVE
                if not r.check_out_date:
                    r.check_out_date = today - timedelta(days=5)
                r.save(update_fields=["expected_return_date", "rental_status", "check_out_date", "updated_at"])
                idx += 1
                k += 1

        # Sync equipment status with open rentals (ACTIVE on rent, don't wipe yard sites)
        open_eq_ids = {
            r.equipment_id
            for r in Rental.objects.filter(
                rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE],
                actual_return_date__isnull=True,
            )
        }
        for eq in Equipment.objects.filter(id__in=open_eq_ids):
            if eq.current_status in (EquipmentStatus.AVAILABLE, EquipmentStatus.IDLE):
                eq.current_status = EquipmentStatus.ACTIVE
                eq.save(update_fields=["current_status", "updated_at"])

        overdue = Rental.objects.filter(
            rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE],
            expected_return_date__lt=today,
            actual_return_date__isnull=True,
        ).count()
        due_soon = Rental.objects.filter(
            rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE],
            expected_return_date__gte=today,
            expected_return_date__lte=today + timedelta(days=3),
            actual_return_date__isnull=True,
        ).count()
        bare_sites = Equipment.objects.filter(current_site__isnull=True).count()

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo desk refreshed: equipment_filled={filled_eq}, "
                f"overdue={overdue}, due_soon_3d={due_soon}, bare_sites={bare_sites}"
            )
        )
