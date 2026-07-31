from datetime import date

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from common.lookup import get_by_uuid_or_code
from common.response import api_response
from common.permissions import IsFleetManagerOrAdmin
from equipment.models import Equipment, EquipmentStatus
from .models import Rental, RentalStatus
from .serializers import RentalSerializer


class RentalViewSet(viewsets.ModelViewSet):
    queryset = Rental.objects.select_related(
        "equipment", "equipment__model_ref", "site", "operator"
    ).all()
    serializer_class = RentalSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "check_out", "check_in", "destroy"]:
            return [IsFleetManagerOrAdmin()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        st = request.query_params.get("status")
        if st:
            qs = qs.filter(rental_status=st)
        overdue = request.query_params.get("overdue")
        if overdue == "1":
            qs = qs.filter(
                rental_status__in=[RentalStatus.ACTIVE, RentalStatus.OVERDUE],
                expected_return_date__lt=date.today(),
                actual_return_date__isnull=True,
            )
        return api_response(True, "Rentals retrieved", self.get_serializer(qs, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return api_response(True, "Rental retrieved", self.get_serializer(self.get_object()).data)

    @action(detail=False, methods=["post"], url_path="check-out")
    def check_out(self, request):
        equipment_id = request.data.get("equipment_id")
        site_id = request.data.get("site_id")
        operator_id = request.data.get("operator_id")
        expected = request.data.get("expected_return_date")
        equipment = get_by_uuid_or_code(Equipment, equipment_id, "asset_id")
        if not equipment:
            return api_response(False, "Equipment not found", status_code=404)
        if equipment.current_status not in (EquipmentStatus.AVAILABLE, EquipmentStatus.IDLE):
            return api_response(False, "Equipment not available for checkout", status_code=400)

        from sites.models import Site
        from operators.models import Operator

        site = get_by_uuid_or_code(Site, site_id, "site_id") if site_id else None
        operator = get_by_uuid_or_code(Operator, operator_id, "operator_id") if operator_id else None
        rental_code = f"RNT{Rental.objects.count() + 1:05d}"
        while Rental.objects.filter(rental_id=rental_code).exists():
            rental_code = f"RNT{Rental.objects.count() + 100:05d}"

        try:
            expected_date = date.fromisoformat(str(expected)[:10]) if expected else date.today()
        except ValueError:
            expected_date = date.today()

        rental = Rental.objects.create(
            rental_id=rental_code,
            equipment=equipment,
            site=site,
            operator=operator,
            check_out_date=date.today(),
            expected_return_date=expected_date,
            rental_status=RentalStatus.ACTIVE,
            daily_rate=float(request.data.get("daily_rate") or 500),
        )
        equipment.current_status = EquipmentStatus.ACTIVE
        equipment.current_site = site
        equipment.current_operator = operator
        equipment.save()
        return api_response(True, "Checked out", RentalSerializer(rental).data, status_code=201)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        rental = self.get_object()
        if rental.actual_return_date:
            return api_response(False, "Already checked in", status_code=400)
        rental.actual_return_date = date.today()
        rental.rental_status = RentalStatus.COMPLETED
        if rental.check_out_date:
            rental.rental_days = (rental.actual_return_date - rental.check_out_date).days or 1
        rental.save()
        eq = rental.equipment
        eq.current_status = EquipmentStatus.AVAILABLE
        eq.current_site = None
        eq.current_operator = None
        eq.save()
        return api_response(True, "Checked in", RentalSerializer(rental).data)
