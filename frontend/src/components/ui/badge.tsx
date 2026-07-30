import { cn } from "@/lib/utils";

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  Available: { bg: "var(--success-soft)", text: "var(--success)", border: "color-mix(in srgb, var(--success) 25%, transparent)" },
  AVAILABLE: { bg: "var(--success-soft)", text: "var(--success)", border: "color-mix(in srgb, var(--success) 25%, transparent)" },
  PENDING_CHECKOUT: { bg: "var(--info-soft)", text: "var(--info)", border: "color-mix(in srgb, var(--info) 25%, transparent)" },
  ACTIVE: { bg: "var(--primary-soft)", text: "var(--primary)", border: "color-mix(in srgb, var(--primary) 25%, transparent)" },
  IDLE: { bg: "var(--warning-soft)", text: "var(--warning)", border: "color-mix(in srgb, var(--warning) 25%, transparent)" },
  MAINTENANCE: { bg: "var(--warning-soft)", text: "var(--warning)", border: "color-mix(in srgb, var(--warning) 25%, transparent)" },
  COMPLETED: { bg: "var(--success-soft)", text: "var(--success)", border: "color-mix(in srgb, var(--success) 25%, transparent)" },
  Efficient: { bg: "var(--success-soft)", text: "var(--success)", border: "color-mix(in srgb, var(--success) 25%, transparent)" },
  Moderate: { bg: "var(--warning-soft)", text: "var(--warning)", border: "color-mix(in srgb, var(--warning) 25%, transparent)" },
  "Under-utilised": { bg: "var(--danger-soft)", text: "var(--danger)", border: "color-mix(in srgb, var(--danger) 25%, transparent)" },
  OVERDUE: { bg: "var(--danger-soft)", text: "var(--danger)", border: "color-mix(in srgb, var(--danger) 25%, transparent)" },
  pending: { bg: "var(--warning-soft)", text: "var(--warning)", border: "color-mix(in srgb, var(--warning) 25%, transparent)" },
  retain: { bg: "var(--muted-bg)", text: "var(--muted)", border: "var(--border)" },
  return: { bg: "var(--danger-soft)", text: "var(--danger)", border: "color-mix(in srgb, var(--danger) 25%, transparent)" },
  reallocate: { bg: "var(--primary-soft)", text: "var(--primary)", border: "color-mix(in srgb, var(--primary) 25%, transparent)" },
  inspect: { bg: "var(--info-soft)", text: "var(--info)", border: "color-mix(in srgb, var(--info) 25%, transparent)" },
  maintain: { bg: "var(--warning-soft)", text: "var(--warning)", border: "color-mix(in srgb, var(--warning) 25%, transparent)" },
  extend: { bg: "var(--violet-soft)", text: "var(--violet)", border: "color-mix(in srgb, var(--violet) 25%, transparent)" },
  "On Trip": { bg: "var(--primary-soft)", text: "var(--primary)", border: "color-mix(in srgb, var(--primary) 25%, transparent)" },
  "Under Maintenance": { bg: "var(--warning-soft)", text: "var(--warning)", border: "color-mix(in srgb, var(--warning) 25%, transparent)" },
  Inactive: { bg: "var(--muted-bg)", text: "var(--muted)", border: "var(--border)" },
  Scheduled: { bg: "var(--violet-soft)", text: "var(--violet)", border: "color-mix(in srgb, var(--violet) 25%, transparent)" },
  Started: { bg: "var(--info-soft)", text: "var(--info)", border: "color-mix(in srgb, var(--info) 25%, transparent)" },
  "In Progress": { bg: "var(--primary-soft)", text: "var(--primary)", border: "color-mix(in srgb, var(--primary) 25%, transparent)" },
  Completed: { bg: "var(--success-soft)", text: "var(--success)", border: "color-mix(in srgb, var(--success) 25%, transparent)" },
  Cancelled: { bg: "var(--danger-soft)", text: "var(--danger)", border: "color-mix(in srgb, var(--danger) 25%, transparent)" },
  "On Leave": { bg: "var(--warning-soft)", text: "var(--warning)", border: "color-mix(in srgb, var(--warning) 25%, transparent)" },
};

export function Badge({ status, className }: { status: string; className?: string }) {
  const colors = statusColors[status] || { bg: "var(--muted-bg)", text: "var(--muted)", border: "var(--border)" };
  return (
    <span
      className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", className)}
      style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
    >
      {status}
    </span>
  );
}
