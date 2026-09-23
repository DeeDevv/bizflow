import React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:outline-brand-600",
  secondary:
    "border border-zinc-200 bg-surface text-zinc-700 hover:bg-zinc-50 focus-visible:outline-zinc-400",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-9.5 gap-2 rounded-lg px-4 text-sm",
};

/** Primary action button used across the dashboard. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
