from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        return api_response(True, "Notifications retrieved", self.get_serializer(self.get_queryset(), many=True).data)

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
