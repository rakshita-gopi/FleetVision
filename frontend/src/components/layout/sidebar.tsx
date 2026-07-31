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
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useAgenticMode } from "@/contexts/agentic-mode-context";
import { useState } from "react";
import ShinyText from "@/components/react-bits/ShinyText";
import Magnet from "@/components/react-bits/Magnet";

const opsNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Administrator", "Fleet Manager", "Operator"] },
  { href: "/equipment", label: "Equipment", icon: HardHat, roles: ["Administrator", "Fleet Manager", "Operator"] },
  { href: "/rentals", label: "Rentals", icon: ClipboardList, roles: ["Administrator", "Fleet Manager", "Operator", "Customer"] },
  { href: "/qr-desk", label: "Dispatch Hub", icon: QrCode, roles: ["Administrator", "Fleet Manager", "Operator"] },
  { href: "/usage", label: "Usage Logging", icon: Gauge, roles: ["Administrator", "Fleet Manager"] },
  { href: "/alerts", label: "Alerts & Notify", icon: Bell, roles: ["Administrator", "Fleet Manager", "Operator"] },
  { href: "/anomalies", label: "Anomaly Desk", icon: ShieldAlert, roles: ["Administrator", "Fleet Manager"] },
  { href: "/demand", label: "Demand Forecast", icon: TrendingUp, roles: ["Administrator", "Fleet Manager"] },
  { href: "/rewards", label: "Rewards", icon: Gift, roles: ["Administrator", "Fleet Manager", "Customer"] },
  { href: "/sites", label: "Sites", icon: MapPin, roles: ["Administrator", "Fleet Manager"] },
  { href: "/operators", label: "Operators", icon: Package, roles: ["Administrator", "Fleet Manager"] },
  { href: "/tracking", label: "Live Map", icon: MapPin, roles: ["Administrator", "Fleet Manager", "Operator"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["Administrator", "Fleet Manager", "Operator", "Customer"] },
];

const agenticNav = [
  { href: "/agentic", label: "Dashboard", icon: LayoutDashboard, exact: true, roles: ["Administrator", "Fleet Manager"] },
  { href: "/agentic/dispatch", label: "Dispatch Hub", icon: QrCode, roles: ["Administrator", "Fleet Manager"] },
  { href: "/agentic/demand", label: "Demand Forecast", icon: TrendingUp, roles: ["Administrator", "Fleet Manager"] },
  { href: "/agentic/anomalies", label: "Anomaly Desk", icon: ShieldAlert, roles: ["Administrator", "Fleet Manager"] },
  { href: "/agentic/alerts", label: "Alerts & Notify", icon: Bell, roles: ["Administrator", "Fleet Manager"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { agenticMode, toggleAgenticMode } = useAgenticMode();
  const [collapsed, setCollapsed] = useState(false);
  const role = user?.role || "Fleet Manager";
  const canAgentic = role === "Administrator" || role === "Fleet Manager";
  const baseNav = agenticMode && canAgentic ? agenticNav : opsNav;
  const navItems = baseNav.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-[var(--border)] bg-[var(--card)] transition-all duration-300",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex items-center gap-3 px-5 py-6 border-b border-[var(--border)]">
        <Magnet>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
            style={{
              background: agenticMode ? "var(--primary-soft)" : "var(--primary-soft)",
              color: "var(--primary)",
            }}
          >
            {agenticMode ? <Sparkles className="h-5 w-5" /> : <HardHat className="h-5 w-5" />}
          </div>
        </Magnet>
        {!collapsed && (
          <div>
            <h1 className="text-base font-bold text-[var(--foreground)] tracking-tight">
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

      {canAgentic && (
      <div className="px-3 py-3 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={toggleAgenticMode}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
            agenticMode
              ? "text-[#1c1917] shadow-sm"
              : "bg-[var(--muted-bg)] text-[var(--foreground)] hover:bg-[var(--hover)]"
          )}
          style={agenticMode ? { background: "var(--primary)" } : undefined}
          title="Toggle Agentic Mode"
        >
          <Sparkles className="h-5 w-5 shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-left flex items-center justify-between gap-2">
              Agentic Mode
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full",
                  agenticMode ? "bg-black/10" : "bg-[var(--primary-soft)] text-[var(--primary)]"
                )}
              >
                {agenticMode ? "ON" : "OFF"}
              </span>
            </span>
          )}
        </button>
      </div>
      )}

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
                    ? "text-[#1c1917] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)]"
                )}
                style={active ? { background: "var(--primary)" } : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] p-3 space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-[var(--muted)]">Signed in as</p>
            <p className="text-sm font-medium text-[var(--foreground)] truncate">{user.full_name}</p>
            <p className="text-xs text-[var(--muted)]">{user.role}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--danger-soft)] transition-all"
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-xl py-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--hover)] transition-all"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
