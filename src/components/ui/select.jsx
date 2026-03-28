import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "../../lib/utils";

// Context so child components can access Select state
const SelectContext = React.createContext();

export function Select({ value, onValueChange, children }) {
  const [open, setOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative inline-block w-full">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children }) {
  const { open, setOpen } = React.useContext(SelectContext);

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground shadow-sm transition-colors duration-300 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      )}
    >
      {children}
      <ChevronDown
        className={cn(
          "ml-2 h-4 w-4 shrink-0 transition-transform duration-300",
          open && "rotate-180"
        )}
      />
    </button>
  );
}

export function SelectValue({ placeholder }) {
  const { value } = React.useContext(SelectContext);

  return (
    <span className="truncate text-foreground">
      {value || <span className="text-muted-foreground">{placeholder}</span>}
    </span>
  );
}

export function SelectContent({ children }) {
  const { open } = React.useContext(SelectContext);

  if (!open) return null;

  return (
    <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg">
      {children}
    </div>
  );
}

export function SelectItem({ value, children }) {
  const { onValueChange, setOpen } = React.useContext(SelectContext);

  return (
    <div
      className="cursor-pointer rounded-sm px-3 py-2 text-sm transition-colors duration-300 hover:bg-accent hover:text-accent-foreground"
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
    >
      {children}
    </div>
  );
}
