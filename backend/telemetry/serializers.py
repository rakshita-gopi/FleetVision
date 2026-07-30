from rest_framework import serializers

from vehicles.models import Vehicle
from .models import TelemetrySource


class TelemetryIngestSerializer(serializers.Serializer):
    vehicle_id = serializers.UUIDField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    speed = serializers.FloatField(required=False, default=0)
    heading = serializers.FloatField(required=False, default=0)
    rpm = serializers.IntegerField(required=False, allow_null=True)
    fuel_level = serializers.FloatField(required=False, allow_null=True)
    engine_temperature = serializers.FloatField(required=False, allow_null=True)
    battery_voltage = serializers.FloatField(required=False, allow_null=True)
    odometer = serializers.FloatField(required=False, allow_null=True)
    gps_accuracy = serializers.FloatField(required=False, allow_null=True)
    source = serializers.ChoiceField(choices=TelemetrySource.choices, default=TelemetrySource.SIMULATOR)
    timestamp = serializers.DateTimeField(required=False)
    event_id = serializers.UUIDField(required=False)

    def validate_latitude(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError("latitude must be between -90 and 90")
        return value

    def validate_longitude(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError("longitude must be between -180 and 180")
        return value

    def validate_speed(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("speed must be >= 0")
        return value

    def validate_fuel_level(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("fuel_level must be between 0 and 100")
        return value

    def validate_battery_voltage(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("battery_voltage must be >= 0")
        return value

    def validate_gps_accuracy(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("gps_accuracy must be >= 0")
        return value

    def validate_vehicle_id(self, value):
        if not Vehicle.objects.filter(id=value).exists():
            raise serializers.ValidationError("Vehicle not found")
        return value


class VehicleTelemetrySerializer(serializers.Serializer):
    time = serializers.DateTimeField()
    event_id = serializers.UUIDField()
    vehicle_id = serializers.UUIDField()
    latitude = serializers.FloatField(allow_null=True)
    longitude = serializers.FloatField(allow_null=True)
    gps_accuracy = serializers.FloatField(allow_null=True)
    speed = serializers.FloatField(allow_null=True)
    heading = serializers.FloatField(allow_null=True)
    rpm = serializers.IntegerField(allow_null=True)
    fuel_level = serializers.FloatField(allow_null=True)
    engine_temperature = serializers.FloatField(allow_null=True)
    battery_voltage = serializers.FloatField(allow_null=True)
    odometer = serializers.FloatField(allow_null=True)
    source = serializers.CharField()
