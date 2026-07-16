from rest_framework.permissions import BasePermission
from authentication.models import UserRole


class IsAdministrator(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == UserRole.ADMINISTRATOR


class IsFleetManagerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            UserRole.ADMINISTRATOR,
            UserRole.FLEET_MANAGER,
        )


class IsMechanicOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            UserRole.ADMINISTRATOR,
            UserRole.MECHANIC,
            UserRole.FLEET_MANAGER,
        )


class IsDriverOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated
