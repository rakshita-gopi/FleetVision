from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from common.response import api_response
from .models import Operator
from .serializers import OperatorSerializer


class OperatorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Operator.objects.all()
    serializer_class = OperatorSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        return api_response(True, "Operators retrieved", self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return api_response(True, "Operator retrieved", self.get_serializer(self.get_object()).data)
