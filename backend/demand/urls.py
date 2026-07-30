from django.urls import path
from .views import DemandForecastView, DemandHistoryView, DemandSeedView

urlpatterns = [
    path("forecast/", DemandForecastView.as_view(), name="demand-forecast"),
    path("history/", DemandHistoryView.as_view(), name="demand-history"),
    path("seed/", DemandSeedView.as_view(), name="demand-seed"),
]
