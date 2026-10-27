import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/helpers";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-900 text-slate-50 shadow dark:bg-slate-100 dark:text-slate-900",
        secondary:
          "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
        destructive:
          "border-rose-500/40 bg-rose-500/15 text-rose-300 shadow-sm font-bold uppercase tracking-wider text-[11px]",
        outline: "border-slate-700 text-slate-300",
        success:
          "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-semibold shadow-sm",
        warning:
          "border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
