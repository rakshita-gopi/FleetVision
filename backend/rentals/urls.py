from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RentalViewSet

router = DefaultRouter()
router.register("", RentalViewSet, basename="rentals")
urlpatterns = [path("", include(router.urls))]
