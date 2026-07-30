"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  RefreshCw,
  Siren,
} from "lucide-react";
import { TopNav } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import GradientText from "@/components/react-bits/GradientText";
import CountUp from "@/components/react-bits/CountUp";
import api, { ApiResponse } from "@/lib/api";
import { toast } from "sonner";

interface AlertRow {
  rental_id: string;
  asset_id: string;
  customer_name?: string;
  operator_name?: string | null;
  site_id?: string | null;
  expected_return_date: string;
  days: number;
  rental_status: string;
  bucket?: string;
}

interface NotifRow {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  severity: string;
  related_rental_id?: string;
  related_asset_id?: string;
  is_read: boolean;
  created_at: string;
}

interface Board {
  counts: { overdue: number; due_today: number; due_soon: number; unread: number };
  overdue: AlertRow[];
  due_today: AlertRow[];
  due_soon: AlertRow[];
  notifications: NotifRow[];
  last_scan?: { created: number; buckets: Record<string, number> };
}

export default function AlertsPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<ApiResponse<Board>>("/notifications/alerts/board/")
      .then((res) => setBoard(res.data.data || null))
      .catch(() => toast.error("Failed to load alerts"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000); // auto-refresh / re-scan every minute
    return () => window.clearInterval(id);
  }, [load]);

  const markAll = async () => {
    try {
      await api.post("/notifications/mark-all-read/");
      toast.success("All notifications marked read");
      load();
    } catch {
      toast.error("Could not mark read");
    }
  };

  const markOne = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/mark-read/`);
      load();
    } catch {
      /* ignore */
    }
  };

  const scanNow = async () => {
    try {
      const res = await api.post<ApiResponse<{ created: number }>>("/notifications/alerts/scan/");
      toast.success(`Scan created ${res.data.data?.created ?? 0} new alert(s)`);
      load();
    } catch {
      toast.error("Scan failed (managers/admins only)");
    }
  };

  const renderBucket = (title: string, rows: AlertRow[], tone: string) => (
    <SpotlightCard className="p-4 space-y-3" spotlightColor={tone}>
      <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
        {title}
        <span className="text-xs font-normal text-[var(--muted)]">({rows.length})</span>
      </h3>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {rows.map((r) => (
          <div key={r.rental_id} className="rounded-xl bg-[var(--muted-bg)] p-3 text-sm">
            <div className="flex justify-between gap-2">
              <p className="font-semibold">
                {r.asset_id} · {r.rental_id}
              </p>
              <span className="text-xs text-[var(--muted)]">
                {r.days < 0 ? `${Math.abs(r.days)}d overdue` : r.days === 0 ? "today" : `in ${r.days}d`}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              Due {r.expected_return_date} · {r.customer_name || "—"} · op {r.operator_name || "—"} ·{" "}
              {r.site_id || "—"}
            </p>
            <Link href="/qr-desk" className="text-xs font-medium mt-2 inline-block" style={{ color: "var(--primary)" }}>
              Open QR desk →
            </Link>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-[var(--muted)] py-6 text-center">None</p>}
      </div>
    </SpotlightCard>
  );

  return (
    <>
      <TopNav title="Alerts & Notify" subtitle="Auto-notifies due soon, due today, and overdue rentals" />
      <div className="p-6 lg:p-8 space-y-6">
        <SpotlightCard className="p-5" spotlightColor="rgba(220, 38, 38, 0.12)">
          <h2 className="text-xl font-bold">
            <GradientText>Rental return alerts</GradientText>
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1 max-w-3xl">
            Opening this tab (and the notification bell) runs an automatic scan. New alerts are written once per
            rental/type about every 20 hours so operators and managers stay notified without spam.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={load} variant="outline">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button onClick={scanNow} variant="outline">
              <Siren className="h-4 w-4" /> Force scan
            </Button>
            <Button onClick={markAll} variant="ghost">
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          </div>
        </SpotlightCard>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Overdue", value: board?.counts.overdue ?? 0, icon: AlertTriangle },
            { label: "Due today", value: board?.counts.due_today ?? 0, icon: CalendarClock },
            { label: "Due soon (≤3d)", value: board?.counts.due_soon ?? 0, icon: Bell },
            { label: "Unread inbox", value: board?.counts.unread ?? 0, icon: Bell },
          ].map((k) => (
            <SpotlightCard key={k.label} className="p-4" spotlightColor="rgba(212, 160, 23, 0.14)">
              <p className="text-xs uppercase tracking-wider text-[var(--muted)]">{k.label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">
                {loading ? "—" : <CountUp to={k.value} duration={0.9} />}
              </p>
            </SpotlightCard>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {renderBucket("Overdue", board?.overdue || [], "rgba(220,38,38,0.14)")}
          {renderBucket("Due today", board?.due_today || [], "rgba(202,138,4,0.14)")}
          {renderBucket("Due soon", board?.due_soon || [], "rgba(13,148,136,0.12)")}
        </div>

        <SpotlightCard className="p-5" spotlightColor="rgba(120, 113, 108, 0.1)">
          <h3 className="font-semibold mb-3">Notification feed</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(board?.notifications || []).map((n) => (
              <button
                key={n.id}
                onClick={() => !n.is_read && markOne(n.id)}
                className={`w-full text-left rounded-xl border border-[var(--border)] p-3 ${
                  n.is_read ? "opacity-70" : "bg-[var(--muted-bg)]"
                }`}
              >
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <Badge status={n.severity === "critical" ? "OVERDUE" : n.severity === "warning" ? "IDLE" : "ACTIVE"} />
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">{n.message}</p>
                <p className="text-[10px] text-[var(--muted)] mt-2">
                  {n.notification_type} · {new Date(n.created_at).toLocaleString()}
                  {!n.is_read ? " · unread" : ""}
                </p>
              </button>
            ))}
            {(board?.notifications || []).length === 0 && (
              <p className="text-sm text-[var(--muted)] text-center py-8">No rental alerts yet</p>
            )}
          </div>
        </SpotlightCard>
      </div>
    </>
  );
}
