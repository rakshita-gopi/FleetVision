"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const STORAGE_KEY = "rental-iq-agentic-mode";

interface AgenticModeContextValue {
  agenticMode: boolean;
  setAgenticMode: (on: boolean) => void;
  toggleAgenticMode: () => void;
}

const AgenticModeContext = createContext<AgenticModeContextValue | null>(null);

export function AgenticModeProvider({ children }: { children: ReactNode }) {
  const [agenticMode, setMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      setMode(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setAgenticMode = useCallback(
    (on: boolean) => {
      setMode(on);
      try {
        localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (on) {
        if (!pathname.startsWith("/agentic")) router.push("/agentic");
      } else if (pathname.startsWith("/agentic")) {
        router.push("/dashboard");
      }
    },
    [pathname, router]
  );

  const toggleAgenticMode = useCallback(() => {
    setAgenticMode(!agenticMode);
  }, [agenticMode, setAgenticMode]);

  const value = useMemo(
    () => ({ agenticMode: hydrated ? agenticMode : false, setAgenticMode, toggleAgenticMode }),
    [agenticMode, hydrated, setAgenticMode, toggleAgenticMode]
  );

  return <AgenticModeContext.Provider value={value}>{children}</AgenticModeContext.Provider>;
}

export function useAgenticMode() {
  const ctx = useContext(AgenticModeContext);
  if (!ctx) throw new Error("useAgenticMode must be used within AgenticModeProvider");
  return ctx;
}
