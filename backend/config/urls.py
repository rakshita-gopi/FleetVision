from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/auth/", include("authentication.urls")),
    path("api/vehicles/", include("vehicles.urls")),
    path("api/drivers/", include("drivers.urls")),
    path("api/trips/", include("trips.urls")),
    path("api/fuel/", include("fuel.urls")),
    path("api/maintenance/", include("maintenance.urls")),
    path("api/expenses/", include("expenses.urls")),
    path("api/gps/", include("gps.urls")),
    path("api/reports/", include("reports.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/ai/", include("ai_assistant.urls")),
]
