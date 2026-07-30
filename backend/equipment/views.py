from datetime import timedelta

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone

from common.response import api_response
from rentals.models import Rental, RentalStatus
from telemetry.consumers.processor import get_live_state
from .models import Equipment
from .serializers import EquipmentSerializer


class EquipmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Equipment.objects.select_related("model_ref", "current_site", "current_operator").all()
    serializer_class = EquipmentSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(current_status=status_filter)
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(Q(asset_id__icontains=q) | Q(serial_number__icontains=q) | Q(model_ref__model__icontains=q))
        return api_response(True, "Equipment retrieved", self.get_serializer(qs, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        data = self.get_serializer(obj).data
        live = get_live_state(str(obj.id))
        data["live"] = live
        return api_response(True, "Equipment retrieved", data)

    @action(detail=True, methods=["get"], url_path="live")
    def live(self, request, id=None):
        obj = self.get_object()
        state = get_live_state(str(obj.id))
        if not state:
            return api_response(False, "No live state", status_code=404)
        state["asset_id"] = obj.asset_id
        return api_response(True, "Live equipment state", state)

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        counts = Equipment.objects.aggregate(
            total=Count("id"),
            available=Count("id", filter=Q(current_status="AVAILABLE")),
            active=Count("id", filter=Q(current_status="ACTIVE")),
            idle=Count("id", filter=Q(current_status="IDLE")),
            maintenance=Count("id", filter=Q(current_status="MAINTENANCE")),
        )
        today = timezone.now().date()
        overdue_qs = Rental.objects.filter(
            rental_status=RentalStatus.ACTIVE,
            expected_return_date__lt=today,
            actual_return_date__isnull=True,
        ).select_related("equipment", "site")
        due_soon_qs = Rental.objects.filter(
            rental_status=RentalStatus.ACTIVE,
            expected_return_date__gte=today,
            expected_return_date__lte=today + timedelta(days=7),
            actual_return_date__isnull=True,
        ).select_related("equipment", "site").order_by("expected_return_date")[:8]
        underutilised = Equipment.objects.filter(current_status="IDLE").count()
        total = counts["total"] or 1
        live_count = 0
        try:
            from telemetry.consumers.processor import get_all_live_states

            live_count = len(get_all_live_states())
        except Exception:
            live_count = 0

        returns = [
            {
                "id": str(r.id),
                "rental_id": r.rental_id,
                "asset_id": r.equipment.asset_id,
                "site_id": r.site.site_id if r.site else None,
                "expected_return_date": str(r.expected_return_date) if r.expected_return_date else None,
                "days_until": (r.expected_return_date - today).days if r.expected_return_date else None,
                "overdue": bool(r.expected_return_date and r.expected_return_date < today),
            }
            for r in list(overdue_qs.order_by("expected_return_date")[:6]) + list(due_soon_qs)
        ]
        # de-dupe by rental id preserving order
        seen = set()
        returns_unique = []
        for row in returns:
            if row["id"] in seen:
                continue
            seen.add(row["id"])
            returns_unique.append(row)

        return api_response(
            True,
            "Rental dashboard",
            {
                **counts,
                "overdue_rentals": overdue_qs.count(),
                "underutilised": underutilised,
                "active_rentals": Rental.objects.filter(rental_status=RentalStatus.ACTIVE).count(),
                "utilisation_pct": round(100 * (counts["active"] or 0) / total, 1),
                "live_assets": live_count,
                "returns": returns_unique[:10],
            },
        )
