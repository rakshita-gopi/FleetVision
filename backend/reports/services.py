import csv
import io
import json
from datetime import timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ai_assistant.services import call_ollama
from drivers.models import Driver
from expenses.models import Expense
from fuel.models import FuelLog
from maintenance.models import MaintenanceRecord
from trips.models import Trip, TripStatus
from vehicles.models import Vehicle


REPORT_TYPES = {"vehicle", "driver", "fuel", "maintenance", "expense", "trip", "overall", "custom"}
DEFAULT_SECTIONS = ["analytics", "tables", "charts", "history"]


def _safe_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def _month_start():
    today = timezone.now().date()
    return today.replace(day=1)


def build_report_payload(report_type: str, filters: Dict, sections: List[str]) -> Dict:
    report_type = (report_type or "overall").lower()
    if report_type not in REPORT_TYPES:
        report_type = "overall"

    sections = sections or DEFAULT_SECTIONS
    lookback_days = int(filters.get("lookback_days", 30))
    since = timezone.now() - timedelta(days=lookback_days)
    month_start = _month_start()

    vehicles = Vehicle.objects.all()
    drivers = Driver.objects.select_related("user", "assigned_vehicle").all()
    trips = Trip.objects.select_related("vehicle", "driver__user").filter(created_at__gte=since)
    fuels = FuelLog.objects.select_related("vehicle", "driver__user").filter(fuel_date__gte=since.date())
    maintenance = MaintenanceRecord.objects.select_related("vehicle").filter(service_date__gte=since.date())
    expenses = Expense.objects.select_related("vehicle").filter(expense_date__gte=since.date())

    base = {
        "meta": {
            "report_type": report_type,
            "generated_at": timezone.now().isoformat(),
            "lookback_days": lookback_days,
            "sections": sections,
        },
        "analytics": {
            "vehicles_total": vehicles.count(),
            "drivers_total": drivers.count(),
            "trips_total": trips.count(),
            "trips_completed": trips.filter(trip_status=TripStatus.COMPLETED).count(),
            "trips_in_progress": trips.filter(trip_status=TripStatus.IN_PROGRESS).count(),
            "fuel_cost_month": _safe_float(
                FuelLog.objects.filter(fuel_date__gte=month_start).aggregate(total=Sum("fuel_cost"))["total"] or 0
            ),
            "maintenance_cost_month": _safe_float(
                MaintenanceRecord.objects.filter(service_date__gte=month_start).aggregate(total=Sum("repair_cost"))["total"] or 0
            ),
            "expense_cost_month": _safe_float(
                Expense.objects.filter(expense_date__gte=month_start).aggregate(total=Sum("amount"))["total"] or 0
            ),
        },
        "tables": {},
        "charts": {},
        "history": {
            "period_start": since.isoformat(),
            "period_end": timezone.now().isoformat(),
        },
    }

    if report_type in {"vehicle", "overall", "custom"}:
        base["tables"]["vehicles"] = list(
            vehicles.values("vehicle_number", "manufacturer", "model", "fuel_type", "status", "odometer")[:200]
        )
        base["charts"]["vehicle_status"] = list(vehicles.values("status").annotate(count=Count("id")))

    if report_type in {"driver", "overall", "custom"}:
        base["tables"]["drivers"] = [
            {
                "name": d.user.full_name,
                "license_number": d.license_number,
                "status": d.status,
                "assigned_vehicle": d.assigned_vehicle.vehicle_number if d.assigned_vehicle else "Unassigned",
                "completed_trips": d.trips.filter(trip_status=TripStatus.COMPLETED).count(),
            }
            for d in drivers[:200]
        ]

    if report_type in {"trip", "overall", "custom"}:
        base["tables"]["trips"] = [
            {
                "vehicle": t.vehicle.vehicle_number,
                "driver": t.driver.user.full_name,
                "source": t.source,
                "destination": t.destination,
                "status": t.trip_status,
                "distance_km": _safe_float(t.distance),
                "start_time": t.start_time.isoformat() if t.start_time else None,
                "end_time": t.end_time.isoformat() if t.end_time else None,
            }
            for t in trips.order_by("-created_at")[:200]
        ]
        base["charts"]["trip_status"] = list(trips.values("trip_status").annotate(count=Count("id")))

    if report_type in {"fuel", "overall", "custom"}:
        base["tables"]["fuel"] = [
            {
                "vehicle": f.vehicle.vehicle_number,
                "driver": f.driver.user.full_name if f.driver else None,
                "quantity_l": _safe_float(f.fuel_quantity),
                "cost": _safe_float(f.fuel_cost),
                "mileage": _safe_float(f.mileage),
                "date": f.fuel_date.isoformat(),
            }
            for f in fuels.order_by("-fuel_date")[:200]
        ]
        base["charts"]["fuel_monthly_cost"] = [
            {"month": row["month"].isoformat() if row["month"] else None, "total_cost": _safe_float(row["total_cost"] or 0)}
            for row in fuels.annotate(month=TruncMonth("fuel_date")).values("month").annotate(total_cost=Sum("fuel_cost")).order_by("month")
        ]

    if report_type in {"maintenance", "overall", "custom"}:
        base["tables"]["maintenance"] = [
            {
                "vehicle": m.vehicle.vehicle_number,
                "service_type": m.service_type,
                "mechanic": m.mechanic_name,
                "cost": _safe_float(m.repair_cost),
                "service_date": m.service_date.isoformat(),
                "next_service_date": m.next_service_date.isoformat() if m.next_service_date else None,
            }
            for m in maintenance.order_by("-service_date")[:200]
        ]

    if report_type in {"expense", "overall", "custom"}:
        base["tables"]["expenses"] = [
            {
                "vehicle": e.vehicle.vehicle_number,
                "category": e.expense_category,
                "amount": _safe_float(e.amount),
                "date": e.expense_date.isoformat(),
                "description": e.description,
            }
            for e in expenses.order_by("-expense_date")[:200]
        ]
        base["charts"]["expense_by_category"] = [
            {"category": row["expense_category"], "total": _safe_float(row["total"] or 0)}
            for row in expenses.values("expense_category").annotate(total=Sum("amount"))
        ]

    if report_type == "custom":
        requested_tables = set(filters.get("custom_tables", []))
        if requested_tables:
            base["tables"] = {k: v for k, v in base["tables"].items() if k in requested_tables}

    if "tables" not in sections:
        base.pop("tables", None)
    if "charts" not in sections:
        base.pop("charts", None)
    if "history" not in sections:
        base.pop("history", None)
    if "analytics" not in sections:
        base.pop("analytics", None)

    return base


def generate_llm_report_text(payload: Dict) -> str:
    prompt = (
        "You are FleetVision report generator. Create an executive report with:\n"
        "1) Key findings\n2) Risks / anomalies\n3) Efficiency opportunities\n4) Action plan.\n"
        "Keep it structured with headings and bullets. Use the analytics and table counts.\n\n"
        f"Data:\n{json.dumps(payload, default=str)[:12000]}"
    )
    result = call_ollama(prompt)
    if result:
        return result
    return (
        "## Executive Summary\n"
        "- Automated report generated from FleetVision operational data.\n"
        "- LLM summary unavailable (Ollama not reachable), so this fallback summary is provided.\n"
        "- Use analytics and table sections for detailed inspection.\n"
    )


def _flatten_rows(payload: Dict) -> List[Dict]:
    rows = []
    for table_name, items in payload.get("tables", {}).items():
        for item in items:
            row = {"table": table_name}
            row.update({k: _safe_float(v) for k, v in item.items()})
            rows.append(row)
    return rows


def render_csv_bytes(payload: Dict) -> bytes:
    rows = _flatten_rows(payload)
    if not rows:
        rows = [{"table": "none", "message": "No records"}]
    headers = sorted({k for r in rows for k in r.keys()})
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue().encode("utf-8")


def render_json_bytes(payload: Dict, llm_summary: str) -> bytes:
    data = {"payload": payload, "llm_summary": llm_summary}
    return json.dumps(data, indent=2, default=str).encode("utf-8")


def _fig_to_image(fig, width: float = 6.8 * inch) -> Image:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=160, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    img = Image(buf)
    img.drawWidth = width
    img.drawHeight = width * 0.52
    return img


def _chart_palette():
    return ["#2563eb", "#0891b2", "#16a34a", "#d97706", "#7c3aed", "#dc2626", "#64748b"]


def _make_kpi_chart(analytics: Dict) -> Optional[Image]:
    if not analytics:
        return None
    labels = [k.replace("_", " ").title() for k in analytics.keys()]
    values = [_safe_float(v) for v in analytics.values()]
    fig, ax = plt.subplots(figsize=(8, 3.2))
    bars = ax.barh(labels, values, color=_chart_palette()[0])
    ax.set_title("Fleet KPI Analytics", fontsize=12, fontweight="bold", color="#0f172a")
    ax.grid(axis="x", linestyle="--", alpha=0.35)
    for bar, val in zip(bars, values):
        ax.text(bar.get_width() + max(values) * 0.01, bar.get_y() + bar.get_height() / 2, f"{val:,.0f}", va="center", fontsize=8)
    fig.tight_layout()
    return _fig_to_image(fig)


def _make_pie_chart(rows: List[Dict], label_key: str, value_key: str, title: str) -> Optional[Image]:
    if not rows:
        return None
    labels = [str(r.get(label_key, ""))[:18] for r in rows]
    values = [_safe_float(r.get(value_key, 0)) for r in rows]
    if sum(values) <= 0:
        return None
    fig, ax = plt.subplots(figsize=(6.5, 3.5))
    ax.pie(values, labels=labels, autopct="%1.0f%%", startangle=120, colors=_chart_palette()[: len(values)])
    ax.set_title(title, fontsize=11, fontweight="bold", color="#0f172a")
    fig.tight_layout()
    return _fig_to_image(fig, width=5.6 * inch)


def _make_bar_chart(rows: List[Dict], label_key: str, value_key: str, title: str) -> Optional[Image]:
    if not rows:
        return None
    labels = [str(r.get(label_key, ""))[:12] for r in rows]
    values = [_safe_float(r.get(value_key, 0)) for r in rows]
    fig, ax = plt.subplots(figsize=(7.5, 3.4))
    ax.bar(labels, values, color=_chart_palette()[0], edgecolor="#1e40af", linewidth=0.6)
    ax.set_title(title, fontsize=11, fontweight="bold", color="#0f172a")
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    plt.xticks(rotation=25, ha="right", fontsize=8)
    fig.tight_layout()
    return _fig_to_image(fig)


def _make_line_chart(rows: List[Dict], label_key: str, value_key: str, title: str) -> Optional[Image]:
    if not rows:
        return None
    labels = [str(r.get(label_key, ""))[:10] for r in rows]
    values = [_safe_float(r.get(value_key, 0)) for r in rows]
    fig, ax = plt.subplots(figsize=(7.5, 3.4))
    ax.plot(labels, values, marker="o", linewidth=2.2, color="#2563eb")
    ax.fill_between(range(len(values)), values, alpha=0.12, color="#2563eb")
    ax.set_title(title, fontsize=11, fontweight="bold", color="#0f172a")
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    plt.xticks(rotation=25, ha="right", fontsize=8)
    fig.tight_layout()
    return _fig_to_image(fig)


def _chart_from_payload(name: str, rows: List[Dict]) -> Optional[Image]:
    if not rows:
        return None
    title = name.replace("_", " ").title()
    keys = set(rows[0].keys())

    if "status" in keys and "count" in keys:
        return _make_pie_chart(rows, "status", "count", title)
    if "trip_status" in keys and "count" in keys:
        return _make_pie_chart(rows, "trip_status", "count", title)
    if "category" in keys and "total" in keys:
        return _make_pie_chart(rows, "category", "total", title)
    if "expense_category" in keys and "total" in keys:
        return _make_pie_chart(rows, "expense_category", "total", title)
    if "month" in keys and "total_cost" in keys:
        return _make_line_chart(rows, "month", "total_cost", title)

    numeric_keys = [k for k in keys if isinstance(rows[0].get(k), (int, float, Decimal))]
    label_keys = [k for k in keys if k not in numeric_keys]
    if label_keys and numeric_keys:
        return _make_bar_chart(rows, label_keys[0], numeric_keys[0], title)
    return None


def _pdf_brand_header(styles) -> Table:
    brand_style = ParagraphStyle(
        "BrandTitle",
        parent=styles["Title"],
        textColor=colors.white,
        fontSize=20,
        leading=24,
    )
    subtitle_style = ParagraphStyle(
        "BrandSub",
        parent=styles["Normal"],
        textColor=colors.HexColor("#dbeafe"),
        fontSize=10,
    )
    header = Table(
        [[Paragraph("<b>FleetVision</b>", brand_style)], [Paragraph("AI Fleet Management Report", subtitle_style)]],
        colWidths=[6.8 * inch],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#2563eb")),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return header


def render_pdf_bytes(payload: Dict, llm_summary: str) -> bytes:
    out = io.BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=28, rightMargin=28, topMargin=36, bottomMargin=28)
    styles = getSampleStyleSheet()
    story = []

    story.append(_pdf_brand_header(styles))
    story.append(Spacer(1, 8))
    meta = payload.get("meta", {})
    story.append(Paragraph(f"<b>Report Type:</b> {meta.get('report_type', 'overall').title()}", styles["Normal"]))
    story.append(Paragraph(f"<b>Generated:</b> {meta.get('generated_at', '')}", styles["Normal"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>LLM Insights</b>", styles["Heading2"]))
    for line in llm_summary.splitlines()[:32]:
        if line.strip():
            story.append(Paragraph(line.strip(), styles["Normal"]))
    story.append(Spacer(1, 12))

    analytics = payload.get("analytics", {})
    if analytics:
        story.append(Paragraph("<b>Analytics Overview</b>", styles["Heading2"]))
        kpi_chart = _make_kpi_chart(analytics)
        if kpi_chart:
            story.append(kpi_chart)
            story.append(Spacer(1, 8))
        analytics_data = [["Metric", "Value"]] + [[k.replace("_", " ").title(), str(v)] for k, v in analytics.items()]
        table = Table(analytics_data, repeatRows=1, colWidths=[3.8 * inch, 2.8 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 14))

    charts = payload.get("charts", {})
    if charts:
        story.append(Paragraph("<b>Visual Analytics</b>", styles["Heading2"]))
        story.append(Spacer(1, 6))
        for chart_name, rows in charts.items():
            chart_img = _chart_from_payload(chart_name, rows)
            if chart_img:
                story.append(Paragraph(chart_name.replace("_", " ").title(), styles["Heading3"]))
                story.append(chart_img)
                story.append(Spacer(1, 10))

    for table_name, rows in payload.get("tables", {}).items():
        story.append(Paragraph(f"<b>{table_name.title()} Details</b>", styles["Heading3"]))
        if not rows:
            story.append(Paragraph("No data", styles["Normal"]))
            continue
        keys = list(rows[0].keys())[:6]
        data = [keys] + [[str(r.get(k, ""))[:50] for k in keys] for r in rows[:20]]
        t = Table(data, repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eff6ff")),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 8))

    doc.build(story)
    return out.getvalue()


def export_report_bytes(export_format: str, payload: Dict, llm_summary: str) -> Tuple[bytes, str, str]:
    export_format = (export_format or "pdf").lower()
    report_type = payload.get("meta", {}).get("report_type", "overall")
    stamp = timezone.now().strftime("%Y%m%d-%H%M%S")
    filename_base = f"fleetvision-{report_type}-report-{stamp}"
    if export_format == "json":
        return render_json_bytes(payload, llm_summary), "application/json", f"{filename_base}.json"
    if export_format == "csv":
        return render_csv_bytes(payload), "text/csv", f"{filename_base}.csv"
    return render_pdf_bytes(payload, llm_summary), "application/pdf", f"{filename_base}.pdf"
