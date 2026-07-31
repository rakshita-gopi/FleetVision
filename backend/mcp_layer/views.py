from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.response import api_response
from .tools_registry import invoke_tool, list_tools, mcp_catalog_block


class McpHealthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return api_response(
            True,
            "MCP layer healthy",
            {
                "ok": True,
                "server": "rental-iq-mcp",
                "protocol": "mcp",
                "tool_count": len(list_tools()),
            },
        )


class McpToolsView(APIView):
    """List MCP tools (HTTP discovery for Agentic Mode / API clients)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return api_response(True, "MCP catalog", mcp_catalog_block())


class McpCallView(APIView):
    """
    Invoke an MCP tool over HTTP.

    Body: { "name": "dispatch_desk", "arguments": { ... } }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        name = (request.data.get("name") or request.data.get("tool") or "").strip()
        if not name:
            return api_response(False, "name is required", status_code=400)
        arguments = request.data.get("arguments") or request.data.get("args") or {}
        if not isinstance(arguments, dict):
            return api_response(False, "arguments must be an object", status_code=400)
        try:
            payload = invoke_tool(name, arguments)
        except ValueError as exc:
            return api_response(False, str(exc), status_code=404)
        except TypeError as exc:
            return api_response(False, f"Invalid arguments: {exc}", status_code=400)
        except Exception as exc:  # noqa: BLE001 — surface tool errors to client
            return api_response(False, str(exc), {"tool": name, "ok": False}, status_code=500)
        return api_response(True, f"Tool {name} completed", payload)
