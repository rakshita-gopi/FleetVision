"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, HardHat, Package, MapPin, ClipboardList,
  Bot, Bell, Activity, Settings, LogOut, ChevronLeft, ChevronRight, Sparkles, QrCode, Gauge, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import ShinyText from "@/components/react-bits/ShinyText";
import Magnet from "@/components/react-bits/Magnet";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/equipment", label: "Equipment", icon: HardHat },
  { href: "/rentals", label: "Rentals", icon: ClipboardList },
  { href: "/qr-desk", label: "QR Check-In/Out", icon: QrCode },
  { href: "/usage", label: "Usage Logging", icon: Gauge },
  { href: "/alerts", label: "Alerts & Notify", icon: Bell },
  { href: "/demand", label: "Demand Forecast", icon: TrendingUp },
  { href: "/sites", label: "Sites", icon: MapPin },
  { href: "/operators", label: "Operators", icon: Package },
  { href: "/tracking", label: "Live Map", icon: MapPin },
  { href: "/agentic", label: "Agentic Mode", icon: Sparkles },
  { href: "/system", label: "System", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

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
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            <HardHat className="h-5 w-5" />
          </div>
        </Magnet>
        {!collapsed && (
          <div>
            <h1 className="text-base font-bold text-[var(--foreground)] tracking-tight">Rental-IQ</h1>
            <ShinyText text="Equipment AI" className="text-[10px] uppercase tracking-widest font-medium" speed={4} />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
