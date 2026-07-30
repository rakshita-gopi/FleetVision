from __future__ import annotations

import csv
import os
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from statistics import mean

from django.conf import settings
from django.db.models import Count

from ai_assistant.services import call_ollama
from equipment.models import Equipment, EquipmentStatus
from sites.models import Site
from .models import SiteDemand


def _dataset_root() -> Path:
    env = os.getenv("RENTAL_DATASET_PATH")
    if env:
        return Path(env)
    candidates = [
        Path(settings.BASE_DIR).parent / "cat_smart_rental_dataset",
        Path("/dataset"),
        Path(settings.BASE_DIR) / "cat_smart_rental_dataset",
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


def seed_site_demand(*, force: bool = False) -> int:
    root = _dataset_root()
    path = root / "site_demand.csv"
    if not path.exists():
        raise FileNotFoundError(f"site_demand.csv not found at {path}")
    if SiteDemand.objects.exists() and not force:
        return SiteDemand.objects.count()
    if force:
        SiteDemand.objects.all().delete()

    sites = {s.site_id: s for s in Site.objects.all()}
    created = 0
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            site = sites.get(row.get("site_id"))
            if not site:
                continue
            SiteDemand.objects.create(
                date=date.fromisoformat(row["date"][:10]),
                site=site,
                equipment_category=row.get("equipment_category") or "",
                requested_units=int(float(row.get("requested_units") or 0)),
                allocated_units=int(float(row.get("allocated_units") or 0)),
                utilisation_pct=float(row.get("utilisation_pct") or 0),
            )
            created += 1
    return created


def _available_by_category() -> dict[str, int]:
    qs = (
        Equipment.objects.filter(current_status__in=[EquipmentStatus.AVAILABLE, EquipmentStatus.IDLE])
        .values("model_ref__category")
        .annotate(c=Count("id"))
    )
    return {(r["model_ref__category"] or "Unknown"): r["c"] for r in qs}


def _idle_assets_by_category() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = defaultdict(list)
    for eq in Equipment.objects.filter(
        current_status__in=[EquipmentStatus.AVAILABLE, EquipmentStatus.IDLE]
    ).select_related("model_ref", "current_site")[:200]:
        cat = eq.model_ref.category if eq.model_ref else "Unknown"
        out[cat].append(
            {
                "asset_id": eq.asset_id,
                "status": eq.current_status,
                "site_id": eq.current_site.site_id if eq.current_site else None,
                "engine_hours": eq.total_engine_hours,
            }
        )
    return out


def build_forecast(*, horizon_days: int = 7, lookback_days: int = 28) -> dict:
    """
    Statistical demand forecast (moving average + weekday seasonality).
    Falls back gracefully with empty history.
    """
    today = date.today()
    lookback_start = today - timedelta(days=lookback_days)
    hist = list(
        SiteDemand.objects.filter(date__gte=lookback_start, date__lte=today)
        .select_related("site")
        .values("date", "site__site_id", "site__site_name", "equipment_category", "requested_units", "allocated_units", "utilisation_pct")
    )

    # Group history by site+category
    series: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in hist:
        key = (row["site__site_id"], row["equipment_category"])
        series[key].append(row)

    available = _available_by_category()
    idle_pool = _idle_assets_by_category()
    forecasts = []
    preposition = []

    for (site_id, category), rows in series.items():
        by_weekday = defaultdict(list)
        for r in rows:
            d = r["date"]
            if isinstance(d, str):
                d = date.fromisoformat(d)
            by_weekday[d.weekday()].append(r["requested_units"])
        overall = [r["requested_units"] for r in rows] or [0]
        avg_req = mean(overall)
        avg_util = mean([r["utilisation_pct"] for r in rows]) if rows else 0
        recent = overall[-7:] or overall
        trend = (mean(recent) - mean(overall)) if len(overall) >= 7 else 0

        daily = []
        peak = 0
        for i in range(1, horizon_days + 1):
            d = today + timedelta(days=i)
            wd_vals = by_weekday.get(d.weekday()) or overall
            base = mean(wd_vals)
            # light trend boost
            pred = max(0, round(base + 0.35 * trend))
            daily.append({"date": str(d), "predicted_units": pred})
            peak = max(peak, pred)

        on_hand = available.get(category, 0)
        shortfall = max(0, peak - on_hand)
        site_name = rows[0]["site__site_name"] if rows else site_id
        item = {
            "site_id": site_id,
            "site_name": site_name,
            "equipment_category": category,
            "avg_requested": round(avg_req, 2),
            "avg_utilisation_pct": round(avg_util, 1),
            "trend": round(trend, 2),
            "peak_forecast": peak,
            "available_fleet": on_hand,
            "shortfall": shortfall,
            "horizon": daily,
        }
        forecasts.append(item)

        if shortfall > 0:
            candidates = idle_pool.get(category, [])[:shortfall]
            preposition.append(
                {
                    "site_id": site_id,
                    "site_name": site_name,
                    "equipment_category": category,
                    "units_needed": shortfall,
                    "suggested_assets": candidates,
                    "rationale": (
                        f"Forecast peak {peak} {category} at {site_id} over next {horizon_days}d; "
                        f"only {on_hand} available fleet-wide."
                    ),
                }
            )

    forecasts.sort(key=lambda x: (-x["shortfall"], -x["peak_forecast"]))
    preposition.sort(key=lambda x: -x["units_needed"])

    # Historical shortfall hotspots
    hotspots = []
    gap_map: dict[tuple[str, str], list[int]] = defaultdict(list)
    for row in SiteDemand.objects.filter(date__gte=lookback_start).select_related("site"):
        if row.requested_units > row.allocated_units:
            gap_map[(row.site.site_id, row.equipment_category)].append(
                row.requested_units - row.allocated_units
            )
    for (sid, cat), gaps in gap_map.items():
        hotspots.append(
            {
                "site_id": sid,
                "equipment_category": cat,
                "shortfall_events": len(gaps),
                "avg_gap": round(mean(gaps), 2),
            }
        )
    hotspots.sort(key=lambda x: (-x["shortfall_events"], -x["avg_gap"]))

    narrative = _llm_or_fallback(forecasts[:8], preposition[:6], hotspots[:6], horizon_days)

    return {
        "as_of": str(today),
        "horizon_days": horizon_days,
        "lookback_days": lookback_days,
        "method": "moving_average_weekday + optional_qwen_narrative",
        "history_rows": len(hist),
        "forecasts": forecasts[:40],
        "preposition": preposition[:20],
        "hotspots": hotspots[:15],
        "summary": {
            "categories_forecasted": len(forecasts),
            "sites_needing_preposition": len(preposition),
            "total_shortfall_units": sum(p["units_needed"] for p in preposition),
        },
        "narrative": narrative,
    }


def _llm_or_fallback(forecasts, preposition, hotspots, horizon_days: int) -> dict:
    facts = {
        "top_forecasts": forecasts,
        "preposition": preposition,
        "hotspots": hotspots,
        "horizon_days": horizon_days,
    }
    system = (
        "You are Rental-IQ demand planner. Write a concise prepositioning brief "
        "(5-8 bullets). Do not invent site or category names not in the facts."
    )
    prompt = (
        f"Demand facts JSON:\n{facts}\n\n"
        "Recommend which equipment categories to stage at which sites and why."
    )
    llm = call_ollama(prompt, system_msg=system, timeout=18)
    if llm:
        return {"source": "qwen3", "text": llm.strip()}

    lines = [
        f"Forecast horizon: next {horizon_days} days (weekday-aware moving average).",
        f"{len(preposition)} site/category pairs show a shortfall vs available fleet.",
    ]
    for p in preposition[:5]:
        assets = ", ".join(a["asset_id"] for a in p["suggested_assets"]) or "no idle assets"
        lines.append(
            f"• Stage {p['units_needed']}× {p['equipment_category']} → {p['site_id']} "
            f"({p['site_name']}). Candidates: {assets}."
        )
    if not preposition:
        lines.append("• No material shortfalls vs current available/idle fleet.")
    for h in hotspots[:3]:
        lines.append(
            f"• Historical pressure: {h['site_id']} / {h['equipment_category']} "
            f"({h['shortfall_events']} shortfall days, avg gap {h['avg_gap']})."
        )
    return {"source": "rules", "text": "\n".join(lines)}
