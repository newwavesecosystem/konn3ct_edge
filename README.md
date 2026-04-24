# Konn3ct Dashboard Frontend

## Project Overview

Konn3ct Dashboard Frontend is a React single-page application for authenticated Konn3ct users. It provides the browser-based operational dashboard for account access, room management, meeting scheduling, livestreaming, recordings, billing, add-ons, donations onboarding, attendance review, event pre-registration, and profile management.

From a business perspective, this repository is the customer-facing control panel for the Konn3ct platform. From a technical perspective, it is a Create React App frontend that consumes external Konn3ct APIs plus several third-party services for payments, social authentication, analytics, and media-related flows.

## System Scope

### Included in this repository

- Public authentication and meeting-join screens
- Authenticated dashboard routes and UI components
- Frontend state, routing, theming, and request orchestration
- Feature-specific API wrappers for Konn3ct backend endpoints
- Client-side exports, print flows, and receipt generation
- Docker and nginx configuration for static deployment

### Handled externally

- User authentication validation and token issuance
- Core business APIs for profile, rooms, streams, plans, invites, recordings, events, donations, and attendance
- AI-generated meeting summaries, highlights, and minutes
- Paystack checkout and payment processing
- Google, Facebook, and Apple identity flows
- Recording playback/download infrastructure
- Google Analytics delivery and tracking

## Core Features

### Access and identity

- Email/password sign-in and sign-up
- Google, Facebook, and Apple social sign-in entry points
- Forgot-password request and reset flow
- Referral capture during registration via query params and session storage
- Auth-gated dashboard routes backed by localStorage state

### Meetings and rooms

- Create, list, start, and delete rooms
- Copy room join links
- Manage room access code, participant limit, banner upload, and room transfer
- Join meetings from a public route using either room ID or room name
- Schedule meeting invites and review invite history

### Streaming and recordings

- Start YouTube, Facebook, or combo livestreams
- Stop active livestreams and review stream history
- Browse, search, and filter recordings
- Open playback URLs, copy recording links, download assets, and delete recordings

### Billing and commercial features

- Display current subscription plan
- Browse available pricing plans
- Review payment history and generate printable receipts
- Initiate Paystack checkout for plans and add-ons
- Open a contact-sales flow for enterprise plans

### Donations and verification

- Individual donation KYC onboarding
- Business donation KYC onboarding
- Bank lookup and bank-account verification
- Donation dashboard with summary metrics and transaction history

### Attendance and event operations

- Attendance meeting list and detailed participant view
- Client-side attendance export to copy, CSV, Excel, and print
- AI-triggered meeting minutes, highlights, and summaries
- Event pre-registration list and summary metrics
- Create free or paid events tied to rooms
- View pre-registered participants, export them, and send reminders

### Account and workspace settings

- Profile photo and profile details management
- Password update
- Browser-session visibility and logout of other sessions
- Referral code and referral-link display
- Light, dark, and system theme support

## High-Level Architecture

This application is structured as a browser SPA with a public route layer and an authenticated route layer. `src/index.js` composes the global runtime by wrapping the app with:

- `ThemeProvider`
- `GoogleOAuthProvider`
- `QueryClientProvider`
- `AuthProvider`
- `GlobalErrorBoundary`
- `GlobalNetworkGuard`

`src/App.js` defines the route tree using `createBrowserRouter`. Public routes include `/login`, `/register`, `/forgot-password`, and `/join`. All operational dashboard routes sit behind `IsAuthenticated`, which redirects unauthenticated users to `/login`.

The frontend uses:

- `@tanstack/react-query` for server-state fetching and cache invalidation
- a shared Axios instance in `src/api/index.js` for the main backend API
- feature-specific API modules under `src/api/`
- local storage for auth token, user snapshot, and theme preference
- session storage for referral code persistence

Frontend responsibility ends at orchestration, rendering, and client-side export utilities. Business rules, authorization enforcement, payment confirmation, recording delivery, and AI output generation are delegated to external services.

## Data Flow Overview

The main application flow is:

1. User interacts with a route-level page component in `src/pages/`.
2. The page calls a feature API function from `src/api/` or a helper in `src/lib/`.
3. The API wrapper sends a request to the configured backend or external endpoint.
4. The response is normalized in the API layer or page component.
5. React Query or local component state updates the UI.

Two integration patterns are used:

- Main Konn3ct API traffic goes through the shared Axios client at `src/api/index.js`, which uses `REACT_APP_BASE_URL` and injects `Authorization: Bearer <token>` from `localStorage`.
- Attendance AI requests bypass Axios and use `fetch` directly against `REACT_APP_API_BOT`.

## Key Feature Flows

### Authentication flow

- `useAuth` initializes user state from `localStorage`.
- Login and social login call `src/api/authService.js`.
- Successful responses store both `user` and `token` in `localStorage`.
- Protected routes are enabled by `IsAuthenticated`.
- Registration can add referral payloads sourced from URL params or session storage.

### Room and invite flow

- Users create and manage rooms from `src/pages/Rooms.jsx`.
- Starting a meeting calls `start-a-room/:id` and opens the returned URL in a new tab.
- Scheduling is handled by `MeetingForm` from `src/pages/InviteHistory.jsx`.
- The same meeting-invite form is reused in both the dashboard and rooms pages.

### Meeting join flow

- The public `/join` form submits to `joinRoom` in `src/api/roomsApi.js`.
- Numeric room values are sent to `/join-room`; non-numeric values are sent to `/kv4/join-room`.
- The returned session token is converted into a browser URL using `buildJoinMeetingUrl`.

### Streaming flow

- Streams are listed from `/streamings?page=:page`.
- Starting a stream posts either to `/start-streaming` or `/start-streaming-combo`.
- Active streams are polled periodically while running.
- Stop actions call `/stop-streaming/:id`.

### Recordings flow

- Recordings are fetched from `/recording`.
- Playback URLs are built from `REACT_APP_PLAYBACK_URL`.
- Screenshare and chat downloads use `REACT_APP_RECORDING_DOWNLOAD_BASE`.
- Webcam video downloads use `REACT_APP_VIDEO_DOWNLOAD_BASE`.

### Payments and add-ons flow

- Pricing plans come from `/pricing-plans`.
- Payment history comes from `/payments`.
- Add-ons come from `/addons`.
- Plan and add-on purchases use `react-paystack` with `REACT_APP_PAYSTACK_KEY`.
- Printable receipts are generated entirely in the browser.

### Donations flow

- Donations first call `/kyc/fetch` to determine current verification state.
- Unverified users are routed into individual or corporate KYC forms.
- KYC forms upload multipart data to `/kyc/submit` or `/kyc-corporate/submit`.
- Verified users see donation metrics from `/donation/stats` and transaction data from `/donation/in`.

### Attendance and AI flow

- Attendance list data comes from `/meeting-attendance`.
- Detailed participant data comes from `/attendance-details/:meeting_id/:identifier`.
- Export, print, and clipboard output are generated client-side in the browser.
- Meeting summary, highlights, and minutes are requested from the separate AI service using `/summary`, `/highlights`, and `/minutes`.

### Event flow

- Event list and summary come from `/pre-reg-list` and `/pre-reg-summary`.
- Event creation posts multipart form data to `/pre-reg`.
- Participant lists come from `/pre-reg-participants/:reference`.
- Reminder actions post to `/sendPreregReminder/:reference`.

## Tech Stack

### Core framework

- React 18
- Create React App / `react-scripts`
- React Router DOM 7

### Data and networking

- Axios
- TanStack React Query
- Native `fetch` for AI attendance requests

### Forms and validation

- React Hook Form
- Zod
- `@hookform/resolvers`

### UI and styling

- Tailwind CSS
- Radix UI primitives
- shadcn-style component structure
- Lucide React icons
- `clsx`, `class-variance-authority`, and `tailwind-merge`

### External integrations and browser APIs

- `@react-oauth/google`
- Facebook JavaScript SDK
- `react-apple-login`
- `react-paystack`
- Google Analytics via `public/index.html`
- Clipboard API
- `window.open` for meeting launch, playback, receipts, print, and downloads
- `localStorage` and `sessionStorage`

### Utility libraries

- `date-fns`
- `moment-timezone`
- `jwt-decode`
- `react-markdown`
- `socket.io-client` is installed in dependencies, but no active usage was found in the audited frontend code

## Project Structure

```text
.
|- public/
|  |- index.html                HTML shell, metadata, analytics, font links, theme bootstrap
|  `- ...                       Static assets
|- src/
|  |- api/                      Feature-specific API wrappers
|  |- assets/                   Logos, SVGs, icon components, images
|  |- components/
|  |  |- ui/                    Reusable UI primitives and resilience components
|  |  `- ...                    Shared app-level components such as Navbar and StatCard
|  |- hooks/                    Auth, theme, mobile, toast, Apple SDK, Facebook SDK hooks
|  |- lib/                      Utilities, route guard, env-driven external links, referral helpers
|  |- pages/
|  |  |- auth/                  Login, register, forgot-password, auth-side content
|  |  |- profile/               Profile forms and password/session views
|  |  `- ...                    Dashboard feature pages
|  |- providers/                Theme provider
|  |- App.js                    Route tree and authenticated layout
|  `- index.js                  Application bootstrap
|- .env                         Frontend build-time environment variables
|- Dockerfile                   Multi-stage build to nginx image
|- default.conf                 nginx SPA fallback config
|- components.json              shadcn/ui configuration
|- jsconfig.json                Base-path alias configuration
`- tailwind.config.js           Tailwind setup
```

## Environment Configuration

This project uses Create React App environment variables, so `REACT_APP_*` values are compiled into the frontend during build time.

### Variables referenced by the codebase

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

### What they control

- `REACT_APP_BASE_URL`: base URL for the main authenticated product API
- `REACT_APP_BASE_BACKENED_URL`: base URL used to construct room join links in the rooms UI
- `REACT_APP_API_BOT`: external AI service for attendance summary, highlights, and minutes
- `REACT_APP_CLIENT_ID`: Google OAuth client ID
- `REACT_APP_PAYSTACK_KEY`: Paystack public key for plan and add-on checkout
- `REACT_APP_PLAYBACK_URL`: playback URL prefix for recordings
- `REACT_APP_FACEBOOK_APP_ID`: Facebook SDK app ID
- `REACT_APP_APPLE_CLIENT_ID`: Apple sign-in client ID
- `REACT_APP_APPLE_REDIRECT_URI`: Apple sign-in redirect URI
- `REACT_APP_LANDING_URL`: marketing-site base URL used by navbar links
- `REACT_APP_RECORDING_DOWNLOAD_BASE`: recording asset download base
- `REACT_APP_VIDEO_DOWNLOAD_BASE`: webcam video download base
- `REACT_APP_SITE_URL`: canonical site URL injected into `public/index.html`
- `REACT_APP_PRIVACY_POLICY_URL`: privacy-policy link shown in auth screens
- `REACT_APP_OG_IMAGE_URL`: Open Graph image URL
- `REACT_APP_FAVICON_URL`: favicon and touch-icon URL
- `REACT_APP_GOOGLE_FONTS_PRECONNECT_URL`, `REACT_APP_GOOGLE_FONTS_STATIC_URL`, `REACT_APP_GOOGLE_FONTS_STYLESHEET_URL`: font loading URLs
- `REACT_APP_GOOGLE_ANALYTICS_SCRIPT_URL`, `REACT_APP_GOOGLE_ANALYTICS_ID`: analytics script and tracking ID
- `REACT_APP_APPLE_SIGNIN_SDK_URL`: Apple sign-in SDK source
- `REACT_APP_GOOGLE_USERINFO_URL`: Google user-info endpoint used after OAuth login
- `REACT_APP_FACEBOOK_SDK_URL`: Facebook SDK script URL
- `REACT_APP_JOIN_MEETING_URL`: base meeting URL used to append `sessionToken`
- `REACT_APP_GETTING_STARTED_VIDEO_URL`: dashboard onboarding video URL
- `REACT_APP_CONTACT_SALES_URL`: contact-sales URL for enterprise plan flow

### Environment notes observed in code

- The code expects the exact key name `REACT_APP_BASE_BACKENED_URL`, including the existing spelling.
- Variables used inside both JavaScript and `public/index.html` must be present before `npm run build`.
- A checked-in `.env` file is present in the repository.
- A checked-in `REACT_APP_FACEBOOK_APP_SECRET` value exists in `.env`, but no audited frontend code reads it.

## Build & Deployment

### Local development

```bash
npm install
npm start
```

Available scripts:

```bash
npm run build
npm test
```

Notes:

- The app is a standard CRA development server during `npm start`.
- `npm test` is available through CRA, but no test files were found during the audit.

### Containerized deployment

The repository includes a multi-stage Docker build:

1. `node:22-alpine` installs dependencies and runs `npm run build`
2. `nginx:1.13.9-alpine` serves the generated `build/` output

`default.conf` configures SPA fallback with:

```nginx
try_files $uri $uri/ /index.html;
```

Example container build and run:

```bash
docker build -t konn3ct-dashboard .
docker run --rm -p 8080:80 konn3ct-dashboard
```

The same compiled `build/` output can also be hosted behind any static file server or reverse proxy that supports SPA fallback to `index.html`.

## External Dependencies

### Konn3ct platform services

- Main product API at `REACT_APP_BASE_URL`
- Public/join-related URL base at `REACT_APP_BASE_BACKENED_URL`
- Recording playback and download endpoints
- Attendance AI endpoint at `REACT_APP_API_BOT`

### Identity providers

- Google OAuth
- Facebook SDK login
- Apple sign-in SDK and popup flow

### Payments and commercial

- Paystack

### Observability and delivery

- Google Analytics
- Google Fonts
- nginx for production static hosting

## Known Limitations / Caveats

These observations are based on the current codebase only.

- This repository is frontend-only; all core business workflows depend on external APIs and services.
- The Settings screen only implements appearance controls. Meeting, Recording, Audio Conference, White Board, and Scheduling tabs are placeholders.
- The SSO option in the login screen is a UI placeholder that only shows an error toast.
- `src/pages/AttendanceUpgrade.jsx` exists in the repository but is not wired into the active route tree.
- `src/components/PricingCard.jsx` exists but is not used by the current payments flow.
- Several pages perform client-side normalization around inconsistent API response shapes, which suggests backend payloads are not fully uniform.
- Some flows rely on popup windows (`window.open`) for meetings, playback, receipts, and printing, so popup blocking can affect usability.
- The donations dashboard labels the account as "Individual Account • Verified" in the UI even though the parent donations flow can branch into business verification as well.

## Security & Architectural Notes

- Because this is a CRA frontend, all `REACT_APP_*` variables are embedded into the client bundle at build time and should be treated as public.
- The repository currently contains a checked-in `.env` file with real-looking values; client-side env files should not hold secrets.
- Authentication state is stored in `localStorage`, which is simple and common for SPAs but increases exposure to XSS-driven token theft if a script injection issue exists elsewhere.
- Route protection is enforced client-side by `IsAuthenticated`, but true authorization must still be enforced by backend services.
- Client-side validation is present in many forms, but final trust must remain with backend validation.
- The frontend generates exports and printable views locally in the browser, which reduces backend complexity but can expose raw returned data directly to the client.

## Extensibility Notes

- New backend integrations should follow the existing pattern of adding a focused module under `src/api/` and calling it from a route-level page.
- Shared env-driven URLs should continue to be centralized in `src/lib/externalLinks.js` rather than embedded directly inside UI components.
- New authenticated features fit naturally into the route structure in `src/App.js` and the sidebar item list in `AppSidebar`.
- React Query is already the dominant server-state pattern, so new remote data flows should prefer query/mutation hooks over ad hoc fetch state where practical.
- Theme-aware UI should continue using the existing `ThemeProvider` and Tailwind dark-mode class approach.
- If settings functionality expands, `src/pages/Settings.jsx` already provides tab placeholders that can be replaced incrementally without changing global theme behavior.

## Audit Summary

The audited codebase is a production-oriented React dashboard for the Konn3ct platform. Its primary role is to give authenticated users a single frontend for meetings, streams, recordings, billing, add-ons, donations onboarding, attendance intelligence, events, and account management, while delegating business logic and transaction execution to external APIs and providers.
