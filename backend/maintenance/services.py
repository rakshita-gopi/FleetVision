import logging

from .models import MaintenanceRecord

logger = logging.getLogger(__name__)


class MaintenanceService:
    @staticmethod
    def list_records(queryset=None):
        qs = queryset if queryset is not None else MaintenanceRecord.objects.select_related("vehicle")
        return qs.all().order_by("-service_date")

    @staticmethod
    def create_record(serializer) -> MaintenanceRecord:
        record = serializer.save()
        logger.info("Maintenance record %s created for vehicle %s", record.id, record.vehicle_id)
        # TODO: publish maintenance.created event (Kafka — Phase 2)
        return record

    @staticmethod
    def update_record(serializer) -> MaintenanceRecord:
        record = serializer.save()
        logger.info("Maintenance record %s updated", record.id)
        return record

    @staticmethod
    def delete_record(instance: MaintenanceRecord):
        record_id = instance.id
        instance.delete()
        logger.info("Maintenance record %s deleted", record_id)
