from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated

from common.response import api_response
from common.permissions import IsFleetManagerOrAdmin
from .models import Expense
from .serializers import ExpenseSerializer
from .services import ExpenseService


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("vehicle").all().order_by("-expense_date")
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsFleetManagerOrAdmin()]
        return [IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        queryset = ExpenseService.list_expenses(self.get_queryset())
        return api_response(True, "Expenses retrieved", self.get_serializer(queryset, many=True).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            ExpenseService.create_expense(serializer)
            return api_response(True, "Expense created", serializer.data, status_code=status.HTTP_201_CREATED)
        return api_response(False, "Validation failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            ExpenseService.update_expense(serializer)
            return api_response(True, "Expense updated", serializer.data)
        return api_response(False, "Update failed", errors=serializer.errors, status_code=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        ExpenseService.delete_expense(self.get_object())
        return api_response(True, "Expense deleted")
