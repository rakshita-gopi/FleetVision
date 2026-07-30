from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.permissions import IsFleetManagerOrAdmin
from common.response import api_response
from rentals.serializers import RentalSerializer
from .services import (
    build_scan_payload,
    confirm_checkin,
    confirm_checkout,
    generate_checkout_qr,
    resolve_rental,
)


class GenerateCheckoutQRView(APIView):
    """Rental Manager: create Pending Checkout rental + QR payload (rental_id only)."""

    permission_classes = [IsFleetManagerOrAdmin]

    def post(self, request):
        try:
            rental = generate_checkout_qr(
                equipment_id=request.data.get("equipment_id") or "",
                operator_id=request.data.get("operator_id"),
                site_id=request.data.get("site_id"),
                customer_id=request.data.get("customer_id") or "",
                customer_name=request.data.get("customer_name") or "",
                expected_return_date=request.data.get("expected_return_date"),
                daily_rate=float(request.data.get("daily_rate") or 500),
            )
        except ValueError as exc:
            return api_response(False, str(exc), status_code=400)
        data = RentalSerializer(rental).data
        data["qr_payload"] = rental.rental_id
        data["qr_hint"] = "Encode only the rental_id in the QR code"
        return api_response(True, "Check-out QR generated", data, status_code=201)


class ScanQRView(APIView):
    """Operator: scan QR → fetch equipment/customer/operator/status/health."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get("code") or request.data.get("rental_id") or ""
        rental = resolve_rental(code)
        if not rental:
            return api_response(
                False,
                "QR Invalid — rental not found. Please contact Rental Manager.",
                {"valid": False, "mode": "invalid"},
                status_code=404,
            )
        payload = build_scan_payload(rental)
        ok = payload.get("valid", False)
        return api_response(ok, payload.get("message", "Scan result"), payload, status_code=200 if ok else 400)


class ConfirmCheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get("code") or request.data.get("rental_id") or ""
        rental = resolve_rental(code)
        if not rental:
            return api_response(False, "Rental not found", status_code=404)
        try:
            rental = confirm_checkout(rental, request.data)
        except ValueError as exc:
            return api_response(False, str(exc), status_code=400)
        data = RentalSerializer(rental).data
        data["scan"] = build_scan_payload(rental)
        return api_response(True, "Checkout confirmed — rental Active", data)


class ConfirmCheckinView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get("code") or request.data.get("rental_id") or ""
        rental = resolve_rental(code)
        if not rental:
            return api_response(False, "Rental not found", status_code=404)
        try:
            rental = confirm_checkin(rental, request.data)
        except ValueError as exc:
            return api_response(False, str(exc), status_code=400)
        data = RentalSerializer(rental).data
        data["scan"] = build_scan_payload(rental)
        data["invoice_number"] = rental.invoice_number
        return api_response(True, "Check-in complete — invoice generated, QR expired", data)


class QrPendingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from rentals.models import Rental, RentalStatus

        qs = (
            Rental.objects.select_related("equipment", "operator", "site")
            .filter(rental_status__in=[RentalStatus.PENDING_CHECKOUT, RentalStatus.ACTIVE])
            .order_by("-created_at")[:40]
        )
        rows = []
        for r in qs:
            rows.append(
                {
                    "id": str(r.id),
                    "rental_id": r.rental_id,
                    "transaction_id": r.transaction_id,
                    "asset_id": r.equipment.asset_id,
                    "status": r.rental_status,
                    "customer_name": r.customer_name,
                    "operator_name": r.operator.name if r.operator else None,
                    "expected_return_date": str(r.expected_return_date) if r.expected_return_date else None,
                    "qr_payload": r.rental_id,
                }
            )
        return api_response(True, "Open QR rentals", rows)
