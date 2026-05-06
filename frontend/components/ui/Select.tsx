"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  className,
  id,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative w-full", className)} id={id}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex w-full items-center justify-between gap-3 h-11 rounded-xl border px-4 text-sm transition-all duration-200",
          "bg-black/[0.02] border-border/60",
          "hover:border-brand-green/40 hover:bg-surface",
          open
            ? "border-brand-green shadow-[0_0_0_4px_rgba(32,116,80,0.1)] bg-surface"
            : ""
        )}
      >
        <span className={cn("flex items-center gap-2 truncate", selected ? "text-text-primary" : "text-text-muted/70")}>
          {selected?.icon && <span className="shrink-0 text-text-muted">{selected.icon}</span>}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-text-muted transition-transform duration-200",
            open && "rotate-180 text-brand-green"
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute z-50 mt-2 w-full rounded-2xl border border-border/60 bg-surface shadow-xl shadow-black/10 overflow-hidden"
          >
            <div className="p-1.5 space-y-0.5 max-h-64 overflow-y-auto">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-all duration-150",
                      isSelected
                        ? "bg-brand-green/10 text-brand-green"
                        : "text-text-primary hover:bg-black/[0.04] hover:text-text-primary"
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {opt.icon && (
                        <span className={cn("shrink-0", isSelected ? "text-brand-green" : "text-text-muted")}>
                          {opt.icon}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block font-semibold truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="block text-xs text-text-muted mt-0.5 truncate">{opt.description}</span>
                        )}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-green" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
