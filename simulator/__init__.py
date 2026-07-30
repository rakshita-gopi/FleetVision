"""FleetVision GPS / telemetry simulator (Phase 2)."""

from .config import API_URL, INTERVAL_SECONDS, PASSWORD, USERNAME, VEHICLE_COUNT
from .main import run

__all__ = ["run", "API_URL", "INTERVAL_SECONDS", "USERNAME", "PASSWORD", "VEHICLE_COUNT"]
