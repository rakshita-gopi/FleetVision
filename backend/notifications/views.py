from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.permissions import IsFleetManagerOrAdmin
from common.response import api_response
from .models import Notification
from .serializers import NotificationSerializer
from .services import list_alert_board, scan_rental_due_alerts


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        # Auto-scan on fetch so due/overdue alerts stay fresh without Celery
        scan_rental_due_alerts()
        qs = self.get_queryset()
        unread_only = request.query_params.get("unread")
        if unread_only == "1":
            qs = qs.filter(is_read=False)
        ntype = request.query_params.get("type")
        if ntype:
            qs = qs.filter(notification_type=ntype)
        return api_response(True, "Notifications retrieved", self.get_serializer(qs[:100], many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return api_response(True, "Notification created", serializer.data, status_code=status.HTTP_201_CREATED)
        return api_response(False, "Validation failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return api_response(True, "Notification updated", serializer.data)
        return api_response(False, "Update failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return api_response(True, "Notification deleted")

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        n = self.get_object()
        n.is_read = True
        n.save(update_fields=["is_read"])
        return api_response(True, "Marked read", self.get_serializer(n).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = Notification.objects.filter(is_read=False).update(is_read=True)
        return api_response(True, f"Marked {updated} read", {"updated": updated})


class AlertsBoardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        scan = scan_rental_due_alerts()
        board = list_alert_board()
        board["last_scan"] = scan
        return api_response(True, "Alerts board", board)


class AlertsScanView(APIView):
    permission_classes = [IsFleetManagerOrAdmin]

    def post(self, request):
        result = scan_rental_due_alerts(due_soon_days=int(request.data.get("due_soon_days") or 3))
        return api_response(True, "Rental due scan complete", result)
