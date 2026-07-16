from django.urls import path
from .views import AIChatView, DashboardSummaryView, DriverAnalysisView, FuelAnalysisView, PredictMaintenanceView

urlpatterns = [
    path("chat", AIChatView.as_view()),
    path("dashboard-summary", DashboardSummaryView.as_view()),
    path("driver-analysis", DriverAnalysisView.as_view()),
    path("fuel-analysis", FuelAnalysisView.as_view()),
    path("predict-maintenance", PredictMaintenanceView.as_view()),
]
