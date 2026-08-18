import React from "react";
import { cn } from "@/shared/utils/cn";

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-100 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-sm px-3 py-2 text-[13px] font-sans text-[var(--text-primary)] shadow-sm transition-all duration-150 outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--text-muted)] focus:border-[var(--text-secondary)] focus:shadow-[inset_0_3px_6px_rgba(0,0,0,0.1)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
