from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def build_telemetry_event(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize ingest payload into the canonical Kafka event schema."""
    ts = payload.get("timestamp")
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        timestamp = ts.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    elif ts:
        timestamp = str(ts)
    else:
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    event_id = str(payload.get("event_id") or uuid4())
    vehicle_id = str(payload["vehicle_id"])

    return {
        "event_id": event_id,
        "vehicle_id": vehicle_id,
        "timestamp": timestamp,
        "location": {
            "latitude": payload.get("latitude"),
            "longitude": payload.get("longitude"),
            "accuracy": payload.get("gps_accuracy"),
        },
        "motion": {
            "speed": payload.get("speed", 0),
            "heading": payload.get("heading", 0),
        },
        "vehicle": {
            "rpm": payload.get("rpm"),
            "fuel_level": payload.get("fuel_level"),
            "engine_temperature": payload.get("engine_temperature"),
            "battery_voltage": payload.get("battery_voltage"),
            "odometer": payload.get("odometer"),
        },
        "source": payload.get("source") or "SIMULATOR",
    }
