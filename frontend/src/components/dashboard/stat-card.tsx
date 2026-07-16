"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accent?: string;
  delay?: number;
}

const accents = [
  "var(--primary)",
  "var(--info)",
  "var(--violet)",
  "var(--warning)",
  "var(--success)",
  "var(--danger)",
];

export function StatCard({ title, value, subtitle, icon: Icon, accent, delay = 0 }: StatCardProps) {
  const color = accent || accents[Math.floor(delay * 10) % accents.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card rounded-2xl p-5 transition-all duration-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">{title}</p>
          <p className="text-2xl font-bold text-[var(--foreground)] mt-2 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-[var(--muted)] mt-1">{subtitle}</p>}
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl border"
          style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color, borderColor: `color-mix(in srgb, ${color} 20%, transparent)` }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
