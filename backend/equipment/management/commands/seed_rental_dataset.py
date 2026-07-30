import csv
import os
from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime

from equipment.models import Equipment, EquipmentModel
from operators.models import Operator
from rentals.models import Rental, RentalStatus
from sites.models import Site
from telemetry.consumers.processor import process_telemetry_event


def _dataset_root() -> Path:
    env = os.getenv("RENTAL_DATASET_PATH")
    if env:
        return Path(env)
    candidates = [
        Path(settings.BASE_DIR).parent / "cat_smart_rental_dataset",
        Path("/dataset"),
        Path(settings.BASE_DIR) / "cat_smart_rental_dataset",
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


def _read(path: Path):
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _parse_date(value):
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    return parse_date(str(value)[:10])


class Command(BaseCommand):
    help = "Seed Rental-IQ domain data from cat_smart_rental_dataset CSVs"

    def add_arguments(self, parser):
        parser.add_argument("--telemetry-limit", type=int, default=500, help="Max telemetry rows to ingest")
        parser.add_argument("--rentals-limit", type=int, default=0, help="0 = all rentals")
        parser.add_argument("--force", action="store_true", help="Reseed even if equipment already exists")

    @transaction.atomic
    def handle(self, *args, **options):
        root = _dataset_root()
        if not root.exists():
            self.stderr.write(self.style.ERROR(f"Dataset not found at {root}"))
            return

        if Equipment.objects.exists() and not options["force"]:
            self.stdout.write(self.style.WARNING("Equipment already seeded; skipping (use --force to reseed)"))
            return

        if options["force"]:
            Rental.objects.all().delete()
            Equipment.objects.all().delete()
            EquipmentModel.objects.all().delete()
            Operator.objects.all().delete()
            Site.objects.all().delete()

        self.stdout.write(f"Seeding from {root}")

        for row in _read(root / "sites.csv"):
            Site.objects.update_or_create(
                site_id=row["site_id"],
                defaults={
                    "site_name": row.get("site_name") or row["site_id"],
                    "site_type": row.get("site_type") or "",
                    "latitude": float(row["latitude"]) if row.get("latitude") else None,
                    "longitude": float(row["longitude"]) if row.get("longitude") else None,
                    "status": row.get("status") or "ACTIVE",
                },
            )

        for row in _read(root / "operators.csv"):
            Operator.objects.update_or_create(
                operator_id=row["operator_id"],
                defaults={
                    "name": row.get("name") or row["operator_id"],
                    "certification": row.get("certification") or "",
                    "experience_years": int(float(row["experience_years"] or 0)),
                    "shift": row.get("shift") or "",
                    "status": row.get("status") or "ACTIVE",
                },
            )

        for row in _read(root / "equipment_models.csv"):
            EquipmentModel.objects.update_or_create(
                model_id=row["model_id"],
                defaults={
                    "manufacturer": row.get("manufacturer") or "Caterpillar",
                    "model": row.get("model") or row["model_id"],
                    "category": row.get("category") or "",
                    "gross_power_kw": float(row["gross_power_kw"]) if row.get("gross_power_kw") else None,
                    "operating_weight_kg": float(row["operating_weight_kg"])
                    if row.get("operating_weight_kg")
                    else None,
                },
            )

        sites = {s.site_id: s for s in Site.objects.all()}
        operators = {o.operator_id: o for o in Operator.objects.all()}
        models = {m.model_id: m for m in EquipmentModel.objects.all()}

        for row in _read(root / "equipment.csv"):
            Equipment.objects.update_or_create(
                asset_id=row["asset_id"],
                defaults={
                    "model_ref": models.get(row.get("model_id")),
                    "serial_number": row.get("serial_number") or "",
                    "manufacture_year": int(row["manufacture_year"]) if row.get("manufacture_year") else None,
                    "acquisition_type": row.get("acquisition_type") or "",
                    "current_status": (row.get("current_status") or "AVAILABLE").upper(),
                    "current_site": sites.get(row.get("current_site")) if row.get("current_site") else None,
                    "current_operator": operators.get(row.get("current_operator"))
                    if row.get("current_operator")
                    else None,
                    "total_engine_hours": float(row.get("total_engine_hours") or 0),
                },
            )

        equipment = {e.asset_id: e for e in Equipment.objects.all()}
        rentals_rows = _read(root / "rentals.csv")
        limit = options["rentals_limit"]
        if limit:
            rentals_rows = rentals_rows[:limit]

        for row in rentals_rows:
            eq = equipment.get(row.get("asset_id"))
            if not eq:
                continue
            status = (row.get("rental_status") or "ACTIVE").upper()
            if status not in RentalStatus.values:
                status = RentalStatus.ACTIVE
            Rental.objects.update_or_create(
                rental_id=row["rental_id"],
                defaults={
                    "equipment": eq,
                    "site": sites.get(row.get("site_id")),
                    "operator": operators.get(row.get("operator_id")),
                    "check_out_date": _parse_date(row.get("check_out_date")),
                    "expected_return_date": _parse_date(row.get("expected_return_date")),
                    "actual_return_date": _parse_date(row.get("actual_return_date")),
                    "rental_days": int(float(row.get("rental_days") or 0)),
                    "daily_rate": float(row.get("synthetic_daily_rate") or 0),
                    "rental_status": status,
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded sites={Site.objects.count()} operators={Operator.objects.count()} "
                f"models={EquipmentModel.objects.count()} equipment={Equipment.objects.count()} "
                f"rentals={Rental.objects.count()}"
            )
        )

        tel_path = root / "telemetry_24h_5min.csv"
        tel_limit = options["telemetry_limit"]
        if tel_path.exists() and tel_limit > 0:
            ingested = 0
            for row in _read(tel_path):
                if ingested >= tel_limit:
                    break
                eq = equipment.get(row.get("asset_id"))
                if not eq:
                    continue
                event = {
                    "event_id": str(uuid4()),
                    "vehicle_id": str(eq.id),
                    "timestamp": row.get("timestamp") or datetime.utcnow().isoformat() + "Z",
                    "location": {
                        "latitude": float(row["latitude"]) if row.get("latitude") else None,
                        "longitude": float(row["longitude"]) if row.get("longitude") else None,
                        "accuracy": None,
                    },
                    "motion": {
                        "speed": float(row.get("speed_kmh") or 0),
                        "heading": 0,
                    },
                    "vehicle": {
                        "rpm": int(float(row["engine_rpm"])) if row.get("engine_rpm") else None,
                        "fuel_level": float(row["fuel_level_pct"]) if row.get("fuel_level_pct") else None,
                        "engine_temperature": float(row["engine_temp_c"]) if row.get("engine_temp_c") else None,
                        "battery_voltage": float(row["battery_voltage"]) if row.get("battery_voltage") else None,
                        "odometer": float(row["engine_hours_total"]) if row.get("engine_hours_total") else None,
                    },
                    "source": "DATASET",
                }
                try:
                    process_telemetry_event(event)
                    ingested += 1
                except Exception as exc:
                    if ingested == 0:
                        self.stdout.write(self.style.WARNING(f"Telemetry ingest skipped: {exc}"))
                        break
            self.stdout.write(self.style.SUCCESS(f"Telemetry rows ingested: {ingested}"))
