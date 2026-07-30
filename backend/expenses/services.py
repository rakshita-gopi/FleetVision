import logging

from .models import Expense

logger = logging.getLogger(__name__)


class ExpenseService:
    @staticmethod
    def list_expenses(queryset=None):
        qs = queryset if queryset is not None else Expense.objects.select_related("vehicle")
        return qs.all().order_by("-expense_date")

    @staticmethod
    def create_expense(serializer) -> Expense:
        expense = serializer.save()
        logger.info("Expense %s created", expense.id)
        # TODO: publish expense.created event (Kafka — Phase 2)
        return expense

    @staticmethod
    def update_expense(serializer) -> Expense:
        expense = serializer.save()
        logger.info("Expense %s updated", expense.id)
        return expense

    @staticmethod
    def delete_expense(instance: Expense):
        expense_id = instance.id
        instance.delete()
        logger.info("Expense %s deleted", expense_id)
