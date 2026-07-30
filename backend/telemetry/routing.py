from django.urls import path

from telemetry.consumers.ws import FleetTelemetryConsumer

websocket_urlpatterns = [
    path("ws/fleet/", FleetTelemetryConsumer.as_asgi()),
]
