from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from common.permissions import IsFleetManagerOrAdmin, IsDriverOrAbove
from drivers.models import Driver, DriverStatus
from vehicles.models import Vehicle, VehicleStatus
from notifications.models import Notification, NotificationType
from .models import Trip, TripStatus
from .serializers import TripSerializer


class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.select_related("vehicle", "driver__user").all().order_by("-created_at")
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "destroy"]:
            return [IsFleetManagerOrAdmin()]
        return [IsDriverOrAbove()]

    def list(self, request, *args, **kwargs):
        return api_response(True, "Trips retrieved", self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return api_response(True, "Trip retrieved", self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return api_response(True, "Trip created", serializer.data, status_code=status.HTTP_201_CREATED)
        return api_response(False, "Validation failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["put"])
    def start(self, request, pk=None):
        trip = self.get_object()
        if trip.trip_status not in [TripStatus.SCHEDULED, TripStatus.STARTED]:
            return api_response(False, "Trip cannot be started", status_code=status.HTTP_400_BAD_REQUEST)
        trip.trip_status = TripStatus.IN_PROGRESS
        trip.start_time = timezone.now()
        trip.save()
        trip.vehicle.status = VehicleStatus.ON_TRIP
        trip.vehicle.save()
        trip.driver.status = DriverStatus.ON_TRIP
        trip.driver.save()
        Notification.objects.create(
            title="Trip Started",
            message=f"Trip from {trip.source} to {trip.destination} has started.",
            notification_type=NotificationType.TRIP_STARTED,
        )
        return api_response(True, "Trip started", self.get_serializer(trip).data)

    @action(detail=True, methods=["put"])
    def complete(self, request, pk=None):
        trip = self.get_object()
        trip.trip_status = TripStatus.COMPLETED
        trip.end_time = timezone.now()
        trip.save()
        trip.vehicle.status = VehicleStatus.AVAILABLE
        trip.vehicle.save()
        trip.driver.status = DriverStatus.AVAILABLE
        trip.driver.save()
        Notification.objects.create(
            title="Trip Completed",
            message=f"Trip from {trip.source} to {trip.destination} completed.",
            notification_type=NotificationType.TRIP_COMPLETED,
        )
        return api_response(True, "Trip completed", self.get_serializer(trip).data)

    @action(detail=True, methods=["put"])
    def cancel(self, request, pk=None):
        trip = self.get_object()
        trip.trip_status = TripStatus.CANCELLED
        trip.save()
        trip.vehicle.status = VehicleStatus.AVAILABLE
        trip.vehicle.save()
        trip.driver.status = DriverStatus.AVAILABLE
        trip.driver.save()
        return api_response(True, "Trip cancelled", self.get_serializer(trip).data)
