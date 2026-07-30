from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AlertsBoardView, AlertsScanView, NotificationViewSet

router = DefaultRouter()
router.register("", NotificationViewSet, basename="notifications")

urlpatterns = [
    path("alerts/board/", AlertsBoardView.as_view(), name="alerts-board"),
    path("alerts/scan/", AlertsScanView.as_view(), name="alerts-scan"),
    path("", include(router.urls)),
]
