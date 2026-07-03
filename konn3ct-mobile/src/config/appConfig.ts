/**
 * Central app configuration loaded from environment variables.
 *
 * All feature flags default to `true` (full-feature Konn3ct mode).
 * Set individual flags to 'false' in .env to disable features
 * (e.g. for the Gov1 Meeting build).
 */

export const APP_CONFIG = {
  /** Display name of the app — used in UI text (biometric prompts, headings, etc.) */
  APP_NAME: process.env.EXPO_PUBLIC_APP_NAME || 'Konn3ct',

  /** When true, show the Addons tab. When false, show the Events tab instead. */
  SHOW_ADDONS_TAB: process.env.EXPO_PUBLIC_SHOW_ADDONS_TAB !== 'false',

  /** When true, show the AI Intelligence section on the Dashboard. */
  SHOW_AI_INTELLIGENCE: process.env.EXPO_PUBLIC_SHOW_AI !== 'false',

  /** When true, show the Payments item in the More screen grid. */
  SHOW_PAYMENTS: process.env.EXPO_PUBLIC_SHOW_PAYMENTS !== 'false',

  /** When true, show the Premium Promo / "Ready to do more?" card on the Dashboard. */
  SHOW_PREMIUM_PROMO: process.env.EXPO_PUBLIC_SHOW_PREMIUM_PROMO !== 'false',

  /** When true, show the notification bell icon in screen headers. */
  SHOW_NOTIFICATIONS: process.env.EXPO_PUBLIC_SHOW_NOTIFICATIONS !== 'false',

  /** When true, show the headset/help icon in screen headers. */
  SHOW_HELP_ICON: process.env.EXPO_PUBLIC_SHOW_HELP_ICON !== 'false',

  /** When true, skip email verification after signup and go straight to login. */
  SKIP_EMAIL_VERIFY: process.env.EXPO_PUBLIC_SKIP_EMAIL_VERIFY === 'true',

  /** When true, show the signup link on the login screen. */
  SHOW_SIGNUP_LINK: process.env.EXPO_PUBLIC_SHOW_SIGNUP !== 'false',

  /** When true, show the forgot password link on the login screen. */
  SHOW_FORGOT_PASSWORD: process.env.EXPO_PUBLIC_SHOW_FORGOT_PASSWORD !== 'false',

  /** When true, use the 1Gov login endpoint (/1gov/login) with tenantId + username + password. */
  GOV_LOGIN: process.env.EXPO_PUBLIC_GOV_LOGIN === 'true',
};

/** Logo image sources — React Native requires static require() calls */
const LOGOS: Record<string, any> = {
  konn3ct: require('../../assets/konn3ct_logo.png'),
  gov1: require('../../assets/conference_logo.webp'),
};

/** The app logo to use, driven by EXPO_PUBLIC_APP_LOGO env var ('konn3ct' or 'gov1') */
export const APP_LOGO = LOGOS[process.env.EXPO_PUBLIC_APP_LOGO || 'konn3ct'] || LOGOS.konn3ct;
