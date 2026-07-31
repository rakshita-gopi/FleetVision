"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ExternalLink,
  Moon,
  ShieldAlert,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useEffect, useMemo, useRef, useState } from "react";
import api, { ApiResponse } from "@/lib/api";
import { Notification } from "@/types";

function severityTone(sev?: string) {
  if (sev === "critical") return "OVERDUE";
  if (sev === "warning") return "IDLE";
  return "ACTIVE";
}

function typeHref(n: Notification) {
  const t = (n.notification_type || "").toLowerCase();
  if (t.includes("anomaly") || t.includes("misuse") || t.includes("idle") || t.includes("under")) {
    return "/anomalies";
  }
  if (t.includes("rental") || t.includes("overdue") || t.includes("due")) {
    return "/alerts";
  }
  return "/alerts";
}

export function TopNav({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("all");
  const panelRef = useRef<HTMLDivElement>(null);

  const loadAll = () => {
    api
      .get<ApiResponse<Notification[]>>("/notifications/")
      .then((res) => setNotifications(res.data.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadAll();
    const id = window.setInterval(loadAll, 90_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showNotifs) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotifs(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [showNotifs]);

  const unread = notifications.filter((n) => !n.is_read).length;
  const criticalCount = notifications.filter((n) => n.severity === "critical" && !n.is_read).length;

  const visible = useMemo(() => {
    let list = [...notifications];
    if (filter === "unread") list = list.filter((n) => !n.is_read);
    if (filter === "critical") list = list.filter((n) => n.severity === "critical");
    return list.slice(0, 40);
  }, [notifications, filter]);

  const markOne = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/mark-read/`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      /* ignore */
    }
  };

  const markAll = async () => {
    try {
      await api.post("/notifications/mark-all-read/");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* ignore */
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-xl px-8 py-4">
      <div>
        <h2 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setShowNotifs((v) => !v)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
            aria-expanded={showNotifs}
            aria-label="Open notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-[min(100vw-2rem,420px)] sm:w-[440px] glass-card rounded-2xl shadow-2xl z-50 overflow-hidden border border-[var(--border)]">
              <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-[var(--border)]">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                    <Bell className="h-4 w-4" style={{ color: "var(--primary)" }} />
                    Notifications
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    {unread} unread
                    {criticalCount > 0 ? ` · ${criticalCount} critical` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={markAll}
                    className="text-[11px] px-2 py-1 rounded-lg hover:bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--foreground)] inline-flex items-center gap-1"
                    title="Mark all read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> All read
                  </button>
                  <button
                    onClick={() => setShowNotifs(false)}
                    className="p-1.5 rounded-lg hover:bg-[var(--hover)] text-[var(--muted)]"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-1 px-3 py-2 border-b border-[var(--border)] bg-[var(--muted-bg)]/40">
                {(
                  [
                    ["all", "All"],
                    ["unread", "Unread"],
                    ["critical", "Critical"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                      filter === key
                        ? "text-[#1c1917] font-medium"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                    style={filter === key ? { background: "var(--primary)" } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="max-h-[min(70vh,480px)] overflow-y-auto p-3 space-y-2">
                {visible.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border border-[var(--border)] p-3 transition-all ${
                      n.is_read ? "bg-[var(--card)] opacity-80" : "bg-[var(--muted-bg)]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background:
                            n.severity === "critical"
                              ? "var(--danger-soft)"
                              : n.severity === "warning"
                                ? "var(--warning-soft)"
                                : "var(--primary-soft)",
                          color:
                            n.severity === "critical"
                              ? "var(--danger)"
                              : n.severity === "warning"
                                ? "var(--warning)"
                                : "var(--primary)",
                        }}
                      >
                        {n.severity === "critical" ? (
                          <ShieldAlert className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--foreground)] leading-snug">
                            {n.title}
                          </p>
                          <Badge status={severityTone(n.severity)} />
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed line-clamp-4">
                          {n.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[10px] text-[var(--muted)]">
                          <span>{n.notification_type}</span>
                          {n.related_asset_id ? <span>· {n.related_asset_id}</span> : null}
                          {n.related_rental_id ? <span>· {n.related_rental_id}</span> : null}
                          <span>· {new Date(n.created_at).toLocaleString()}</span>
                          {!n.is_read && <span className="text-[var(--primary)] font-medium">· unread</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          {!n.is_read && (
                            <Button size="sm" variant="ghost" onClick={() => markOne(n.id)}>
                              Mark read
                            </Button>
                          )}
                          <Link href={typeHref(n)} onClick={() => setShowNotifs(false)}>
                            <Button size="sm" variant="outline">
                              Open <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {visible.length === 0 && (
                  <p className="text-xs text-[var(--muted)] text-center py-10">No notifications in this filter</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[var(--border)] bg-[var(--card)]">
                <Link
                  href="/alerts"
                  onClick={() => setShowNotifs(false)}
                  className="text-xs font-medium"
                  style={{ color: "var(--primary)" }}
                >
                  Alerts & Notify →
                </Link>
                <Link
                  href="/anomalies"
                  onClick={() => setShowNotifs(false)}
                  className="text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  Anomaly desk →
                </Link>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-[var(--border)]">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: "var(--primary)" }}
          >
            {user?.full_name?.charAt(0) || "U"}
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-medium text-[var(--foreground)]">{user?.full_name}</p>
            <p className="text-xs text-[var(--muted)]">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
