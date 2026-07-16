"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import api, { ApiResponse } from "@/lib/api";
import { MaintenanceRecord } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function MaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<MaintenanceRecord[]>>("/maintenance/").then((res) => {
      setRecords(res.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <TopNav title="Maintenance" subtitle="Service records and scheduling" />
      <div className="p-8">
        <DataTable
          loading={loading}
          data={records as unknown as Record<string, unknown>[]}
          columns={[
            { key: "vehicle_number", label: "Vehicle" },
            { key: "service_type", label: "Service Type" },
            { key: "mechanic_name", label: "Mechanic" },
            { key: "service_date", label: "Service Date", render: (row) => formatDate(row.service_date as string) },
            { key: "next_service_date", label: "Next Service", render: (row) => row.next_service_date ? formatDate(row.next_service_date as string) : "—" },
            { key: "repair_cost", label: "Cost", render: (row) => formatCurrency(Number(row.repair_cost)) },
          ]}
        />
      </div>
    </>
  );
}
