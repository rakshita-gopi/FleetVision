"use client";

import { Sidebar } from "./sidebar";
import { useAuth } from "@/contexts/auth-context";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-[var(--foreground)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--muted)]">Loading FleetVision...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <Sidebar />
      <main className="ml-64 min-h-screen transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
