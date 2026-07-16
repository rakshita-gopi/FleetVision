from rest_framework import serializers
from .models import FuelLog


class FuelLogSerializer(serializers.ModelSerializer):
    vehicle_number = serializers.CharField(source="vehicle.vehicle_number", read_only=True)
    driver_name = serializers.CharField(source="driver.user.full_name", read_only=True, allow_null=True)

    class Meta:
        model = FuelLog
        fields = "__all__"
