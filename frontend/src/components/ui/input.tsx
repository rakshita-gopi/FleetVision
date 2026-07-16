import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/20 focus:border-[var(--foreground)]/30 transition-all",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
export { Input };
