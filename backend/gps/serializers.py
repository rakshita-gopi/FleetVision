from rest_framework import serializers
from .models import VehicleLocation, GPSHistory


class VehicleLocationSerializer(serializers.ModelSerializer):
    vehicle_number = serializers.CharField(source="vehicle.vehicle_number", read_only=True)
    driver_name = serializers.CharField(source="driver.user.full_name", read_only=True, allow_null=True)
    vehicle_status = serializers.CharField(source="vehicle.status", read_only=True)
    current_trip_destination = serializers.SerializerMethodField()

    class Meta:
        model = VehicleLocation
        fields = [
            "id", "vehicle", "vehicle_number", "driver", "driver_name", "vehicle_status",
            "latitude", "longitude", "speed", "heading", "last_updated", "current_trip_destination",
        ]

    def get_current_trip_destination(self, obj):
        from trips.models import Trip, TripStatus
        trip = Trip.objects.filter(vehicle=obj.vehicle, trip_status=TripStatus.IN_PROGRESS).first()
        return trip.destination if trip else None


class GPSHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GPSHistory
        fields = "__all__"
