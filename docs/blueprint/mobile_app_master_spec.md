# Konn3ct Edge - Mobile Applications (Android & iOS) Master Specification

**Target Role:** Kay (Backend API Lead & Extended Mobile App Duties)  
**Blueprint Reference:** Volume 4 (Mobile Apps, Multi-Platform Experience and Distribution Strategy)  
**Context:** This document provides the master technical specification for the native/cross-platform Konn3ct mobile apps for Android and iOS devices, using the Expo / React Native stack.

---

## 1. Executive Summary & Strategic Importance (Volume 4)

In the Konn3ct Edge Blueprint, **Mobile is not a secondary companion app—it is a primary growth engine**. Mobile access is essential for driving African adoption, community usage, faith-based groups, educational sessions, and creator/event participation across variable network conditions.

### Primary Mobile Goals:
1.  **Frictionless Access:** One-tap join from WhatsApp, SMS, QR codes, and deep links without requiring complex logins.
2.  **Bandwidth Efficiency:** Intelligent audio-first fallback and low-bandwidth modes for 3G/4G networks.
3.  **Monetization & Replays:** Mobile ticket purchasing (PayGate Shield) and interactive replay playback with AI summaries.
4.  **Engagement:** Timely push notifications (FCM/APNs) driving meeting attendance and retention.

---

## 2. Core Mobile Architectural Modules

### Module 1: Mobile Onboarding & Deep Linking
*   **Deep Link Handler:** Intercepts `konn3ct://join/{roomId}` and `https://konn3ct.com/join/{roomId}` URLs from WhatsApp, SMS, or QR code scans.
*   **Authentication & Biometrics:** Biometric login (Face ID / Touch ID / Fingerprint), token storage in Secure Enclave / KeyStore, and seamless guest join options.

### Module 2: Pre-Meeting Hardware & Permissions Manager
*   **Permission Gates:** Native Android/iOS permission prompts for Camera and Microphone with graceful fallback explanations.
*   **Audio Output Manager:** Dynamic switching between Speakerphone, Earpiece, and Bluetooth Headsets (SCO / A2DP).
*   **Mobile Self-Preview:** Self-view camera box with front/rear camera flip toggle.

### Module 3: Mobile Meeting Room UI & WebRTC Stream Rendering
*   **Mobile Layouts:** Responsive vertical grid (1x2, 2x2 tiles) and Active Speaker mode optimized for portrait and landscape orientations.
*   **Mobile Control Bar:** Compact bottom control bar (Mute Mic, Video Toggle, Raise Hand, Reaction Emojis, Chat Drawer, Leave Room).
*   **Low-Bandwidth Mode:** Automatic or manual toggle disabling incoming video streams to preserve mobile data.

### Module 4: Push Notifications & Re-engagement (FCM / APNs)
*   **Push Triggers:** 'Meeting Starts in 10 Mins', 'Host Admitted You', 'Replay Available', 'Event Registration Reminder'.
*   **Interactive Push Notifications:** One-tap 'Join Now' action buttons directly inside notification banners.

### Module 5: Mobile Replay Library & PayGate Checkout
*   **Mobile Replay Player:** Native video player with AI summary chapter markers and transcript search drawer.
*   **Mobile PayGate Checkout:** In-app webview or native mobile checkout for purchasing paid webinar tickets and replay access.

---

## 3. Technical Prerequisites & Dependencies

*   **SDKs & Framework:** Expo (SDK ~56), React Native (0.85), NativeWind (Tailwind CSS for React Native), and Zustand for state management.
*   **Media & WebRTC:** `react-native-webrtc` (v124), `mediasoup-client` (v3.20.0), and `react-native-incall-manager` for audio routing.
*   **Push Engine:** `expo-notifications` (FCM for Android, APNs for iOS).
*   **State & Storage:** `expo-secure-store` for encrypted biometrics/tokens, and `@react-native-async-storage/async-storage`.
*   **Authentication:** `expo-local-authentication` (Biometrics).
*   **Backend APIs & WebSockets:** Axios and `socket.io-client` connecting to Kay's REST APIs and SFU signaling.
*   **Testing:** Playwright (`@playwright/test`) for E2E UI testing on mobile.

---

## 4. Delivery Checklist for Mobile Lead Engineer

The Mobile Application build will be executed by Kay via the task list in [mobile_app_tasks.csv](file:///C:/conn3ct_meeting/docs/blueprint/mobile_app_tasks.csv). All tasks follow the `MM/DD/YYYY` timeline starting from `08/10/2026` with extended deadlines to accommodate Kay's API responsibilities.
