from django.urls import path

from .views import McpCallView, McpHealthView, McpToolsView

urlpatterns = [
    path("health/", McpHealthView.as_view(), name="mcp-health"),
    path("tools/", McpToolsView.as_view(), name="mcp-tools"),
    path("call/", McpCallView.as_view(), name="mcp-call"),
]
