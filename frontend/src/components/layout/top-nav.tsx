"use client";

import { Bell, Search, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useEffect, useState } from "react";
import api, { ApiResponse } from "@/lib/api";
import { Notification } from "@/types";

export function TopNav({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<Notification[]>>("/notifications/").then((res) => {
      setNotifications(res.data.data || []);
    }).catch(() => {});
    const id = window.setInterval(() => {
      api.get<ApiResponse<Notification[]>>("/notifications/?unread=1").then((res) => {
        // merge unread into list for badge freshness
        const unread = res.data.data || [];
        if (unread.length) {
          setNotifications((prev) => {
            const map = new Map(prev.map((n) => [n.id, n]));
            unread.forEach((n) => map.set(n.id, n));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          });
        }
      }).catch(() => {});
    }, 90_000);
    return () => window.clearInterval(id);
  }, []);

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur-xl px-8 py-4">
      <div>
        <h2 className="text-xl font-semibold text-[var(--foreground)] tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" />
          <Input placeholder="Search fleet..." className="pl-9 w-64" />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 glass-card rounded-2xl p-4 shadow-2xl z-50">
              <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Notifications</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.slice(0, 5).map((n) => (
                  <div key={n.id} className="rounded-lg bg-[var(--muted-bg)] p-3">
                    <p className="text-xs font-medium text-[var(--foreground)]">{n.title}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">{n.message}</p>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-xs text-[var(--muted)] text-center py-4">No notifications</p>
                )}
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
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "var(--primary)" }}>
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
