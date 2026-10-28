import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/helpers";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-spruce-800 text-white shadow hover:bg-spruce-900 dark:bg-spruce-300 dark:text-spruce-950 dark:hover:bg-spruce-200 dark:font-semibold",
        destructive:
          "bg-rose-600 text-white shadow-sm hover:bg-rose-700 dark:bg-rose-900/80 dark:text-rose-100 dark:hover:bg-rose-800",
        outline:
          "border border-spruce-300/80 bg-white text-spruce-800 shadow-sm hover:bg-spruce-100 hover:text-spruce-950 dark:border-spruce-700/80 dark:bg-spruce-900/60 dark:text-spruce-200 dark:hover:bg-spruce-800",
        secondary:
          "bg-spruce-100 text-spruce-900 shadow-sm hover:bg-spruce-200/80 dark:bg-spruce-700/60 dark:text-spruce-100 dark:hover:bg-spruce-700",
        ghost:
          "text-spruce-800 hover:bg-spruce-100 hover:text-spruce-950 dark:text-spruce-300 dark:hover:bg-spruce-800/70 dark:hover:text-white",
        link: "text-spruce-700 underline-offset-4 hover:underline dark:text-spruce-300",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
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
