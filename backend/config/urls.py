from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from telemetry.views import FleetLiveView, TelemetryIngestView, VehicleLiveView, VehicleTelemetryHistoryView


def api_root(_request):
    return JsonResponse(
        {
            "name": "Rental-IQ API",
            "status": "ok",
            "version": "v1",
            "docs": "/api/docs/",
            "schema": "/api/schema/",
            "health": "/api/v1/system/health/",
            "mcp": "/api/v1/mcp/tools/",
            "admin": "/admin/",
        }
    )


# Shared API route table — mounted under /api/v1/ (primary) and /api/ (legacy alias)
_api_patterns = [
    path("auth/", include("authentication.urls")),
    path("telemetry/", TelemetryIngestView.as_view(), name="telemetry-ingest"),
    path("fleet/live/", FleetLiveView.as_view(), name="fleet-live"),
    path("vehicles/<uuid:vehicle_id>/live/", VehicleLiveView.as_view(), name="vehicle-live"),
    path(
        "vehicles/<uuid:vehicle_id>/telemetry/",
        VehicleTelemetryHistoryView.as_view(),
        name="vehicle-telemetry-history",
    ),
    path("vehicles/", include("vehicles.urls")),
    path("drivers/", include("drivers.urls")),
    path("trips/", include("trips.urls")),
    path("fuel/", include("fuel.urls")),
    path("maintenance/", include("maintenance.urls")),
    path("expenses/", include("expenses.urls")),
    path("gps/", include("gps.urls")),
    path("reports/", include("reports.urls")),
    path("notifications/", include("notifications.urls")),
    path("ai/", include("ai_assistant.urls")),
    path("system/", include("system.urls")),
    path("sites/", include("sites.urls")),
    path("operators/", include("operators.urls")),
    path("equipment/", include("equipment.urls")),
    path("rentals/", include("rentals.urls")),
    path("agentic/", include("agentic.urls")),
    path("qr-desk/", include("qr_desk.urls")),
    path("usage/", include("usage_logging.urls")),
    path("demand/", include("demand.urls")),
    path("anomalies/", include("anomalies.urls")),
    path("rewards/", include("rewards.urls")),
    path("mcp/", include("mcp_layer.urls")),
]

urlpatterns = [
    path("", api_root, name="api-root"),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/", include((_api_patterns, "api-v1"))),
    path("api/", include((_api_patterns, "api-legacy"))),
]
