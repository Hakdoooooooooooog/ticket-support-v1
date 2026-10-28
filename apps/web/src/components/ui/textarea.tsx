import * as React from "react";
import { cn } from "@lib/helpers";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-spruce-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-spruce-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-spruce-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-spruce-700/80 dark:bg-spruce-900/60 dark:text-spruce-50 dark:placeholder:text-spruce-500 dark:focus-visible:ring-spruce-300",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
