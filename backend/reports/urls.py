from django.urls import path
from .views import (
    DashboardReportView,
    ReportChatView,
    GenerateReportView,
    ReportHistoryView,
    ReportDownloadView,
    ReportPreviewView,
)

urlpatterns = [
    path("dashboard", DashboardReportView.as_view()),
    path("chat", ReportChatView.as_view()),
    path("generate", GenerateReportView.as_view()),
    path("history", ReportHistoryView.as_view()),
    path("<uuid:report_id>/download", ReportDownloadView.as_view()),
    path("<uuid:report_id>/preview", ReportPreviewView.as_view()),
]