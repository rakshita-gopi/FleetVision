"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import api, { ApiResponse } from "@/lib/api";
import { Site, VehicleLocation } from "@/types";

const FleetMap = dynamic(() => import("@/components/tracking/fleet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-80 flex items-center justify-center bg-[var(--muted-bg)] text-[var(--muted)] rounded-2xl">
      Loading map...
    </div>
  ),
});

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ApiResponse<Site[]>>("/sites/")
      .then((res) => {
        const data = res.data.data || [];
        setSites(data);
        if (data[0]) setSelectedId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const locations: VehicleLocation[] = useMemo(
    () =>
      sites
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({
          id: s.id,
          vehicle: s.id,
          vehicle_number: s.site_id,
          vehicle_status: s.status,
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
          speed: 0,
          heading: 0,
          last_updated: new Date().toISOString(),
        })),
    [sites]
  );

  const selected = locations.find((l) => l.id === selectedId) || locations[0] || null;

  return (
    <>
      <TopNav title="Sites" subtitle="Jobsite pins and status" />
      <div className="p-8 space-y-6">
        <div className="h-80 rounded-2xl overflow-hidden border border-[var(--border)]">
          <FleetMap
            locations={locations}
            selected={selected}
            onSelect={(loc) => setSelectedId(loc.id)}
          />
        </div>
        <DataTable
          loading={loading}
          data={sites as unknown as Record<string, unknown>[]}
          columns={[
            { key: "site_id", label: "Site" },
            { key: "site_name", label: "Name" },
            { key: "site_type", label: "Type" },
            {
              key: "status",
              label: "Status",
              render: (row) => <Badge status={String(row.status)} />,
            },
            {
              key: "latitude",
              label: "Lat",
              render: (row) => (row.latitude != null ? Number(row.latitude).toFixed(4) : "—"),
            },
            {
              key: "longitude",
              label: "Lng",
              render: (row) => (row.longitude != null ? Number(row.longitude).toFixed(4) : "—"),
            },
          ]}
          actions={(row) => (
            <button className="text-xs" style={{ color: "var(--primary)" }} onClick={() => setSelectedId(String(row.id))}>
              Focus
            </button>
          )}
        />
      </div>
    </>
  );
}
