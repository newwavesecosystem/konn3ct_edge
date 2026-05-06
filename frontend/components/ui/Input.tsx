import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional icon to render at the left side of the input */
  leftIcon?: React.ReactNode;
  /** Optional icon to render at the right side of the input */
  rightIcon?: React.ReactNode;
  /** When true, shows error styling */
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", leftIcon, rightIcon, error = false, ...props }, ref) => {
    return (
      <div
        className={cn(
          "group flex items-center w-full rounded-xl border bg-input transition-all duration-200",
          "hover:border-brand-green/40",
          "focus-within:bg-surface focus-within:border-brand-green focus-within:shadow-[0_0_0_4px_rgba(32,116,80,0.1)]",
          error 
            ? "border-danger focus-within:border-danger focus-within:shadow-[0_0_0_4px_rgba(204,80,92,0.1)]" 
            : "border-border",
          className
        )}
      >
        {leftIcon && (
          <div className="pl-4 pr-2 text-text-muted group-focus-within:text-brand-green transition-colors flex items-center justify-center">
            {leftIcon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex-1 h-12 w-full bg-transparent px-4 py-2 text-[15px] text-text-primary placeholder:text-text-muted/70 outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            leftIcon && "pl-2",
            rightIcon && "pr-2"
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <div className="pr-4 pl-2 text-text-muted flex items-center justify-center">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };

