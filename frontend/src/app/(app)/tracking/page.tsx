"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { RefreshCw, Navigation, Radio } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api, { ApiResponse } from "@/lib/api";
import { LiveVehicleState } from "@/types";
import { toast } from "sonner";

const FleetMap = dynamic(() => import("@/components/tracking/fleet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-[var(--muted-bg)] text-[var(--muted)]">
      Loading map...
    </div>
  ),
});

const POLL_MS = 4000;

function wsUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const base = api.replace(/\/api\/v1\/?$/, "").replace(/^http/, "ws");
  return `${base}/ws/fleet/`;
}

export default function TrackingPage() {
  const [states, setStates] = useState<LiveVehicleState[]>([]);
  const [equipment, setEquipment] = useState<Record<string, { asset_id: string }>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const enrich = useCallback(
    (raw: LiveVehicleState[]): LiveVehicleState[] =>
      raw.map((s) => ({
        ...s,
        vehicle_number:
          s.asset_id ||
          equipment[s.vehicle_id]?.asset_id ||
          s.vehicle_number ||
          s.vehicle_id.slice(0, 8),
      })),
    [equipment]
  );

  const fetchFleet = useCallback(() => {
    return api
      .get<ApiResponse<LiveVehicleState[]>>("/fleet/live/")
      .then((res) => {
        const data = enrich(res.data.data || []);
        setStates(data);
        setSelectedId((prev) => {
          if (!data.length) return null;
          if (prev && data.some((d) => d.vehicle_id === prev)) return prev;
          return data[0].vehicle_id;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enrich]);

  useEffect(() => {
    api.get<ApiResponse<{ id: string; asset_id: string }[]>>("/equipment/").then((res) => {
      const map: Record<string, { asset_id: string }> = {};
      (res.data.data || []).forEach((v) => {
        map[v.id] = { asset_id: v.asset_id };
      });
      setEquipment(map);
    });
  }, []);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  // Polling fallback / primary when WS down
  useEffect(() => {
    if (!live || wsConnected) return;
    const id = window.setInterval(() => fetchFleet(), POLL_MS);
    return () => window.clearInterval(id);
  }, [live, wsConnected, fetchFleet]);

  // WebSocket live updates
  useEffect(() => {
    if (!live) {
      wsRef.current?.close();
      setWsConnected(false);
      return;
    }
    let closed = false;
    let sock: WebSocket;
    try {
      sock = new WebSocket(wsUrl());
    } catch {
      setWsConnected(false);
      return;
    }
    wsRef.current = sock;
    sock.onopen = () => setWsConnected(true);
    sock.onclose = () => {
      if (!closed) setWsConnected(false);
    };
    sock.onerror = () => setWsConnected(false);
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "telemetry.update" && msg.vehicle_id) {
          setStates((prev) => {
            const next = [...prev];
            const idx = next.findIndex((s) => s.vehicle_id === msg.vehicle_id);
            const enriched = enrich([msg as LiveVehicleState])[0];
            if (idx >= 0) next[idx] = { ...next[idx], ...enriched };
            else next.push(enriched);
            return next;
          });
          setSelectedId((prev) => prev || msg.vehicle_id);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      closed = true;
      sock.close();
    };
  }, [live, enrich]);

  const selected = useMemo(
    () => states.find((s) => s.vehicle_id === selectedId) || null,
    [states, selectedId]
  );

  const mapLocations = useMemo(
    () =>
      states.map((s) => ({
        id: s.vehicle_id,
        vehicle: s.vehicle_id,
        vehicle_number: s.vehicle_number || s.vehicle_id.slice(0, 8),
        vehicle_status: "On Trip",
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        speed: Number(s.speed || 0),
        heading: Number(s.heading || 0),
        last_updated: s.last_updated,
      })),
    [states]
  );

  const mapSelected = selected
    ? {
        id: selected.vehicle_id,
        vehicle: selected.vehicle_id,
        vehicle_number: selected.vehicle_number || selected.vehicle_id.slice(0, 8),
        vehicle_status: "On Trip",
        latitude: Number(selected.latitude),
        longitude: Number(selected.longitude),
        speed: Number(selected.speed || 0),
        heading: Number(selected.heading || 0),
        last_updated: selected.last_updated,
      }
    : null;

  return (
    <>
      <TopNav title="Live Map" subtitle="Equipment telemetry — Redis live state + Kafka pipeline" />
      <div className="p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${wsConnected ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {wsConnected ? "WebSocket connected" : "Polling every 4s"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={live ? "secondary" : "ghost"} onClick={() => setLive((v) => !v)}>
              <Radio className="h-4 w-4" />
              {live ? "Live" : "Paused"}
            </Button>
            <Button variant="secondary" onClick={() => fetchFleet()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.message("Run simulator", {
                  description: "python -m simulator  (from repo root, API must be up)",
                })
              }
            >
              Simulator help
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[500px] rounded-2xl overflow-hidden border border-[var(--border)] bg-[#e5e7eb]">
            {loading ? (
              <div className="h-full flex items-center justify-center bg-[var(--muted-bg)] text-[var(--muted)]">
                Loading map...
              </div>
            ) : (
              <FleetMap
                locations={mapLocations}
                selected={mapSelected}
                onSelect={(loc) => setSelectedId(loc.vehicle)}
              />
            )}
          </div>
          <div className="space-y-4">
            {selected ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Navigation className="h-5 w-5" />
                    {selected.vehicle_number}
                  </CardTitle>
                </CardHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Speed</span>
                    <span>{selected.speed ?? "—"} km/h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Fuel</span>
                    <span>{selected.fuel_level ?? "—"}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Engine temp</span>
                    <span>{selected.engine_temperature ?? "—"}°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">RPM</span>
                    <span>{selected.rpm ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Battery</span>
                    <span>{selected.battery_voltage ?? "—"} V</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">GPS accuracy</span>
                    <span>{selected.gps_accuracy ?? "—"} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted)]">Updated</span>
                    <span className="text-xs">{new Date(selected.last_updated).toLocaleTimeString()}</span>
                  </div>
                  <Link
                    href={`/telemetry/${selected.vehicle_id}`}
                    className="block text-center text-sm pt-2"
                    style={{ color: "var(--primary)" }}
                  >
                    Open telemetry dashboard →
                  </Link>
                </div>
              </Card>
            ) : (
              <Card>
                <p className="text-[var(--muted)] text-sm text-center py-8">
                  No live equipment — seed dataset or start the simulator
                </p>
              </Card>
            )}
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {states.map((s) => (
                <button
                  key={s.vehicle_id}
                  onClick={() => setSelectedId(s.vehicle_id)}
                  className={`w-full text-left glass-card rounded-xl p-3 transition-all ${
                    selectedId === s.vehicle_id ? "ring-1 ring-[var(--foreground)]" : ""
                  }`}
                >
                  <p className="text-sm font-medium">{s.vehicle_number || s.vehicle_id.slice(0, 8)}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {s.speed ?? 0} km/h · fuel {s.fuel_level ?? "—"}%
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
