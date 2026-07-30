from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from common.permissions import IsFleetManagerOrAdmin
from .models import FuelLog
from .serializers import FuelLogSerializer
from .services import FuelService


class FuelLogViewSet(viewsets.ModelViewSet):
    queryset = FuelLog.objects.select_related("vehicle", "driver__user").all().order_by("-fuel_date")
    serializer_class = FuelLogSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsFleetManagerOrAdmin()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        queryset = FuelService.list_logs(self.get_queryset())
        return api_response(True, "Fuel logs retrieved", self.get_serializer(queryset, many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            FuelService.create_log(serializer)
            return api_response(True, "Fuel log created", serializer.data, status_code=status.HTTP_201_CREATED)
        return api_response(False, "Validation failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            FuelService.update_log(serializer)
            return api_response(True, "Fuel log updated", serializer.data)
        return api_response(False, "Update failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        FuelService.delete_log(self.get_object())
        return api_response(True, "Fuel log deleted")
