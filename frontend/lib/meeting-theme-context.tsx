"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export type MeetingTheme = "midnight" | "soft" | "slate" | "sage";

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
 * Inspired by Zoom / Google Meet / Microsoft Teams — neutral backgrounds,
 * brand-green accent only on interactive elements.
 *
 * - "midnight" = neutral charcoal (like Zoom) — DEFAULT
 * - "soft"     = warm off-white with subtle depth (like Notion / Linear light)
 * - "slate"    = cool blue-gray premium dark (like VS Code / Discord)
 */
const themeTokens: Record<MeetingTheme, Record<string, string>> = {
  sage: {
    /* Soft sage green — inspired by modern video-call UI with warm white bg and muted green tiles */
    "--mt-bg":              "#F2F5F2",
    "--mt-bg-elevated":     "#FFFFFF",
    "--mt-bg-tile":         "#9DB8A3",
    "--mt-bg-tile-alt":     "#8EAD96",
    "--mt-bg-tile-alt2":    "#A7BFAd",
    "--mt-bg-tile-camera":  "#92AC99",
    "--mt-bg-hover":        "rgba(0,0,0,0.05)",
    "--mt-bg-active":       "rgba(32,116,80,0.14)",
    "--mt-bg-control":      "rgba(0,0,0,0.07)",
    "--mt-bg-control-hover":"rgba(0,0,0,0.12)",
    "--mt-bg-input":        "#FFFFFF",
    "--mt-bg-screen":       "#D8E4DA",
    "--mt-bg-screen-content":"#FFFFFF",
    "--mt-bg-screen-grad1": "#E4EDE6",
    "--mt-bg-screen-grad2": "#D4E0D6",
    "--mt-border":          "rgba(0,0,0,0.10)",
    "--mt-border-strong":   "rgba(0,0,0,0.18)",
    "--mt-text":            "#1A2B1F",
    "--mt-text-secondary":  "#2E4035",
    "--mt-text-muted":      "#566B5C",
    "--mt-text-faint":      "#8BA090",
    "--mt-text-ghost":      "#B8CCBF",
    "--mt-text-whisper":    "#D8E4DA",
    "--mt-ring-offset":     "#F2F5F2",
    "--mt-overlay":         "rgba(0,0,0,0.32)",
    "--mt-dialog-bg":       "#FFFFFF",
    "--mt-reaction-picker": "rgba(255,255,255,0.97)",
    "--mt-option-bg":       "#FFFFFF",
    "--mt-scrollbar-thumb": "rgba(0,0,0,0.15)",
    "--mt-scrollbar-track": "transparent",
    "--mt-shadow":          "0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.05)",
    "--mt-control-bar":     "#FFFFFF",
    "--mt-control-pill":    "rgba(0,0,0,0.05)",
    "--mt-tile-overlay":    "rgba(0,0,0,0.45)",
    "--mt-is-dark":         "0",
    /* Sage-specific: avatar circle background inside a tile */
    "--mt-avatar-bg":       "#7A9E86",
    "--mt-avatar-text":     "#FFFFFF",
  },
  midnight: {
    /* Neutral charcoal — Zoom / Teams inspired */
    "--mt-bg":              "#18181B",
    "--mt-bg-elevated":     "#1F1F23",
    "--mt-bg-tile":         "#27272A",
    "--mt-bg-tile-alt":     "#2C2C31",
    "--mt-bg-tile-alt2":    "#313136",
    "--mt-bg-tile-camera":  "#232328",
    "--mt-bg-hover":        "rgba(255,255,255,0.06)",
    "--mt-bg-active":       "rgba(255,255,255,0.12)",
    "--mt-bg-control":      "rgba(255,255,255,0.07)",
    "--mt-bg-control-hover":"rgba(255,255,255,0.12)",
    "--mt-bg-input":        "rgba(255,255,255,0.07)",
    "--mt-bg-screen":       "#141417",
    "--mt-bg-screen-content":"#1F1F23",
    "--mt-bg-screen-grad1": "#18181B",
    "--mt-bg-screen-grad2": "#141417",
    "--mt-border":          "rgba(255,255,255,0.08)",
    "--mt-border-strong":   "rgba(255,255,255,0.14)",
    "--mt-text":            "#FAFAFA",
    "--mt-text-secondary":  "rgba(255,255,255,0.82)",
    "--mt-text-muted":      "rgba(255,255,255,0.55)",
    "--mt-text-faint":      "rgba(255,255,255,0.35)",
    "--mt-text-ghost":      "rgba(255,255,255,0.20)",
    "--mt-text-whisper":    "rgba(255,255,255,0.08)",
    "--mt-ring-offset":     "#18181B",
    "--mt-overlay":         "rgba(0,0,0,0.60)",
    "--mt-dialog-bg":       "#27272A",
    "--mt-reaction-picker": "rgba(39,39,42,0.95)",
    "--mt-option-bg":       "#27272A",
    "--mt-scrollbar-thumb": "rgba(255,255,255,0.12)",
    "--mt-scrollbar-track": "transparent",
    "--mt-shadow":          "none",
    "--mt-control-bar":     "#141417",
    "--mt-control-pill":    "rgba(255,255,255,0.06)",
    "--mt-tile-overlay":    "rgba(0,0,0,0.65)",
    "--mt-is-dark":         "1",
    "--mt-avatar-bg":       "#3F3F46",
    "--mt-avatar-text":     "#FAFAFA",
  },
  soft: {
    /* Warm, high-contrast light — Google Meet / Figma light mode inspired */
    "--mt-bg":              "#F0EFE9",
    "--mt-bg-elevated":     "#FAFAF7",
    "--mt-bg-tile":         "#E3E2DC",
    "--mt-bg-tile-alt":     "#D6D5CF",
    "--mt-bg-tile-alt2":    "#CDCCC6",
    "--mt-bg-tile-camera":  "#DDDCD6",
    "--mt-bg-hover":        "rgba(0,0,0,0.05)",
    "--mt-bg-active":       "rgba(32,116,80,0.12)",
    "--mt-bg-control":      "rgba(0,0,0,0.06)",
    "--mt-bg-control-hover":"rgba(0,0,0,0.10)",
    "--mt-bg-input":        "#FAFAF7",
    "--mt-bg-screen":       "#E3E2DC",
    "--mt-bg-screen-content":"#FAFAF7",
    "--mt-bg-screen-grad1": "#E8E7E1",
    "--mt-bg-screen-grad2": "#E0DFD9",
    "--mt-border":          "#C8C7C1",
    "--mt-border-strong":   "#9E9D97",
    "--mt-text":            "#1C1C1A",
    "--mt-text-secondary":  "#3D3D3A",
    "--mt-text-muted":      "#6B6B66",
    "--mt-text-faint":      "#9E9D97",
    "--mt-text-ghost":      "#C8C7C1",
    "--mt-text-whisper":    "#E3E2DC",
    "--mt-ring-offset":     "#F0EFE9",
    "--mt-overlay":         "rgba(0,0,0,0.35)",
    "--mt-dialog-bg":       "#FAFAF7",
    "--mt-reaction-picker": "rgba(250,250,247,0.97)",
    "--mt-option-bg":       "#FAFAF7",
    "--mt-scrollbar-thumb": "rgba(0,0,0,0.18)",
    "--mt-scrollbar-track": "transparent",
    "--mt-shadow":          "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
    "--mt-control-bar":     "#FAFAF7",
    "--mt-control-pill":    "rgba(0,0,0,0.05)",
    "--mt-tile-overlay":    "rgba(0,0,0,0.50)",
    "--mt-is-dark":         "0",
    "--mt-avatar-bg":       "#C8C7C1",
    "--mt-avatar-text":     "#3D3D3A",
  },
  slate: {
    /* Cool blue-gray premium dark — VS Code / Discord inspired */
    "--mt-bg":              "#0F172A",
    "--mt-bg-elevated":     "#1E293B",
    "--mt-bg-tile":         "#1E293B",
    "--mt-bg-tile-alt":     "#283548",
    "--mt-bg-tile-alt2":    "#334155",
    "--mt-bg-tile-camera":  "#1A2536",
    "--mt-bg-hover":        "rgba(255,255,255,0.05)",
    "--mt-bg-active":       "rgba(255,255,255,0.12)",
    "--mt-bg-control":      "rgba(255,255,255,0.06)",
    "--mt-bg-control-hover":"rgba(255,255,255,0.10)",
    "--mt-bg-input":        "rgba(255,255,255,0.06)",
    "--mt-bg-screen":       "#0B1120",
    "--mt-bg-screen-content":"#1E293B",
    "--mt-bg-screen-grad1": "#0F172A",
    "--mt-bg-screen-grad2": "#0B1120",
    "--mt-border":          "rgba(255,255,255,0.07)",
    "--mt-border-strong":   "rgba(255,255,255,0.12)",
    "--mt-text":            "#F1F5F9",
    "--mt-text-secondary":  "rgba(241,245,249,0.82)",
    "--mt-text-muted":      "rgba(241,245,249,0.55)",
    "--mt-text-faint":      "rgba(241,245,249,0.35)",
    "--mt-text-ghost":      "rgba(241,245,249,0.20)",
    "--mt-text-whisper":    "rgba(241,245,249,0.08)",
    "--mt-ring-offset":     "#0F172A",
    "--mt-overlay":         "rgba(0,0,0,0.55)",
    "--mt-dialog-bg":       "#1E293B",
    "--mt-reaction-picker": "rgba(30,41,59,0.95)",
    "--mt-option-bg":       "#1E293B",
    "--mt-scrollbar-thumb": "rgba(255,255,255,0.10)",
    "--mt-scrollbar-track": "transparent",
    "--mt-shadow":          "none",
    "--mt-control-bar":     "#0B1120",
    "--mt-control-pill":    "rgba(255,255,255,0.05)",
    "--mt-tile-overlay":    "rgba(0,0,0,0.60)",
    "--mt-is-dark":         "1",
    "--mt-avatar-bg":       "#283548",
    "--mt-avatar-text":     "#F1F5F9",
  },
};

export function MeetingThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<MeetingTheme>("sage");

  const setTheme = useCallback((t: MeetingTheme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const order: MeetingTheme[] = ["sage", "midnight", "soft", "slate"];
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
