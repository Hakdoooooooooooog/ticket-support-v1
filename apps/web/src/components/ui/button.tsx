import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/helpers";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spruce-400/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-spruce-700 text-white shadow-xs hover:bg-spruce-800 border border-spruce-800/40 active:scale-[0.99] font-semibold dark:bg-spruce-300 dark:text-spruce-950 dark:hover:bg-spruce-200 dark:font-bold dark:shadow-[0_2px_14px_rgba(158,200,185,0.25)] dark:border dark:border-spruce-200/50",
        destructive:
          "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:scale-[0.99] dark:bg-rose-900/80 dark:text-rose-100 dark:hover:bg-rose-800 dark:border dark:border-rose-700/50",
        outline:
          "border border-spruce-300/80 bg-white text-spruce-800 shadow-sm hover:bg-spruce-100 hover:text-spruce-950 dark:border-spruce-700/80 dark:bg-spruce-950/60 dark:text-spruce-200 dark:hover:bg-spruce-800/90 dark:hover:text-white",
        secondary:
          "bg-spruce-100 text-spruce-900 shadow-sm hover:bg-spruce-200/80 dark:bg-spruce-800/80 dark:text-spruce-100 dark:hover:bg-spruce-700 dark:border dark:border-spruce-700/60",
        ghost:
          "text-spruce-800 hover:bg-spruce-100 hover:text-spruce-950 dark:text-spruce-300 dark:hover:bg-spruce-800/70 dark:hover:text-white",
        link: "text-spruce-700 underline-offset-4 hover:underline dark:text-spruce-300 font-medium",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
