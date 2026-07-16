from rest_framework import serializers
from .models import Trip


class TripSerializer(serializers.ModelSerializer):
    vehicle_number = serializers.CharField(source="vehicle.vehicle_number", read_only=True)
    driver_name = serializers.CharField(source="driver.user.full_name", read_only=True)

    class Meta:
        model = Trip
        fields = "__all__"
