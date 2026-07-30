from django.urls import path

from .views import (
    FleetLiveView,
    TelemetryIngestView,
    VehicleLiveView,
    VehicleTelemetryHistoryView,
)

urlpatterns = [
    path("", TelemetryIngestView.as_view(), name="telemetry-ingest"),
    path("fleet/live/", FleetLiveView.as_view(), name="fleet-live"),
    path("vehicles/<uuid:vehicle_id>/live/", VehicleLiveView.as_view(), name="vehicle-live"),
    path(
        "vehicles/<uuid:vehicle_id>/telemetry/",
        VehicleTelemetryHistoryView.as_view(),
        name="vehicle-telemetry-history",
    ),
]
