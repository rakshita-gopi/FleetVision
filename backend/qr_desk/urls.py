from django.urls import path
from .views import (
    ConfirmCheckinView,
    ConfirmCheckoutView,
    GenerateCheckoutQRView,
    QrCancelPendingView,
    QrEligibleEquipmentView,
    QrPendingListView,
    ScanQRView,
)

urlpatterns = [
    path("generate/", GenerateCheckoutQRView.as_view(), name="qr-generate"),
    path("scan/", ScanQRView.as_view(), name="qr-scan"),
    path("confirm-checkout/", ConfirmCheckoutView.as_view(), name="qr-confirm-checkout"),
    path("confirm-checkin/", ConfirmCheckinView.as_view(), name="qr-confirm-checkin"),
    path("open/", QrPendingListView.as_view(), name="qr-open"),
    path("eligible/", QrEligibleEquipmentView.as_view(), name="qr-eligible"),
    path("cancel-pending/", QrCancelPendingView.as_view(), name="qr-cancel-pending"),
]
