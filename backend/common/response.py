from rest_framework.response import Response
from rest_framework import status


def api_response(success=True, message="", data=None, errors=None, status_code=status.HTTP_200_OK):
    payload = {"success": success, "message": message}
    if data is not None:
        payload["data"] = data
    if errors is not None:
        payload["errors"] = errors
    return Response(payload, status=status_code)
