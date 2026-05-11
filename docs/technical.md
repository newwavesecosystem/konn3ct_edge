# conn3ct — Technical Document

## 1) Scope (What We’re Building)
conn3ct is a web-based meeting + webinar platform with:
- A dashboard for signup/login, teams, rooms, invites, recordings, and billing
- A meeting join experience via room links
- Recording publishing and access links
- Free vs paid recording access using Paystack
- A public website with API integration (landing pages + docs/SDK later)

This document describes the product requirements, APIs, data concepts, and security approach.

## 2) Functional Requirements

### 2.1 Authentication & Accounts
- Email/password signup and login
- Password reset flow (email)
- Session management (cookie or token-based)
- Basic profile management

### 2.2 Teams
- Create a team (organization)
- Invite team members by email
- Accept invite via token link
- Roles (initial): owner, admin, member
- Permissions:
  - Owner/admin can manage rooms, invites, and recordings
  - Members can be allowed to host meetings (configurable)

### 2.3 Rooms
- Create/update/delete rooms
- Room slug (human-friendly join link)
- Room ownership:
  - Personal rooms
  - Team rooms
- Room settings (MVP):
  - Default mode: meeting or webinar
  - Recording allowed: off/free/paid (subject to plan)

### 2.4 Meeting Invites
- Invite attendees by email to a specific room/meeting
- Invite token with expiry
- Optional “guest join without login”

### 2.5 Recordings
- Create recording metadata (title, owner, room)
- Store playback URL (CDN/object storage URL)
- Publish/unpublish recordings
- Recording access settings:
  - Specific users (via email)
  - Anyone with link
  - Only meeting participants
- Architecture: Bundled with the main frontend Next.js directory to reuse authentication state and components. Handled via dynamic public routes (e.g., `/recordings/[recordingId]`).
- Free recording access: immediate playback based on access settings
- Paid recording access:
  - Configure price
  - Require payment before playback
  - Generate/verify Paystack transaction
  - Grant access after successful verification

### 2.6 Billing & Plans (Paystack)
- Four plans: Starter, Pro, Business, Enterprise
- Subscribe/upgrade/downgrade/cancel
- Store subscription status and current period end
- Webhook verification:
  - Verify event signatures
  - Verify transaction/reference with Paystack API
  - Idempotent processing (safe retries)

### 2.7 Telephony (SIP/PSTN + IVR + Call-In/Out)
Inbound (call-in):
- Provide dial-in numbers (DIDs) per region/provider
- Callers enter meeting/webinar code or room slug (DTMF)
- Optional PIN flows (host PIN, attendee PIN)
- Announcements, prompts, language selection (IVR)
- Join as audience by default; allow “promote to stage” from dashboard/host controls

Outbound (call-out):
- Host can dial-out to a phone number or SIP URI to invite a participant into a room
- Call-out permissions restricted by plan/role, with rate limits and fraud controls

Interoperability:
- SIP endpoints (PBX, softphones) can join via SIP URI
- SIP trunk support for PSTN connectivity

Operational requirements:
- CDRs (call detail records) for audit and billing
- DTMF handling, call recording controls (policy-driven)
- E.164 formatting and number validation

### 2.8 Scheduling & Events
- Schedule `MeetingSession`s linked to specific rooms
- Generate ICS files for calendar integration
- Event registration pages with capacity limits

### 2.9 In-Meeting Experience & Media
- Reactions (floating emojis) and interactive Polls
- In-meeting Doc viewer/collaborative notes
- Remote Control (requires Native Client + WebRTC DataChannels for OS-level mouse/keyboard simulation)
- eCinema Broadcast Feature (synchronized streaming of external content like YouTube or MP4 files directly inside the active video conference, allowing all participants to watch together in real time)
- Donate button integrated with Paystack during live streams
- Audio Boost (client-side amplification)
- Strict Low Bandwidth degradation rules

### 2.10 AI & Accessibility
- Live Captions (Speech-to-text) and real-time Translate
- Full downloadable Transcriptions post-meeting
- AI Meeting Summary (action items and summaries)

### 2.11 Platform & Operations
- Unified Dashboard for managing rooms, team members, recordings, and schedules
- 24/7 Support ticketing system for Enterprise/Business clients

## 3) Non-Functional Requirements
- Scalability: webinar mode supports very large audiences by limiting publishers
- Latency: low-latency audio, adaptive video
- Reliability: multi-region readiness, graceful degradation (audio-first)
- Security: least privilege, signed invites, payment verification, rate limiting
- Privacy: access controls on recordings, secure URLs, audit logs for admin actions
- Observability: metrics, logs, traces for meeting quality + API health
- Bandwidth optimization: simulcast/SVC, active-speaker subscriptions, role-based caps, audio-first degradation under congestion

## 4) Proposed Tech Stack (Web, API & Native Clients)
This is the recommended approach for a scalable and maintainable MVP:
- **Web**: Next.js (App Router), TypeScript
- **Desktop Native (Windows, macOS, Ubuntu)**: Rust + Tauri or Electron with a custom C++ media engine to bypass browser WebRTC limitations and achieve Zoom-like hardware acceleration.
- **Mobile Native (iOS, Android)**: React Native with custom WebRTC bridging or fully native Swift/Kotlin modules to maximize performance and battery life.
- **API**: Node.js (TypeScript), REST (or tRPC/GraphQL later)
- **DB**: Postgres (recommended for production); SQLite acceptable for dev
- **ORM**: Prisma
- **Cache/Queue**: Redis (sessions, rate-limit, invite tokens, job queue)
- **Email**: SMTP provider (transactional), e.g. Postmark/Mailgun/SendGrid (implementation-agnostic)
- **Storage**: S3-compatible object storage for recordings + CDN
- **Payments**: Paystack (server-side verification + webhooks)
- **Media**: mediasoup (WebRTC SFU), coturn (TURN/STUN)
- **Telephony**: FreeSWITCH (SIP/PSTN + IVR). Optional SIP routing layer if required for multi-tenant trunks.

## 5) Data Model (Conceptual)
Entities:
- User
- Team, TeamMember, TeamInvite
- Room, MeetingSession, MeetingInvite
- Recording
- Plan, Subscription
- PaymentTransaction (for subscriptions and paid recordings)

Key invariants:
- Invite tokens are unique, expiring, and single-use (or limited-use)
- Recording playback requires:
  - owner/team access OR
  - public recording + payment (if paid)
- Payment access is granted only after server-side verification

## 6) API Surface (Initial)
All endpoints below are “server-authenticated” unless stated otherwise.

### Dashboard & Scheduling
- GET /dashboard (Aggregated host statistics)
- POST /scheduling (Create a MeetingSession and generate ICS)
- GET /scheduling (List upcoming sessions across rooms)

### Auth
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- POST /auth/request-password-reset
- POST /auth/reset-password

### Teams
- POST /teams
- GET /teams
- GET /teams/:teamId
- POST /teams/:teamId/invites
- POST /teams/invites/:token/accept
- DELETE /teams/:teamId/members/:memberId

### Rooms
- POST /rooms
- GET /rooms
- GET /rooms/:roomId
- PATCH /rooms/:roomId
- DELETE /rooms/:roomId

### Meeting Invites
- POST /rooms/:roomId/invites
- GET /rooms/:roomId/invites

### Recordings
- POST /recordings
- GET /recordings
- GET /recordings/:recordingId
- PATCH /recordings/:recordingId (publish, pricing, title)
- GET /recordings/:recordingId/public (public page data; no auth)

### Payments (Paystack)
- POST /payments/initialize (kind=subscription|recording)
- POST /payments/webhook (Paystack webhook; no auth, signature required)
- GET /payments/verify/:reference (optional client redirect verification; server verifies)

### Media / Meetings (Signaling Contracts)
- POST /rooms/:roomId/join-token (short-lived join token)
- WS /signal (websocket signaling; authenticated by join token)

### Telephony
- POST /telephony/callout (host initiates outbound PSTN/SIP call into a room)
- POST /telephony/inbound/route (FreeSWITCH webhook to resolve meeting code/room)
- GET /telephony/numbers (list available dial-in numbers by region/plan)
- GET /telephony/cdr (admin/owner reporting; access-controlled)

## 7) Recording Paywall Logic
Access decision for a recording request:
1) If user is owner or in owning team with permission → allow
2) Else if recording is not published → deny
3) Else if recording is free → allow
4) Else (paid):
   - Require verified payment transaction linked to recordingId and user/email
   - If not paid → return “payment required” with Paystack initialization payload

Recommended patterns:
- Store transactions with reference, amount, status, kind
- Mark as “verified” only after server calls Paystack verify endpoint
- Make webhook handler idempotent per reference/event

## 8) Email Invites
Team invites and meeting invites:
- Generate token (random, high entropy), store hashed token (recommended) and expiry
- Email link: /invite/<token> or /join/<token>
- On accept:
  - Validate token + expiry
  - Create membership or allow join
  - Invalidate token

## 9) Security Requirements
- Password hashing (bcrypt/argon2)
- JWT or session cookies with secure flags
- CSRF protection if cookie-based
- Rate limiting:
  - Auth endpoints
  - Invite endpoints
  - Payment endpoints
  - Telephony endpoints (callout attempts, inbound route lookups)
- Webhook security:
  - Validate Paystack signature
  - Verify transaction/reference server-side before granting access
- Access control:
  - Team membership/role checks on all team resources
  - Recording permissions enforced server-side (never trust client)
- Secrets:
  - Store Paystack keys and SMTP creds in environment variables
  - Store SIP trunk credentials and FreeSWITCH event socket credentials securely

## 10) Testing Strategy (MVP)
- Unit tests for:
  - Auth validation, access control, paywall logic
  - Webhook signature + idempotency
- Integration tests for:
  - Payment initialization + verification flow (mock Paystack)
- E2E tests for:
  - Signup → create room → invite → create recording → paywall playback
