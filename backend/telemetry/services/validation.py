"""Validation helpers for consumer-side schema checks."""

REQUIRED_KEYS = ("event_id", "vehicle_id", "timestamp")


def validate_event_schema(event: dict) -> list[str]:
    errors = []
    for key in REQUIRED_KEYS:
        if key not in event or event[key] in (None, ""):
            errors.append(f"missing {key}")
    loc = event.get("location") or {}
    lat = loc.get("latitude")
    lng = loc.get("longitude")
    if lat is None or lng is None:
        errors.append("missing location.latitude/longitude")
    elif not (-90 <= float(lat) <= 90):
        errors.append("invalid latitude")
    elif not (-180 <= float(lng) <= 180):
        errors.append("invalid longitude")
    return errors
