from django.urls import path
from .views import AnomalyDetectView, AnomalyScanNotifyView

urlpatterns = [
    path("", AnomalyDetectView.as_view(), name="anomalies-detect"),
    path("scan/", AnomalyScanNotifyView.as_view(), name="anomalies-scan"),
]
