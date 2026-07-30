"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Fuel,
  Gauge,
  MapPin,
  RefreshCw,
  Search,
  Timer,
  User,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import GradientText from "@/components/react-bits/GradientText";
import CountUp from "@/components/react-bits/CountUp";
import api, { ApiResponse } from "@/lib/api";
import { useTheme } from "@/contexts/theme-context";

interface OperatorInfo {
  id?: string | null;
  name?: string | null;
  certification?: string | null;
  shift?: string | null;
  experience_years?: number | null;
  status?: string | null;
}

interface UsageRow {
  id: string;
  rental_id: string;
  rental_status: string;
  asset_id: string;
  model?: string;
  category?: string;
  customer_name?: string;
  site_id?: string | null;
  site_name?: string | null;
  operator: OperatorInfo;
  rental_window_hours: number;
  runtime_hours: number;
  idle_hours: number;
  utilisation_pct: number;
  idle_pct: number;
  efficiency_score: number;
  efficiency_grade: string;
  fuel_start_pct?: number | null;
  fuel_end_pct?: number | null;
  fuel_used_pct?: number | null;
  fuel_burn_rate_pct_per_hour?: number | null;
  live_fuel_pct?: number | null;
  live_speed?: number | null;
  current_location?: {
    latitude?: number | null;
    longitude?: number | null;
    last_updated?: string | null;
    source?: string;
  };
  check_out_at?: string | null;
  check_in_at?: string | null;
  series?: {
    time: string;
    fuel_level?: number | null;
    speed?: number | null;
    rpm?: number | null;
  }[];
}

interface UsageSummary {
  rentals: number;
  active: number;
  avg_utilisation_pct: number;
  avg_efficiency_score: number;
  total_runtime_hours: number;
  total_idle_hours: number;
  total_fuel_used_pct: number;
}

function selectedGrade(grade: string) {
  return grade || "Moderate";
}

export default function UsageLoggingPage() {
  const { theme } = useTheme();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [selected, setSelected] = useState<UsageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");

  const gridColor = theme === "dark" ? "#44403c" : "#e7e0c9";
  const axisColor = theme === "dark" ? "#a8a29e" : "#78716c";
  const tooltipBg = theme === "dark" ? "#292524" : "#fffbf0";

  const load = (opts?: { status?: string; q?: string }) => {
    setLoading(true);
    const st = opts?.status ?? status;
    const query = opts?.q ?? q;
    const params = new URLSearchParams();
    if (st) params.set("status", st);
    if (query) params.set("q", query);
    api
      .get<ApiResponse<{ summary: UsageSummary; results: UsageRow[] }>>(`/usage/?${params}`)
      .then((res) => {
        const data = res.data.data;
        setSummary(data?.summary || null);
        const list = data?.results || [];
        setRows(list);
        if (list.length) {
          const keep = list.find((r) => r.id === selected?.id) || list[0];
          openDetail(keep.rental_id);
        } else {
          setSelected(null);
        }
      })
      .catch(() => {
        setRows([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  };

  const openDetail = (rentalId: string) => {
    api.get<ApiResponse<UsageRow>>(`/usage/${rentalId}/`).then((res) => {
      setSelected(res.data.data || null);
    });
  };

  useEffect(() => {
    load({ status: "active" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = useMemo(
    () =>
      (selected?.series || []).map((p) => ({
        t: new Date(p.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        fuel: p.fuel_level,
        speed: p.speed,
        rpm: p.rpm,
      })),
    [selected]
  );

  const loc = selected?.current_location;
  const locLabel =
    loc?.latitude != null && loc?.longitude != null
      ? `${Number(loc.latitude).toFixed(5)}, ${Number(loc.longitude).toFixed(5)}`
      : "No fix";

  return (
    <>
      <TopNav title="Usage Logging" subtitle="Runtime · fuel · idle · location · efficiency" />
      <div className="p-6 lg:p-8 space-y-6">
        <SpotlightCard className="p-5" spotlightColor="rgba(212, 160, 23, 0.2)">
          <h2 className="text-xl font-bold">
            <GradientText>Rented machinery usage</GradientText>
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-3xl">
            Track how efficiently each rental is used — engine runtime vs idle hours, fuel burn, live location,
            and operator accountability.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                load({ status: e.target.value });
              }}
              className="w-40"
            >
              <option value="active">Active / overdue</option>
              <option value="completed">Completed</option>
              <option value="">All rentals</option>
            </Select>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
              <Input
                className="pl-10"
                placeholder="Search rental / asset / operator"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
            </div>
            <Button variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </SpotlightCard>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Rentals in view", value: summary?.rentals ?? 0, icon: Activity },
            { label: "Active now", value: summary?.active ?? 0, icon: Gauge },
            { label: "Avg utilisation", value: summary?.avg_utilisation_pct ?? 0, suffix: "%", icon: Timer },
            { label: "Avg efficiency", value: summary?.avg_efficiency_score ?? 0, icon: Fuel },
          ].map((k) => (
            <SpotlightCard key={k.label} className="p-4" spotlightColor="rgba(212, 160, 23, 0.15)">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{k.label}</p>
                  <p className="text-2xl font-bold mt-1 tabular-nums">
                    {loading ? "—" : <CountUp to={Number(k.value)} duration={1} />}
                    {k.suffix || ""}
                  </p>
                </div>
                <k.icon className="h-5 w-5" style={{ color: "var(--primary)" }} />
              </div>
            </SpotlightCard>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <SpotlightCard className="xl:col-span-2 p-0 overflow-hidden" spotlightColor="rgba(120, 113, 108, 0.1)">
            <div className="max-h-[640px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--card)] z-10">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="px-4 py-3">Asset / rental</th>
                    <th className="px-2 py-3">Util %</th>
                    <th className="px-2 py-3">Idle h</th>
                    <th className="px-4 py-3">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openDetail(r.rental_id)}
                      className={`border-b border-[var(--border)]/50 cursor-pointer hover:bg-[var(--hover)] ${
                        selected?.id === r.id ? "bg-[var(--primary-soft)]" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold">{r.asset_id}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {r.rental_id} · {r.operator?.name || "No operator"}
                        </p>
                      </td>
                      <td className="px-2 py-3 tabular-nums">{r.utilisation_pct}%</td>
                      <td className="px-2 py-3 tabular-nums">{r.idle_hours}</td>
                      <td className="px-4 py-3">
                        <Badge status={selectedGrade(r.efficiency_grade)} />
                        <p className="text-[10px] text-[var(--muted)] mt-1">{r.efficiency_score}/100</p>
                      </td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-[var(--muted)]">
                        No rented machinery in this filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SpotlightCard>

          <div className="xl:col-span-3 space-y-4">
            {!selected ? (
              <SpotlightCard className="p-12 text-center text-[var(--muted)]">
                Select a rental to inspect usage
              </SpotlightCard>
            ) : (
              <>
                <SpotlightCard className="p-5 space-y-4" spotlightColor="rgba(13, 148, 136, 0.12)">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-[var(--muted)]">Usage log</p>
                      <h3 className="text-2xl font-bold">
                        {selected.asset_id}{" "}
                        <span className="text-base font-medium text-[var(--muted)]">· {selected.rental_id}</span>
                      </h3>
                      <p className="text-sm text-[var(--muted)]">
                        {selected.model} {selected.category ? `· ${selected.category}` : ""} ·{" "}
                        {selected.customer_name || "Customer —"}
                      </p>
                    </div>
                    <Badge status={selected.rental_status} />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Runtime", value: `${selected.runtime_hours} h`, icon: Timer },
                      { label: "Idle hours", value: `${selected.idle_hours} h`, icon: Activity },
                      {
                        label: "Fuel used",
                        value: selected.fuel_used_pct != null ? `${selected.fuel_used_pct}%` : "—",
                        icon: Fuel,
                      },
                      {
                        label: "Efficiency",
                        value: `${selected.efficiency_score}`,
                        icon: Gauge,
                      },
                    ].map((m) => (
                      <div key={m.label} className="rounded-xl bg-[var(--muted-bg)] p-3">
                        <p className="text-xs text-[var(--muted)] flex items-center gap-1">
                          <m.icon className="h-3.5 w-3.5" /> {m.label}
                        </p>
                        <p className="text-lg font-bold mt-1">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-[var(--border)] p-3 space-y-1">
                      <p className="text-xs uppercase text-[var(--muted)] flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Current location
                      </p>
                      <p className="font-medium">{locLabel}</p>
                      <p className="text-xs text-[var(--muted)]">
                        Source: {loc?.source || "—"}
                        {loc?.last_updated ? ` · ${new Date(loc.last_updated).toLocaleString()}` : ""}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        Live fuel {selected.live_fuel_pct ?? selected.fuel_end_pct ?? "—"}% · speed{" "}
                        {selected.live_speed ?? "—"} km/h
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] p-3 space-y-1">
                      <p className="text-xs uppercase text-[var(--muted)] flex items-center gap-1">
                        <User className="h-3.5 w-3.5" /> Operator
                      </p>
                      <p className="font-medium">{selected.operator?.name || "Unassigned"}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {selected.operator?.id || "—"} · {selected.operator?.certification || "cert —"} ·{" "}
                        {selected.operator?.shift || "shift —"}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        Exp {selected.operator?.experience_years ?? "—"} yrs · site{" "}
                        {selected.site_name || selected.site_id || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-[var(--muted)]">Window</p>
                      <p className="font-semibold">{selected.rental_window_hours} h</p>
                    </div>
                    <div>
                      <p className="text-[var(--muted)]">Utilisation</p>
                      <p className="font-semibold">{selected.utilisation_pct}%</p>
                    </div>
                    <div>
                      <p className="text-[var(--muted)]">Idle share</p>
                      <p className="font-semibold">{selected.idle_pct}%</p>
                    </div>
                    <div>
                      <p className="text-[var(--muted)]">Fuel burn rate</p>
                      <p className="font-semibold">
                        {selected.fuel_burn_rate_pct_per_hour != null
                          ? `${selected.fuel_burn_rate_pct_per_hour}% / h`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </SpotlightCard>

                <SpotlightCard className="p-5" spotlightColor="rgba(212, 160, 23, 0.12)">
                  <h4 className="font-semibold mb-3">Fuel & motion during rental</h4>
                  <div className="h-56">
                    {chartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-[var(--muted)]">
                        No telemetry samples in this rental window yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="t" stroke={axisColor} fontSize={11} />
                          <YAxis stroke={axisColor} fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              background: tooltipBg,
                              border: "1px solid var(--border)",
                              borderRadius: 12,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="fuel"
                            name="Fuel %"
                            stroke="#d4a017"
                            fill="rgba(212,160,23,0.25)"
                          />
                          <Area
                            type="monotone"
                            dataKey="speed"
                            name="Speed"
                            stroke="#0d9488"
                            fill="rgba(13,148,136,0.15)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </SpotlightCard>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
