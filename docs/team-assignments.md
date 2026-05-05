# conn3ct — Team Work Split & Assignments

This document outlines the division of labor across the conn3ct project milestones, organized by domain and assigned to specific team members.

## 1. Backend & Media Servers
**Assignee:** Sam

**Responsibilities:**
- **Core API & Database:** Set up the Node.js API, Express routing, and Prisma ORM (PostgreSQL/SQLite).
- **Authentication & Security:** Handle JWT sessions, password hashing, and role-based access control (RBAC).
- **Teams & Rooms Logic:** Build the CRUD endpoints for teams, room generation, and invite tokens.
- **Paystack Integration:** Implement webhook endpoints, payment initialization, and server-side verification for paid recordings.
- **Real-Time Signaling:** Build the WebSocket gateway for room presence, chat, and roles.
- **WebRTC (mediasoup):** Configure and scale the SFU for live video/audio routing, focusing on the "webinar mode" bandwidth optimizations (Simulcast/SVC).
- **Telephony (FreeSWITCH):** Deploy and configure SIP trunks, IVR routing, and dial-in/dial-out capabilities.
- **Infrastructure & Deployment:** Manage Kubernetes manifests, Docker files, and auto-scaling logic (Room Allocator).
- **Native Media Engine (C++/Rust):** Build the core native media pipeline required to bypass WebRTC limits for Desktop/Mobile.
- **AI Intelligence Layer:** Integrate Speech-to-Text and LLM APIs for Live Captions, Transcriptions, and Meeting Summaries.
- **Remote Control & Data Channels:** Implement ultra-low latency WebRTC Data Channels for transmitting mouse/keyboard telemetry.

## 2. Frontend
**Assignee:** Kay

**Responsibilities:**
- **Web Application:** Build the user-facing application using Next.js (App Router) and TypeScript.
- **Dashboard UI:** Develop screens for Signup/Login, Team Management, Room Creation, Billing (Paystack), and Scheduling.
- **Meeting Interface (In-Room):** Build the interactive video room UI, separating the "Stage/Presenter" view from the "Audience" view. Include Reactions, Polls, and in-meeting Docs.
- **Real-Time Client Logic:** Integrate mediasoup-client for publishing/subscribing to media tracks and handling WebSocket events (chat, Q&A, hand-raising).
- **eCinema & Playback:** Build the synchronized media player and rich Netflix-style recording viewer.
- **Native Client UI:** Develop the user interfaces for the Desktop (Tauri/Electron) and Mobile (React Native) apps to wrap the custom media engine.
- **Design & UX:** Implement modern, responsive aesthetics ensuring the platform feels premium and dynamic.

## 3. Testing & Quality Assurance
**Assignee:** Lammy

**Responsibilities:**
- **Unit Testing:** Ensure core business logic (auth, permissions, paywall verification) has comprehensive test coverage.
- **Integration Testing:** Write tests to verify the API communicates correctly with the database, Redis cache, and external services (mocking Paystack webhooks).
- **End-to-End (E2E) Testing:** Automate critical user flows (e.g., Signup → Create Room → Join Room → Start Recording → Paywall Checkout) using tools like Playwright or Cypress.
- **Load & Stress Testing:** Simulate high-concurrency scenarios to ensure the mediasoup SFU and WebSocket signaling do not crash or degrade ungracefully.
- **Media Quality Testing:** Monitor and verify audio/video quality under constrained bandwidth conditions (ensuring audio-first degradation works as designed).
- **Telephony QA:** Manually and automatically test PSTN dial-in numbers, DTMF (keypad) recognition, and IVR flows.
- **Native App QA:** Test the Desktop and Mobile clients across different operating systems to verify CPU/Memory performance.
- **Remote Control & AI QA:** Verify ultra-low latency for Remote Control inputs and validate the accuracy of real-time AI translations.
