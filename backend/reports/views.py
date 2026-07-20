from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from common.response import api_response
from .conversation import process_report_chat
from .models import GeneratedReport
from .services import build_report_payload, export_report_bytes, generate_llm_report_text


class DashboardReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payload = build_report_payload("overall", filters={}, sections=["analytics", "charts"])
        return api_response(True, "Dashboard report", payload.get("analytics", {}))


class ReportChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = (request.data.get("message") or "").strip()
        if not message:
            return api_response(False, "Message is required", status_code=status.HTTP_400_BAD_REQUEST)
        history = request.data.get("history") or []
        state = request.data.get("state") or {}
        result = process_report_chat(message=message, history=history, state=state)
        return api_response(True, "Report chat turn", result)


class GenerateReportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        report_type = request.data.get("report_type", "overall")
        sections = request.data.get("sections", ["analytics", "tables", "charts", "history"])
        filters = request.data.get("filters", {})
        export_format = request.data.get("format", "pdf")

        payload = build_report_payload(report_type=report_type, filters=filters, sections=sections)
        llm_summary = generate_llm_report_text(payload)
        file_bytes, content_type, filename = export_report_bytes(export_format, payload, llm_summary)

        report = GeneratedReport.objects.create(
            report_type=report_type,
            requested_sections=sections,
            requested_by=request.user,
            default_format=export_format if export_format in {"pdf", "json", "csv"} else "pdf",
            llm_summary=llm_summary,
            filters=filters,
            payload=payload,
        )

        response = HttpResponse(file_bytes, content_type=content_type, status=status.HTTP_200_OK)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["X-Report-Id"] = str(report.id)
        response["X-Report-Format"] = export_format
        return response


class ReportHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = GeneratedReport.objects.all()[:50]
        data = [
            {
                "id": str(r.id),
                "report_type": r.report_type,
                "sections": r.requested_sections,
                "default_format": r.default_format,
                "created_at": r.created_at,
                "preview": r.llm_summary[:260],
            }
            for r in rows
        ]
        return api_response(True, "Report history", data)


class ReportDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        export_format = request.query_params.get("format", "")
        report = GeneratedReport.objects.filter(id=report_id).first()
        if not report:
            return api_response(False, "Report not found", status_code=status.HTTP_404_NOT_FOUND)

        fmt = export_format or report.default_format
        file_bytes, content_type, filename = export_report_bytes(fmt, report.payload, report.llm_summary)
        response = HttpResponse(file_bytes, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class ReportPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = GeneratedReport.objects.filter(id=report_id).first()
        if not report:
            return api_response(False, "Report not found", status_code=status.HTTP_404_NOT_FOUND)
        return api_response(
            True,
            "Report preview",
            {
                "id": str(report.id),
                "report_type": report.report_type,
                "sections": report.requested_sections,
                "llm_summary": report.llm_summary,
                "payload": report.payload,
                "filters": report.filters,
                "created_at": report.created_at,
            },
        )
