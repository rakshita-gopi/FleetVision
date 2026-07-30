"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
}

/** Adapted from React Bits GradientText. https://reactbits.dev/ */
export default function GradientText({
  children,
  className = "",
  colors = ["#b45309", "#d4a017", "#f5c518", "#d4a017", "#b45309"],
}: GradientTextProps) {
  return (
    <span
      className={cn(
        "inline-block bg-clip-text text-transparent animate-[gradient-shift_6s_ease_infinite]",
        className
      )}
      style={{
        backgroundImage: `linear-gradient(90deg, ${colors.join(", ")})`,
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
      }}
    >
      {children}
    </span>
  );
}
