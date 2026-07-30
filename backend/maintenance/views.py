from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from common.permissions import IsMechanicOrAdmin
from .models import MaintenanceRecord
from .serializers import MaintenanceSerializer
from .services import MaintenanceService


class MaintenanceViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRecord.objects.select_related("vehicle").all().order_by("-service_date")
    serializer_class = MaintenanceSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsMechanicOrAdmin()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        queryset = MaintenanceService.list_records(self.get_queryset())
        return api_response(True, "Maintenance records retrieved", self.get_serializer(queryset, many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            MaintenanceService.create_record(serializer)
            return api_response(True, "Maintenance record created", serializer.data, status_code=status.HTTP_201_CREATED)
        return api_response(False, "Validation failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            MaintenanceService.update_record(serializer)
            return api_response(True, "Maintenance record updated", serializer.data)
        return api_response(False, "Update failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        MaintenanceService.delete_record(self.get_object())
        return api_response(True, "Maintenance record deleted")
