from django.urls import path
from .views import UpdateLocationView, LiveLocationView, GPSHistoryView, SimulateGPSView

urlpatterns = [
    path("update-location", UpdateLocationView.as_view()),
    path("live", LiveLocationView.as_view()),
    path("live/<uuid:vehicle_id>", LiveLocationView.as_view()),
    path("history/<uuid:trip_id>", GPSHistoryView.as_view()),
    path("simulate", SimulateGPSView.as_view()),
]
