from rest_framework import serializers

from common.geo import snap_to_land
from .models import Site


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = "__all__"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        lat, lon = snap_to_land(data.get("latitude"), data.get("longitude"))
        data["latitude"] = lat
        data["longitude"] = lon
        return data
