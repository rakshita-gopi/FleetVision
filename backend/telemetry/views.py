import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.response import api_response
from .consumers.processor import get_all_live_states, get_live_state
from .models import VehicleTelemetry
from .producers.kafka import publish_telemetry
from .serializers import TelemetryIngestSerializer, VehicleTelemetrySerializer
from .services.telemetry import build_telemetry_event

logger = logging.getLogger(__name__)


class TelemetryIngestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TelemetryIngestSerializer(data=request.data)
        if not serializer.is_valid():
            return api_response(
                False,
                "Validation failed",
                errors=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        event = build_telemetry_event(serializer.validated_data)
        try:
            publish_telemetry(event)
        except Exception as exc:
            logger.error("Kafka unavailable: %s", exc)
            return api_response(
                False,
                "Kafka unavailable",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        logger.info(
            "Telemetry received vehicle=%s event=%s",
            event["vehicle_id"],
            event["event_id"],
        )
        return api_response(
            True,
            "Telemetry accepted",
            {"event_id": event["event_id"], "vehicle_id": event["vehicle_id"]},
            status_code=status.HTTP_202_ACCEPTED,
        )


class VehicleLiveView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, vehicle_id):
        state = get_live_state(str(vehicle_id))
        if not state:
            return api_response(False, "No live state for vehicle", status_code=status.HTTP_404_NOT_FOUND)
        return api_response(True, "Live vehicle state", state)


class VehicleTelemetryHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, vehicle_id):
        qs = VehicleTelemetry.objects.filter(vehicle_id=vehicle_id).order_by("-time")
        from_ts = request.query_params.get("from")
        to_ts = request.query_params.get("to")
        try:
            limit = min(int(request.query_params.get("limit", 100)), 1000)
        except ValueError:
            limit = 100
        if from_ts:
            qs = qs.filter(time__gte=from_ts)
        if to_ts:
            qs = qs.filter(time__lte=to_ts)
        rows = list(qs[:limit])
        data = VehicleTelemetrySerializer(rows, many=True).data
        return api_response(True, "Telemetry history", data)


class FleetLiveView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        states = get_all_live_states()
        # Enrich with Rental-IQ asset codes when state UUID matches equipment
        from equipment.models import Equipment
        from common.geo import snap_to_land

        ids = [s.get("vehicle_id") for s in states if s.get("vehicle_id")]
        from common.lookup import is_uuid

        uuid_ids = [vid for vid in ids if is_uuid(vid)]
        asset_map = {
            str(e.id): e.asset_id for e in Equipment.objects.filter(id__in=uuid_ids).only("id", "asset_id")
        }
        for s in states:
            vid = str(s.get("vehicle_id") or "")
            if vid in asset_map:
                s["asset_id"] = asset_map[vid]
                s["equipment_id"] = vid
            lat, lon = snap_to_land(s.get("latitude"), s.get("longitude"))
            if lat is not None:
                s["latitude"] = lat
            if lon is not None:
                s["longitude"] = lon
        return api_response(True, "Fleet live state", states)
