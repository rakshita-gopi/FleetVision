from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from common.permissions import IsFleetManagerOrAdmin
from .models import Vehicle
from .serializers import VehicleSerializer
from .services import VehicleService


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by("-created_at")
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsFleetManagerOrAdmin()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        queryset = VehicleService.list_vehicles(self.filter_queryset(self.get_queryset()))
        serializer = self.get_serializer(queryset, many=True)
        return api_response(True, "Vehicles retrieved", serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return api_response(True, "Vehicle retrieved", self.get_serializer(instance).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            VehicleService.create_vehicle(serializer)
            return api_response(True, "Vehicle Created Successfully", serializer.data, status_code=status.HTTP_201_CREATED)
        return api_response(False, "Validation failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=kwargs.get("partial", False))
        if serializer.is_valid():
            VehicleService.update_vehicle(instance, serializer)
            return api_response(True, "Vehicle updated", serializer.data)
        return api_response(False, "Update failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        VehicleService.delete_vehicle(self.get_object())
        return api_response(True, "Vehicle deleted")

    @action(detail=False, methods=["get"])
    def search(self, request):
        q = request.query_params.get("vehicle_number", "")
        queryset = VehicleService.search(q, self.get_queryset())
        return api_response(True, "Search results", self.get_serializer(queryset, many=True).data)
