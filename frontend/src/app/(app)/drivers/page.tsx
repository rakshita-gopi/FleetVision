"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import api, { ApiResponse } from "@/lib/api";
import { Driver } from "@/types";
import { formatDate } from "@/lib/utils";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<Driver[]>>("/drivers/").then((res) => {
      setDrivers(res.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <TopNav title="Drivers" subtitle="Driver profiles and assignments" />
      <div className="p-8">
        <DataTable
          loading={loading}
          data={drivers as unknown as Record<string, unknown>[]}
          columns={[
            { key: "name", label: "Name" },
            { key: "license_number", label: "License No." },
            { key: "phone", label: "Phone" },
            { key: "assigned_vehicle_number", label: "Vehicle", render: (row) => (row.assigned_vehicle_number as string) || "—" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status as string} /> },
            { key: "license_expiry", label: "License Expiry", render: (row) => formatDate(row.license_expiry as string) },
          ]}
        />
      </div>
    </>
  );
}
