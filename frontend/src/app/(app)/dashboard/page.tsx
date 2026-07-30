"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarClock,
  HardHat,
  MapPin,
  Radio,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api, { ApiResponse } from "@/lib/api";
import { RentalDashboard } from "@/types";
import { useTheme } from "@/contexts/theme-context";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import CountUp from "@/components/react-bits/CountUp";
import GradientText from "@/components/react-bits/GradientText";
import BlurText from "@/components/react-bits/BlurText";
import ShinyText from "@/components/react-bits/ShinyText";
import Magnet from "@/components/react-bits/Magnet";

/**
 * Category imagery inspired by Cat Rentals catalog (earthmoving, aerial, telehandlers, attachments).
 * Using Unsplash construction photography in the same visual language as https://rent.cat.com/en_US
 */
const CATEGORIES = [
  {
    title: "Earthmoving",
    subtitle: "Excavators · Loaders · Dozers",
    href: "/equipment?q=Excavator",
    image:
      "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Aerial",
    subtitle: "Boom & scissor lifts",
    href: "/equipment?q=Loader",
    image:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Telehandlers",
    subtitle: "Material handling reach",
    href: "/equipment?q=Telehandler",
    image:
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Attachments",
    subtitle: "Hammers · Buckets · Forks",
    href: "/rentals",
    image:
      "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1200&q=80",
  },
];

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1800&q=80";

export default function DashboardPage() {
  const { theme } = useTheme();
  const [stats, setStats] = useState<RentalDashboard | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [ask, setAsk] = useState("");
  const [askAnswer, setAskAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  const gridColor = theme === "dark" ? "#44403c" : "#e7e0c9";
  const axisColor = theme === "dark" ? "#a8a29e" : "#78716c";
  const tooltipBg = theme === "dark" ? "#292524" : "#fffbf0";
  const tooltipBorder = theme === "dark" ? "#44403c" : "#e7e0c9";

  useEffect(() => {
    api
      .get<ApiResponse<RentalDashboard>>("/equipment/dashboard/")
      .then((res) => setStats(res.data.data || null))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));

    setAiLoading(true);
    api
      .get<ApiResponse<{ summary: string }>>("/ai/dashboard-summary")
      .then((res) => setAiSummary(res.data.data?.summary || ""))
      .catch(() => setAiSummary(""))
      .finally(() => setAiLoading(false));
  }, []);

  const utilPct = stats?.utilisation_pct ?? (stats ? Math.round((100 * stats.active) / Math.max(stats.total, 1)) : 0);

  const pressure = useMemo(
    () =>
      stats
        ? [
            { name: "On rent", value: stats.active_rentals, fill: "#d4a017" },
            { name: "Overdue", value: stats.overdue_rentals, fill: "#dc2626" },
            { name: "Idle", value: stats.idle, fill: "#ca8a04" },
            { name: "Available", value: stats.available, fill: "#16a34a" },
          ]
        : [],
    [stats]
  );

  const askAi = async (question?: string) => {
    const q = (question || ask).trim();
    if (!q) return;
    setAsking(true);
    setAsk("");
    try {
      const res = await api.post<ApiResponse<{ answer: string }>>("/ai/chat", { question: q });
      setAskAnswer(res.data.data?.answer || "No answer");
    } catch {
      setAskAnswer("AI unavailable — try Agentic Mode for tool-backed answers.");
    } finally {
      setAsking(false);
    }
  };

  const kpi = [
    { label: "Fleet size", value: stats?.total ?? 0, hint: "assets" },
    { label: "Available", value: stats?.available ?? 0, hint: "ready to rent" },
    { label: "On rent", value: stats?.active ?? 0, hint: "active jobs" },
    { label: "Overdue", value: stats?.overdue_rentals ?? 0, hint: "need return" },
  ];

  return (
    <>
      <TopNav title="Dashboard" subtitle="Command center — live rentals & utilisation" />
      <div className="p-6 lg:p-8 space-y-8">
        {/* Hero — Cat Rentals inspired full-bleed */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl min-h-[280px] lg:min-h-[320px] border border-[var(--border)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMAGE}
            alt="Heavy equipment on a construction site"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 rental-hero-scrim" />
          <div className="relative z-10 flex h-full flex-col justify-between p-6 lg:p-10 text-white min-h-[280px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
                <span className="live-dot" />
                Live ops · {stats?.live_assets ?? 0} telematics feeds
              </span>
              <ShinyText text="More when you need it most" className="text-xs text-white/80" speed={4} />
            </div>
            <div className="max-w-2xl space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-[#f5c518] font-semibold">Rental-IQ</p>
              <h2 className="text-3xl lg:text-5xl font-bold leading-tight">
                <BlurText text="Equipment that earns — not sits." />
              </h2>
              <p className="text-white/80 text-sm lg:text-base max-w-xl">
                Track utilisation, clear overdue returns, and ask AI what to reallocate next — in the spirit of{" "}
                <a
                  href="https://rent.cat.com/en_US"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-[#f5c518]/30 underline-offset-4 hover:decoration-[#f5c518]"
                >
                  Cat Rentals
                </a>{" "}
                ops clarity.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Magnet>
                  <Link href="/tracking">
                    <Button className="bg-[#f5c518] text-[#1c1917] hover:opacity-90 border-0">
                      <Radio className="h-4 w-4" /> Live map
                    </Button>
                  </Link>
                </Magnet>
                <Magnet>
                  <Link href="/agentic">
                    <Button variant="outline" className="border-white/30 text-white bg-white/5">
                      <Sparkles className="h-4 w-4" /> Agentic Mode
                    </Button>
                  </Link>
                </Magnet>
              </div>
            </div>
          </div>
        </motion.section>

        {/* KPI strip with CountUp */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpi.map((item, i) => (
            <SpotlightCard key={item.label} className="p-5" spotlightColor="rgba(212, 160, 23, 0.22)">
              <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{item.label}</p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)] tabular-nums">
                {loading ? "—" : <CountUp to={item.value} duration={1.2} delay={i * 0.08} />}
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">{item.hint}</p>
            </SpotlightCard>
          ))}
        </div>

        {/* Category tiles */}
        <div>
          <div className="flex items-end justify-between mb-4 gap-3">
            <div>
              <h3 className="text-lg font-bold text-[var(--foreground)]">
                <GradientText>Top rental categories</GradientText>
              </h3>
              <p className="text-sm text-[var(--muted)]">Browse like a rental yard — jump straight into inventory</p>
            </div>
            <Link href="/equipment" className="text-sm font-medium" style={{ color: "var(--primary)" }}>
              Browse equipment <ArrowRight className="inline h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {CATEGORIES.map((cat, i) => (
              <Magnet key={cat.title}>
                <Link href={cat.href}>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="group relative h-44 overflow-hidden rounded-2xl border border-[var(--border)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cat.image}
                      alt={cat.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <p className="font-semibold text-lg">{cat.title}</p>
                      <p className="text-xs text-white/75">{cat.subtitle}</p>
                    </div>
                  </motion.div>
                </Link>
              </Magnet>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Live status + utilisation */}
          <SpotlightCard className="p-6 xl:col-span-1 space-y-5" spotlightColor="rgba(13, 148, 136, 0.2)">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                <Activity className="h-4 w-4" style={{ color: "var(--primary)" }} /> Live status
              </h3>
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <span className="live-dot" /> telematics
              </span>
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: "Active on site", value: stats?.active ?? 0, color: "var(--primary)" },
                { label: "Available yard", value: stats?.available ?? 0, color: "var(--success)" },
                { label: "Idle / under-utilised", value: stats?.underutilised ?? 0, color: "var(--warning)" },
                { label: "Maintenance", value: stats?.maintenance ?? 0, color: "var(--danger)" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span className="text-[var(--muted)]">{row.label}</span>
                  <span className="font-semibold tabular-nums" style={{ color: row.color }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-[var(--muted)]">Utilisation</span>
                <span className="font-semibold text-[var(--foreground)]">{utilPct}%</span>
              </div>
              <div className="h-3 rounded-full bg-[var(--muted-bg)] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #b45309, #f5c518)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, utilPct)}%` }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-2">
                Active ÷ total fleet · target push idle iron back onto jobs
              </p>
            </div>
            <Link href="/equipment" className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: "var(--primary)" }}>
              <HardHat className="h-4 w-4" /> Open equipment board
            </Link>
          </SpotlightCard>

          {/* AI summary + ask */}
          <SpotlightCard className="p-6 xl:col-span-2 space-y-4" spotlightColor="rgba(212, 160, 23, 0.18)">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                <Bot className="h-4 w-4" style={{ color: "var(--primary)" }} /> AI ops brief
              </h3>
              <Link href="/agentic">
                <Button size="sm" variant="outline">
                  <Sparkles className="h-3.5 w-3.5" /> Full Agentic
                </Button>
              </Link>
            </div>
            <div className="rounded-2xl bg-[var(--muted-bg)] p-4 min-h-[120px] text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
              {aiLoading ? (
                <span className="text-[var(--muted)]">Generating rental summary…</span>
              ) : (
                aiSummary || "No summary yet — ensure backend AI/fallback is reachable."
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {["What is overdue?", "Where is utilisation weak?", "What should we inspect?"].map((q) => (
                <button
                  key={q}
                  onClick={() => askAi(q)}
                  className="text-xs rounded-full px-3 py-1.5 bg-[var(--hover)] text-[var(--foreground)] hover:opacity-90"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAi()}
                placeholder="Ask about returns, idle assets, or maintenance…"
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
              />
              <Button onClick={() => askAi()} disabled={asking}>
                {asking ? "…" : "Ask"}
              </Button>
            </div>
            {askAnswer && (
              <p className="text-sm rounded-xl border border-[var(--border)] p-3 bg-[var(--card)] text-[var(--foreground)]">
                {askAnswer}
              </p>
            )}
          </SpotlightCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Return dates */}
          <SpotlightCard className="p-6 xl:col-span-2 space-y-4" spotlightColor="rgba(220, 38, 38, 0.12)">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                <CalendarClock className="h-4 w-4" style={{ color: "var(--danger)" }} /> Return calendar
              </h3>
              <Link href="/rentals" className="text-xs font-medium" style={{ color: "var(--primary)" }}>
                All rentals
              </Link>
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {(stats?.returns || []).length === 0 && !loading && (
                <p className="text-sm text-[var(--muted)] py-8 text-center">No upcoming or overdue returns</p>
              )}
              {(stats?.returns || []).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 bg-[var(--muted-bg)]/50"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{r.asset_id}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {r.rental_id}
                      {r.site_id ? ` · ${r.site_id}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge status={r.overdue ? "OVERDUE" : "ACTIVE"} />
                    <p className="text-xs text-[var(--muted)] mt-1">{r.expected_return_date || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>

          {/* Utilisation chart tools */}
          <SpotlightCard className="p-6 xl:col-span-3 space-y-4" spotlightColor="rgba(212, 160, 23, 0.15)">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-[var(--foreground)]">Utilisation tools</h3>
              <div className="flex gap-2">
                <Link href="/sites">
                  <Button size="sm" variant="ghost">
                    <MapPin className="h-3.5 w-3.5" /> Sites
                  </Button>
                </Link>
                <Link href="/rentals">
                  <Button size="sm" variant="ghost">
                    <Wrench className="h-3.5 w-3.5" /> Check-in/out
                  </Button>
                </Link>
              </div>
            </div>
            <div className="h-64">
              {loading ? (
                <div className="h-full flex items-center justify-center text-[var(--muted)]">Loading…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pressure} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" stroke={axisColor} fontSize={12} />
                    <YAxis stroke={axisColor} fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: tooltipBg,
                        border: `1px solid ${tooltipBorder}`,
                        borderRadius: "12px",
                      }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {pressure.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SpotlightCard>
        </div>
      </div>
    </>
  );
}
