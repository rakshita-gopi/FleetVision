from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from common.permissions import IsFleetManagerOrAdmin, IsDriverOrAbove
from .models import Trip
from .serializers import TripSerializer
from .services import TripService


class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.select_related("vehicle", "driver__user").all().order_by("-created_at")
    serializer_class = TripSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "destroy"]:
            return [IsFleetManagerOrAdmin()]
        return [IsDriverOrAbove()]

    def list(self, request, *args, **kwargs):
        queryset = TripService.list_trips(self.get_queryset())
        return api_response(True, "Trips retrieved", self.get_serializer(queryset, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return api_response(True, "Trip retrieved", self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            TripService.create_trip(serializer)
            return api_response(True, "Trip created", serializer.data, status_code=status.HTTP_201_CREATED)
        return api_response(False, "Validation failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        TripService.delete_trip(self.get_object())
        return api_response(True, "Trip deleted")

    @action(detail=True, methods=["put"])
    def start(self, request, pk=None):
        trip = self.get_object()
        try:
            trip = TripService.start_trip(trip)
        except ValueError as exc:
            return api_response(False, str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        return api_response(True, "Trip started", self.get_serializer(trip).data)

    @action(detail=True, methods=["put"])
    def complete(self, request, pk=None):
        trip = TripService.complete_trip(self.get_object())
        return api_response(True, "Trip completed", self.get_serializer(trip).data)

    @action(detail=True, methods=["put"])
    def cancel(self, request, pk=None):
        trip = TripService.cancel_trip(self.get_object())
        return api_response(True, "Trip cancelled", self.get_serializer(trip).data)
