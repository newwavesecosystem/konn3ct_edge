// ── Brand ──────────────────────────────────────────────
export const APP_NAME = "konn3ct";
export const APP_TAGLINE = "Where Teams Connect, Collaborate & Create";
export const APP_DESCRIPTION =
  "Premium video conferencing, webinars, recordings, and collaboration — built for modern teams.";

// ── API ────────────────────────────────────────────────
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// ── Plans ──────────────────────────────────────────────
export const PLAN_NAMES = ["Starter", "Pro", "Business", "Enterprise"] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

// ── Meeting defaults ───────────────────────────────────
export const MAX_PARTICIPANTS_DEFAULT = 100;
export const MAX_WEBINAR_AUDIENCE = 1000;
