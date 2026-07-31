"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  QrCode,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import GradientText from "@/components/react-bits/GradientText";
import CountUp from "@/components/react-bits/CountUp";
import api, { ApiResponse } from "@/lib/api";
import { RentalDashboard, ActionProposal } from "@/types";
import { useAgenticMode } from "@/contexts/agentic-mode-context";
import { useTheme } from "@/contexts/theme-context";
import { toast } from "sonner";

interface Catalog {
  agents: { id: string; name: string; role: string; domain: string; color: string; capabilities: string[] }[];
  workers: { id: string; name: string; kind: string }[];
  mcp?: {
    protocol: string;
    server: string;
    stdio_command: string;
    http?: { tools: string; call: string };
    tools: { name: string; description: string }[];
  };
}

const AGENT_LINKS = [
  { href: "/agentic/dispatch", label: "Dispatch Hub", icon: QrCode, domain: "dispatch" },
  { href: "/agentic/demand", label: "Demand Forecast", icon: TrendingUp, domain: "demand" },
  { href: "/agentic/anomalies", label: "Anomaly Desk", icon: ShieldAlert, domain: "anomalies" },
  { href: "/agentic/alerts", label: "Alerts & Notify", icon: Bell, domain: "alerts" },
];

export default function AgenticDashboardPage() {
  const { setAgenticMode } = useAgenticMode();
  const { theme } = useTheme();
  const [stats, setStats] = useState<RentalDashboard | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [anomalyCounts, setAnomalyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAgenticMode(true);
  }, [setAgenticMode]);

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<RentalDashboard>>("/equipment/dashboard/"),
      api.get<ApiResponse<Catalog>>("/agentic/catalog/"),
      api.get<ApiResponse<ActionProposal[]>>("/agentic/proposals/?status=pending"),
      api.get<ApiResponse<{ counts: Record<string, number>; total: number }>>("/anomalies/?notify=0", { timeout: 90000 }).catch(() => null),
    ])
      .then(([dash, cat, props, anom]) => {
        setStats(dash.data.data || null);
        setCatalog(cat.data.data || null);
        setProposals(props.data.data || []);
        setAnomalyCounts(anom?.data?.data?.counts || {});
      })
      .catch(() => toast.error("Failed to load agentic dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const gridColor = theme === "dark" ? "#44403c" : "#e7e0c9";
  const axisColor = theme === "dark" ? "#a8a29e" : "#78716c";

  const statusChart = [
    { name: "Available", value: stats?.available ?? 0 },
    { name: "Active", value: stats?.active ?? 0 },
    { name: "Idle", value: stats?.idle ?? 0 },
    { name: "Maint.", value: stats?.maintenance ?? 0 },
  ];
  const agentCards = catalog?.agents || [];

  return (
    <>
      <TopNav title="Agentic Dashboard" subtitle="Fleet analytics · agent health · HITL queue" />
      <div className="p-6 lg:p-8 space-y-6">
        <SpotlightCard className="p-5" spotlightColor="rgba(212, 160, 23, 0.16)">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">
                <GradientText>Orchestration overview</GradientText>
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1 max-w-2xl">
                Live fleet KPIs plus specialist agents. Open a domain to run its unique React Flow graph (not a shared
                template).
              </p>
            </div>
            <Link href="/agentic/dispatch">
              <Button>
                <Sparkles className="h-4 w-4" /> Open Dispatch flow
              </Button>
            </Link>
          </div>
        </SpotlightCard>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active assets", value: stats?.active ?? 0, icon: Activity },
            { label: "Overdue rentals", value: stats?.overdue_rentals ?? 0, icon: AlertTriangle },
            { label: "Pending HITL", value: proposals.length, icon: Bot },
            { label: "Anomaly signals", value: Object.values(anomalyCounts).reduce((a, b) => a + b, 0), icon: ShieldAlert },
          ].map((k) => (
            <SpotlightCard key={k.label} className="p-4" spotlightColor="rgba(212, 160, 23, 0.1)">
              <div className="flex items-center justify-between">
                <k.icon className="h-5 w-5 text-[var(--muted)]" />
                <Badge status="ACTIVE" />
              </div>
              <p className="text-2xl font-bold mt-2">
                {loading ? "—" : <CountUp to={k.value} />}
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">{k.label}</p>
            </SpotlightCard>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <SpotlightCard className="p-4 xl:col-span-2" spotlightColor="rgba(120, 113, 108, 0.1)">
            <h3 className="font-semibold mb-3">Fleet status mix</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChart}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke={axisColor} tick={{ fontSize: 11 }} />
                  <YAxis stroke={axisColor} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ca8a04" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-4" spotlightColor="rgba(220, 38, 38, 0.08)">
            <h3 className="font-semibold mb-3">Anomaly mix</h3>
            <div className="space-y-2">
              {Object.entries(anomalyCounts).length === 0 && (
                <p className="text-sm text-[var(--muted)] py-8 text-center">{loading ? "Loading…" : "No signals yet"}</p>
              )}
              {Object.entries(anomalyCounts).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm rounded-xl bg-[var(--muted-bg)] px-3 py-2">
                  <span className="capitalize text-[var(--muted)]">{k.replace("_", " ")}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
              <Link href="/agentic/anomalies" className="text-xs font-medium inline-flex items-center gap-1 mt-2" style={{ color: "var(--primary)" }}>
                Run Anomaly flow <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </SpotlightCard>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Specialist agents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {AGENT_LINKS.map((link) => {
              const agent = agentCards.find((a) => a.domain === link.domain);
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <SpotlightCard className="p-4 h-full hover:scale-[1.01] transition-transform" spotlightColor="rgba(212, 160, 23, 0.12)">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-5 w-5" style={{ color: agent?.color || "var(--primary)" }} />
                      <p className="font-semibold text-sm">{link.label}</p>
                    </div>
                    <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-3">
                      {agent?.role || "Unique node graph for this domain"}
                    </p>
                    <p className="text-[10px] mt-3 uppercase tracking-wider text-[var(--primary)]">
                      Open flow →
                    </p>
                  </SpotlightCard>
                </Link>
              );
            })}
          </div>
        </div>

        {catalog?.mcp && (
          <SpotlightCard className="p-4" spotlightColor="rgba(37, 99, 235, 0.08)">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold">MCP tool layer</h3>
                <p className="text-xs text-[var(--muted)] mt-1">
                  {catalog.mcp.server} · {catalog.mcp.tools?.length ?? 0} tools · stdio +{" "}
                  {catalog.mcp.http?.tools || "/api/v1/mcp/tools/"}
                </p>
              </div>
              <Badge status="ACTIVE" />
            </div>
            <div className="flex flex-wrap gap-2">
              {(catalog.mcp.tools || []).map((t) => (
                <span
                  key={t.name}
                  className="text-[11px] rounded-lg bg-[var(--muted-bg)] px-2.5 py-1 font-mono"
                  title={t.description}
                >
                  {t.name}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-[var(--muted)] mt-3 font-mono">
              {catalog.mcp.stdio_command}
            </p>
          </SpotlightCard>
        )}

        <SpotlightCard className="p-4" spotlightColor="rgba(13, 148, 136, 0.1)">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Pending human approvals</h3>
            <span className="text-xs text-[var(--muted)]">{proposals.length} open</span>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {proposals.slice(0, 8).map((p) => (
              <div key={p.id} className="rounded-xl bg-[var(--muted-bg)] p-3 text-sm flex justify-between gap-3">
                <div>
                  <Badge status={p.action_type} />
                  <p className="text-xs text-[var(--muted)] mt-1">{p.rationale}</p>
                </div>
                <span className="text-[10px] text-[var(--muted)] shrink-0">{p.asset_id || p.rental_id}</span>
              </div>
            ))}
            {!proposals.length && <p className="text-sm text-[var(--muted)] text-center py-6">No pending proposals</p>}
          </div>
        </SpotlightCard>
      </div>
    </>
  );
}
