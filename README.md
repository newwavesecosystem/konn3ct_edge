# Konn3ct Dashboard Frontend

Konn3ct Dashboard Frontend is the React single-page application that powers the browser dashboard for Konn3ct users. It covers authentication, rooms, livestreaming, recordings, plans and payments, add-ons, donations onboarding, attendance reporting, event pre-registration, and profile management.

## Latest Updates

The current codebase includes these recent product and architecture updates:

- Internationalization is now wired into the app runtime with `i18next`, `react-i18next`, browser language detection, and translation loading from `public/locales/{{lng}}/common.json`.
- The translation layer is actively used in the navbar, login, register, join-room, settings, attendance, rooms, payments, donations, events, and shared resilience UI.
- The app bootstrap now includes global resilience wrappers:
  - `GlobalErrorBoundary`
  - `GlobalNetworkGuard`
  - `RouteErrorFallback`
- Theme handling has been upgraded to support `light`, `dark`, and `system` modes through `ThemeProvider`, with live system-theme syncing and `meta[name="theme-color"]` updates.
- The settings page has been rebuilt around the new appearance controls and currently exposes the theme selector as the live settings surface.
- Registration now supports country-aware phone number entry and validation using `libphonenumber-js`.
- Registration also preserves referral codes from query params and session storage before passing normalized referral data to the backend.
- The public join-room screen has been made responsive and now builds the final meeting URL via `buildJoinMeetingUrl(sessionToken)`.
- The navbar has updated mobile behavior, translation support, and clearer separation between guest and authenticated actions.

## High-Level Scope

### Included in this repository

- Public auth and meeting-join screens
- Authenticated dashboard routes
- UI state, route protection, theming, and request orchestration
- Feature-specific API wrappers under `src/api/`
- Client-side export and print flows
- Static deployment config for Docker and nginx

### Handled externally

- Token issuance and backend authorization
- Business APIs for rooms, streams, recordings, plans, payments, donations, attendance, and events
- Google, Facebook, and Apple identity providers
- Paystack checkout
- Attendance AI summary/highlight/minutes generation
- Recording playback and asset delivery

## Runtime Architecture

### App bootstrap

`src/index.js` composes the live runtime in this order:

```text
ReactDOM.createRoot
|
+-- ThemeProvider
    |
    +-- GoogleOAuthProvider
        |
        +-- QueryClientProvider
            |
            +-- AuthProvider
                |
                +-- GlobalErrorBoundary
                    |
                    +-- GlobalNetworkGuard
                        |
                        +-- App
                        +-- Toaster
```

### Route structure

`src/App.js` uses `createBrowserRouter` and separates public routes from authenticated dashboard routes.

```text
/
|
+-- Public
|   +-- /login
|   +-- /register
|   +-- /forgot-password
|   +-- /join
|
+-- Protected via IsAuthenticated
    +-- /                      Dashboard
    +-- /profile
    +-- /rooms
    +-- /streams
    +-- /recordings
    +-- /payments
    +-- /addons
    +-- /referees
    +-- /donations
    +-- /attendance
    +-- /attendance-details/:meeting_id/:identifier
    +-- /events/*
    +-- /events/participants/:reference
    +-- /history
    +-- /settings
```

### Route and auth flow

```text
Browser request
      |
      v
createBrowserRouter route match
      |
      +--> Public route? --------------------> Render page directly
      |
      +--> Protected route
              |
              v
       IsAuthenticated
              |
              +--> user in localStorage -> AuthProvider hydrates user -> render layout
              |
              +--> no user and not loading -> navigate("/login")
```

## Core Data Flow

Most feature pages follow the same pattern:

```text
Page component in src/pages/
        |
        v
Feature API module in src/api/
        |
        v
Shared axios client (src/api/index.js)
        |
        +-- baseURL = REACT_APP_BASE_URL
        +-- Authorization: Bearer <token> from localStorage
        |
        v
Backend response
        |
        v
React Query cache or component state
        |
        v
Rendered dashboard UI
```

Attendance AI is a special case:

```text
Attendance details page
        |
        v
native fetch
        |
        v
REACT_APP_API_BOT
        |
        +-- /summary
        +-- /highlights
        +-- /minutes
```

## Current Feature Flows

### Authentication

- `AuthProvider` hydrates `user` from `localStorage`.
- Login and social login call `src/api/authService.js`.
- Successful auth stores both `user` and `token` in `localStorage`.
- Protected dashboard routes depend on `IsAuthenticated`.
- Google social login fetches user details from `REACT_APP_GOOGLE_USERINFO_URL` before calling the backend social-login endpoint.
- Apple and Facebook login rely on their respective SDK hooks.

### Registration

- `src/pages/auth/Register.jsx` validates passwords with Zod.
- Country codes and example numbers come from `libphonenumber-js`.
- Phone input is normalized to `+<country calling code><digits>` before submission.
- Referral codes are read from URL params, mirrored into storage, normalized, and sent as both `referral` and `ref` when present.

### Public join-room flow

```text
/join form
   |
   v
joinRoom(data)
   |
   +-- numeric roomName -----> POST /join-room   with { id, ...body }
   |
   +-- non-numeric roomName -> POST /kv4/join-room with { room, ...body }
   |
   v
sessionToken returned
   |
   v
buildJoinMeetingUrl(sessionToken)
   |
   v
window.open(meetingUrl, "_blank")
```

### Settings and theming

- `ThemeProvider` persists the selected theme in `localStorage`.
- `system` mode listens to `prefers-color-scheme`.
- The root document gets the `dark` class only when the resolved theme is dark.
- The settings screen currently exposes the appearance selector as the active settings experience.

### Rooms, streaming, recordings, payments, donations, attendance, and events

- Rooms are managed through `src/api/roomsApi.js`.
- Streaming uses feature-specific API modules and page-level React Query state.
- Recordings build playback/download URLs from env-driven base paths.
- Payments and add-ons integrate Paystack via the frontend public key.
- Donations branch between individual and business verification flows based on backend state.
- Attendance supports browser-side copy, CSV, Excel, print, and AI-generated meeting content.
- Events support creation, participant exports, and reminder triggers.

## Internationalization

The app now boots translation support from `src/i18n/index.js`.

- Backend loader path: `/locales/{{lng}}/common.json`
- Detection order:
  - query string
  - `localStorage`
  - browser navigator
  - `<html>` tag
- Language preference storage key: `konn3ct-language`
- Current supported language in code: `en`

Document language metadata is kept in sync:

- `document.documentElement.lang`
- `document.documentElement.dir`

## Project Structure

```text
.
|- public/
|  |- index.html
|  `- locales/
|     `- en/common.json
|- src/
|  |- api/                    Feature API wrappers
|  |- assets/                 Images, SVGs, icon components
|  |- components/
|  |  |- ui/                  Reusable UI primitives and resilience UI
|  |  `- Navbar.jsx           Top navigation
|  |- constants/
|  |  `- languages.js         i18n language metadata
|  |- hooks/                  Auth, theme, SDK, toast, mobile hooks
|  |- i18n/
|  |  `- index.js             i18next setup
|  |- lib/                    Route guard, env links, helpers
|  |- pages/                  Route-level pages
|  |- providers/
|  |  `- ThemeProvider.jsx
|  |- App.js                  Router and authenticated layout
|  `- index.js                Runtime bootstrap
|- Dockerfile
|- default.conf
|- package.json
`- README.md
```

## Environment Variables Used by the App

This is a Create React App project, so all `REACT_APP_*` values are compiled into the client bundle.

```env
REACT_APP_BASE_BACKENED_URL=
REACT_APP_BASE_URL=
REACT_APP_API_BOT=
REACT_APP_CLIENT_ID=
REACT_APP_PAYSTACK_KEY=
REACT_APP_PLAYBACK_URL=
REACT_APP_FACEBOOK_APP_ID=
REACT_APP_APPLE_CLIENT_ID=
REACT_APP_APPLE_REDIRECT_URI=
REACT_APP_LANDING_URL=
REACT_APP_RECORDING_DOWNLOAD_BASE=
REACT_APP_VIDEO_DOWNLOAD_BASE=
REACT_APP_SITE_URL=
REACT_APP_PRIVACY_POLICY_URL=
REACT_APP_OG_IMAGE_URL=
REACT_APP_FAVICON_URL=
REACT_APP_GOOGLE_FONTS_PRECONNECT_URL=
REACT_APP_GOOGLE_FONTS_STATIC_URL=
REACT_APP_GOOGLE_FONTS_STYLESHEET_URL=
REACT_APP_GOOGLE_ANALYTICS_SCRIPT_URL=
REACT_APP_GOOGLE_ANALYTICS_ID=
REACT_APP_APPLE_SIGNIN_SDK_URL=
REACT_APP_GOOGLE_USERINFO_URL=
REACT_APP_FACEBOOK_SDK_URL=
REACT_APP_JOIN_MEETING_URL=
REACT_APP_GETTING_STARTED_VIDEO_URL=
REACT_APP_CONTACT_SALES_URL=
```

Key notes:

- `REACT_APP_BASE_URL` drives the shared Axios client.
- `REACT_APP_JOIN_MEETING_URL` is required to open joined meetings.
- `REACT_APP_API_BOT` powers attendance summary, highlights, and minutes.
- `REACT_APP_BASE_BACKENED_URL` is still referenced with its current spelling.
- Values in `.env` are public in the final built bundle and must not be treated as secrets.

## Development

```bash
npm install
npm start
```

Other scripts:

```bash
npm run build
npm test
```

## Deployment

The repository ships with a multi-stage Docker build:

1. Build the frontend with `node:22-alpine`
2. Serve the static `build/` output with `nginx:1.13.9-alpine`

`default.conf` uses SPA fallback:

```nginx
try_files $uri $uri/ /index.html;
```

## Known Notes

- This is a frontend-only repository; business behavior depends on external services.
- The settings page currently exposes appearance controls only.
- The login SSO option is still a placeholder toast.
- `src/pages/AttendanceUpgrade.jsx` exists but is not routed.
- `socket.io-client` is installed but no active usage was found in the inspected runtime path.
- A checked-in `.env` file exists in the repository, and client-side env values should be treated as public.

## Summary

The current frontend is a React dashboard with a stronger runtime foundation than before: translation bootstrapping is in place, theme behavior is more complete, auth/public flows are better documented in code, and resilience wrappers now sit around the core application tree. This README has been updated to match that current architecture and to make the main runtime and request flows easier to understand at a glance.
