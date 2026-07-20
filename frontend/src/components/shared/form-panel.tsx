"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface FormPanelProps {
  title: string;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  children: ReactNode;
}

export function FormPanel({ title, onSubmit, onCancel, submitLabel = "Save", children }: FormPanelProps) {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{children}</div>
      <div className="flex gap-3">
        <Button onClick={onSubmit}>{submitLabel}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[var(--muted)] mb-1 block">{label}</label>
      {children}
    </div>
  );
}
