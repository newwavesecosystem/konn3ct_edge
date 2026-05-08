"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type MeetingTheme = "emerald" | "konn3ct" | "dark";

interface MeetingThemeContextValue {
  theme: MeetingTheme;
  setTheme: (theme: MeetingTheme) => void;
  toggleTheme: () => void;
}

const MeetingThemeContext = createContext<MeetingThemeContextValue | null>(null);

export function useMeetingTheme() {
  const ctx = useContext(MeetingThemeContext);
  if (!ctx) throw new Error("useMeetingTheme must be used within MeetingThemeProvider");
  return ctx;
}

/**
 * Theme tokens for the meeting UI.
 * - "emerald" = rich green backgrounds with white text — the default (green/white inverted)
 * - "konn3ct" = light theme matching the dashboard / landing page brand
 * - "dark"    = the cinematic dark theme option
 */
const themeTokens: Record<MeetingTheme, Record<string, string>> = {
  emerald: {
    /* Deep green backgrounds, white text — brand-green inverted */
    "--mt-bg":              "#0B2B1E",
    "--mt-bg-elevated":     "#0F3527",
    "--mt-bg-tile":         "#14412F",
    "--mt-bg-tile-alt":     "#184D38",
    "--mt-bg-tile-alt2":    "#1C5940",
    "--mt-bg-tile-camera":  "#143E2D",
    "--mt-bg-hover":        "rgba(255,255,255,0.06)",
    "--mt-bg-active":       "rgba(255,255,255,0.15)",
    "--mt-bg-control":      "rgba(255,255,255,0.07)",
    "--mt-bg-control-hover":"rgba(255,255,255,0.12)",
    "--mt-bg-input":        "rgba(255,255,255,0.07)",
    "--mt-bg-screen":       "#091F15",
    "--mt-bg-screen-content":"#0F3024",
    "--mt-bg-screen-grad1": "#0C2A1C",
    "--mt-bg-screen-grad2": "#0B2518",
    "--mt-border":          "rgba(255,255,255,0.07)",
    "--mt-border-strong":   "rgba(255,255,255,0.12)",
    "--mt-text":            "#FFFFFF",
    "--mt-text-secondary":  "rgba(255,255,255,0.82)",
    "--mt-text-muted":      "rgba(255,255,255,0.55)",
    "--mt-text-faint":      "rgba(255,255,255,0.32)",
    "--mt-text-ghost":      "rgba(255,255,255,0.20)",
    "--mt-text-whisper":    "rgba(255,255,255,0.10)",
    "--mt-ring-offset":     "#0B2B1E",
    "--mt-overlay":         "rgba(0,0,0,0.55)",
    "--mt-dialog-bg":       "#14412F",
    "--mt-reaction-picker": "rgba(20,65,47,0.95)",
    "--mt-option-bg":       "#14412F",
    "--mt-scrollbar-thumb": "rgba(255,255,255,0.14)",
    "--mt-scrollbar-track": "transparent",
    "--mt-shadow":          "none",
  },
  konn3ct: {
    /* Matches dashboard/landing page: white surfaces, #FCFCFC page bg, brand greens & blues */
    "--mt-bg":              "#FCFCFC",
    "--mt-bg-elevated":     "#FFFFFF",
    "--mt-bg-tile":         "#F0F5F2",
    "--mt-bg-tile-alt":     "#E0ECE4",
    "--mt-bg-tile-alt2":    "#D5E5DA",
    "--mt-bg-tile-camera":  "#E8EFEB",
    "--mt-bg-hover":        "rgba(0,0,0,0.03)",
    "--mt-bg-active":       "rgba(32,116,80,0.12)",
    "--mt-bg-control":      "rgba(0,0,0,0.04)",
    "--mt-bg-control-hover":"rgba(0,0,0,0.07)",
    "--mt-bg-input":        "#F8F8F8",
    "--mt-bg-screen":       "#F0F3F1",
    "--mt-bg-screen-content":"#FFFFFF",
    "--mt-bg-screen-grad1": "#E8EFEB",
    "--mt-bg-screen-grad2": "#E0ECE4",
    "--mt-border":          "#D9D9D9",
    "--mt-border-strong":   "rgba(0,0,0,0.12)",
    "--mt-text":            "#000000",
    "--mt-text-secondary":  "#343030",
    "--mt-text-muted":      "#A0A0A0",
    "--mt-text-faint":      "rgba(0,0,0,0.30)",
    "--mt-text-ghost":      "rgba(0,0,0,0.20)",
    "--mt-text-whisper":    "rgba(0,0,0,0.08)",
    "--mt-ring-offset":     "#FCFCFC",
    "--mt-overlay":         "rgba(0,0,0,0.40)",
    "--mt-dialog-bg":       "#FFFFFF",
    "--mt-reaction-picker": "rgba(255,255,255,0.95)",
    "--mt-option-bg":       "#FFFFFF",
    "--mt-scrollbar-thumb": "rgba(32,116,80,0.25)",
    "--mt-scrollbar-track": "transparent",
    "--mt-shadow":          "0 2px 8px rgba(0,0,0,0.06)",
  },
  dark: {
    /* The original cinematic dark theme */
    "--mt-bg":              "#0d0d1a",
    "--mt-bg-elevated":     "#111128",
    "--mt-bg-tile":         "#1a1a2e",
    "--mt-bg-tile-alt":     "#1e293b",
    "--mt-bg-tile-alt2":    "#2d1f3d",
    "--mt-bg-tile-camera":  "#1a2a3a",
    "--mt-bg-hover":        "rgba(255,255,255,0.05)",
    "--mt-bg-active":       "rgba(255,255,255,0.15)",
    "--mt-bg-control":      "rgba(255,255,255,0.05)",
    "--mt-bg-control-hover":"rgba(255,255,255,0.10)",
    "--mt-bg-input":        "rgba(255,255,255,0.05)",
    "--mt-bg-screen":       "#0a0a18",
    "--mt-bg-screen-content":"#141428",
    "--mt-bg-screen-grad1": "#0e1525",
    "--mt-bg-screen-grad2": "#0e0e24",
    "--mt-border":          "rgba(255,255,255,0.05)",
    "--mt-border-strong":   "rgba(255,255,255,0.10)",
    "--mt-text":            "#ffffff",
    "--mt-text-secondary":  "rgba(255,255,255,0.80)",
    "--mt-text-muted":      "rgba(255,255,255,0.50)",
    "--mt-text-faint":      "rgba(255,255,255,0.30)",
    "--mt-text-ghost":      "rgba(255,255,255,0.20)",
    "--mt-text-whisper":    "rgba(255,255,255,0.10)",
    "--mt-ring-offset":     "#0d0d1a",
    "--mt-overlay":         "rgba(0,0,0,0.60)",
    "--mt-dialog-bg":       "#1a1a2e",
    "--mt-reaction-picker": "rgba(26,26,46,0.95)",
    "--mt-option-bg":       "#1a1a2e",
    "--mt-scrollbar-thumb": "rgba(255,255,255,0.10)",
    "--mt-scrollbar-track": "transparent",
    "--mt-shadow":          "none",
  },
};

export function MeetingThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<MeetingTheme>("emerald");

  const setTheme = useCallback((t: MeetingTheme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const order: MeetingTheme[] = ["emerald", "konn3ct", "dark"];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);

  // Apply CSS variables to the wrapper
  const tokens = themeTokens[theme];

  return (
    <MeetingThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div style={tokens as React.CSSProperties} className="contents">
        {children}
      </div>
    </MeetingThemeContext.Provider>
  );
}
