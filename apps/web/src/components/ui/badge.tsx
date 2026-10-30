import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/helpers";
import { HTMLAttributes } from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-spruce-300 dark:border-spruce-700 bg-spruce-100 dark:bg-spruce-800 text-spruce-900 dark:text-spruce-100 shadow-2xs",
        secondary:
          "border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 shadow-2xs",
        destructive:
          "border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-bold uppercase tracking-wider text-[11px] shadow-2xs",
        outline:
          "border-spruce-300 dark:border-spruce-700 bg-spruce-50/80 dark:bg-spruce-900/60 text-spruce-700 dark:text-spruce-300",
        success:
          "border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold shadow-2xs",
        warning:
          "border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-semibold shadow-2xs",
        info: "border-sky-300 dark:border-sky-700/60 bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-semibold shadow-2xs",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
