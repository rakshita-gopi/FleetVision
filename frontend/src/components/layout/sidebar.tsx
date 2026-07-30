"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  HardHat,
  Package,
  MapPin,
  ClipboardList,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  QrCode,
  Gauge,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useAgenticMode } from "@/contexts/agentic-mode-context";
import { useState } from "react";
import ShinyText from "@/components/react-bits/ShinyText";
import Magnet from "@/components/react-bits/Magnet";

const opsNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/equipment", label: "Equipment", icon: HardHat },
  { href: "/rentals", label: "Rentals", icon: ClipboardList },
  { href: "/qr-desk", label: "Dispatch Hub", icon: QrCode },
  { href: "/usage", label: "Usage Logging", icon: Gauge },
  { href: "/alerts", label: "Alerts & Notify", icon: Bell },
  { href: "/anomalies", label: "Anomaly Desk", icon: ShieldAlert },
  { href: "/demand", label: "Demand Forecast", icon: TrendingUp },
  { href: "/sites", label: "Sites", icon: MapPin },
  { href: "/operators", label: "Operators", icon: Package },
  { href: "/tracking", label: "Live Map", icon: MapPin },
  { href: "/settings", label: "Settings", icon: Settings },
];

const agenticNav = [
  { href: "/agentic", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/agentic/dispatch", label: "Dispatch Hub", icon: QrCode },
  { href: "/agentic/demand", label: "Demand Forecast", icon: TrendingUp },
  { href: "/agentic/anomalies", label: "Anomaly Desk", icon: ShieldAlert },
  { href: "/agentic/alerts", label: "Alerts & Notify", icon: Bell },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { agenticMode, toggleAgenticMode } = useAgenticMode();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = agenticMode ? agenticNav : opsNav;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-[var(--border)] transition-all duration-300",
        collapsed ? "w-[72px]" : "w-64",
        agenticMode ? "bg-[#1c1917] text-[#fafaf9] border-[#292524]" : "bg-[var(--card)]"
      )}
      data-collapsed={collapsed ? "1" : "0"}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-6 border-b",
          agenticMode ? "border-[#292524]" : "border-[var(--border)]"
        )}
      >
        <Magnet>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
            style={{
              background: agenticMode ? "rgba(250, 204, 21, 0.18)" : "var(--primary-soft)",
              color: agenticMode ? "#facc15" : "var(--primary)",
            }}
          >
            {agenticMode ? <Sparkles className="h-5 w-5" /> : <HardHat className="h-5 w-5" />}
          </div>
        </Magnet>
        {!collapsed && (
          <div>
            <h1
              className={cn(
                "text-base font-bold tracking-tight",
                agenticMode ? "text-[#fafaf9]" : "text-[var(--foreground)]"
              )}
            >
              {agenticMode ? "Agentic Mode" : "Rental-IQ"}
            </h1>
            <ShinyText
              text={agenticMode ? "Agents · Workers" : "Equipment AI"}
              className="text-[10px] uppercase tracking-widest font-medium"
              speed={4}
            />
          </div>
        )}
      </div>

      <div className={cn("px-3 py-3 border-b", agenticMode ? "border-[#292524]" : "border-[var(--border)]")}>
        <button
          type="button"
          onClick={toggleAgenticMode}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
            agenticMode
              ? "bg-yellow-400 text-[#1c1917] shadow-lg shadow-yellow-400/20"
              : "bg-[var(--muted-bg)] text-[var(--foreground)] hover:bg-[var(--hover)]"
          )}
          title="Toggle Agentic Mode"
        >
          <Sparkles className="h-5 w-5 shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-left flex items-center justify-between gap-2">
              Agentic Mode
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full",
                  agenticMode ? "bg-[#1c1917]/15" : "bg-[var(--primary-soft)] text-[var(--primary)]"
                )}
              >
                {agenticMode ? "ON" : "OFF"}
              </span>
            </span>
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const exact = "exact" in item && item.exact;
          const active = exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? agenticMode
                      ? "bg-yellow-400/15 text-yellow-300"
                      : "text-[#1c1917] shadow-sm"
                    : agenticMode
                      ? "text-stone-400 hover:text-stone-100 hover:bg-white/5"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                )}
                style={!agenticMode && active ? { background: "var(--primary)" } : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t p-3 space-y-1", agenticMode ? "border-[#292524]" : "border-[var(--border)]")}>
        {!collapsed && user && (
          <div className="px-3 py-2 mb-2">
            <p className={cn("text-xs", agenticMode ? "text-stone-500" : "text-[var(--muted)]")}>Signed in as</p>
            <p
              className={cn(
                "text-sm font-medium truncate",
                agenticMode ? "text-stone-100" : "text-[var(--foreground)]"
              )}
            >
              {user.full_name}
            </p>
            <p className={cn("text-xs", agenticMode ? "text-stone-500" : "text-[var(--muted)]")}>{user.role}</p>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
            agenticMode
              ? "text-stone-400 hover:text-red-300 hover:bg-red-500/10"
              : "text-[var(--muted)] hover:bg-[var(--danger-soft)]"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex w-full items-center justify-center rounded-xl py-2 transition-all",
            agenticMode
              ? "text-stone-500 hover:text-stone-200 hover:bg-white/5"
              : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
