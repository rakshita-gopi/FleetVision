import os
import json
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from vehicles.models import Vehicle, VehicleStatus
from drivers.models import Driver
from trips.models import Trip, TripStatus
from fuel.models import FuelLog
from maintenance.models import MaintenanceRecord
from expenses.models import Expense
from notifications.models import Notification


class DashboardReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        month_start = today.replace(day=1)

        total_vehicles = Vehicle.objects.count()
        active_vehicles = Vehicle.objects.filter(status=VehicleStatus.ON_TRIP).count()
        total_drivers = Driver.objects.count()
        trips_today = Trip.objects.filter(created_at__date=today).count()
        fuel_cost_month = FuelLog.objects.filter(fuel_date__gte=month_start).aggregate(
            total=Sum("fuel_cost")
        )["total"] or 0
        maintenance_cost_month = MaintenanceRecord.objects.filter(service_date__gte=month_start).aggregate(
            total=Sum("repair_cost")
        )["total"] or 0
        expenses_month = Expense.objects.filter(expense_date__gte=month_start).aggregate(
            total=Sum("amount")
        )["total"] or 0
        unread_notifications = Notification.objects.filter(is_read=False).count()

        vehicle_status = list(
            Vehicle.objects.values("status").annotate(count=Count("id"))
        )
        active_trips = Trip.objects.filter(trip_status=TripStatus.IN_PROGRESS).count()

        return api_response(True, "Dashboard report", {
            "total_vehicles": total_vehicles,
            "active_vehicles": active_vehicles,
            "total_drivers": total_drivers,
            "trips_today": trips_today,
            "active_trips": active_trips,
            "fuel_cost_month": float(fuel_cost_month),
            "maintenance_cost_month": float(maintenance_cost_month),
            "expenses_month": float(expenses_month),
            "unread_notifications": unread_notifications,
            "vehicle_status_distribution": vehicle_status,
        })


class VehicleReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vehicles = Vehicle.objects.all().values(
            "id", "vehicle_number", "manufacturer", "model", "status", "fuel_type", "odometer"
        )
        return api_response(True, "Vehicle report", list(vehicles))


class DriverReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        drivers = Driver.objects.select_related("user", "assigned_vehicle").all()
        data = [{
            "id": str(d.id),
            "name": d.user.full_name,
            "license_number": d.license_number,
            "status": d.status,
            "trips_completed": d.trips.filter(trip_status=TripStatus.COMPLETED).count(),
            "assigned_vehicle": d.assigned_vehicle.vehicle_number if d.assigned_vehicle else None,
        } for d in drivers]
        return api_response(True, "Driver report", data)


class TripReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        trips = Trip.objects.select_related("vehicle", "driver__user").all().order_by("-created_at")[:100]
        data = [{
            "id": str(t.id),
            "vehicle": t.vehicle.vehicle_number,
            "driver": t.driver.user.full_name,
            "source": t.source,
            "destination": t.destination,
            "status": t.trip_status,
            "distance": float(t.distance),
            "start_time": t.start_time,
            "end_time": t.end_time,
        } for t in trips]
        return api_response(True, "Trip report", data)


class FuelReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = FuelLog.objects.select_related("vehicle").all().order_by("-fuel_date")[:100]
        data = [{
            "vehicle": l.vehicle.vehicle_number,
            "quantity": float(l.fuel_quantity),
            "cost": float(l.fuel_cost),
            "mileage": float(l.mileage),
            "date": str(l.fuel_date),
        } for l in logs]
        monthly = FuelLog.objects.annotate(
            month=TruncMonth("fuel_date")
        ).values("month").annotate(total_cost=Sum("fuel_cost"), total_quantity=Sum("fuel_quantity"))
        return api_response(True, "Fuel report", {"logs": data, "monthly": list(monthly)})


class MaintenanceReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        records = MaintenanceRecord.objects.select_related("vehicle").all().order_by("-service_date")
        data = [{
            "vehicle": r.vehicle.vehicle_number,
            "service_type": r.service_type,
            "mechanic": r.mechanic_name,
            "cost": float(r.repair_cost),
            "service_date": str(r.service_date),
            "next_service_date": str(r.next_service_date) if r.next_service_date else None,
        } for r in records]
        return api_response(True, "Maintenance report", data)


class ExpenseReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        by_category = Expense.objects.values("expense_category").annotate(total=Sum("amount"))
        by_vehicle = Expense.objects.select_related("vehicle").values(
            "vehicle__vehicle_number"
        ).annotate(total=Sum("amount"))
        return api_response(True, "Expense report", {
            "by_category": list(by_category),
            "by_vehicle": list(by_vehicle),
        })
