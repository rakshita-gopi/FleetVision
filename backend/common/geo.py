"""Geographic helpers for map display."""

from __future__ import annotations

from typing import Any


def is_offshore_coromandel(lat: Any, lon: Any) -> bool:
    """True when a point sits in the Bay of Bengal east of the Tamil Nadu / AP coast."""
    try:
        la = float(lat)
        lo = float(lon)
    except (TypeError, ValueError):
        return False
    # Coromandel coastline sits roughly west of ~80.28°E between ~8°N–15.5°N
    return 8.0 <= la <= 15.5 and lo > 80.28


def snap_to_land(lat: Any, lon: Any) -> tuple[float | None, float | None]:
    """Pull offshore demo markers onto land so maps do not show assets in the sea."""
    if lat is None or lon is None:
        return None if lat is None else float(lat), None if lon is None else float(lon)
    try:
        la = float(lat)
        lo = float(lon)
    except (TypeError, ValueError):
        return None, None
    if is_offshore_coromandel(la, lo):
        # Nudge west of the coastline onto land
        lo = 80.18
    return la, lo
