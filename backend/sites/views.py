from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from common.response import api_response
from .models import Site
from .serializers import SiteSerializer


class SiteViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        return api_response(True, "Sites retrieved", self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return api_response(True, "Site retrieved", self.get_serializer(self.get_object()).data)
