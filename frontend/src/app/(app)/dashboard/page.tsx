"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Truck, Users, Route, Fuel, Wrench, Wallet, Bell, Activity } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TopNav } from "@/components/layout/top-nav";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import api, { ApiResponse } from "@/lib/api";
import { DashboardStats } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { useTheme } from "@/contexts/theme-context";

export default function DashboardPage() {
  const { theme } = useTheme();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [loading, setLoading] = useState(true);

  const resolvedColors = theme === "dark"
    ? ["#3b82f6", "#06b6d4", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"]
    : ["#2563eb", "#0891b2", "#16a34a", "#d97706", "#7c3aed", "#dc2626"];
  const gridColor = theme === "dark" ? "#1e293b" : "#e2e8f0";
  const axisColor = theme === "dark" ? "#94a3b8" : "#64748b";
  const tooltipBg = theme === "dark" ? "#0f172a" : "#ffffff";
  const tooltipBorder = theme === "dark" ? "#1e293b" : "#e2e8f0";

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<DashboardStats>>("/reports/dashboard"),
      api.get<ApiResponse<{ summary: string }>>("/ai/dashboard-summary"),
    ]).then(([statsRes, aiRes]) => {
      setStats(statsRes.data.data || null);
      setAiSummary(aiRes.data.data?.summary || "");
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const pieData = stats?.vehicle_status_distribution?.map((s) => ({
    name: s.status,
    value: s.count,
  })) || [];

  const expenseData = stats ? [
    { name: "Fuel", value: stats.fuel_cost_month },
    { name: "Maintenance", value: stats.maintenance_cost_month },
    { name: "Other", value: Math.max(0, stats.expenses_month - stats.fuel_cost_month - stats.maintenance_cost_month) },
  ] : [];

  return (
    <>
      <TopNav title="Dashboard" subtitle="Fleet operations overview" />
      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Vehicles" value={stats?.total_vehicles ?? "—"} icon={Truck} delay={0} />
          <StatCard title="Active Trips" value={stats?.active_trips ?? "—"} subtitle={`${stats?.trips_today ?? 0} trips today`} icon={Route} delay={0.1} />
          <StatCard title="Drivers" value={stats?.total_drivers ?? "—"} icon={Users} delay={0.2} />
          <StatCard title="Notifications" value={stats?.unread_notifications ?? "—"} icon={Bell} delay={0.3} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Fuel Cost (Month)" value={stats ? formatCurrency(stats.fuel_cost_month) : "—"} icon={Fuel} delay={0.4} />
          <StatCard title="Maintenance (Month)" value={stats ? formatCurrency(stats.maintenance_cost_month) : "—"} icon={Wrench} delay={0.5} />
          <StatCard title="Total Expenses" value={stats ? formatCurrency(stats.expenses_month) : "—"} icon={Wallet} delay={0.6} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Monthly Expenses</CardTitle>
              <CardDescription>Breakdown by category</CardDescription>
            </CardHeader>
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center text-[var(--muted)]">Loading...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="name" stroke={axisColor} fontSize={12} />
                    <YAxis stroke={axisColor} fontSize={12} />
                    <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: "12px" }} />
                    <Bar dataKey="value" fill={resolvedColors[0]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vehicle Status</CardTitle>
              <CardDescription>Current fleet distribution</CardDescription>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={resolvedColors[i % resolvedColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: "12px" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5" style={{ color: "var(--violet)" }} />
                  <CardTitle>AI Fleet Summary</CardTitle>
                </div>
                <CardDescription>Powered by Ollama Qwen3:8B</CardDescription>
              </CardHeader>
              <div className="text-sm text-[var(--muted)] leading-relaxed whitespace-pre-line">
                {aiSummary || "Loading AI summary..."}
              </div>
            </Card>
          </motion.div>

          <Card>
            <CardHeader>
              <CardTitle>Fleet Activity Trend</CardTitle>
              <CardDescription>Weekly operational overview</CardDescription>
            </CardHeader>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { day: "Mon", trips: 4 }, { day: "Tue", trips: 6 }, { day: "Wed", trips: 3 },
                  { day: "Thu", trips: 8 }, { day: "Fri", trips: 5 }, { day: "Sat", trips: 2 }, { day: "Sun", trips: 1 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="day" stroke={axisColor} fontSize={12} />
                  <YAxis stroke={axisColor} fontSize={12} />
                  <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: "12px" }} />
                  <Area type="monotone" dataKey="trips" stroke={resolvedColors[0]} fill={resolvedColors[0]} fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
