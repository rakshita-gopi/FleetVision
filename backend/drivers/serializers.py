from rest_framework import serializers
from authentication.serializers import UserSerializer
from .models import Driver


class DriverSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    assigned_vehicle_number = serializers.CharField(source="assigned_vehicle.vehicle_number", read_only=True)

    class Meta:
        model = Driver
        fields = [
            "id", "user", "name", "email", "phone", "license_number", "license_expiry",
            "address", "emergency_contact", "blood_group", "experience_years",
            "joining_date", "status", "assigned_vehicle", "assigned_vehicle_number",
        ]


class DriverCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    license_number = serializers.CharField()
    license_expiry = serializers.DateField()
    address = serializers.CharField(required=False, allow_blank=True)
    emergency_contact = serializers.CharField(required=False, allow_blank=True)
    blood_group = serializers.CharField(required=False, allow_blank=True)
    experience_years = serializers.IntegerField(default=0)
    joining_date = serializers.DateField()
    assigned_vehicle = serializers.UUIDField(required=False, allow_null=True)
