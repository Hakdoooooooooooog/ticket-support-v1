import * as React from "react";
import { cn } from "@lib/helpers";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-spruce-300/90 bg-white px-3.5 py-2 text-sm shadow-sm transition-all duration-150 placeholder:text-spruce-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spruce-500/20 focus-visible:border-spruce-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-spruce-700/80 dark:bg-spruce-950/70 dark:text-spruce-50 dark:placeholder:text-spruce-400/60 dark:shadow-inner dark:focus-visible:ring-spruce-300/30 dark:focus-visible:border-spruce-300",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
