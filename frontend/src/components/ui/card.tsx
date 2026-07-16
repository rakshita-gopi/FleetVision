import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("glass-card rounded-2xl p-6 transition-all duration-300", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-4", className)} {...props} />
);

const CardTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-lg font-semibold text-[var(--foreground)] tracking-tight", className)} {...props} />
);

const CardDescription = ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-[var(--muted)] mt-1", className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription };
