"use client";

import { ReactNode } from "react";

interface DataTableProps {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }[];
  data: Record<string, unknown>[];
  loading?: boolean;
  actions?: (row: Record<string, unknown>) => ReactNode;
}

export function DataTable({ columns, data, loading, actions }: DataTableProps) {
  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-8">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-[var(--muted-bg)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <p className="text-[var(--muted)]">No data available</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {columns.map((col) => (
                <th key={col.key} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {col.label}
                </th>
              ))}
              {actions && <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--hover)] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-6 py-4 text-sm text-[var(--foreground)]">
                    {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                  </td>
                ))}
                {actions && <td className="px-6 py-4 text-right">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
