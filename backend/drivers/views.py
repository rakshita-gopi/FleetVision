from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated

from authentication.models import User, UserRole
from common.response import api_response
from common.permissions import IsFleetManagerOrAdmin
from vehicles.models import Vehicle
from .models import Driver
from .serializers import DriverSerializer, DriverCreateSerializer


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.select_related("user", "assigned_vehicle").all()
    serializer_class = DriverSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsFleetManagerOrAdmin()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        return api_response(True, "Drivers retrieved", self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return api_response(True, "Driver retrieved", self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = DriverCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(False, "Validation failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        user = User.objects.create_user(
            email=data["email"],
            password=data["password"],
            full_name=data["full_name"],
            phone=data.get("phone", ""),
            role=UserRole.DRIVER,
        )
        vehicle = None
        if data.get("assigned_vehicle"):
            vehicle = Vehicle.objects.filter(id=data["assigned_vehicle"]).first()
        driver = Driver.objects.create(
            user=user,
            license_number=data["license_number"],
            license_expiry=data["license_expiry"],
            address=data.get("address", ""),
            emergency_contact=data.get("emergency_contact", ""),
            blood_group=data.get("blood_group", ""),
            experience_years=data.get("experience_years", 0),
            joining_date=data["joining_date"],
            assigned_vehicle=vehicle,
        )
        return api_response(True, "Driver created", DriverSerializer(driver).data, status_code=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return api_response(True, "Driver updated", serializer.data)
        return api_response(False, "Update failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        driver = self.get_object()
        user = driver.user
        driver.delete()
        user.delete()
        return api_response(True, "Driver deleted")
