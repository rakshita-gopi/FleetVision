"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api, { ApiResponse } from "@/lib/api";
import { toast } from "sonner";

const reportTypes = [
  { key: "vehicles", label: "Vehicle Report", desc: "Complete vehicle inventory and status" },
  { key: "drivers", label: "Driver Report", desc: "Driver performance and assignments" },
  { key: "trips", label: "Trip Report", desc: "Trip history and completion stats" },
  { key: "fuel", label: "Fuel Report", desc: "Fuel consumption and cost analysis" },
  { key: "maintenance", label: "Maintenance Report", desc: "Service history and upcoming schedules" },
  { key: "expenses", label: "Expense Report", desc: "Operational cost breakdown" },
];

export default function ReportsPage() {
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api.get<ApiResponse<Record<string, unknown>>>("/reports/dashboard").then((res) => {
      setDashboard(res.data.data || null);
    });
  }, []);

  const downloadReport = async (type: string) => {
    try {
      const res = await api.get(`/reports/${type}`);
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fleetvision-${type}-report.json`;
      a.click();
      toast.success(`${type} report downloaded`);
    } catch {
      toast.error("Failed to generate report");
    }
  };

  return (
    <>
      <TopNav title="Reports" subtitle="Analytics and exportable reports" />
      <div className="p-8 space-y-6">
        {dashboard && (
          <Card>
            <CardHeader>
              <CardTitle>Fleet Overview</CardTitle>
              <CardDescription>Quick snapshot from dashboard analytics</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                { label: "Vehicles", value: dashboard.total_vehicles },
                { label: "Drivers", value: dashboard.total_drivers },
                { label: "Active Trips", value: dashboard.active_trips },
                { label: "Trips Today", value: dashboard.trips_today },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-[var(--muted-bg)] p-4">
                  <p className="text-2xl font-bold">{String(item.value)}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => (
            <Card key={report.key} className="hover:ring-1 hover:ring-[var(--foreground)]/10 transition-all">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{ background: "var(--primary-soft)", color: "var(--primary)", borderColor: "color-mix(in srgb, var(--primary) 20%, transparent)" }}>
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{report.label}</CardTitle>
                    <CardDescription className="text-xs">{report.desc}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <Button variant="outline" size="sm" onClick={() => downloadReport(report.key)}>
                <Download className="h-3.5 w-3.5" /> Export JSON
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
