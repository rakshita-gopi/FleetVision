import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variants = {
      primary: "text-white hover:opacity-90 shadow-sm",
      secondary: "bg-[var(--muted-bg)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--hover)]",
      ghost: "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--foreground)]",
      danger: "bg-[var(--danger)] text-white hover:opacity-90",
      outline: "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--hover)]",
    };
    const sizes = {
      sm: "px-3 py-1.5 text-xs rounded-lg",
      md: "px-4 py-2 text-sm rounded-xl",
      lg: "px-6 py-3 text-base rounded-xl",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className
        )}
        style={variant === "primary" ? { background: "var(--primary)" } : undefined}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
export { Button };
