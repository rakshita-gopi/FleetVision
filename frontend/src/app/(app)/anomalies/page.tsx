"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Fuel,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserX,
} from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import GradientText from "@/components/react-bits/GradientText";
import CountUp from "@/components/react-bits/CountUp";
import api, { ApiResponse } from "@/lib/api";
import { toast } from "sonner";

interface AnomalyRow {
  kind: string;
  severity: string;
  asset_id: string;
  equipment_id?: string;
  rental_id?: string;
  title: string;
  detail: string;
  score: number;
  signals?: Record<string, unknown>;
}

interface AnomalyPayload {
  as_of: string;
  method: string;
  baselines: {
    fuel_drop_mean: number;
    fuel_drop_threshold: number;
    idle_ratio_mean: number;
    idle_ratio_threshold: number;
  };
  counts: Record<string, number>;
  total: number;
  notifications_created?: number;
  anomalies: AnomalyRow[];
  narrative: { source: string; text: string };
}

const KIND_META: Record<
  string,
  { label: string; icon: typeof ShieldAlert; tone: string; badge: "OVERDUE" | "IDLE" | "ACTIVE" | "AVAILABLE" }
> = {
  potential_misuse: {
    label: "Potential misuse",
    icon: Fuel,
    tone: "rgba(220, 38, 38, 0.14)",
    badge: "OVERDUE",
  },
  unassigned: {
    label: "Unassigned",
    icon: UserX,
    tone: "rgba(234, 88, 12, 0.14)",
    badge: "IDLE",
  },
  long_idle: {
    label: "Long idle",
    icon: PauseCircle,
    tone: "rgba(202, 138, 4, 0.14)",
    badge: "IDLE",
  },
  underuse: {
    label: "Underuse",
    icon: AlertTriangle,
    tone: "rgba(13, 148, 136, 0.14)",
    badge: "AVAILABLE",
  },
};

function severityBadge(sev: string): "OVERDUE" | "IDLE" | "ACTIVE" {
  if (sev === "critical") return "OVERDUE";
  if (sev === "warning") return "IDLE";
  return "ACTIVE";
}

export default function AnomaliesPage() {
  const [data, setData] = useState<AnomalyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback((notify = true) => {
    setLoading(true);
    api
      .get<ApiResponse<AnomalyPayload>>(`/anomalies/?notify=${notify ? "1" : "0"}`)
      .then((res) => setData(res.data.data || null))
      .catch(() => toast.error("Anomaly scan failed"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const scanNotify = async () => {
    try {
      const res = await api.post<ApiResponse<{ total: number; counts: Record<string, number> }>>(
        "/anomalies/scan/"
      );
      toast.success(`Scan complete — ${res.data.data?.total ?? 0} signal(s)`);
      load(false);
    } catch {
      toast.error("Scan failed (managers/admins only)");
    }
  };

  const filtered = useMemo(() => {
    const rows = data?.anomalies || [];
    if (filter === "all") return rows;
    return rows.filter((a) => a.kind === filter);
  }, [data, filter]);

  const counts = data?.counts || {};

  return (
    <>
      <TopNav
        title="Anomaly Desk"
        subtitle="Historical telemetry + rental usage → idle, unassigned, underuse, misuse"
      />
      <div className="p-6 lg:p-8 space-y-6">
        <SpotlightCard className="p-5" spotlightColor="rgba(220, 38, 38, 0.1)">
          <h2 className="text-xl font-bold">
            <GradientText>Asset misuse & utilisation anomalies</GradientText>
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-3xl">
            Rules + fleet z-score thresholds on 7-day fuel burn and idle telematics, combined with active-rental
            utilisation. Top findings write into the notification bell (deduped ~18h). Optional Qwen brief when
            Ollama is up.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={() => load(true)} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Rescan
            </Button>
            <Button onClick={scanNotify} variant="outline">
              <ShieldAlert className="h-4 w-4" /> Scan & notify
            </Button>
            <Link href="/alerts">
              <Button variant="ghost">Open alerts →</Button>
            </Link>
          </div>
        </SpotlightCard>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(
            [
              ["potential_misuse", "Misuse"],
              ["unassigned", "Unassigned"],
              ["long_idle", "Long idle"],
              ["underuse", "Underuse"],
            ] as const
          ).map(([key, label]) => {
            const meta = KIND_META[key];
            const Icon = meta.icon;
            return (
              <button key={key} type="button" onClick={() => setFilter(filter === key ? "all" : key)}>
                <SpotlightCard className="p-4 text-left" spotlightColor={meta.tone}>
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-[var(--muted)]" />
                    <Badge status={meta.badge} />
                  </div>
                  <p className="text-2xl font-bold mt-2">
                    <CountUp to={counts[key] || 0} />
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">{label}</p>
                </SpotlightCard>
              </button>
            );
          })}
        </div>

        {data?.narrative?.text && (
          <SpotlightCard className="p-5" spotlightColor="rgba(13, 148, 136, 0.12)">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />
              Ops brief
              <span className="text-xs font-normal text-[var(--muted)]">({data.narrative.source})</span>
            </h3>
            <pre className="mt-3 text-sm text-[var(--foreground)] whitespace-pre-wrap font-sans leading-relaxed">
              {data.narrative.text}
            </pre>
            {data.baselines && (
              <p className="text-[11px] text-[var(--muted)] mt-3">
                Baselines · fuel drop μ {data.baselines.fuel_drop_mean}% / thr{" "}
                {data.baselines.fuel_drop_threshold}% · idle ratio μ {data.baselines.idle_ratio_mean} / thr{" "}
                {data.baselines.idle_ratio_threshold}
              </p>
            )}
          </SpotlightCard>
        )}

        <SpotlightCard className="p-4 space-y-3" spotlightColor="rgba(120, 113, 108, 0.1)">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-[var(--foreground)]">
              Findings
              <span className="text-xs font-normal text-[var(--muted)] ml-2">
                ({filtered.length}
                {filter !== "all" ? ` · ${KIND_META[filter]?.label || filter}` : ""}
                {data ? ` of ${data.total}` : ""})
              </span>
            </h3>
            {filter !== "all" && (
              <Button size="sm" variant="ghost" onClick={() => setFilter("all")}>
                Clear filter
              </Button>
            )}
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto">
            {filtered.map((a) => {
              const meta = KIND_META[a.kind] || KIND_META.underuse;
              const Icon = meta.icon;
              return (
                <div
                  key={`${a.asset_id}-${a.kind}-${a.rental_id || ""}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--muted-bg)] p-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "var(--card)" }}
                    >
                      <Icon className="h-4 w-4 text-[var(--muted)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-sm">{a.title}</p>
                        <Badge status={severityBadge(a.severity)} />
                        <span className="text-[10px] text-[var(--muted)]">score {a.score}</span>
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">{a.detail}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2 text-[10px] text-[var(--muted)]">
                        <span>{meta.label}</span>
                        <span>· {a.asset_id}</span>
                        {a.rental_id ? <span>· {a.rental_id}</span> : null}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Link href="/equipment">
                          <Button size="sm" variant="outline">
                            Equipment
                          </Button>
                        </Link>
                        {a.rental_id ? (
                          <Link href="/rentals">
                            <Button size="sm" variant="ghost">
                              Rentals
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-[var(--muted)] py-10 text-center">No anomalies in this filter</p>
            )}
            {loading && !data && (
              <p className="text-sm text-[var(--muted)] py-10 text-center">Scanning historical data…</p>
            )}
          </div>
        </SpotlightCard>
      </div>
    </>
  );
}
