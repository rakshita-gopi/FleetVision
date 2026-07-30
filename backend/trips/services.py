import logging

from django.utils import timezone

from drivers.models import DriverStatus
from notifications.models import Notification, NotificationType
from vehicles.models import VehicleStatus
from .models import Trip, TripStatus

logger = logging.getLogger(__name__)


class TripService:
    @staticmethod
    def list_trips(queryset=None):
        qs = queryset if queryset is not None else Trip.objects.select_related("vehicle", "driver__user")
        return qs.all().order_by("-created_at")

    @staticmethod
    def create_trip(serializer) -> Trip:
        trip = serializer.save()
        logger.info("Trip %s created (%s → %s)", trip.id, trip.source, trip.destination)
        # TODO: publish trip.created event (Kafka — Phase 2)
        return trip

    @staticmethod
    def delete_trip(instance: Trip):
        trip_id = instance.id
        instance.delete()
        logger.info("Trip %s deleted", trip_id)
        # TODO: publish trip.deleted event (Kafka — Phase 2)

    @staticmethod
    def start_trip(trip: Trip) -> Trip:
        if trip.trip_status not in [TripStatus.SCHEDULED, TripStatus.STARTED]:
            raise ValueError("Trip cannot be started")
        trip.trip_status = TripStatus.IN_PROGRESS
        trip.start_time = timezone.now()
        trip.save()
        trip.vehicle.status = VehicleStatus.ON_TRIP
        trip.vehicle.save()
        trip.driver.status = DriverStatus.ON_TRIP
        trip.driver.save()
        Notification.objects.create(
            title="Trip Started",
            message=f"Trip from {trip.source} to {trip.destination} has started.",
            notification_type=NotificationType.TRIP_STARTED,
        )
        logger.info("Trip %s started", trip.id)
        # TODO: publish trip.started event (Kafka — Phase 2)
        return trip

    @staticmethod
    def complete_trip(trip: Trip) -> Trip:
        trip.trip_status = TripStatus.COMPLETED
        trip.end_time = timezone.now()
        trip.save()
        trip.vehicle.status = VehicleStatus.AVAILABLE
        trip.vehicle.save()
        trip.driver.status = DriverStatus.AVAILABLE
        trip.driver.save()
        Notification.objects.create(
            title="Trip Completed",
            message=f"Trip from {trip.source} to {trip.destination} completed.",
            notification_type=NotificationType.TRIP_COMPLETED,
        )
        logger.info("Trip %s completed", trip.id)
        # TODO: publish trip.completed event (Kafka — Phase 2)
        return trip

    @staticmethod
    def cancel_trip(trip: Trip) -> Trip:
        trip.trip_status = TripStatus.CANCELLED
        trip.save()
        trip.vehicle.status = VehicleStatus.AVAILABLE
        trip.vehicle.save()
        trip.driver.status = DriverStatus.AVAILABLE
        trip.driver.save()
        logger.info("Trip %s cancelled", trip.id)
        # TODO: publish trip.cancelled event (Kafka — Phase 2)
        return trip
