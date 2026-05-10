# conn3ct — Development Plan (Execution + Guardrails)

## 1) Purpose
This plan ensures implementation stays aligned with the agreed documents:
- Business requirements
- Technical requirements
- Architecture requirements
- Marketing/go-to-market requirements

It also defines scope-control rules so work does not “go off radar.”

## 2) Working Agreement (Anti “Off-Radar” Rules)
1) **No scope expansion without a change request**
   - Any new feature not listed in the agreed MVP must be added to a backlog and explicitly approved before implementation.
2) **One source of truth**
   - Requirements live in the docs folder; any change must be reflected there first.
3) **Milestone-based delivery**
   - Work is delivered in milestones with acceptance criteria and demoable checkpoints.
4) **Security and cost constraints are first-class**
   - Payment verification, access control, and bandwidth optimization must be implemented before “polish” work.
5) **Capacity and caps are enforced by plan**
   - No “unbounded” media features in production; enforce defaults and limits.

## 3) Milestones & Deliverables

### Milestone 0 — Foundation & Environments
Deliverables:
- Repo structure, configuration, environment variable strategy
- CI-ready build/test scripts
- Database schema and migrations
- Basic observability scaffolding (logs + metrics hooks)

Acceptance criteria:
- Project runs locally with documented environment variables
- Database migrations apply cleanly

### Milestone 1 — Core Dashboard (Auth + Teams + Rooms)
Deliverables:
- Signup/login/logout + password reset emails
- Teams: create, invite, accept invite, roles
- Rooms: CRUD, room links, room settings (meeting/webinar, recording policy)
- Scheduling: Calendar generation, ICS links, and scheduling UI
- Dashboard: Initial admin/host control center

Acceptance criteria:
- Owner can create a team, invite a user, and that user can accept and appear as a member
- Owner can create a room and share a join link

### Milestone 2 — Recordings + Free/Paid Access (Paystack)
Deliverables:
- Recording metadata management (publish/unpublish, free/paid, price, access settings by email/link/participants)
- Recording viewer bundled in frontend (dynamic Next.js routes)
- Paystack payment initialization + webhook verification
- Recording access enforcement (paywall + secure delivery strategy)
- Playback: Rich video player with chapter markers and speed controls

Acceptance criteria:
- Free recording plays without payment
- Paid recording requires payment; access only after server-side verification

### Milestone 3 — Meetings (WebRTC) + Bandwidth Optimization
Deliverables:
- Signaling service (join, roles, presence)
- mediasoup SFU integration (publish/subscribe)
- Webinar mode (few publishers, many audience)
- Bandwidth & Quality controls:
  - simulcast/SVC policy and Low Bandwidth degradation
  - Audio Boost (client-side amplification)
  - active speaker subscription policy
- In-Meeting Interactions: Reactions (floating emojis), Polls, Donate buttons (via Paystack)
- eCinema Broadcast Feature: Synchronized streaming of external content (e.g., YouTube) directly inside the meeting for shared viewing
- Doc: In-meeting collaborative notes/viewer

Acceptance criteria:
- Host/presenters publish streams; audience receives stage streams
- Under constrained bandwidth, audio remains stable and video degrades gracefully

### Milestone 4 — Telephony (SIP/PSTN + IVR + Call-In/Out)
Deliverables:
- FreeSWITCH deployment and configuration (SIP trunks, DIDs)
- IVR flows (DTMF meeting code/room selection, PIN options)
- Call-in joins webinar/room as audience by default
- Call-out API for host-initiated outbound calls (plan/role gated)
- CDR logging and abuse controls (rate limits, allowlists, fraud detection signals)

Acceptance criteria:
- PSTN caller can dial a number, enter a meeting code, and join audio
- Host can place a call-out and bring a phone participant into a room

### Milestone 5 — Scaling, Auto-Scaling, and Production Readiness
Deliverables:
- Room allocator service for SFU placement
- Autoscaling strategy implemented (HPA/custom metrics + cluster autoscaler)
- Load and cost dashboards (bandwidth, TURN usage, SFU utilization)
- Runbooks for incidents and capacity management

Acceptance criteria:
- Multiple concurrent webinars are placed across SFU nodes automatically
- System scales out under load and scales in safely when idle

### Milestone 6 — AI, Accessibility & Transcriptions (Post-MVP)
Deliverables:
- AI Intelligence Layer integration
- Live Captions (Speech-to-text) and real-time Translate
- Transcriptions (downloadable logs)
- Meeting Summary (AI-generated action items and summaries)

Acceptance criteria:
- Host can enable live captions and post-meeting summaries are generated reliably

### Milestone 7 — Enterprise & Operations (Post-MVP)
Deliverables:
- Events: Registration pages, capacity limits, and ticketing
- 24/7 Support: Ticketing dashboard for enterprise customers
- Breakout Rooms and persistent Team Rooms

Acceptance criteria:
- User can register for an Event and enterprise clients can submit support tickets

### Milestone 8 — Native Desktop & Mobile Clients (Post-MVP)
Deliverables:
- Native Desktop apps for Windows, macOS, and Ubuntu
- Native Mobile apps for iOS and Android
- Custom media engine integration to bypass browser WebRTC limitations and maximize hardware acceleration (Zoom-like performance)

Acceptance criteria:
- Users can join a meeting via a native desktop or mobile app with superior CPU/Memory performance compared to the browser.

## 4) MVP Definition (Scope Lock)
MVP includes:
- Dashboard: auth, teams/invites, rooms, recordings management
- Paystack: 4 plans + paid recordings
- Webinar mode with bandwidth optimization defaults
- Telephony: SIP/PSTN bridging, IVR call-in, call-out, and interoperability

Not in MVP unless approved:
- Mobile native apps
- Advanced analytics dashboards beyond essentials
- Deep integrations (Calendars, CRMs, etc.)
- White-label domains and advanced branding (can be a follow-on)

## 5) Acceptance Process (How You Guide & Approve)
For each milestone:
1) Review the milestone deliverables list
2) Confirm acceptance criteria
3) Demo/verify against criteria
4) Only then move to next milestone

## 6) Ongoing Communication Checklist
Each update should answer:
- What changed (features delivered)
- What is blocked (if anything)
- What is next (next milestone items)
- What decisions are needed from you (if any)
