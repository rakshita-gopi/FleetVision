from rest_framework import serializers

from equipment.models import Equipment
from vehicles.models import Vehicle
from .models import TelemetrySource


class TelemetryIngestSerializer(serializers.Serializer):
    vehicle_id = serializers.UUIDField(required=False)
    equipment_id = serializers.UUIDField(required=False)
    asset_id = serializers.CharField(required=False, allow_blank=True)
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

    def validate(self, attrs):
        equipment_id = attrs.get("equipment_id")
        asset_id = (attrs.get("asset_id") or "").strip()
        vehicle_id = attrs.get("vehicle_id")

        resolved = None
        if equipment_id:
            eq = Equipment.objects.filter(id=equipment_id).first()
            if not eq:
                raise serializers.ValidationError({"equipment_id": "Equipment not found"})
            resolved = eq.id
        elif asset_id:
            eq = Equipment.objects.filter(asset_id=asset_id).first()
            if not eq:
                raise serializers.ValidationError({"asset_id": "Equipment not found"})
            resolved = eq.id
        elif vehicle_id:
            if Equipment.objects.filter(id=vehicle_id).exists() or Vehicle.objects.filter(id=vehicle_id).exists():
                resolved = vehicle_id
            else:
                raise serializers.ValidationError({"vehicle_id": "Vehicle/equipment not found"})
        else:
            raise serializers.ValidationError("Provide vehicle_id, equipment_id, or asset_id")

        attrs["vehicle_id"] = resolved
        return attrs


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
