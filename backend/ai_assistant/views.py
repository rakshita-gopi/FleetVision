import os
import json
from django.db.models import Sum, Count
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
from notifications.models import AIReport
from .services import call_ollama


def _gather_rental_context():
    from datetime import date
    from django.db.models import Avg, Count
    from equipment.models import Equipment
    from rentals.models import Rental, RentalStatus

    today = date.today()
    status_counts = dict(
        Equipment.objects.values("current_status").annotate(c=Count("id")).values_list("current_status", "c")
    )
    overdue = Rental.objects.filter(
        rental_status=RentalStatus.ACTIVE,
        expected_return_date__lt=today,
        actual_return_date__isnull=True,
    ).count()
    due_soon = Rental.objects.filter(
        rental_status=RentalStatus.ACTIVE,
        expected_return_date__gte=today,
        expected_return_date__lte=today + timedelta(days=3),
        actual_return_date__isnull=True,
    ).count()
    total = sum(status_counts.values()) or 1
    active = status_counts.get("ACTIVE", 0)
    return {
        "equipment_total": Equipment.objects.count(),
        "available": status_counts.get("AVAILABLE", 0),
        "active": active,
        "idle": status_counts.get("IDLE", 0),
        "maintenance": status_counts.get("MAINTENANCE", 0),
        "active_rentals": Rental.objects.filter(rental_status=RentalStatus.ACTIVE).count(),
        "overdue_rentals": overdue,
        "returns_due_3d": due_soon,
        "utilisation_pct": round(100 * active / total, 1),
        "avg_engine_hours": round(
            float(Equipment.objects.aggregate(a=Avg("total_engine_hours"))["a"] or 0), 1
        ),
    }


def _fallback_rental_summary(ctx):
    return (
        f"Rental-IQ ops brief\n"
        f"• Fleet: {ctx['equipment_total']} assets — {ctx['available']} available, "
        f"{ctx['active']} on rent, {ctx['idle']} idle, {ctx['maintenance']} in maintenance.\n"
        f"• Utilisation ~{ctx['utilisation_pct']}% with avg engine hours {ctx['avg_engine_hours']}.\n"
        f"• {ctx['active_rentals']} active rentals; {ctx['overdue_rentals']} overdue; "
        f"{ctx['returns_due_3d']} returns due within 3 days.\n"
        f"• Priority: clear overdue returns, reallocate idle iron, inspect high-hour assets."
    )


def _gather_fleet_context():
    rental = _gather_rental_context()
    if rental["equipment_total"] > 0:
        return rental
    today = timezone.now().date()
    return {
        "vehicles_total": Vehicle.objects.count(),
        "vehicles_active": Vehicle.objects.filter(status=VehicleStatus.ON_TRIP).count(),
        "vehicles_maintenance": Vehicle.objects.filter(status=VehicleStatus.UNDER_MAINTENANCE).count(),
        "drivers_total": Driver.objects.count(),
        "trips_active": Trip.objects.filter(trip_status=TripStatus.IN_PROGRESS).count(),
        "trips_today": Trip.objects.filter(created_at__date=today).count(),
        "fuel_cost_month": float(FuelLog.objects.filter(
            fuel_date__gte=today.replace(day=1)
        ).aggregate(t=Sum("fuel_cost"))["t"] or 0),
        "maintenance_due": MaintenanceRecord.objects.filter(
            next_service_date__lte=today + timedelta(days=7)
        ).count(),
        "insurance_expiring": Vehicle.objects.filter(
            insurance_expiry__lte=today + timedelta(days=30)
        ).count(),
        "expenses_month": float(Expense.objects.filter(
            expense_date__gte=today.replace(day=1)
        ).aggregate(t=Sum("amount"))["t"] or 0),
    }


def _fallback_summary(ctx):
    if "equipment_total" in ctx:
        return _fallback_rental_summary(ctx)
    return (
        f"Fleet Summary – Today\n"
        f"• {ctx['vehicles_total']} vehicles in fleet, {ctx['vehicles_active']} currently on active trips.\n"
        f"• {ctx['drivers_total']} drivers registered.\n"
        f"• {ctx['trips_today']} trips scheduled/completed today.\n"
        f"• Monthly fuel cost: ₹{ctx['fuel_cost_month']:,.0f}.\n"
        f"• {ctx['maintenance_due']} vehicles require servicing within 7 days.\n"
        f"• {ctx['insurance_expiring']} insurance policies expiring within 30 days."
    )


def _fallback_chat(question, ctx):
    q = question.lower()
    if "equipment_total" in ctx:
        if "overdue" in q or "return" in q:
            return (
                f"{ctx['overdue_rentals']} rentals are overdue and {ctx['returns_due_3d']} returns are due "
                f"within 3 days. Clear overdue check-ins first, then reallocate idle assets."
            )
        if "util" in q or "idle" in q:
            return (
                f"Utilisation is ~{ctx['utilisation_pct']}% with {ctx['idle']} idle and "
                f"{ctx['available']} available. Reallocate idle iron onto active sites."
            )
        if "inspect" in q or "maintain" in q:
            return (
                f"{ctx['maintenance']} assets are in maintenance. Avg engine hours "
                f"{ctx['avg_engine_hours']} — prioritise high-hour inspections."
            )
        return _fallback_rental_summary(ctx)
    if "maintenance" in q or "servicing" in q:
        due = MaintenanceRecord.objects.filter(
            next_service_date__lte=timezone.now().date() + timedelta(days=7)
        ).select_related("vehicle")[:5]
        if due:
            names = ", ".join(r.vehicle.vehicle_number for r in due)
            return f"{due.count()} vehicle(s) require maintenance this week: {names}."
        return "No vehicles require immediate maintenance."
    if "active trip" in q or "active trips" in q:
        count = ctx["trips_active"]
        return f"There are currently {count} active trips in progress."
    if "fuel" in q:
        return f"Monthly fuel expenses total ₹{ctx['fuel_cost_month']:,.0f}. Review fuel logs for detailed breakdown."
    return _fallback_summary(ctx)


class AIChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question = request.data.get("question", "")
        if not question:
            return api_response(False, "Question is required", status_code=400)
        ctx = _gather_fleet_context()
        prompt = f"Fleet data: {json.dumps(ctx)}\n\nUser question: {question}\nProvide a concise, actionable answer."
        answer = call_ollama(prompt) or _fallback_chat(question, ctx)
        return api_response(True, "AI response", {"answer": answer, "question": question})


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ctx = _gather_fleet_context()
        if "equipment_total" in ctx:
            prompt = (
                "You are Rental-IQ. Write a concise executive ops brief (4-6 bullets) from this rental data. "
                "Cover utilisation, overdue/returns, idle assets, and one recommended action:\n"
                f"{json.dumps(ctx, indent=2)}"
            )
        else:
            prompt = (
                f"Analyze this fleet data and generate a concise executive summary with bullet points:\n"
                f"{json.dumps(ctx, indent=2)}\nProvide recommendations."
            )
        summary = call_ollama(prompt) or _fallback_summary(ctx)
        AIReport.objects.create(report_type="Daily Fleet Summary", summary=summary)
        return api_response(True, "Dashboard summary", {"summary": summary, "context": ctx})


class DriverAnalysisView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        drivers = Driver.objects.select_related("user").all()
        data = []
        for d in drivers:
            trips = d.trips.filter(trip_status=TripStatus.COMPLETED).count()
            fuel = FuelLog.objects.filter(driver=d).aggregate(t=Sum("fuel_cost"))["t"] or 0
            score = min(100, 50 + trips * 5 - float(fuel) / 1000)
            data.append({
                "driver": d.user.full_name,
                "trips_completed": trips,
                "fuel_cost": float(fuel),
                "performance_score": round(score, 1),
            })
        data.sort(key=lambda x: x["performance_score"], reverse=True)
        return api_response(True, "Driver analysis", data)


class FuelAnalysisView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = FuelLog.objects.select_related("vehicle").values(
            "vehicle__vehicle_number"
        ).annotate(
            total_cost=Sum("fuel_cost"),
            total_quantity=Sum("fuel_quantity"),
            avg_mileage=Sum("mileage"),
        ).order_by("-total_cost")[:10]
        analysis = list(logs)
        prompt_data = json.dumps(analysis, default=str)
        insight = call_ollama(
            f"Analyze fuel consumption data and identify anomalies:\n{prompt_data}"
        ) or "Review vehicles with highest fuel costs for efficiency improvements."
        return api_response(True, "Fuel analysis", {"data": analysis, "insight": insight})


class PredictMaintenanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        predictions = []
        for v in Vehicle.objects.all()[:20]:
            last = MaintenanceRecord.objects.filter(vehicle=v).order_by("-service_date").first()
            if last and last.next_service_date:
                days_until = (last.next_service_date - today).days
                if days_until <= 14:
                    predictions.append({
                        "vehicle": v.vehicle_number,
                        "service_type": last.service_type,
                        "days_until": days_until,
                        "recommendation": f"Schedule {last.service_type} within {max(days_until, 0)} days.",
                    })
            elif v.odometer > 50000:
                predictions.append({
                    "vehicle": v.vehicle_number,
                    "service_type": "General Inspection",
                    "days_until": 0,
                    "recommendation": f"Vehicle has {v.odometer} km — recommend preventive inspection.",
                })
        return api_response(True, "Predictive maintenance", predictions)
