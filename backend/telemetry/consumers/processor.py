import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import IntegrityError
from django.utils.dateparse import parse_datetime
from django_redis import get_redis_connection

from telemetry.models import VehicleTelemetry
from telemetry.services.validation import validate_event_schema

logger = logging.getLogger(__name__)

LIVE_SET_KEY = "fleetvision:live_vehicles"
CONSUMER_HEARTBEAT_KEY = "fleetvision:telemetry_consumer:heartbeat"
STATE_TTL_SECONDS = 60 * 60 * 24


def state_key(vehicle_id: str) -> str:
    return f"vehicle:{vehicle_id}:state"


def _redis():
    return get_redis_connection("default")


def process_telemetry_event(event: dict) -> bool:
    """
    Persist history, update Redis live state, broadcast WS.
    Returns True if newly processed, False if duplicate/skip.
    """
    errors = validate_event_schema(event)
    if errors:
        logger.warning("Invalid telemetry schema: %s", errors)
        return False

    event_id = event["event_id"]
    vehicle_id = str(event["vehicle_id"])

    if VehicleTelemetry.objects.filter(event_id=event_id).exists():
        logger.info("Duplicate event ignored event=%s vehicle=%s", event_id, vehicle_id)
        return False

    loc = event.get("location") or {}
    motion = event.get("motion") or {}
    vehicle = event.get("vehicle") or {}

    ts = parse_datetime(str(event["timestamp"]).replace("Z", "+00:00"))
    if ts is None:
        ts = datetime.now(timezone.utc)
    elif ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    try:
        VehicleTelemetry.objects.create(
            time=ts,
            event_id=UUID(str(event_id)),
            vehicle_id=UUID(vehicle_id),
            latitude=loc.get("latitude"),
            longitude=loc.get("longitude"),
            gps_accuracy=loc.get("accuracy"),
            speed=motion.get("speed"),
            heading=motion.get("heading"),
            rpm=vehicle.get("rpm"),
            fuel_level=vehicle.get("fuel_level"),
            engine_temperature=vehicle.get("engine_temperature"),
            battery_voltage=vehicle.get("battery_voltage"),
            odometer=vehicle.get("odometer"),
            source=event.get("source") or "SIMULATOR",
        )
    except IntegrityError:
        logger.info("Duplicate event (integrity) event=%s", event_id)
        return False

    logger.info("Telemetry persisted vehicle=%s event=%s", vehicle_id, event_id)

    state = {
        "vehicle_id": vehicle_id,
        "latitude": loc.get("latitude"),
        "longitude": loc.get("longitude"),
        "speed": motion.get("speed"),
        "heading": motion.get("heading"),
        "fuel_level": vehicle.get("fuel_level"),
        "rpm": vehicle.get("rpm"),
        "engine_temperature": vehicle.get("engine_temperature"),
        "battery_voltage": vehicle.get("battery_voltage"),
        "odometer": vehicle.get("odometer"),
        "gps_accuracy": loc.get("accuracy"),
        "source": event.get("source") or "SIMULATOR",
        "last_updated": ts.isoformat().replace("+00:00", "Z"),
    }
    r = _redis()
    r.set(state_key(vehicle_id), json.dumps(state), ex=STATE_TTL_SECONDS)
    r.sadd(LIVE_SET_KEY, vehicle_id)

    _broadcast_update(state)
    return True


def _broadcast_update(state: dict) -> None:
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            "fleet_live",
            {
                "type": "telemetry.update",
                "payload": {
                    "type": "telemetry.update",
                    **state,
                },
            },
        )
    except Exception as exc:
        logger.warning("WebSocket broadcast failed: %s", exc)


def touch_consumer_heartbeat() -> None:
    _redis().set(
        CONSUMER_HEARTBEAT_KEY,
        datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        ex=60,
    )


def get_live_state(vehicle_id: str) -> dict | None:
    raw = _redis().get(state_key(str(vehicle_id)))
    if not raw:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)


def get_all_live_states() -> list[dict]:
    r = _redis()
    members = r.smembers(LIVE_SET_KEY) or set()
    states = []
    for vid in members:
        if isinstance(vid, bytes):
            vid = vid.decode("utf-8")
        state = get_live_state(vid)
        if state:
            states.append(state)
    return states
