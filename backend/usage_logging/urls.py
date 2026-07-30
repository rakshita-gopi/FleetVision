from django.urls import path
from .views import UsageLogDetailView, UsageLogListView

urlpatterns = [
    path("", UsageLogListView.as_view(), name="usage-logs"),
    path("<str:rental_id>/", UsageLogDetailView.as_view(), name="usage-log-detail"),
]
