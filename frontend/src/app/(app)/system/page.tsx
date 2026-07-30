"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Database, Server, RefreshCw } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api, { ApiResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type ServiceStatus = "healthy" | "unhealthy" | "unknown";

interface HealthPayload {
  status: "healthy" | "degraded";
  services: {
    backend: ServiceStatus;
    database: ServiceStatus;
    redis: ServiceStatus;
    timescaledb?: ServiceStatus;
    kafka?: ServiceStatus;
    telemetry_consumer?: ServiceStatus;
  };
}

const SERVICE_META: { key: keyof HealthPayload["services"]; label: string; icon: typeof Server }[] = [
  { key: "backend", label: "Backend", icon: Server },
  { key: "database", label: "PostgreSQL", icon: Database },
  { key: "redis", label: "Redis", icon: Activity },
  { key: "timescaledb", label: "TimescaleDB", icon: Database },
  { key: "kafka", label: "Kafka", icon: Server },
  { key: "telemetry_consumer", label: "Telemetry consumer", icon: Activity },
];

export default function SystemPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get<ApiResponse<HealthPayload>>("/system/health/")
      .then((res) => {
        setHealth(res.data.data || null);
      })
      .catch(() => {
        setHealth(null);
        setError("Unable to reach the health endpoint. Is the API running?");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const overall = health?.status ?? "unknown";

  return (
    <>
      <TopNav title="System" subtitle="Platform health and infrastructure status" />
      <div className="p-8 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted)]">Overall status</p>
            <p
              className={cn(
                "text-2xl font-semibold capitalize",
                overall === "healthy" && "text-emerald-500",
                overall === "degraded" && "text-amber-500",
                overall === "unknown" && "text-[var(--muted)]"
              )}
            >
              {loading ? "Checking…" : overall}
            </p>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {error && (
          <Card>
            <p className="text-sm text-[var(--danger)]">{error}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICE_META.map(({ key, label, icon: Icon }) => {
            const status = health?.services?.[key] ?? "unknown";
            const ok = status === "healthy";
            return (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-[var(--primary)]" />
                    <CardTitle>{label}</CardTitle>
                  </div>
                  <CardDescription>Foundation service probe</CardDescription>
                </CardHeader>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 rounded-full",
                      ok ? "bg-emerald-500" : status === "unhealthy" ? "bg-red-500" : "bg-slate-400"
                    )}
                  />
                  <span className="text-sm font-medium capitalize text-[var(--foreground)]">
                    {loading ? "…" : status}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Phase 1 foundation</CardTitle>
            <CardDescription>
              Phase 2 health covers Django, PostgreSQL/TimescaleDB, Redis, Kafka, and the telemetry consumer.
            </CardDescription>
          </CardHeader>
          <p className="text-xs text-[var(--muted)] font-mono">GET /api/v1/system/health/</p>
        </Card>
      </div>
    </>
  );
}
