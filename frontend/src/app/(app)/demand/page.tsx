"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  MapPin,
  RefreshCw,
  Sparkles,
  Truck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import GradientText from "@/components/react-bits/GradientText";
import CountUp from "@/components/react-bits/CountUp";
import api, { ApiResponse } from "@/lib/api";
import { useTheme } from "@/contexts/theme-context";
import { toast } from "sonner";

interface ForecastRow {
  site_id: string;
  site_name: string;
  equipment_category: string;
  avg_requested: number;
  avg_utilisation_pct: number;
  peak_forecast: number;
  available_fleet: number;
  shortfall: number;
  trend: number;
  horizon: { date: string; predicted_units: number }[];
}

interface PrepositionRow {
  site_id: string;
  site_name: string;
  equipment_category: string;
  units_needed: number;
  suggested_assets: { asset_id: string; status: string; site_id?: string | null }[];
  rationale: string;
}

interface ForecastPayload {
  as_of: string;
  horizon_days: number;
  method: string;
  history_rows: number;
  forecasts: ForecastRow[];
  preposition: PrepositionRow[];
  hotspots: { site_id: string; equipment_category: string; shortfall_events: number; avg_gap: number }[];
  summary: {
    categories_forecasted: number;
    sites_needing_preposition: number;
    total_shortfall_units: number;
  };
  narrative: { source: string; text: string };
}

export default function DemandPage() {
  const { theme } = useTheme();
  const [data, setData] = useState<ForecastPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState("7");
  const [selected, setSelected] = useState<ForecastRow | null>(null);

  const gridColor = theme === "dark" ? "#44403c" : "#e7e0c9";
  const axisColor = theme === "dark" ? "#a8a29e" : "#78716c";

  const load = (h = horizon) => {
    setLoading(true);
    api
      .get<ApiResponse<ForecastPayload>>(`/demand/forecast/?horizon=${h}&lookback=28`)
      .then((res) => {
        const payload = res.data.data || null;
        setData(payload);
        setSelected(payload?.forecasts?.[0] || null);
      })
      .catch(() => toast.error("Forecast failed — seed demand data if empty"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load("7");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seed = async () => {
    try {
      const res = await api.post<ApiResponse<{ rows: number }>>("/demand/seed/", { force: false });
      toast.success(`Seeded ${res.data.data?.rows ?? 0} demand rows`);
      load();
    } catch {
      toast.error("Seed failed (manager/admin)");
    }
  };

  const chartData =
    selected?.horizon.map((d) => ({
      day: d.date.slice(5),
      units: d.predicted_units,
    })) || [];

  return (
    <>
      <TopNav
        title="Demand Forecasting"
        subtitle="Predict site demand & preposition idle machines"
      />
      <div className="p-6 lg:p-8 space-y-6">
        <SpotlightCard className="p-5" spotlightColor="rgba(13, 148, 136, 0.14)">
          <h2 className="text-xl font-bold">
            <GradientText>Preposition with foresight</GradientText>
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-3xl">
            Baseline model: weekday-aware moving average over site demand history. Narrative uses Qwen3 when Ollama
            is up, otherwise a deterministic rules brief. Goal: move the right iron to the right site before the spike.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Select
              value={horizon}
              className="w-36"
              onChange={(e) => {
                setHorizon(e.target.value);
                load(e.target.value);
              }}
            >
              <option value="7">7-day horizon</option>
              <option value="14">14-day horizon</option>
            </Select>
            <Button variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" /> Refresh forecast
            </Button>
            <Button variant="ghost" onClick={seed}>
              Seed site_demand.csv
            </Button>
          </div>
          {data && (
            <p className="text-xs text-[var(--muted)] mt-3">
              As of {data.as_of} · {data.method} · {data.history_rows} history rows · narrative via{" "}
              {data.narrative?.source}
            </p>
          )}
        </SpotlightCard>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Series forecasted", value: data?.summary.categories_forecasted ?? 0 },
            { label: "Sites to stage", value: data?.summary.sites_needing_preposition ?? 0 },
            { label: "Shortfall units", value: data?.summary.total_shortfall_units ?? 0 },
            { label: "Horizon days", value: Number(horizon) },
          ].map((k) => (
            <SpotlightCard key={k.label} className="p-4" spotlightColor="rgba(212, 160, 23, 0.12)">
              <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{k.label}</p>
              <p className="text-2xl font-bold mt-1">
                {loading ? "—" : <CountUp to={k.value} duration={1} />}
              </p>
            </SpotlightCard>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <SpotlightCard className="xl:col-span-2 p-0 overflow-hidden" spotlightColor="rgba(120,113,108,0.1)">
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--card)]">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="px-4 py-3">Site / category</th>
                    <th className="px-2 py-3">Peak</th>
                    <th className="px-2 py-3">Avail</th>
                    <th className="px-4 py-3">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.forecasts || []).map((f) => (
                    <tr
                      key={`${f.site_id}-${f.equipment_category}`}
                      onClick={() => setSelected(f)}
                      className={`border-b border-[var(--border)]/50 cursor-pointer hover:bg-[var(--hover)] ${
                        selected?.site_id === f.site_id && selected?.equipment_category === f.equipment_category
                          ? "bg-[var(--primary-soft)]"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold">{f.site_id}</p>
                        <p className="text-xs text-[var(--muted)]">{f.equipment_category}</p>
                      </td>
                      <td className="px-2 py-3 tabular-nums">{f.peak_forecast}</td>
                      <td className="px-2 py-3 tabular-nums">{f.available_fleet}</td>
                      <td className="px-4 py-3">
                        <Badge status={f.shortfall > 0 ? "OVERDUE" : "AVAILABLE"} />
                        <p className="text-[10px] text-[var(--muted)] mt-1">{f.shortfall}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SpotlightCard>

          <div className="xl:col-span-3 space-y-4">
            <SpotlightCard className="p-5" spotlightColor="rgba(212,160,23,0.12)">
              <h3 className="font-semibold mb-1 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />{" "}
                {selected ? `${selected.site_id} · ${selected.equipment_category}` : "Select a series"}
              </h3>
              <p className="text-xs text-[var(--muted)] mb-3">
                Avg request {selected?.avg_requested ?? "—"} · util {selected?.avg_utilisation_pct ?? "—"}% · trend{" "}
                {selected?.trend ?? "—"}
              </p>
              <div className="h-56">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[var(--muted)] text-sm">No forecast</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="day" stroke={axisColor} fontSize={11} />
                      <YAxis stroke={axisColor} fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="units" fill="#d4a017" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </SpotlightCard>

            <SpotlightCard className="p-5 space-y-3" spotlightColor="rgba(13,148,136,0.12)">
              <h3 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" /> Preposition plan
              </h3>
              {(data?.preposition || []).slice(0, 6).map((p) => (
                <div key={`${p.site_id}-${p.equipment_category}`} className="rounded-xl bg-[var(--muted-bg)] p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold">
                      {p.units_needed}× {p.equipment_category} → {p.site_id}
                    </p>
                    <MapPin className="h-4 w-4 text-[var(--muted)]" />
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-1">{p.rationale}</p>
                  <p className="text-xs mt-2">
                    Candidates:{" "}
                    {p.suggested_assets.length
                      ? p.suggested_assets.map((a) => a.asset_id).join(", ")
                      : "none idle — consider external rent / reallocate from other sites"}
                  </p>
                </div>
              ))}
              {(data?.preposition || []).length === 0 && (
                <p className="text-sm text-[var(--muted)]">No shortfalls vs available fleet</p>
              )}
            </SpotlightCard>

            <SpotlightCard className="p-5" spotlightColor="rgba(161,98,7,0.12)">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4" /> Planner brief
              </h3>
              <pre className="text-sm whitespace-pre-wrap font-sans text-[var(--foreground)] leading-relaxed">
                {data?.narrative?.text || (loading ? "Generating…" : "—")}
              </pre>
            </SpotlightCard>
          </div>
        </div>
      </div>
    </>
  );
}
