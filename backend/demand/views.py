from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.permissions import IsFleetManagerOrAdmin
from common.response import api_response
from .models import SiteDemand
from .services import build_forecast, seed_site_demand


class DemandForecastView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not SiteDemand.objects.exists():
            try:
                seed_site_demand()
            except FileNotFoundError as exc:
                return api_response(False, str(exc), status_code=404)
        try:
            horizon = min(int(request.query_params.get("horizon", 7)), 21)
            lookback = min(int(request.query_params.get("lookback", 28)), 120)
        except ValueError:
            horizon, lookback = 7, 28
        data = build_forecast(horizon_days=horizon, lookback_days=lookback)
        return api_response(True, "Demand forecast", data)


class DemandSeedView(APIView):
    permission_classes = [IsFleetManagerOrAdmin]

    def post(self, request):
        force = bool(request.data.get("force"))
        try:
            n = seed_site_demand(force=force)
        except FileNotFoundError as exc:
            return api_response(False, str(exc), status_code=404)
        return api_response(True, "Site demand seeded", {"rows": n})


class DemandHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        site_id = request.query_params.get("site_id")
        category = request.query_params.get("category")
        qs = SiteDemand.objects.select_related("site").all()
        if site_id:
            qs = qs.filter(site__site_id=site_id)
        if category:
            qs = qs.filter(equipment_category__icontains=category)
        rows = [
            {
                "date": str(r.date),
                "site_id": r.site.site_id,
                "site_name": r.site.site_name,
                "equipment_category": r.equipment_category,
                "requested_units": r.requested_units,
                "allocated_units": r.allocated_units,
                "utilisation_pct": r.utilisation_pct,
                "shortfall": max(0, r.requested_units - r.allocated_units),
            }
            for r in qs.order_by("-date")[:200]
        ]
        return api_response(True, "Demand history", rows)
