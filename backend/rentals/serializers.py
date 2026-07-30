from rest_framework import serializers
from .models import Rental


class RentalSerializer(serializers.ModelSerializer):
    asset_id = serializers.CharField(source="equipment.asset_id", read_only=True)
    equipment_category = serializers.CharField(source="equipment.model_ref.category", read_only=True, default="")
    site_id = serializers.CharField(source="site.site_id", read_only=True, default=None)
    site_name = serializers.CharField(source="site.site_name", read_only=True, default=None)
    operator_id = serializers.CharField(source="operator.operator_id", read_only=True, default=None)
    operator_name = serializers.CharField(source="operator.name", read_only=True, default=None)

    class Meta:
        model = Rental
        fields = [
            "id",
            "rental_id",
            "equipment",
            "asset_id",
            "equipment_category",
            "site",
            "site_id",
            "site_name",
            "operator",
            "operator_id",
            "operator_name",
            "check_out_date",
            "expected_return_date",
            "actual_return_date",
            "rental_days",
            "daily_rate",
            "rental_status",
            "created_at",
            "updated_at",
        ]
