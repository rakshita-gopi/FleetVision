import json
import logging
import threading

from django.conf import settings

logger = logging.getLogger(__name__)

_producer = None
_lock = threading.Lock()


def get_producer():
    global _producer
    if _producer is not None:
        return _producer
    with _lock:
        if _producer is not None:
            return _producer
        from kafka import KafkaProducer

        bootstrap = getattr(settings, "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        _producer = KafkaProducer(
            bootstrap_servers=bootstrap.split(","),
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            acks="all",
            retries=3,
            linger_ms=10,
        )
        logger.info("Kafka producer connected to %s", bootstrap)
        return _producer


def publish_telemetry(event: dict) -> None:
    topic = getattr(settings, "KAFKA_TELEMETRY_TOPIC", "fleet.telemetry")
    vehicle_id = str(event["vehicle_id"])
    producer = get_producer()
    future = producer.send(topic, key=vehicle_id, value=event)
    future.get(timeout=10)
    producer.flush(timeout=5)
    logger.info("Kafka event published topic=%s vehicle=%s event=%s", topic, vehicle_id, event.get("event_id"))
