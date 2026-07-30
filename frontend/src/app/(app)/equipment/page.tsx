"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HardHat, Search } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import api, { ApiResponse } from "@/lib/api";
import { Equipment } from "@/types";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import CountUp from "@/components/react-bits/CountUp";

function EquipmentContent() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Equipment[]>([]);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = (query = "") => {
    setLoading(true);
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    api
      .get<ApiResponse<Equipment[]>>(`/equipment/${params}`)
      .then((res) => setRows(res.data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const initial = searchParams.get("q") || "";
    setQ(initial);
    load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openDetail = async (id: string) => {
    const res = await api.get<ApiResponse<Equipment>>(`/equipment/${id}/`);
    setSelected(res.data.data || null);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="relative h-36 overflow-hidden rounded-2xl border border-[var(--border)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1600&q=80"
          alt="Earthmoving equipment"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 to-black/20" />
        <div className="relative z-10 p-6 text-white">
          <p className="text-xs uppercase tracking-widest text-[#f5c518] font-semibold">Yard inventory</p>
          <p className="text-2xl font-bold mt-1">
            <CountUp to={rows.length} duration={1} /> assets in view
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">{rows.length} assets</p>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
          <Input
            className="pl-10"
            placeholder="Search asset / model"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(q)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <DataTable
            loading={loading}
            data={rows as unknown as Record<string, unknown>[]}
            columns={[
              { key: "asset_id", label: "Asset" },
              { key: "model_name", label: "Model" },
              { key: "category", label: "Category" },
              {
                key: "current_status",
                label: "Status",
                render: (row) => <Badge status={String(row.current_status)} />,
              },
              { key: "site_id", label: "Site" },
              {
                key: "total_engine_hours",
                label: "Hours",
                render: (row) => Number(row.total_engine_hours || 0).toFixed(1),
              },
            ]}
            actions={(row) => (
              <button
                className="text-xs font-medium"
                style={{ color: "var(--primary)" }}
                onClick={() => openDetail(String(row.id))}
              >
                Details
              </button>
            )}
          />
        </div>

        <SpotlightCard className="p-6 space-y-4 min-h-[280px]" spotlightColor="rgba(212, 160, 23, 0.22)">
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5" style={{ color: "var(--primary)" }} />
            <h3 className="font-semibold text-[var(--foreground)]">LAM strip</h3>
          </div>
          {!selected ? (
            <p className="text-sm text-[var(--muted)]">Select an asset to view live status.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-lg font-bold text-[var(--foreground)]">{selected.asset_id}</p>
              <p className="text-[var(--muted)]">
                {selected.manufacturer} {selected.model_name} · {selected.category}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--muted-bg)] p-3">
                  <p className="text-xs text-[var(--muted)]">Status</p>
                  <p className="font-medium">{selected.current_status}</p>
                </div>
                <div className="rounded-xl bg-[var(--muted-bg)] p-3">
                  <p className="text-xs text-[var(--muted)]">Engine hours</p>
                  <p className="font-medium">{Number(selected.total_engine_hours).toFixed(1)}</p>
                </div>
                <div className="rounded-xl bg-[var(--muted-bg)] p-3">
                  <p className="text-xs text-[var(--muted)]">Site</p>
                  <p className="font-medium">{selected.site_name || selected.site_id || "—"}</p>
                </div>
                <div className="rounded-xl bg-[var(--muted-bg)] p-3">
                  <p className="text-xs text-[var(--muted)]">Operator</p>
                  <p className="font-medium">{selected.operator_name || selected.operator_id || "—"}</p>
                </div>
              </div>
              {selected.live && (
                <div className="rounded-xl border border-[var(--border)] p-3 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)] flex items-center gap-2">
                    <span className="live-dot" /> Live telemetry
                  </p>
                  <p>
                    {selected.live.latitude?.toFixed(5)}, {selected.live.longitude?.toFixed(5)}
                  </p>
                  <p className="text-[var(--muted)]">
                    speed {selected.live.speed ?? 0} · fuel {selected.live.fuel_level ?? "—"}% · rpm{" "}
                    {selected.live.rpm ?? "—"}
                  </p>
                </div>
              )}
            </div>
          )}
        </SpotlightCard>
      </div>
    </div>
  );
}

export default function EquipmentPage() {
  return (
    <>
      <TopNav title="Equipment" subtitle="Asset inventory and LAM status" />
      <Suspense fallback={<div className="p-8 text-[var(--muted)]">Loading equipment…</div>}>
        <EquipmentContent />
      </Suspense>
    </>
  );
}
