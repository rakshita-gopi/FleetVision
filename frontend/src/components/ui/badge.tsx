import { cn } from "@/lib/utils";

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  Available: { bg: "var(--success-soft)", text: "var(--success)", border: "color-mix(in srgb, var(--success) 25%, transparent)" },
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
