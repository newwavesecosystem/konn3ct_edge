import React, { useState } from "react";

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
      className="w-full border rounded-md px-3 py-2 text-left flex justify-between items-center bg-white shadow-sm"
    >
      {children}
      <span className="ml-2">{open ? "▲" : "▼"}</span>
    </button>
  );
}

export function SelectValue({ placeholder }) {
  const { value } = React.useContext(SelectContext);

  return (
    <span className="text-gray-700">
      {value || <span className="text-gray-400">{placeholder}</span>}
    </span>
  );
}

export function SelectContent({ children }) {
  const { open } = React.useContext(SelectContext);

  if (!open) return null;

  return (
    <div className="absolute mt-1 w-full bg-white border rounded-md shadow-lg z-10">
      {children}
    </div>
  );
}

export function SelectItem({ value, children }) {
  const { onValueChange, setOpen } = React.useContext(SelectContext);

  return (
    <div
      className="px-3 py-2 cursor-pointer hover:bg-gray-100"
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
    >
      {children}
    </div>
  );
}
