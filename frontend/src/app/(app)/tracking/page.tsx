"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCw, Navigation } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api, { ApiResponse } from "@/lib/api";
import { VehicleLocation } from "@/types";
import { toast } from "sonner";

const FleetMap = dynamic(() => import("@/components/tracking/fleet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-[var(--muted-bg)] text-[var(--muted)]">
      Loading map...
    </div>
  ),
});

const POLL_MS = 8000;

export default function TrackingPage() {
  const [locations, setLocations] = useState<VehicleLocation[]>([]);
  const [selected, setSelected] = useState<VehicleLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);

  const fetchLocations = useCallback(() => {
    return api
      .get<ApiResponse<VehicleLocation[]>>("/gps/live")
      .then((res) => {
        const data = res.data.data || [];
        setLocations(data);
        setSelected((prev) => {
          if (!data.length) return null;
          if (!prev) return data[0];
          return data.find((d) => d.id === prev.id) || data[0];
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => {
      fetchLocations();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [live, fetchLocations]);

  const simulate = async () => {
    try {
      await api.post("/gps/simulate");
      toast.success("GPS positions updated");
      await fetchLocations();
    } catch {
      toast.error("Failed to simulate GPS");
    }
  };

  return (
    <>
      <TopNav title="Live Tracking" subtitle="Real-time vehicle locations on the map" />
      <div className="p-8">
        <div className="flex flex-wrap justify-end gap-2 mb-4">
          <Button
            variant={live ? "secondary" : "ghost"}
            onClick={() => setLive((v) => !v)}
          >
            {live ? "Live · every 8s" : "Paused"}
          </Button>
          <Button variant="secondary" onClick={() => fetchLocations()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="secondary" onClick={simulate}>
            <RefreshCw className="h-4 w-4" /> Simulate GPS
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[500px] rounded-2xl overflow-hidden border border-[var(--border)] bg-[#e5e7eb]">
            {loading ? (
              <div className="h-full flex items-center justify-center bg-[var(--muted-bg)] text-[var(--muted)]">
                Loading map...
              </div>
            ) : (
              <FleetMap locations={locations} selected={selected} onSelect={setSelected} />
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
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Driver</span><span>{selected.driver_name || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Speed</span><span>{selected.speed} km/h</span></div>
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Status</span><Badge status={selected.vehicle_status} /></div>
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Destination</span><span>{selected.current_trip_destination || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Latitude</span><span className="font-mono text-xs">{selected.latitude}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Longitude</span><span className="font-mono text-xs">{selected.longitude}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Last Updated</span><span className="text-xs">{new Date(selected.last_updated).toLocaleTimeString()}</span></div>
                </div>
              </Card>
            ) : (
              <Card><p className="text-[var(--muted)] text-sm text-center py-8">Select a vehicle on the map</p></Card>
            )}
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setSelected(loc)}
                  className={`w-full text-left glass-card rounded-xl p-3 transition-all ${selected?.id === loc.id ? "ring-1 ring-[var(--foreground)]" : ""}`}
                >
                  <p className="text-sm font-medium">{loc.vehicle_number}</p>
                  <p className="text-xs text-[var(--muted)]">{loc.driver_name} · {loc.speed} km/h</p>
                </button>
              ))}
              {!locations.length && (
                <p className="text-xs text-[var(--muted)] text-center py-4">No live GPS points — click Simulate GPS</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
