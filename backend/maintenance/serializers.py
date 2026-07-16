from rest_framework import serializers
from .models import MaintenanceRecord


class MaintenanceSerializer(serializers.ModelSerializer):
    vehicle_number = serializers.CharField(source="vehicle.vehicle_number", read_only=True)

    class Meta:
        model = MaintenanceRecord
        fields = "__all__"
