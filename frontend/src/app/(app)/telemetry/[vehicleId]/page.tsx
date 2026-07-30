"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Gauge, Fuel, Thermometer, Battery, Activity } from "lucide-react";
import api, { ApiResponse } from "@/lib/api";
import { LiveVehicleState, TelemetryPoint } from "@/types";
import { useTheme } from "@/contexts/theme-context";

export default function TelemetryDashboardPage() {
  const params = useParams();
  const vehicleId = String(params.vehicleId || "");
  const { theme } = useTheme();
  const [live, setLive] = useState<LiveVehicleState | null>(null);
  const [history, setHistory] = useState<TelemetryPoint[]>([]);

  const stroke = theme === "dark" ? "#3b82f6" : "#2563eb";
  const grid = theme === "dark" ? "#1e293b" : "#e2e8f0";
  const axis = theme === "dark" ? "#94a3b8" : "#64748b";

  useEffect(() => {
    if (!vehicleId) return;
    const load = () => {
      api.get<ApiResponse<LiveVehicleState>>(`/vehicles/${vehicleId}/live/`).then((res) => {
        setLive(res.data.data || null);
      }).catch(() => setLive(null));
      api
        .get<ApiResponse<TelemetryPoint[]>>(`/vehicles/${vehicleId}/telemetry/`, {
          params: { limit: 120 },
        })
        .then((res) => {
          const rows = [...(res.data.data || [])].reverse();
          setHistory(rows);
        })
        .catch(() => setHistory([]));
    };
    load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, [vehicleId]);

  const chartData = history.map((h) => ({
    t: new Date(h.time).toLocaleTimeString(),
    speed: h.speed ?? 0,
    fuel: h.fuel_level ?? 0,
    temp: h.engine_temperature ?? 0,
  }));

  return (
    <>
      <TopNav title="Vehicle Telemetry" subtitle={`History + live KPIs · ${vehicleId.slice(0, 8)}…`} />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Speed" value={live ? `${live.speed ?? "—"} km/h` : "—"} icon={Gauge} delay={0} />
          <StatCard title="RPM" value={live?.rpm ?? "—"} icon={Activity} delay={0.05} />
          <StatCard title="Fuel" value={live ? `${live.fuel_level ?? "—"}%` : "—"} icon={Fuel} delay={0.1} />
          <StatCard title="Engine" value={live ? `${live.engine_temperature ?? "—"}°C` : "—"} icon={Thermometer} delay={0.15} />
          <StatCard title="Battery" value={live ? `${live.battery_voltage ?? "—"} V` : "—"} icon={Battery} delay={0.2} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[
            { key: "speed", title: "Speed history", unit: "km/h" },
            { key: "fuel", title: "Fuel level", unit: "%" },
            { key: "temp", title: "Engine temperature", unit: "°C" },
          ].map((c) => (
            <Card key={c.key}>
              <CardHeader>
                <CardTitle>{c.title}</CardTitle>
                <CardDescription>From TimescaleDB · {c.unit}</CardDescription>
              </CardHeader>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                    <XAxis dataKey="t" stroke={axis} fontSize={10} hide />
                    <YAxis stroke={axis} fontSize={11} />
                    <Tooltip />
                    <Area type="monotone" dataKey={c.key} stroke={stroke} fill={stroke} fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ))}
        </div>

        {!live && (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              No live Redis state yet. Run <code className="font-mono">python -m simulator</code> after the API stack is up.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
