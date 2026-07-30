"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import api, { ApiResponse } from "@/lib/api";
import { Operator } from "@/types";

export default function OperatorsPage() {
  const [rows, setRows] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ApiResponse<Operator[]>>("/operators/")
      .then((res) => setRows(res.data.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <TopNav title="Operators" subtitle="Certified equipment operators" />
      <div className="p-8 space-y-6">
        <p className="text-sm text-[var(--muted)]">{rows.length} operators</p>
        <DataTable
          loading={loading}
          data={rows as unknown as Record<string, unknown>[]}
          columns={[
            { key: "operator_id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "certification", label: "Certification" },
            { key: "experience_years", label: "Years" },
            { key: "shift", label: "Shift" },
            {
              key: "status",
              label: "Status",
              render: (row) => <Badge status={String(row.status)} />,
            },
          ]}
        />
      </div>
    </>
  );
}
