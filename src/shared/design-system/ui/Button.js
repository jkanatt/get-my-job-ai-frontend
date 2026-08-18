import React from "react";
import { cn } from "@/shared/utils/cn";

const buttonVariants = {
  default: "bg-white text-black hover:opacity-90 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.2)]",
  primary: "bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-base)] hover:opacity-90",
  destructive: "bg-red-500 text-white hover:bg-red-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.1)]",
  outline: "bg-transparent border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--text-primary)]",
  secondary: "bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
  ghost: "bg-transparent border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] shadow-none",
  neon: "bg-transparent border border-[var(--c-accent)] text-[var(--c-accent)] shadow-[0_0_8px_rgba(0,230,118,0.2)] hover:bg-[var(--c-accent-soft)] hover:shadow-[0_0_16px_rgba(0,230,118,0.4)]",
  invert: "bg-[var(--text-primary)] border-[var(--text-primary)] text-[var(--bg-base)] hover:bg-white"
};

const buttonSizes = {
  default: "h-9 px-4 py-2 text-[11px] gap-2",
  sm: "h-8 px-3 text-[10px] gap-1.5",
  lg: "h-11 px-6 text-[13px] gap-2.5",
  icon: "h-9 w-9 p-0 justify-center"
};

const Button = React.forwardRef(({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
  const Comp = asChild ? React.Fragment : "button";
  
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center font-sans font-extrabold uppercase tracking-[0.1em] rounded-none transition-all duration-150 whitespace-nowrap overflow-hidden backdrop-blur-md disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
