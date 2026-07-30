from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.permissions import IsFleetManagerOrAdmin
from common.response import api_response
from .services import detect_anomalies


class AnomalyDetectView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        emit = request.query_params.get("notify", "1") != "0"
        data = detect_anomalies(emit_notifications=emit)
        return api_response(True, "Anomaly scan", data)

    def post(self, request):
        emit = bool(request.data.get("notify", True))
        data = detect_anomalies(emit_notifications=emit)
        return api_response(True, "Anomaly scan complete", data)


class AnomalyScanNotifyView(APIView):
    permission_classes = [IsFleetManagerOrAdmin]

    def post(self, request):
        data = detect_anomalies(emit_notifications=True)
        return api_response(
            True,
            "Anomalies scanned and notifications emitted",
            {"total": data["total"], "counts": data["counts"]},
        )
