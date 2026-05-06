// ── Public / Marketing ─────────────────────────────────
export const ROUTES = {
  home: "/",
  features: "/features",
  pricing: "/pricing",
  contact: "/contact",

  // Auth
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",

  // Dashboard
  dashboard: "/dashboard",
  rooms: "/dashboard/rooms",
  roomNew: "/dashboard/rooms/new",
  room: (id: string) => `/dashboard/rooms/${id}`,
  teams: "/dashboard/teams",
  schedule: "/dashboard/schedule",
  recordings: "/dashboard/recordings",
  recording: (id: string) => `/dashboard/recordings/${id}`,
  billing: "/dashboard/billing",
  settings: "/dashboard/settings",

  // Meeting
  join: (token: string) => `/join/${token}`,
  meeting: (roomId: string) => `/meeting/${roomId}`,

  // Public recordings
  publicRecording: (id: string) => `/recordings/public/${id}`,
} as const;
