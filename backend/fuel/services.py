import logging

from .models import FuelLog

logger = logging.getLogger(__name__)


class FuelService:
    @staticmethod
    def list_logs(queryset=None):
        qs = queryset if queryset is not None else FuelLog.objects.select_related("vehicle", "driver__user")
        return qs.all().order_by("-fuel_date")

    @staticmethod
    def create_log(serializer) -> FuelLog:
        log = serializer.save()
        logger.info("Fuel log %s created for vehicle %s", log.id, log.vehicle_id)
        # TODO: publish fuel.recorded event (Kafka — Phase 2)
        return log

    @staticmethod
    def update_log(serializer) -> FuelLog:
        log = serializer.save()
        logger.info("Fuel log %s updated", log.id)
        return log

    @staticmethod
    def delete_log(instance: FuelLog):
        log_id = instance.id
        instance.delete()
        logger.info("Fuel log %s deleted", log_id)
