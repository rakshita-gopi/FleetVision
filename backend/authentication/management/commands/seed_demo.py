from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone

from authentication.models import User, UserRole
from drivers.models import Driver, DriverStatus
from vehicles.models import Vehicle, VehicleStatus, VehicleType, FuelType
from trips.models import Trip, TripStatus
from fuel.models import FuelLog
from maintenance.models import MaintenanceRecord
from expenses.models import Expense, ExpenseCategory
from notifications.models import Notification, NotificationType
from gps.models import VehicleLocation


class Command(BaseCommand):
    help = "Seed FleetVision AI with demo data"

    def handle(self, *args, **options):
        if User.objects.filter(email="admin@fleetvision.ai").exists():
            self.stdout.write("Demo data already exists. Skipping.")
            return

        admin = User.objects.create_user(
            email="admin@fleetvision.ai",
            password="admin123",
            full_name="System Administrator",
            role=UserRole.ADMINISTRATOR,
            phone="+91 9876543210",
            is_staff=True,
            is_superuser=True,
        )
        manager = User.objects.create_user(
            email="manager@fleetvision.ai",
            password="manager123",
            full_name="Rajesh Kumar",
            role=UserRole.FLEET_MANAGER,
            phone="+91 9876543211",
        )

        vehicles_data = [
            ("TN38AB1234", "Tata", "Ace Gold", VehicleType.TRUCK, FuelType.DIESEL),
            ("TN37XY4567", "Mahindra", "Bolero Pickup", VehicleType.TRUCK, FuelType.DIESEL),
            ("TN66GH9087", "Ashok Leyland", "Dost", VehicleType.VAN, FuelType.DIESEL),
            ("KA01MN2345", "Toyota", "Innova Crysta", VehicleType.CAR, FuelType.DIESEL),
            ("MH12PQ6789", "Eicher", "Pro 2049", VehicleType.TRUCK, FuelType.DIESEL),
            ("DL01RS3456", "Maruti", "Eeco", VehicleType.VAN, FuelType.PETROL),
        ]

        vehicles = []
        for i, (vnum, mfr, model, vtype, ftype) in enumerate(vehicles_data):
            v = Vehicle.objects.create(
                vehicle_number=vnum,
                registration_number=f"REG-{vnum}",
                vehicle_type=vtype,
                manufacturer=mfr,
                model=model,
                manufacturing_year=2020 + i,
                fuel_type=ftype,
                purchase_date=date(2020 + i, 3, 15),
                insurance_expiry=date.today() + timedelta(days=30 + i * 10),
                fitness_expiry=date.today() + timedelta(days=90),
                pollution_expiry=date.today() + timedelta(days=60),
                odometer=25000 + i * 8000,
                status=VehicleStatus.AVAILABLE if i > 1 else VehicleStatus.ON_TRIP,
            )
            vehicles.append(v)

        drivers = []
        driver_names = [
            ("Rahul Sharma", "DL-0420110012345"),
            ("Priya Nair", "KL-0320220056789"),
            ("Amit Patel", "GJ-0120190034567"),
            ("Suresh Reddy", "AP-0520210078901"),
        ]
        for i, (name, license_no) in enumerate(driver_names):
            u = User.objects.create_user(
                email=f"driver{i+1}@fleetvision.ai",
                password="driver123",
                full_name=name,
                role=UserRole.DRIVER,
                phone=f"+91 98000000{i+1:02d}",
            )
            d = Driver.objects.create(
                user=u,
                license_number=license_no,
                license_expiry=date.today() + timedelta(days=180 + i * 30),
                address=f"Address {i+1}, Chennai",
                emergency_contact=f"+91 99000000{i+1:02d}",
                blood_group=["O+", "A+", "B+", "AB+"][i],
                experience_years=3 + i,
                joining_date=date(2022, 1, 1) + timedelta(days=i * 90),
                status=DriverStatus.ON_TRIP if i < 2 else DriverStatus.AVAILABLE,
                assigned_vehicle=vehicles[i] if i < len(vehicles) else None,
            )
            drivers.append(d)

        trips = [
            Trip.objects.create(
                vehicle=vehicles[0], driver=drivers[0],
                source="Chennai", destination="Bangalore",
                trip_status=TripStatus.IN_PROGRESS,
                start_time=timezone.now() - timedelta(hours=3),
                distance=Decimal("350"),
            ),
            Trip.objects.create(
                vehicle=vehicles[1], driver=drivers[1],
                source="Coimbatore", destination="Madurai",
                trip_status=TripStatus.IN_PROGRESS,
                start_time=timezone.now() - timedelta(hours=1),
                distance=Decimal("210"),
            ),
            Trip.objects.create(
                vehicle=vehicles[2], driver=drivers[2],
                source="Hyderabad", destination="Vijayawada",
                trip_status=TripStatus.SCHEDULED,
                distance=Decimal("275"),
            ),
            Trip.objects.create(
                vehicle=vehicles[3], driver=drivers[3],
                source="Mumbai", destination="Pune",
                trip_status=TripStatus.COMPLETED,
                start_time=timezone.now() - timedelta(days=1),
                end_time=timezone.now() - timedelta(hours=20),
                distance=Decimal("150"),
            ),
        ]

        for i, v in enumerate(vehicles[:4]):
            FuelLog.objects.create(
                vehicle=v, driver=drivers[i] if i < len(drivers) else None,
                fuel_station=f"Indian Oil - Station {i+1}",
                fuel_quantity=Decimal("45") + i * 5,
                fuel_cost=Decimal("4500") + i * 500,
                mileage=Decimal("12") + Decimal(str(i * 0.5)),
                fuel_date=date.today() - timedelta(days=i * 3),
            )
            MaintenanceRecord.objects.create(
                vehicle=v,
                mechanic_name="AutoCare Services",
                service_type=["Oil Change", "Brake Service", "General Service", "Tire Replacement"][i],
                service_date=date.today() - timedelta(days=30 + i * 10),
                next_service_date=date.today() + timedelta(days=15 + i * 5),
                repair_cost=Decimal("3500") + i * 1000,
            )
            Expense.objects.create(
                vehicle=v,
                expense_category=ExpenseCategory.FUEL,
                amount=Decimal("4500") + i * 500,
                expense_date=date.today() - timedelta(days=i * 2),
                description="Monthly fuel expense",
            )

        coords = [
            (12.9716, 77.5946), (13.0827, 80.2707), (11.0168, 76.9558), (19.0760, 72.8777),
        ]
        for i, v in enumerate(vehicles[:4]):
            VehicleLocation.objects.create(
                vehicle=v,
                driver=drivers[i] if i < len(drivers) else None,
                latitude=Decimal(str(coords[i][0])),
                longitude=Decimal(str(coords[i][1])),
                speed=Decimal(str(45 + i * 10)),
                heading=Decimal(str(90 + i * 45)),
            )

        Notification.objects.create(
            title="Insurance Expiring Soon",
            message=f"Vehicle {vehicles[0].vehicle_number} insurance expires in 30 days.",
            notification_type=NotificationType.INSURANCE_EXPIRY,
        )
        Notification.objects.create(
            title="Maintenance Due",
            message=f"Vehicle {vehicles[1].vehicle_number} requires brake service.",
            notification_type=NotificationType.MAINTENANCE_DUE,
        )
        Notification.objects.create(
            title="AI Recommendation",
            message="Fuel consumption increased 8% compared to last month. Review TN38AB1234.",
            notification_type=NotificationType.AI_RECOMMENDATION,
        )

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully!"))
        self.stdout.write("Login: admin@fleetvision.ai / admin123")
        self.stdout.write("Login: manager@fleetvision.ai / manager123")
        self.stdout.write("Login: driver1@fleetvision.ai / driver123")
