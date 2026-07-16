from django.urls import path
from .views import (
    DashboardReportView, VehicleReportView, DriverReportView,
    TripReportView, FuelReportView, MaintenanceReportView, ExpenseReportView,
)

urlpatterns = [
    path("dashboard", DashboardReportView.as_view()),
    path("vehicles", VehicleReportView.as_view()),
    path("drivers", DriverReportView.as_view()),
    path("trips", TripReportView.as_view()),
    path("fuel", FuelReportView.as_view()),
    path("maintenance", MaintenanceReportView.as_view()),
    path("expenses", ExpenseReportView.as_view()),
]
