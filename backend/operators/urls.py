from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OperatorViewSet

router = DefaultRouter()
router.register("", OperatorViewSet, basename="operators")
urlpatterns = [path("", include(router.urls))]
