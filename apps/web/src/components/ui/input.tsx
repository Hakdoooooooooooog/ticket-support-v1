import * as React from "react";
import { cn } from "@lib/helpers";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-spruce-300 bg-white px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-spruce-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-spruce-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-spruce-700/80 dark:bg-spruce-900/60 dark:text-spruce-50 dark:placeholder:text-spruce-500 dark:focus-visible:ring-spruce-300",
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
