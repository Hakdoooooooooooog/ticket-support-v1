import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/helpers";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-spruce-400/40 bg-spruce-100 text-spruce-800 dark:bg-spruce-800/80 dark:text-spruce-200 dark:border-spruce-600/50 shadow-sm",
        secondary:
          "border-transparent bg-spruce-100/80 text-spruce-700 dark:bg-spruce-900/80 dark:text-spruce-300",
        destructive:
          "border-rose-500/40 bg-rose-500/15 text-rose-800 dark:text-rose-300 shadow-sm font-bold uppercase tracking-wider text-[11px]",
        outline: "border-spruce-300 text-spruce-700 dark:border-spruce-600 dark:text-spruce-300",
        success:
          "border-spruce-500/40 bg-spruce-500/15 text-spruce-800 dark:text-spruce-200 font-semibold shadow-sm",
        warning:
          "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold shadow-sm",
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
