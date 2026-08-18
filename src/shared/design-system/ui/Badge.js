import React from "react";
import { cn } from "@/shared/utils/cn";

const badgeVariants = {
  default: "bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-strong)]",
  primary: "bg-[var(--c-primary-soft)] text-[var(--c-primary)] border-[rgba(99,102,241,0.3)]",
  success: "bg-[var(--c-accent-soft)] text-[var(--c-accent)] border-[rgba(0,230,118,0.3)]",
  warning: "bg-[rgba(245,158,11,0.15)] text-[var(--c-warning)] border-[rgba(245,158,11,0.3)]",
  danger: "bg-[rgba(239,68,68,0.15)] text-[var(--c-danger)] border-[rgba(239,68,68,0.3)]",
  info: "bg-[rgba(59,130,246,0.15)] text-[var(--c-info)] border-[rgba(59,130,246,0.3)]"
};

function Badge({ className, variant = "default", ...props }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.05em] rounded-[2px] border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
