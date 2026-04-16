# Konn3ct Dashboard Frontend

This repository contains the React frontend for the Konn3ct dashboard. It is a Create React App single-page application that provides public authentication and meeting-join screens plus an authenticated dashboard for managing rooms, streaming, recordings, billing, donations, attendance, and event pre-registration.

This repo is frontend-only. It depends on external Konn3ct APIs and related third-party services for authentication, payments, social login, AI-generated attendance insights, and media playback/downloads.

## What the application does

- Authenticates users with email/password and social providers.
- Lets authenticated users create, manage, start, and share meeting rooms.
- Supports meeting invite scheduling and invite history.
- Starts and stops livestreams for YouTube, Facebook, and combo streaming.
- Lists recordings and exposes playback, download, copy-link, and delete actions.
- Shows plans, payments, receipts, and paid add-ons using Paystack checkout.
- Handles donation onboarding with individual and business KYC flows.
- Displays attendance data and calls an external AI service for meeting minutes, highlights, and summaries.
- Manages pre-registration events and participant exports/reminders.
- Provides profile editing, password change, and browser session management.
- Supports light, dark, and system theme preferences from the Settings screen.

## Stack and architecture

- Framework: React 18 with Create React App (`react-scripts`).
- Routing: `react-router-dom` with a browser router and nested authenticated layout.
- Data fetching/state: `@tanstack/react-query`.
- HTTP client: `axios` with a shared API client that attaches a bearer token from `localStorage`.
- UI: Tailwind CSS, Radix UI primitives, and shadcn-style component scaffolding.
- Forms/validation: `react-hook-form` and `zod`.
- Theme system: `ThemeProvider` + `useTheme`, persisted in `localStorage` and resolved against system color-scheme preferences.
- Integrations:
  - Google OAuth
  - Facebook SDK login
  - Apple login
  - Paystack payments
  - External AI attendance service
  - Google Analytics snippet in `public/index.html`
- Resilience layer: global error boundary, offline guard, route-level fallback screens.
- Styling mode: Tailwind uses class-based dark mode, and `public/index.html` applies the saved theme before React mounts to reduce flash on load.

At startup, `src/index.js` wires together:

- `ThemeProvider`
- `GoogleOAuthProvider`
- `QueryClientProvider`
- `AuthProvider`
- `GlobalErrorBoundary`
- `GlobalNetworkGuard`
- the app router and toaster

The authenticated portion of the app is gated by `IsAuthenticated`, which checks the auth context populated from `localStorage`. API requests use the shared Axios instance in `src/api/index.js`, which adds `Authorization: Bearer <token>` when a token exists.

## Main feature areas

### Public routes

- `/login`: email/password login plus Google, Facebook, Apple, and a placeholder SSO entry.
- `/register`: email/password registration plus social sign-in entry points.
- `/forgot-password`: request reset code and submit a new password.
- `/join`: join a room by room name or room ID.

### Authenticated routes

- `/`: dashboard overview with profile summary, room statistics, quick actions, and upcoming meetings.
- `/rooms`: create rooms, delete rooms, start meetings, copy meeting links, manage access code, limit users, upload banners, transfer rooms, and schedule invites.
- `/streams`: start/stop livestreams and review stream history.
- `/recordings`: browse, search, filter, play, copy, download, and delete recordings.
- `/payments`: inspect current plan, payment history, receipts, and change/renew plans.
- `/addons`: buy add-on services through Paystack and inspect their activation status.
- `/referees`: list referees/referrals.
- `/donations`: complete KYC and access the donations dashboard.
- `/attendance`: list meetings with attendance data.
- `/attendance-details/:meeting_id/:identifier`: inspect meeting attendance, export data, print it, and request AI-generated minutes/highlights/summary.
- `/events/*`: manage pre-registration events and participant lists.
- `/history`: invite history plus resend/send invite flows.
- `/profile`: profile information, password update, and browser sessions.
- `/settings`: working appearance controls for light/dark/system theme selection and placeholder tabs for other future settings sections.

## Project structure

```text
.
|- public/                  Static HTML and public assets
|- src/
|  |- api/                  API client and feature-specific request modules
|  |- assets/               Logos, icons, and React icon components
|  |- components/           Shared app components and UI primitives
|  |  `- ui/                shadcn/Radix-based UI layer + resilience helpers
|  |- hooks/                Auth, toast, mobile, and Facebook SDK hooks
|  |- lib/                  Route guard and small utility helpers
|  |- providers/            Cross-cutting React providers such as theming
|  `- pages/                Route screens and feature flows
|     |- auth/              Login, register, forgot password, auth-side copy
|     `- profile/           Profile, password, and session screens
|- Dockerfile               Multi-stage frontend build + nginx image
|- default.conf             nginx SPA routing config
|- tailwind.config.js       Tailwind theme configuration
|- components.json          shadcn/ui component config
`- jsconfig.json            Base path alias config (`@/*`)
```

## API modules

`src/api/` is organized by feature:

- `authService.js`: login, social login, registration
- `userApi.js`: profile, password, session management
- `roomsApi.js`: rooms, meetings, access code, limits, banners, transfer, join
- `streamApi.js`: stream list, start, combo start, stop
- `recordingApi.js`: recordings list and delete
- `plansApi.js`: plans and payment history
- `addonsApi.js`: add-on list
- `invitesApi.js`: invite list, resend, create
- `attendanceApi.js`: attendance list/details and AI summary/minutes/highlights
- `eventsApi.js`: pre-registration events, summary, participants, reminders
- `donationApi.js`: bank lookup, bank verification, KYC, donations, donation stats
- `refereeApi.js`: referees list
- `forgetpassword.js`: forgot-password request/reset

## Environment configuration

Create or update a root `.env` file before running or building the app. Because this project uses Create React App, `REACT_APP_*` values are compiled into the frontend at build time.

```env
REACT_APP_BASE_URL=
REACT_APP_BASE_BACKENED_URL=
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
```

What each variable is used for:

- `REACT_APP_BASE_URL`: primary backend API base URL used by the shared Axios client.
- `REACT_APP_BASE_BACKENED_URL`: base URL used when building public join links in the rooms UI.
- `REACT_APP_API_BOT`: AI service used for attendance summaries, minutes, and highlights.
- `REACT_APP_CLIENT_ID`: Google OAuth client ID.
- `REACT_APP_PAYSTACK_KEY`: Paystack public key used in plan and add-on checkout.
- `REACT_APP_PLAYBACK_URL`: recording playback base URL.
- `REACT_APP_FACEBOOK_APP_ID`: Facebook SDK app ID.
- `REACT_APP_APPLE_CLIENT_ID`: Apple sign-in client ID.
- `REACT_APP_APPLE_REDIRECT_URI`: Apple sign-in redirect URL.
- `REACT_APP_LANDING_URL`: marketing-site base URL used by navbar links.
- `REACT_APP_RECORDING_DOWNLOAD_BASE`: base URL for recording asset downloads.
- `REACT_APP_VIDEO_DOWNLOAD_BASE`: base URL for webcam video downloads.

Important notes:

- The code reads `REACT_APP_BASE_BACKENED_URL` with that exact spelling. Keep the existing key unless the code is changed.
- The checked-in `.env` currently includes a `REACT_APP_FACEBOOK_APP_SECRET` entry. That secret is not used by the frontend code and should not live in a client-side env file.
- Since CRA injects env values at build time, Docker builds and production builds must have the correct env values available before `npm run build`.

## Local development

### Prerequisites

- Node.js 22 is the safest baseline because the Docker build uses `node:22-alpine`.
- npm

### Install and start

```bash
npm install
npm start
```

The CRA dev server runs at `http://localhost:3000` by default.

### Other available scripts

```bash
npm run build
npm test
```

Notes:

- `npm run build` outputs a production bundle to `build/`.
- `npm test` is available because the project uses CRA, but there are currently no test files in the repository.

## Deployment

This repo includes a production Docker setup:

- Stage 1: build the CRA app with Node 22 Alpine.
- Stage 2: copy the generated `build/` output into nginx.
- `default.conf` enables SPA routing with `try_files $uri $uri/ /index.html;`.

### Build and run with Docker

```bash
docker build -t konn3ct-dashboard .
docker run --rm -p 8080:80 konn3ct-dashboard
```

The container serves the app on port `80`, so the example above exposes it on `http://localhost:8080`.

You can also deploy the compiled `build/` directory behind any static host or reverse proxy that supports an SPA fallback to `index.html`.

## Feature flow notes

### Authentication flow

- Login/register uses the auth context in `src/hooks/useAuth.jsx`.
- Successful login stores both `user` and `token` in `localStorage`.
- Protected pages rely on that stored state and the shared API interceptor.

### Theme and settings flow

- Theme state is provided globally by `src/providers/ThemeProvider.jsx`.
- The selected theme is stored in `localStorage` under `theme`.
- `system` mode follows `prefers-color-scheme`, and the resolved theme updates the document class and browser theme color.
- The Settings screen currently exposes appearance controls; the other settings tabs are still scaffolding for future work.

### Room and invite flow

- Room management lives in `Rooms.jsx`.
- Scheduled meeting invitations are created through the reusable `MeetingForm` exported from `InviteHistory.jsx`.
- The dashboard reuses the same invite form modal for quick scheduling.

### Attendance and AI flow

- Attendance list data comes from the backend via `attendanceApi.js`.
- Detailed attendance exports are generated client-side in the browser.
- Meeting minutes, highlights, and summary are fetched from a separate AI endpoint defined by `REACT_APP_API_BOT`.

### Donations flow

- The donations page first checks KYC status.
- Verified users see a donation dashboard.
- Unverified users are routed into individual or corporate KYC forms.

### Events flow

- Events are pre-registration events tied to rooms.
- Users can create free or paid events, view participant lists, export participant data, and send reminders.

## Important caveats discovered during audit

- This repository does not contain the backend. All business data, auth validation, payments, and media operations depend on external services.
- `src/pages/Settings.jsx` now implements appearance and language settings, but the Meeting, Recording, Audio Conference, White Board, and Scheduling tabs are still placeholders.
- `src/pages/AttendanceUpgrade.jsx` exists but is not part of the active route flow.
- `src/components/PricingCard.jsx` exists but is not used by the current payments UI.
- `src/pages/JoinRoom.jsx` hardcodes the post-join meeting URL host as `https://k4.konn3ct.ng/` instead of reading it from configuration.
- Event participant routing is partially inconsistent: one route path uses `:reference`, while the nested events route defines `:id`, but `EventParticipants` reads `reference`.
- The repository currently tracks `.env`, including sensitive-looking values. Those values should be removed from version control and rotated if they are real.
- Social login is only partially symmetrical across providers. For example, the SSO option is a UI placeholder that only shows an error toast.
- `public/index.html` includes a legacy Google Analytics UA snippet, the Apple sign-in script, and a pre-hydration theme bootstrap script directly in the document.

## Summary

Konn3ct Dashboard Frontend is a React SPA for managing Konn3ct user operations after sign-in: meetings, livestreams, recordings, plan billing, add-ons, donations/KYC, attendance insights, invites, events, and user profile data. The source is organized primarily by feature pages and API modules, and production deployment is handled as a static SPA served by nginx.
