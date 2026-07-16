"use client";

import { useTheme } from "@/contexts/theme-context";

export function AnimatedBackground({ variant = "auth" }: { variant?: "landing" | "auth" }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          background: isDark
            ? "radial-gradient(ellipse 80% 60% at 50% -10%, var(--glow-1), transparent), radial-gradient(ellipse 60% 50% at 100% 50%, var(--glow-2), transparent), radial-gradient(ellipse 50% 40% at 0% 80%, var(--glow-3), transparent), var(--background)"
            : "radial-gradient(ellipse 80% 60% at 50% -10%, var(--glow-1), transparent), radial-gradient(ellipse 60% 50% at 100% 50%, var(--glow-2), transparent), radial-gradient(ellipse 50% 40% at 0% 80%, var(--glow-3), transparent), var(--background)",
        }}
      />

      {/* Floating orbs */}
      <div
        className="absolute top-[15%] left-[10%] w-64 h-64 rounded-full blur-3xl animate-float opacity-60"
        style={{ background: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(37, 99, 235, 0.1)" }}
      />
      <div
        className="absolute top-[40%] right-[8%] w-48 h-48 rounded-full blur-3xl animate-float-reverse opacity-50"
        style={{ background: isDark ? "rgba(6, 182, 212, 0.12)" : "rgba(8, 145, 178, 0.08)" }}
      />
      <div
        className="absolute bottom-[20%] left-[25%] w-56 h-56 rounded-full blur-3xl animate-pulse-glow opacity-40"
        style={{ background: isDark ? "rgba(139, 92, 246, 0.1)" : "rgba(124, 58, 237, 0.07)" }}
      />

      {variant === "landing" && (
        <>
          <div
            className="absolute top-[60%] right-[30%] w-32 h-32 rounded-full blur-2xl animate-drift opacity-30"
            style={{ background: isDark ? "rgba(34, 197, 94, 0.1)" : "rgba(22, 163, 74, 0.08)" }}
          />
          <div
            className="absolute top-[25%] right-[45%] w-20 h-20 rounded-full blur-xl animate-float opacity-25"
            style={{ background: isDark ? "rgba(245, 158, 11, 0.1)" : "rgba(217, 119, 6, 0.08)" }}
          />
        </>
      )}

      {/* Subtle route lines for fleet theme */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04] dark:opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="routes" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M0 100 Q50 50 100 100 T200 100" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <path d="M100 0 Q150 50 100 100 T100 200" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#routes)" />
      </svg>
    </div>
  );
}
