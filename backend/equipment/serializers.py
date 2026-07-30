from rest_framework import serializers
from .models import Equipment, EquipmentModel


class EquipmentModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentModel
        fields = "__all__"


class EquipmentSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(source="model_ref.model", read_only=True, default="")
    category = serializers.CharField(source="model_ref.category", read_only=True, default="")
    manufacturer = serializers.CharField(source="model_ref.manufacturer", read_only=True, default="")
    site_id = serializers.CharField(source="current_site.site_id", read_only=True, default=None)
    site_name = serializers.CharField(source="current_site.site_name", read_only=True, default=None)
    operator_id = serializers.CharField(source="current_operator.operator_id", read_only=True, default=None)
    operator_name = serializers.CharField(source="current_operator.name", read_only=True, default=None)

    class Meta:
        model = Equipment
        fields = [
            "id",
            "asset_id",
            "serial_number",
            "manufacture_year",
            "acquisition_type",
            "current_status",
            "total_engine_hours",
            "model_name",
            "category",
            "manufacturer",
            "site_id",
            "site_name",
            "operator_id",
            "operator_name",
            "current_site",
            "current_operator",
            "model_ref",
            "created_at",
            "updated_at",
        ]
