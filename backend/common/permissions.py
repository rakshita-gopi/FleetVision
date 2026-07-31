from rest_framework.permissions import BasePermission
from authentication.models import UserRole

# Role hierarchy (higher index = more privilege for "or above" checks)
ROLE_RANK = {
    UserRole.CUSTOMER: 0,
    UserRole.DRIVER: 1,
    UserRole.OPERATOR: 2,
    UserRole.MECHANIC: 2,
    UserRole.FLEET_MANAGER: 3,
    UserRole.ADMINISTRATOR: 4,
}


def _rank(user) -> int:
    if not user or not user.is_authenticated:
        return -1
    return ROLE_RANK.get(user.role, 0)


class IsAdministrator(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == UserRole.ADMINISTRATOR


class IsFleetManagerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            UserRole.ADMINISTRATOR,
            UserRole.FLEET_MANAGER,
        )


class IsOperatorOrAbove(BasePermission):
    """Operator, Manager, Admin — yard / scan actions."""

    def has_permission(self, request, view):
        return _rank(request.user) >= ROLE_RANK[UserRole.OPERATOR]


class IsMechanicOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            UserRole.ADMINISTRATOR,
            UserRole.MECHANIC,
            UserRole.FLEET_MANAGER,
        )


class IsDriverOrAbove(BasePermission):
    """Any authenticated user whose role is Driver/Operator or higher."""

    def has_permission(self, request, view):
        return _rank(request.user) >= ROLE_RANK[UserRole.DRIVER]


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == UserRole.CUSTOMER
