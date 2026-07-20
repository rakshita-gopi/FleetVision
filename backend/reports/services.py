import csv
import io
import json
import re
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

# Soft professional palette (slate + muted teal)
_PDF = {
    "ink": "#0f172a",
    "muted": "#64748b",
    "line": "#e2e8f0",
    "surface": "#f8fafc",
    "accent": "#0f766e",
    "header_bg": "#0f172a",
    "chart": ["#0f766e", "#0369a1", "#4f46e5", "#b45309", "#be123c", "#475569", "#0d9488"],
}


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
            {
                "month": row["month"].isoformat() if row["month"] else None,
                "total_cost": _safe_float(row["total_cost"] or 0),
            }
            for row in fuels.annotate(month=TruncMonth("fuel_date"))
            .values("month")
            .annotate(total_cost=Sum("fuel_cost"))
            .order_by("month")
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
        "Keep it structured with plain headings and bullets. Avoid markdown symbols like # or **.\n\n"
        f"Data:\n{json.dumps(payload, default=str)[:12000]}"
    )
    result = call_ollama(prompt)
    if result:
        return result
    return (
        "Executive Summary\n"
        "• Automated report generated from FleetVision operational data.\n"
        "• AI narrative was unavailable for this run, so a structured fallback summary is shown.\n"
        "• Review the analytics cards, charts, and detail tables below for actionable insights.\n"
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


def _escape_xml(text: str) -> str:
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _format_metric_value(key: str, value) -> str:
    val = _safe_float(value)
    if isinstance(val, (int, float)) and ("cost" in key or "amount" in key or "expense" in key):
        return f"₹{val:,.0f}"
    if isinstance(val, float) and val == int(val):
        return f"{int(val):,}"
    if isinstance(val, float):
        return f"{val:,.1f}"
    if isinstance(val, int):
        return f"{val:,}"
    return str(value)


def _format_generated_at(raw: str) -> str:
    if not raw:
        return ""
    clean = raw.replace("T", " ").split(".")[0]
    if "+" in clean:
        clean = clean.split("+")[0]
    return f"{clean} UTC"


def _clean_llm_lines(llm_summary: str) -> List[str]:
    lines = []
    for raw in (llm_summary or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        line = re.sub(r"^#{1,6}\s*", "", line)
        line = re.sub(r"\*\*(.*?)\*\*", r"\1", line)
        line = re.sub(r"__(.*?)__", r"\1", line)
        line = re.sub(r"^[-*•]\s+", "• ", line)
        lines.append(line)
    return lines[:28]


def _pdf_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "FVTitle", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=18, textColor=colors.white, leading=22, spaceAfter=2,
        ),
        "subtitle": ParagraphStyle(
            "FVSub", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, textColor=colors.HexColor("#94a3b8"), leading=12,
        ),
        "meta": ParagraphStyle(
            "FVMeta", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, textColor=colors.HexColor(_PDF["muted"]), leading=12, spaceAfter=2,
        ),
        "h2": ParagraphStyle(
            "FVH2", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=12, textColor=colors.HexColor(_PDF["ink"]),
            spaceBefore=10, spaceAfter=8, leading=15,
        ),
        "h3": ParagraphStyle(
            "FVH3", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=10, textColor=colors.HexColor("#334155"),
            spaceBefore=6, spaceAfter=6, leading=13,
        ),
        "body": ParagraphStyle(
            "FVBody", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, textColor=colors.HexColor("#334155"), leading=13, spaceAfter=3,
        ),
        "cell": ParagraphStyle(
            "FVCell", parent=base["Normal"], fontName="Helvetica",
            fontSize=8, textColor=colors.HexColor("#334155"), leading=10,
        ),
        "cell_header": ParagraphStyle(
            "FVCellH", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8, textColor=colors.HexColor("#0f172a"), leading=10,
        ),
        "muted": ParagraphStyle(
            "FVMuted", parent=base["Normal"], fontName="Helvetica-Oblique",
            fontSize=8, textColor=colors.HexColor(_PDF["muted"]), leading=11,
        ),
    }


def _fig_to_image(fig, width: float = 6.6 * inch, ratio: float = 0.48) -> Image:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=180, bbox_inches="tight", facecolor="white", edgecolor="none")
    plt.close(fig)
    buf.seek(0)
    img = Image(buf)
    img.drawWidth = width
    img.drawHeight = width * ratio
    return img


def _style_axes(ax, title: str):
    ax.set_title(title, fontsize=11, fontweight="bold", color=_PDF["ink"], pad=10, loc="left")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(_PDF["line"])
    ax.spines["bottom"].set_color(_PDF["line"])
    ax.tick_params(colors=_PDF["muted"], labelsize=8)
    ax.grid(axis="y", linestyle="-", linewidth=0.6, color=_PDF["line"], alpha=0.9)
    ax.set_axisbelow(True)


def _make_ops_chart(analytics: Dict) -> Optional[Image]:
    count_keys = [k for k in analytics.keys() if "cost" not in k and "amount" not in k]
    if not count_keys:
        return None
    labels = [k.replace("_", " ").title() for k in count_keys]
    values = [_safe_float(analytics[k]) for k in count_keys]
    fig, ax = plt.subplots(figsize=(7.2, 2.8))
    y = list(range(len(labels)))
    ax.barh(y, values, color=_PDF["chart"][0], height=0.55, edgecolor="none")
    ax.set_yticks(y)
    ax.set_yticklabels(labels)
    _style_axes(ax, "Operational snapshot")
    ax.grid(axis="x", linestyle="-", linewidth=0.6, color=_PDF["line"], alpha=0.9)
    ax.grid(axis="y", visible=False)
    for i, val in enumerate(values):
        ax.text(val + max(values + [1]) * 0.02, i, f"{val:,.0f}", va="center", fontsize=8, color=_PDF["ink"])
    fig.tight_layout()
    return _fig_to_image(fig, ratio=0.42)


def _make_cost_chart(analytics: Dict) -> Optional[Image]:
    cost_keys = [k for k in analytics.keys() if "cost" in k or "amount" in k or "expense" in k]
    if not cost_keys:
        return None
    labels = [k.replace("_", " ").title() for k in cost_keys]
    values = [_safe_float(analytics[k]) for k in cost_keys]
    fig, ax = plt.subplots(figsize=(7.2, 2.4))
    palette = [_PDF["chart"][i % len(_PDF["chart"])] for i in range(len(values))]
    bars = ax.bar(labels, values, color=palette, width=0.55, edgecolor="none")
    _style_axes(ax, "Cost overview (₹)")
    plt.xticks(rotation=15, ha="right")
    for bar, val in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2, bar.get_height(),
            f"₹{val:,.0f}", ha="center", va="bottom", fontsize=7.5, color=_PDF["ink"],
        )
    fig.tight_layout()
    return _fig_to_image(fig, ratio=0.40)


def _make_pie_chart(rows: List[Dict], label_key: str, value_key: str, title: str) -> Optional[Image]:
    if not rows:
        return None
    labels = [str(r.get(label_key, ""))[:16] for r in rows]
    values = [_safe_float(r.get(value_key, 0)) for r in rows]
    if sum(values) <= 0:
        return None
    fig, ax = plt.subplots(figsize=(6.2, 3.2))
    wedges, texts, autotexts = ax.pie(
        values,
        labels=labels,
        autopct="%1.0f%%",
        startangle=110,
        colors=_PDF["chart"][: len(values)],
        pctdistance=0.72,
        wedgeprops={"width": 0.45, "edgecolor": "white", "linewidth": 2},
    )
    for t in texts:
        t.set_fontsize(8)
        t.set_color(_PDF["ink"])
    for t in autotexts:
        t.set_fontsize(7.5)
        t.set_color(_PDF["ink"])
    ax.set_title(title, fontsize=11, fontweight="bold", color=_PDF["ink"], pad=8, loc="left")
    fig.tight_layout()
    return _fig_to_image(fig, width=5.4 * inch, ratio=0.55)


def _make_bar_chart(rows: List[Dict], label_key: str, value_key: str, title: str) -> Optional[Image]:
    if not rows:
        return None
    labels = [str(r.get(label_key, ""))[:14] for r in rows]
    values = [_safe_float(r.get(value_key, 0)) for r in rows]
    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    ax.bar(labels, values, color=_PDF["chart"][1], width=0.55, edgecolor="none")
    _style_axes(ax, title)
    plt.xticks(rotation=20, ha="right")
    fig.tight_layout()
    return _fig_to_image(fig, ratio=0.45)


def _make_line_chart(rows: List[Dict], label_key: str, value_key: str, title: str) -> Optional[Image]:
    if not rows:
        return None
    labels = []
    for r in rows:
        raw = str(r.get(label_key, "") or "")
        labels.append(raw[:10] if "T" not in raw else raw.split("T")[0][5:])
    values = [_safe_float(r.get(value_key, 0)) for r in rows]
    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    x = list(range(len(values)))
    ax.plot(x, values, marker="o", markersize=5, linewidth=2, color=_PDF["chart"][0])
    ax.fill_between(x, values, alpha=0.12, color=_PDF["chart"][0])
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=20, ha="right")
    _style_axes(ax, title)
    fig.tight_layout()
    return _fig_to_image(fig, ratio=0.45)


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
    header = Table(
        [
            [Paragraph("FleetVision", styles["title"])],
            [Paragraph("AI Fleet Management Report", styles["subtitle"])],
        ],
        colWidths=[6.8 * inch],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(_PDF["header_bg"])),
                ("LEFTPADDING", (0, 0), (-1, -1), 16),
                ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                ("TOPPADDING", (0, 0), (0, 0), 14),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 12),
                ("TOPPADDING", (0, 1), (-1, 1), 0),
                ("LINEBELOW", (0, -1), (-1, -1), 3, colors.HexColor(_PDF["accent"])),
            ]
        )
    )
    return header


def _styled_table(data: List[List], col_widths=None) -> Table:
    table = Table(data, repeatRows=1, colWidths=col_widths)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(_PDF["surface"])),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor(_PDF["ink"])),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor(_PDF["accent"])),
                ("LINEBELOW", (0, 1), (-1, -2), 0.4, colors.HexColor(_PDF["line"])),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(_PDF["line"])),
            ]
        )
    )
    return table


def _section_rule():
    rule = Table([[""]], colWidths=[6.8 * inch], rowHeights=[1])
    rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(_PDF["line"]))]))
    return rule


def render_pdf_bytes(payload: Dict, llm_summary: str) -> bytes:
    out = io.BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=32, bottomMargin=36)
    styles = _pdf_styles()
    story = []
    meta = payload.get("meta", {})
    report_type = str(meta.get("report_type", "overall")).title()
    generated = _format_generated_at(str(meta.get("generated_at", "")))

    story.append(_pdf_brand_header(styles))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Report type &nbsp;&nbsp;<b>{_escape_xml(report_type)}</b>", styles["meta"]))
    story.append(Paragraph(f"Generated &nbsp;&nbsp;&nbsp;<b>{_escape_xml(generated)}</b>", styles["meta"]))
    lookback = meta.get("lookback_days")
    if lookback:
        story.append(Paragraph(f"Period &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>Last {lookback} days</b>", styles["meta"]))
    story.append(Spacer(1, 8))
    story.append(_section_rule())

    story.append(Paragraph("Executive insights", styles["h2"]))
    insight_lines = _clean_llm_lines(llm_summary)
    if insight_lines:
        for line in insight_lines:
            story.append(Paragraph(_escape_xml(line), styles["body"]))
    else:
        story.append(Paragraph("No narrative summary available for this run.", styles["muted"]))
    story.append(Spacer(1, 6))
    story.append(_section_rule())

    analytics = payload.get("analytics", {})
    if analytics:
        story.append(Paragraph("Analytics overview", styles["h2"]))

        items = list(analytics.items())
        card_rows = []
        row = []
        for i, (k, v) in enumerate(items):
            cell = Paragraph(
                f"<font color='{_PDF['muted']}' size='7'>{_escape_xml(k.replace('_', ' ').title())}</font><br/>"
                f"<font color='{_PDF['ink']}' size='11'><b>{_escape_xml(_format_metric_value(k, v))}</b></font>",
                styles["body"],
            )
            row.append(cell)
            if len(row) == 4 or i == len(items) - 1:
                while len(row) < 4:
                    row.append("")
                card_rows.append(row)
                row = []
        cards = Table(card_rows, colWidths=[1.7 * inch] * 4)
        cards.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(_PDF["surface"])),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(_PDF["line"])),
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(_PDF["line"])),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(cards)
        story.append(Spacer(1, 10))

        ops = _make_ops_chart(analytics)
        if ops:
            story.append(ops)
            story.append(Spacer(1, 8))
        costs = _make_cost_chart(analytics)
        if costs:
            story.append(costs)
            story.append(Spacer(1, 8))

        analytics_data = [
            [Paragraph("Metric", styles["cell_header"]), Paragraph("Value", styles["cell_header"])]
        ] + [
            [
                Paragraph(_escape_xml(k.replace("_", " ").title()), styles["cell"]),
                Paragraph(_escape_xml(_format_metric_value(k, v)), styles["cell"]),
            ]
            for k, v in analytics.items()
        ]
        story.append(_styled_table(analytics_data, col_widths=[4.0 * inch, 2.6 * inch]))
        story.append(Spacer(1, 8))
        story.append(_section_rule())

    charts = payload.get("charts", {})
    if charts:
        story.append(Paragraph("Visual analytics", styles["h2"]))
        any_chart = False
        for chart_name, rows in charts.items():
            chart_img = _chart_from_payload(chart_name, rows)
            if chart_img:
                any_chart = True
                story.append(Paragraph(chart_name.replace("_", " ").title(), styles["h3"]))
                story.append(chart_img)
                story.append(Spacer(1, 8))
        if not any_chart:
            story.append(Paragraph("No chartable data available for the selected period.", styles["muted"]))
        story.append(_section_rule())

    for table_name, rows in (payload.get("tables") or {}).items():
        story.append(Paragraph(f"{table_name.replace('_', ' ').title()} details", styles["h2"]))
        if not rows:
            story.append(Paragraph("No records in this section.", styles["muted"]))
            continue
        keys = list(rows[0].keys())[:6]
        header = [Paragraph(_escape_xml(k.replace("_", " ").title()), styles["cell_header"]) for k in keys]
        data = [header]
        for r in rows[:18]:
            data.append(
                [
                    Paragraph(
                        _escape_xml(str(r.get(k, "") if r.get(k, "") is not None else "—")[:42]),
                        styles["cell"],
                    )
                    for k in keys
                ]
            )
        col_w = [6.6 * inch / len(keys)] * len(keys)
        story.append(_styled_table(data, col_widths=col_w))
        if len(rows) > 18:
            story.append(Paragraph(f"Showing 18 of {len(rows)} rows.", styles["muted"]))
        story.append(Spacer(1, 10))

    story.append(Spacer(1, 6))
    story.append(_section_rule())
    story.append(Spacer(1, 6))
    story.append(
        Paragraph("Prepared by FleetVision AI · Confidential fleet operations report", styles["muted"])
    )

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
