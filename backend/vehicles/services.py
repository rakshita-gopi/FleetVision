import logging

from django.db.models import Q

from .models import Vehicle

logger = logging.getLogger(__name__)


class VehicleService:
    @staticmethod
    def list_vehicles(queryset=None):
        qs = queryset if queryset is not None else Vehicle.objects.all()
        return qs.order_by("-created_at")

    @staticmethod
    def search(query: str, queryset=None):
        qs = queryset if queryset is not None else Vehicle.objects.all()
        return qs.filter(
            Q(vehicle_number__icontains=query) | Q(registration_number__icontains=query)
        ).order_by("-created_at")

    @staticmethod
    def create_vehicle(serializer):
        vehicle = serializer.save()
        logger.info("Vehicle %s created", vehicle.id)
        # TODO: publish vehicle.created event (Kafka — Phase 2)
        return vehicle

    @staticmethod
    def update_vehicle(instance, serializer):
        vehicle = serializer.save()
        logger.info("Vehicle %s updated", vehicle.id)
        # TODO: publish vehicle.updated event (Kafka — Phase 2)
        return vehicle

    @staticmethod
    def delete_vehicle(instance):
        vehicle_id = instance.id
        instance.delete()
        logger.info("Vehicle %s deleted", vehicle_id)
        # TODO: publish vehicle.deleted event (Kafka — Phase 2)
