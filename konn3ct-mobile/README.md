# Konn3ct Mobile App

A cross-platform mobile and web video conferencing application built with **React Native**, **Expo SDK 56**, **WebRTC / Mediasoup**, **NativeWind (TailwindCSS)**, **Zustand**, and **Playwright**.

The application supports real-time multi-party video/audio calls, interactive meeting tools (chat, whiteboard, polls, document sharing, streaming), and comprehensive conference management. It features a flexible **white-label environment configuration** allowing seamless switching between **Konn3ct** and **Gov Conference** branding and feature sets.

---

## Table of Contents

- [Overview & Key Features](#overview--key-features)
- [Folder & Codebase Structure](#folder--codebase-structure)
- [Environment Configuration (`.env`)](#environment-configuration-env)
- [Styling & Design System](#styling--design-system)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [How to Start & Run the App](#how-to-start--run-the-app)
- [Native Plugins & Customizations](#native-plugins--customizations)

---

## Overview & Key Features

- **Real-Time Video Conferencing**: Powered by `mediasoup-client` and `react-native-webrtc` for scalable SFU audio/video streams, screen sharing, and active speaker detection.
- **Dynamic White-Labeling**: Configurable feature flags (`appConfig.ts`) enable or disable features (e.g., AI features, payments, add-ons, 1Gov single sign-on) based on target build environments.
- **Interactive Meeting Panels**: In-meeting Chat, Polls, Whiteboard, Document Sharing, Reactions, Live Streaming, Captions Overlay, and Participant Management.
- **Native Android Features**: Background meeting foreground service, Picture-in-Picture (PiP) mode support (`react-native-pip-android`), and device media permissions plugins.
- **Custom Modern Dialogs**: Native `Alert.alert` is overridden globally with custom animated modal alerts (`CustomAlert.tsx`).
- **Comprehensive Platform Features**: Events registration, Attendance management, Past meeting recordings, Donations, Referee networks, and Account profile management.

---

## Folder & Codebase Structure

```
konn3ct-mobile/
├── assets/                  # App icons, splash screens, logos (Konn3ct & Gov Conference)
├── e2e/                     # Playwright End-to-End browser automation test suite
├── patches/                 # patch-package native library patches
├── plugins/                 # Expo config plugins for custom native Android behavior
├── src/
│   ├── api/                 # Modular REST API service layers (Axios)
│   ├── components/          # Reusable UI components and in-meeting drawer/modal panels
│   ├── config/              # App environment config parser & feature flag definitions
│   ├── hooks/               # Custom React hooks (network quality monitoring, video health)
│   ├── native/              # Native bridge helpers (PiP mode, Android foreground service)
│   ├── navigation/          # React Navigation stacks (Auth stack, Main tab navigator, Root stack)
│   ├── screens/             # Application screen components (25 screens)
│   ├── store/               # Zustand state stores (Auth, Meeting, Alert dialogs, Secure Storage)
│   ├── theme/               # Theme tokens & meeting design system definitions
│   └── webrtc/              # Mediasoup WebRTC client engine & media stream manager
├── App.tsx                  # Root app entry point, navigation container, error boundary
├── app.config.js            # Expo dynamic configuration (plugins, Android/iOS permissions)
├── babel.config.js          # Babel preset & NativeWind plugin configuration
├── global.css               # TailwindCSS directive entry point
├── package.json             # NPM dependencies, scripts, and overrides
├── playwright.config.ts     # Playwright E2E runner configuration
├── run-both.cmd             # Automated dual-device Android runner script
└── tailwind.config.js       # TailwindCSS theme extensions & content paths
```

### Breakdown of `src/` Modules

#### 1. `src/api/` (API Layer)
- `client.ts`: Base Axios HTTP client with auth token interceptor and standard headers.
- `rooms.ts`: Meeting room creation, joining, listing, token generation, and room controls.
- `edgeApi.ts`: Edge media server signaling API interactions.
- `events.ts`: Public & private event creation, ticket booking, and event management.
- `dashboard.ts`: Dashboard stats, upcoming meetings, quick stats.
- `attendance.ts`: Government & conference attendance logs and detail extraction.
- `donations.ts`: Fundraiser campaign listing and donation processing.
- `payments.ts`: Subscription plans and payment processing.
- `profile.ts`: User profile fetching, bio update, avatar upload.
- `recordings.ts`: Meeting recording list and streaming playback endpoints.
- `schedule.ts`: Scheduled meeting creation, update, and deletion.
- `streamings.ts`: Live streaming key generation and RTMP configuration.
- `referees.ts`: Referee referral link and network data.

#### 2. `src/components/` (UI Components)
- `CustomAlert.tsx`: Global modal replacement for standard React Native alerts.
- `CustomTabBar.tsx`: Modern custom bottom tab bar with dynamic tab visibility.
- `components/meeting/`: Dedicated in-meeting panels:
  - `ChatPanel.tsx`: Meeting chat, public & private messaging.
  - `PollsPanel.tsx`: Live poll creation, voting, and result displays.
  - `ParticipantsPanel.tsx`: Participant list, audio/video status, host moderation (mute/kick).
  - `StreamingPanel.tsx`: Controls for broadcasting meetings to YouTube/Facebook/RTMP.
  - `SettingsPanel.tsx`: Audio/video device selector, bandwidth quality settings.
  - `WhiteboardPanel.tsx`: Canvas drawing & collaborative whiteboard interface.
  - `DocsPanel.tsx`: Shared meeting document viewer.
  - `CaptionsOverlay.tsx`: Real-time speech-to-text transcript overlay.
  - `ReactionsLayer.tsx`: Floating emoji animations over video feeds.
  - `DonationPanel.tsx`: In-meeting fundraising overlay.

#### 3. `src/config/` (App Configuration)
- `appConfig.ts`: Centralized `APP_CONFIG` object mapping environment variables to feature flags (`SHOW_ADDONS_TAB`, `GOV_LOGIN`, `SHOW_AI_INTELLIGENCE`, `SKIP_EMAIL_VERIFY`, etc.) and setting logo assets dynamically.

#### 4. `src/hooks/` (Custom Hooks)
- `useNetworkQuality.ts`: Real-time latency, jitter, packet loss monitoring and status indicators.
- `useVideoHealth.ts`: Video track health check and reconnect logic.

#### 5. `src/native/` (Native Service Bridges)
- `KonnPip.ts`: Controls Android Picture-in-Picture mode activation and screen state listeners.
- `MeetingService.ts`: Controls the native Android foreground service to prevent background process termination during ongoing calls.

#### 6. `src/navigation/` (Navigation Stacks)
- `AuthStackNavigator.tsx`: Unauthenticated flow screens (`Welcome`, `Login`, `Signup`, `GuestJoin`).
- `MainTabNavigator.tsx`: Main authenticated bottom tab navigation (`Home`/`Dashboard`, `Rooms`, `Schedule`, `Events`/`Addons`, `More`).

#### 7. `src/screens/` (Screen Views)
- **Auth & Onboarding**: `WelcomeScreen`, `LoginScreen`, `SignupScreen`, `GuestJoinScreen`.
- **Core Dashboard**: `DashboardScreen`, `HomeScreen`, `MoreScreen`, `SettingsScreen`, `NotificationsScreen`, `HistoryScreen`.
- **Meeting Flow**: `LobbyScreen` (pre-join mic/camera check), `MeetingScreen` (active video call matrix & controls), `MeetingSummaryScreen` (AI meeting summary & key points).
- **Conference Tools**: `RoomsScreen`, `ScheduleScreen`, `EventsScreen`, `PastMeetingsScreen`, `RecordingsScreen`, `AttendanceScreen`, `StreamingScreen`, `AddonsScreen`, `PaymentsScreen`, `DonationsScreen`, `RefereesScreen`, `ProfileScreen`.

#### 8. `src/store/` (State Management)
- `useAuthStore.ts`: Authentication state, JWT token, user profile data, login/logout, and persistent session hydration via Expo SecureStore.
- `useMeetingStore.ts`: Active meeting metadata, WebRTC media producer/consumer states, mic/camera toggles, active speaker ID, and panel visibility flags.
- `useAlertStore.ts`: Dynamic alert store powering custom modal alerts.
- `secureStore.ts`: Wrapper around `expo-secure-store` for encrypted storage of credentials and tokens.

#### 9. `src/theme/` (Design Tokens)
- `meetingTheme.ts`: Central color palette (Primary green `#0a5c36`, Dark slate backgrounds, status colors, font sizes, grid layouts).

#### 10. `src/webrtc/` (Media Engine)
- `MediasoupService.ts`: Core Mediasoup client wrapper managing WebSocket signaling connection, device loading, audio/video producer transport, consumer transport, and stream tracks.
- `activeMeetingService.ts`: Active call reference keeper.

---

## Environment Configuration (`.env`)

The app uses standard Expo `EXPO_PUBLIC_*` environment variables loaded at build time. Pre-configured templates are provided in the repository root:

- `.env.konn3ct`: Standard Konn3ct product environment (Full feature set enabled).
- `.env.gov1`: Government Conference tenant environment (Streamlined UI, Gov SSO enabled).

### Key Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | Backend REST API endpoint URL | `https://dev.konn3ct.ng/api/app` |
| `EXPO_PUBLIC_BACKEND_DOMAIN` | Media signaling server domain | `konn3ctedge.konn3ct.net` |
| `EXPO_PUBLIC_EDGE_FRONTEND_URL` | Web edge frontend URL | `https://edge.konn3ct.net` |
| `EXPO_PUBLIC_APP_NAME` | Display name of the application | `Konn3ct` / `Gov Conference` |
| `EXPO_PUBLIC_APP_LOGO` | App logo key (`konn3ct` or `gov1`) | `konn3ct` |
| `EXPO_PUBLIC_GOV_LOGIN` | Enable 1Gov login flow (`/1gov/login`) | `false` |
| `EXPO_PUBLIC_SHOW_ADDONS_TAB` | Show Addons tab instead of Events tab | `true` |
| `EXPO_PUBLIC_SHOW_AI` | Display AI intelligence features | `true` |
| `EXPO_PUBLIC_SHOW_PAYMENTS` | Enable payments & subscription tab | `true` |
| `EXPO_PUBLIC_SKIP_EMAIL_VERIFY`| Skip email verification screen on signup | `false` |

To switch environments, copy the desired template to `.env`:
```bash
# Switch to Konn3ct environment
cp .env.konn3ct .env

# Switch to Gov Conference environment
cp .env.gov1 .env
```

---

## Styling & Design System

The application uses **NativeWind v2** combined with **TailwindCSS v3** for utility-first styling across iOS, Android, and Web platforms.

- **Tailwind Config** (`tailwind.config.js`): Scans `App.tsx` and all components under `./src/**/*.{js,jsx,ts,tsx}`.
- **Global CSS** (`global.css`): Contains standard `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;` directives.
- **Babel Setup** (`babel.config.js`): Configured with `nativewind/babel` plugin.
- **Theme Palette** (`src/theme/meetingTheme.ts`):
  - Primary Dark Background: `#0b132b` / `#0f172a` (Slate 900)
  - Primary Accent Green: `#0a5c36` / `#10b981` (Emerald 500)
  - Dark Surface Panels: `#1e293b` (Slate 800)
  - Text Tokens: `#f8fafc` (Slate 50), `#94a3b8` (Slate 400)
- **Global Alert Dialog System**: Standard React Native `Alert.alert` calls are routed through `CustomAlert.tsx` to ensure consistent modern visual design.

---

## Testing & Quality Assurance

### 1. Playwright End-to-End (E2E) Tests (`./e2e`)

The project features a comprehensive E2E test suite using Playwright targeting WebRTC browser flows with simulated media streams (`--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`).

#### E2E Test Specs:
- `login.spec.ts` & `signup.spec.ts`: User authentication flows.
- `dashboard.spec.ts`, `welcome.spec.ts`, `settings.spec.ts`: Dashboard & user configuration.
- `lobby.spec.ts` & `meeting.spec.ts`: Pre-join checks and active meeting rooms.
- `rooms.spec.ts` & `schedule.spec.ts`: Meeting room creation & scheduling logic.
- `attendance.spec.ts`, `events.spec.ts`, `recordings.spec.ts`, `streaming.spec.ts`: Secondary feature suites.

### 2. Standalone API Endpoint Test Scripts

The root folder contains targeted Node.js script utilities for verifying backend API endpoints directly:
- `test-room-endpoints.js`, `test-create-room.js`, `test-host-room.js`: Room management verification.
- `test-gov-attendance.js`, `test-gov-attendance-details.js`: Attendance reporting scripts.
- `test-payments.js`, `test-profile.js`, `test-schedule.js`: Platform feature tests.

### Running Tests

```bash
# Run all Playwright E2E tests headless
npm run test:e2e

# Run Playwright E2E tests with Interactive UI
npm run test:e2e:ui
```

---

## How to Start & Run the App

### Prerequisites

1. **Node.js**: Version 18.x or higher installed.
2. **Package Manager**: `npm` (v9+ recommended).
3. **Expo CLI**: Installed globally or executed via `npx expo`.
4. **Android Development** (Optional for Native Android):
   - Android Studio with Android SDK (API Level 34+).
   - Java Development Kit (JDK 17).
   - ADB (Android Debug Bridge) added to PATH.

---

### Step-by-Step Setup

#### 1. Install Dependencies
Run `npm install` in the `konn3ct-mobile` folder. The `postinstall` script automatically executes `patch-package` to apply necessary native library patches.

```bash
cd konn3ct-mobile
npm install
```

#### 2. Set Up Environment File
Select your target environment file and copy it to `.env`:

```bash
cp .env.konn3ct .env
```

#### 3. Start Development Server (Metro)

Start the Expo Metro bundler:
```bash
npm start
```
From the interactive terminal prompt, you can press:
- `a` to open on an attached Android emulator/device.
- `w` to open in a web browser.
- `r` to reload the bundle.

#### 4. Run on Web
To explicitly target the web platform:
```bash
npm run web
```

#### 5. Run on Android Native Build
To build and launch the native Android development client:
```bash
npm run android
```

#### 6. Multi-Device Android Development Script (`run-both.cmd`)
For testing on multiple physical Android devices simultaneously (e.g., testing multi-participant WebRTC calls live across Android 10 and Android 14 devices), use the included Windows batch script:

```cmd
# Start both Android devices
run-both.cmd

# Run on Android 10 device only
run-both.cmd 1

# Run on Android 14 device only
run-both.cmd 2

# Clean build universal APK and install on both devices
run-both.cmd build
```

---

## Native Plugins & Customizations

Expo config plugins (`app.config.js`) automate native Android manifest and code modifications during prebuild:

- `./plugins/withPiP`: Configures Android `PictureInPictureParams` and manifest activity flags for floating video windows.
- `./plugins/withScreenShare`: Configures Android MediaProjection foreground service permissions for screen sharing.
- `./plugins/withMeetingService`: Registers native foreground services (`MeetingService`) to retain active WebRTC audio/video streams when the app is minimized.
- `@config-plugins/react-native-webrtc`: Adds native camera, microphone, and audio routing permissions to `AndroidManifest.xml` and `Info.plist`.

---
