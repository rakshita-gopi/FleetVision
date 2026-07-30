from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.response import api_response
from .services import list_usage_logs, usage_detail, usage_summary


class UsageLogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status = request.query_params.get("status")
        q = request.query_params.get("q")
        try:
            limit = min(int(request.query_params.get("limit", 80)), 200)
        except ValueError:
            limit = 80
        rows = list_usage_logs(status=status, q=q, limit=limit)
        return api_response(
            True,
            "Usage logs",
            {"summary": usage_summary(rows), "results": rows},
        )


class UsageLogDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, rental_id):
        data = usage_detail(rental_id)
        if not data:
            return api_response(False, "Rental not found", status_code=404)
        return api_response(True, "Usage detail", data)
