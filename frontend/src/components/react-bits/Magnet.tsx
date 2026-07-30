"use client";

import { cn } from "@/lib/utils";

interface MagnetProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Lightweight Magnet wrapper inspired by React Bits Magnet / MagneticButton.
 * https://reactbits.dev/
 */
export default function Magnet({ children, className }: MagnetProps) {
  return (
    <div
      className={cn(
        "transition-transform duration-300 ease-out will-change-transform hover:scale-[1.03] active:scale-[0.98]",
        className
      )}
    >
      {children}
    </div>
  );
}
