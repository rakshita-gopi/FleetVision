import json
import logging
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from kafka import KafkaConsumer

from telemetry.consumers.processor import process_telemetry_event, touch_consumer_heartbeat

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Consume fleet.telemetry events → TimescaleDB + Redis + WebSocket"

    def handle(self, *args, **options):
        bootstrap = getattr(settings, "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        topic = getattr(settings, "KAFKA_TELEMETRY_TOPIC", "fleet.telemetry")
        self.stdout.write(f"Starting telemetry consumer on {bootstrap} topic={topic}")

        consumer = None
        while consumer is None:
            try:
                consumer = KafkaConsumer(
                    topic,
                    bootstrap_servers=bootstrap.split(","),
                    group_id="fleetvision-telemetry-consumer",
                    enable_auto_commit=False,
                    auto_offset_reset="earliest",
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                    consumer_timeout_ms=1000,
                )
            except Exception as exc:
                logger.error("Kafka consumer connect failed: %s — retrying", exc)
                time.sleep(3)

        self.stdout.write(self.style.SUCCESS("Telemetry consumer connected"))

        while True:
            try:
                touch_consumer_heartbeat()
                records = consumer.poll(timeout_ms=1000, max_records=50)
                if not records:
                    continue
                for _tp, messages in records.items():
                    for msg in messages:
                        try:
                            process_telemetry_event(msg.value)
                        except Exception as exc:
                            logger.error("Failed processing telemetry: %s", exc)
                consumer.commit()
            except Exception as exc:
                logger.error("Consumer loop error: %s", exc)
                time.sleep(2)
