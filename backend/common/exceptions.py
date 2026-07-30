from rest_framework import status
from rest_framework.exceptions import APIException


class FleetVisionAPIException(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "A request error occurred."
    default_code = "error"


class NotFoundError(FleetVisionAPIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Resource not found."
    default_code = "not_found"


class ValidationError(FleetVisionAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Validation failed."
    default_code = "validation_error"


class ConflictError(FleetVisionAPIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Conflict with current resource state."
    default_code = "conflict"


class ServiceUnavailableError(FleetVisionAPIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "A required service is unavailable."
    default_code = "service_unavailable"
