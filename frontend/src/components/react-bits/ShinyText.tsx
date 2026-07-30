"use client";

import { cn } from "@/lib/utils";

interface ShinyTextProps {
  text: string;
  className?: string;
  speed?: number;
}

/** Adapted from React Bits ShinyText. https://reactbits.dev/ */
export default function ShinyText({ text, className = "", speed = 3 }: ShinyTextProps) {
  return (
    <span
      className={cn(
        "bg-clip-text text-transparent inline-block",
        className
      )}
      style={{
        backgroundImage:
          "linear-gradient(120deg, #78716c 0%, #78716c 35%, #fafaf9 50%, #78716c 65%, #78716c 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        animation: `shiny-text ${speed}s linear infinite`,
      }}
    >
      {text}
    </span>
  );
}
