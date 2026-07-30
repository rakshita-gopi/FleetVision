import logging

from authentication.models import User, UserRole
from vehicles.models import Vehicle
from .models import Driver

logger = logging.getLogger(__name__)


class DriverService:
    @staticmethod
    def list_drivers(queryset=None):
        qs = queryset if queryset is not None else Driver.objects.select_related("user", "assigned_vehicle")
        return qs.all()

    @staticmethod
    def create_driver(validated_data: dict) -> Driver:
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            phone=validated_data.get("phone", ""),
            role=UserRole.DRIVER,
        )
        vehicle = None
        if validated_data.get("assigned_vehicle"):
            vehicle = Vehicle.objects.filter(id=validated_data["assigned_vehicle"]).first()
        driver = Driver.objects.create(
            user=user,
            license_number=validated_data["license_number"],
            license_expiry=validated_data["license_expiry"],
            address=validated_data.get("address", ""),
            emergency_contact=validated_data.get("emergency_contact", ""),
            blood_group=validated_data.get("blood_group", ""),
            experience_years=validated_data.get("experience_years", 0),
            joining_date=validated_data["joining_date"],
            assigned_vehicle=vehicle,
        )
        logger.info("Driver %s created for user %s", driver.id, user.email)
        # TODO: publish driver.created event (Kafka — Phase 2)
        return driver

    @staticmethod
    def update_driver(instance: Driver, request_data, serializer) -> Driver:
        user = instance.user
        if "full_name" in request_data or "name" in request_data:
            user.full_name = request_data.get("full_name") or request_data.get("name") or user.full_name
        if "phone" in request_data:
            user.phone = request_data.get("phone") or ""
        user.save()
        serializer.save()
        logger.info("Driver %s updated", instance.id)
        # TODO: publish driver.updated event (Kafka — Phase 2)
        return instance

    @staticmethod
    def delete_driver(instance: Driver):
        driver_id = instance.id
        user = instance.user
        instance.delete()
        user.delete()
        logger.info("Driver %s deleted", driver_id)
        # TODO: publish driver.deleted event (Kafka — Phase 2)
