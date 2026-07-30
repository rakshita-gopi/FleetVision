import logging
from datetime import datetime, timezone

from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from common.response import api_response
from django.conf import settings

logger = logging.getLogger(__name__)


class HealthView(APIView):
    """GET /api/v1/system/health/ — no auth required for load balancers / Docker."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        services = {
            "backend": "healthy",
            "database": self._check_database(),
            "redis": self._check_redis(),
            "timescaledb": self._check_timescaledb(),
            "kafka": self._check_kafka(),
            "telemetry_consumer": self._check_telemetry_consumer(),
        }
        # Core services gate HTTP status (Docker healthcheck). Consumer may start after API.
        core_ok = all(
            services[k] == "healthy" for k in ("backend", "database", "redis", "timescaledb", "kafka")
        )
        overall = "healthy" if all(v == "healthy" for v in services.values()) else "degraded"
        status_code = 200 if core_ok else 503
        return api_response(
            core_ok,
            "System health",
            {"status": overall, "services": services},
            status_code=status_code,
        )

    @staticmethod
    def _check_database() -> str:
        try:
            connection.ensure_connection()
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return "healthy"
        except Exception as exc:
            logger.error("Database health check failed: %s", exc)
            return "unhealthy"

    @staticmethod
    def _check_redis() -> str:
        try:
            probe_key = "fleetvision:health:probe"
            cache.set(probe_key, "ok", timeout=10)
            if cache.get(probe_key) != "ok":
                return "unhealthy"
            return "healthy"
        except Exception as exc:
            logger.error("Redis health check failed: %s", exc)
            return "unhealthy"

    @staticmethod
    def _check_timescaledb() -> str:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'")
                row = cursor.fetchone()
            return "healthy" if row else "unhealthy"
        except Exception as exc:
            logger.error("TimescaleDB health check failed: %s", exc)
            return "unhealthy"

    @staticmethod
    def _check_kafka() -> str:
        try:
            from kafka import KafkaAdminClient

            bootstrap = getattr(settings, "KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
            admin = KafkaAdminClient(bootstrap_servers=bootstrap.split(","), request_timeout_ms=3000)
            admin.list_topics()
            admin.close()
            return "healthy"
        except Exception as exc:
            logger.error("Kafka health check failed: %s", exc)
            return "unhealthy"

    @staticmethod
    def _check_telemetry_consumer() -> str:
        try:
            from django_redis import get_redis_connection

            raw = get_redis_connection("default").get("fleetvision:telemetry_consumer:heartbeat")
            if not raw:
                return "unhealthy"
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            ts = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - ts).total_seconds()
            return "healthy" if age < 45 else "unhealthy"
        except Exception as exc:
            logger.error("Telemetry consumer health check failed: %s", exc)
            return "unhealthy"
