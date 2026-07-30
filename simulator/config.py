import os

API_URL = os.getenv("SIMULATOR_API_URL", "http://localhost:8000/api/v1")
USERNAME = os.getenv("SIMULATOR_USERNAME", "admin@fleetvision.ai")
PASSWORD = os.getenv("SIMULATOR_PASSWORD", "admin123")
INTERVAL_SECONDS = float(os.getenv("SIMULATOR_INTERVAL", "5"))
VEHICLE_COUNT = int(os.getenv("SIMULATOR_VEHICLE_COUNT", "1"))
# Comma-separated UUIDs; if empty, fetch first N vehicles from API
VEHICLE_IDS = [v.strip() for v in os.getenv("SIMULATOR_VEHICLE_IDS", "").split(",") if v.strip()]
