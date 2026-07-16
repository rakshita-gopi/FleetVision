"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/top-nav";
import { DataTable } from "@/components/shared/data-table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api, { ApiResponse } from "@/lib/api";
import { FuelLog } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function FuelPage() {
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<FuelLog[]>>("/fuel/").then((res) => {
      setLogs(res.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const monthlyCost = logs.reduce((sum, l) => sum + Number(l.fuel_cost), 0);
  const chartData = logs.slice(0, 6).map((l) => ({
    vehicle: l.vehicle_number || "Unknown",
    cost: Number(l.fuel_cost),
  }));

  return (
    <>
      <TopNav title="Fuel Management" subtitle="Fuel consumption and cost tracking" />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader><CardTitle className="text-2xl">{formatCurrency(monthlyCost)}</CardTitle><p className="text-xs text-[var(--muted)]">Total Fuel Cost</p></CardHeader></Card>
          <Card><CardHeader><CardTitle className="text-2xl">{logs.length}</CardTitle><p className="text-xs text-[var(--muted)]">Fuel Entries</p></CardHeader></Card>
          <Card><CardHeader><CardTitle className="text-2xl">{logs.length ? (logs.reduce((s, l) => s + Number(l.mileage), 0) / logs.length).toFixed(1) : 0} km/L</CardTitle><p className="text-xs text-[var(--muted)]">Avg Mileage</p></CardHeader></Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Fuel Cost by Vehicle</CardTitle></CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="vehicle" stroke="var(--muted)" fontSize={11} />
                <YAxis stroke="var(--muted)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px" }} />
                <Bar dataKey="cost" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <DataTable
          loading={loading}
          data={logs as unknown as Record<string, unknown>[]}
          columns={[
            { key: "vehicle_number", label: "Vehicle" },
            { key: "driver_name", label: "Driver" },
            { key: "fuel_quantity", label: "Quantity (L)" },
            { key: "fuel_cost", label: "Cost", render: (row) => formatCurrency(Number(row.fuel_cost)) },
            { key: "mileage", label: "Mileage" },
            { key: "fuel_date", label: "Date", render: (row) => formatDate(row.fuel_date as string) },
          ]}
        />
      </div>
    </>
  );
}
