"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { useAuth } from "@/contexts/auth-context";
import { useAgenticMode } from "@/contexts/agentic-mode-context";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const { agenticMode } = useAgenticMode();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (agenticMode && !pathname.startsWith("/agentic")) {
      router.replace("/agentic");
    }
  }, [agenticMode, pathname, router, loading]);

  if (loading) {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-[var(--foreground)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--muted)]">Loading Rental-IQ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen">
      <Sidebar />
      <main className="ml-64 min-h-screen transition-all duration-300">{children}</main>
    </div>
  );
}
