from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from common.permissions import IsFleetManagerOrAdmin
from .models import Driver
from .serializers import DriverSerializer, DriverCreateSerializer
from .services import DriverService


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.select_related("user", "assigned_vehicle").all()
    serializer_class = DriverSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsFleetManagerOrAdmin()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        queryset = DriverService.list_drivers(self.get_queryset())
        return api_response(True, "Drivers retrieved", self.get_serializer(queryset, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return api_response(True, "Driver retrieved", self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = DriverCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(False, "Validation failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        driver = DriverService.create_driver(serializer.validated_data)
        return api_response(True, "Driver created", DriverSerializer(driver).data, status_code=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        serializer = self.get_serializer(instance, data=data, partial=True)
        if serializer.is_valid():
            DriverService.update_driver(instance, request.data, serializer)
            return api_response(True, "Driver updated", DriverSerializer(instance).data)
        return api_response(False, "Update failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        DriverService.delete_driver(self.get_object())
        return api_response(True, "Driver deleted")
