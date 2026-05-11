# conn3ct Frontend Development Roadmap

## Purpose

This document provides a practical, step-by-step frontend development guide for building **conn3ct**, a Next.js video conferencing and webinar web application. It is designed to help a human developer or AI coding agent build the frontend gradually, with review and approval after each phase.

The current focus is the **website and web application frontend**, not the backend, native desktop client, or mobile app.

---

## Product Summary

**conn3ct** is a modern video conferencing, meeting, webinar, recording, billing, and collaboration platform. The frontend will be built with:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Modern responsive UI
- API-ready architecture
- Dashboard screens
- Meeting room interface
- Recording playback pages
- Paystack-ready billing UI
- Future support for mediasoup-client, WebSocket events, eCinema, captions, AI summaries, and native client wrappers

The Figma design should guide visual direction, colors, spacing, layout style, and product feel.

Figma reference:

```text
https://www.figma.com/design/hNV7a2hoFeaBowmczY9CSh/Konn3ct-Meeting-Design?node-id=1-2&p=f
```

---

# 1. Development Principles

## 1.1 Build in Stages

The frontend must not be built all at once. The AI agent or developer should complete one phase at a time, then stop for review and approval.

Each stage should produce visible, testable UI.

## 1.2 No Backend Dependency at First

Use mock data first. Do not block frontend progress waiting for backend endpoints.

Later phases should replace mock services with real API calls.

## 1.3 Component-First Architecture

Build reusable components before duplicating UI across pages.

Examples:

- Button
- Input
- Modal
- Card
- Pricing card
- Dashboard stat card
- Sidebar
- Topbar
- Room card
- Recording card
- Meeting control button
- Participant tile
- Poll component
- Reaction component

## 1.4 Premium Product Feel

The product should feel modern, clean, premium, and suitable for enterprise use.

The UI should communicate:

- Security
- Reliability
- Professional video collaboration
- Enterprise readiness
- Simplicity
- Nigerian/local relevance where appropriate
- Global SaaS quality

## 1.5 Approval Checkpoints

After each phase, the AI agent must stop and ask for approval before continuing.

The required review statement is:

```text
Phase completed. Please review the UI, routes, components, and behavior. Approve before I proceed to the next phase.
```

---

# 2. Recommended Frontend Stack

## 2.1 Core Stack

```text
Next.js App Router
TypeScript
Tailwind CSS
React
```

## 2.2 Suggested Supporting Libraries

```text
lucide-react        Icons
framer-motion       Animations
react-hook-form     Forms
zod                 Validation schemas
sonner              Toast notifications
clsx / tailwind-merge Class handling
recharts            Charts/dashboard analytics
```

## 2.3 Future Integration Libraries

These should not be fully implemented in the early UI phases, but the project should be structured to support them later.

```text
mediasoup-client    WebRTC publishing/subscribing
socket.io-client or native WebSocket client
Paystack checkout integration
HLS/DASH video player support
```

---

# 3. Suggested Folder Structure

```text
app/
  page.tsx
  layout.tsx
  globals.css

  (marketing)/
    page.tsx
    pricing/page.tsx
    features/page.tsx
    contact/page.tsx

  (auth)/
    login/page.tsx
    signup/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx

  dashboard/
    layout.tsx
    page.tsx
    rooms/page.tsx
    rooms/new/page.tsx
    rooms/[roomId]/page.tsx
    teams/page.tsx
    schedule/page.tsx
    recordings/page.tsx
    recordings/[recordingId]/page.tsx
    billing/page.tsx
    settings/page.tsx

  join/
    [token]/page.tsx

  meeting/
    [roomId]/page.tsx

  recordings/
    public/[recordingId]/page.tsx

components/
  ui/
  layout/
  marketing/
  auth/
  dashboard/
  rooms/
  teams/
  billing/
  meeting/
  recordings/
  scheduling/

lib/
  api/
  mock-data/
  utils.ts
  constants.ts
  routes.ts

types/
  user.ts
  team.ts
  room.ts
  meeting.ts
  recording.ts
  billing.ts
```

---

# 4. Frontend Build Phases

## Phase 1: Project Foundation

### Goal

Set up the Next.js frontend project foundation with clean routing, styling, reusable layout structure, and design tokens.

### Tasks

1. Create a Next.js App Router project with TypeScript.
2. Configure Tailwind CSS.
3. Set up global styles.
4. Define color tokens based on the Figma direction.
5. Create base reusable UI components.
6. Add route groups for marketing, auth, and dashboard.
7. Create placeholder pages for all major routes.
8. Add responsive layout foundations.

### Pages to Create

```text
/
/login
/signup
/forgot-password
/dashboard
/dashboard/rooms
/dashboard/teams
/dashboard/schedule
/dashboard/recordings
/dashboard/billing
/dashboard/settings
/meeting/demo-room
```

### Components to Create

```text
components/ui/Button.tsx
components/ui/Input.tsx
components/ui/Card.tsx
components/ui/Badge.tsx
components/ui/Modal.tsx
components/ui/Avatar.tsx
components/layout/PublicNavbar.tsx
components/layout/PublicFooter.tsx
components/layout/DashboardSidebar.tsx
components/layout/DashboardTopbar.tsx
```

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 2: Marketing Website

### Goal

Build the public-facing website that explains conn3ct, its features, use cases, pricing, and product value.

### Main Pages

```text
/
/features
/pricing
/contact
```

### Homepage Sections

1. Hero section
2. Trusted meeting platform statement
3. Feature highlights
4. Meeting, webinar, and recording use cases
5. eCinema and playback preview
6. AI captions and summaries section
7. Security and enterprise readiness section
8. Pricing preview
9. Final call-to-action

### Feature Areas to Highlight

- Secure video meetings
- Webinars
- Teams and rooms
- Reactions
- Polls
- In-meeting docs
- Recordings
- Paid recording access
- Paystack billing
- Scheduling
- eCinema
- AI captions
- Transcriptions
- Low bandwidth mode
- Audio boost
- Telephony support
- Enterprise support

### Design Direction

- Use bold hero design.
- Add soft gradients.
- Use professional cards.
- Add product UI mockups.
- Keep the design clean and premium.
- Ensure mobile responsiveness.

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 3: Authentication UI

### Goal

Build the frontend screens for user account access.

### Pages

```text
/login
/signup
/forgot-password
/reset-password
```

### Forms

#### Signup Form

Fields:

- Full name
- Email
- Password
- Confirm password
- Accept terms checkbox

#### Login Form

Fields:

- Email
- Password
- Remember me

#### Forgot Password Form

Fields:

- Email

#### Reset Password Form

Fields:

- New password
- Confirm password

### Requirements

- Use form validation.
- Show friendly error states.
- Show loading states.
- Use mock submit handlers first.
- Keep auth design consistent with the premium brand.

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 4: Dashboard Layout

### Goal

Create the authenticated dashboard shell that will hold all user management, rooms, billing, recordings, and scheduling screens.

### Dashboard Layout Requirements

- Sidebar navigation
- Topbar
- User profile menu
- Mobile sidebar drawer
- Responsive dashboard grid
- Breadcrumb or page title area

### Navigation Items

```text
Overview
Rooms
Schedule
Teams
Recordings
Billing
Settings
Support
```

### Dashboard Overview Widgets

- Total rooms
- Upcoming meetings
- Published recordings
- Active subscription plan
- Team members
- Recent activity

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 5: Rooms Management UI

### Goal

Build screens for creating, viewing, editing, and deleting meeting rooms.

### Pages

```text
/dashboard/rooms
/dashboard/rooms/new
/dashboard/rooms/[roomId]
```

### Room Fields

- Room name
- Room slug
- Room type: Meeting or Webinar
- Ownership: Personal or Team
- Recording setting: Off, Free, Paid
- Guest join allowed
- Waiting room enabled
- Access code/PIN optional

### Room List UI

Each room card should show:

- Room name
- Room type
- Room slug/join link
- Recording status
- Owner/team
- Copy link button
- Start meeting button
- Edit button

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 6: Scheduling UI

### Goal

Build the scheduling interface for creating future meetings linked to rooms.

### Pages

```text
/dashboard/schedule
```

### Scheduling Form Fields

- Meeting title
- Room
- Date
- Start time
- End time
- Timezone
- Attendee emails
- Capacity limit
- Description
- Generate calendar invite option

### UI Requirements

- Calendar-style upcoming sessions list
- Empty state
- Edit and cancel actions
- Copy invite link
- Download ICS placeholder button

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 7: Team Management UI

### Goal

Build screens for organization/team management.

### Pages

```text
/dashboard/teams
```

### Team Features

- Create team
- View team members
- Invite member by email
- Assign role: Owner, Admin, Member
- Remove member
- Pending invites

### UI Components

- Team switcher
- Member table
- Invite modal
- Role badge
- Permission explanation card

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 8: Billing and Plans UI

### Goal

Build subscription and payment screens using Paystack-ready UI flows.

### Pages

```text
/dashboard/billing
```

### Plans

```text
Starter
Pro
Business
Enterprise
```

### Billing Features

- Current plan card
- Pricing cards
- Upgrade button
- Downgrade button
- Cancel subscription button
- Payment history table
- Paystack initialization placeholder
- Subscription status
- Current period end

### Important

Do not implement real Paystack payment in this phase unless backend endpoints are already available. Use mock payment states first.

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 9: Recordings UI and Paywall Flow

### Goal

Build recording listing, recording detail, public playback, and paid recording access screens.

### Dashboard Pages

```text
/dashboard/recordings
/dashboard/recordings/[recordingId]
```

### Viewer Page (Bundled in frontend)

```text
/recordings/[recordingId]
```

### Recording Fields

- Title
- Room
- Owner/team
- Published status
- Playback URL
- Access type: Free or Paid
- Price
- Access Setting: Specific users (email), Anyone with link, Only participants
- Created date

### Recording Dashboard Features

- Publish/unpublish toggle
- Set price
- Copy public link
- Preview playback
- View access/payment status

### Public Playback Logic UI

Show one of these states:

1. Recording requires email login / participation validation → show auth/access denied if invalid
2. Recording is free (and access is allowed) → show player
3. Recording is paid and user has paid → show player
4. Recording is paid and user has not paid → show payment prompt
5. Recording is unpublished → show unavailable message

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 10: Meeting Join Experience

### Goal

Build the pre-meeting join screen before a user enters a room.

### Page

```text
/join/[token]
```

### Join Screen Features

- Meeting/room title
- Name input for guest
- Camera preview placeholder
- Microphone selector placeholder
- Camera selector placeholder
- Join as guest
- Login to join option
- Meeting access code input if required
- Waiting room state

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 11: In-Room Meeting Interface

### Goal

Build the main meeting UI before integrating real mediasoup/WebRTC logic.

### Page

```text
/meeting/[roomId]
```

### Meeting UI Layout

The room interface should separate:

- Stage/Presenter view
- Audience/participant grid
- Sidebar panels
- Bottom meeting controls

### Core Components

```text
components/meeting/MeetingShell.tsx
components/meeting/StageView.tsx
components/meeting/ParticipantGrid.tsx
components/meeting/ParticipantTile.tsx
components/meeting/MeetingControls.tsx
components/meeting/ChatPanel.tsx
components/meeting/PollsPanel.tsx
components/meeting/ReactionsLayer.tsx
components/meeting/DocsPanel.tsx
components/meeting/ParticipantsPanel.tsx
```

### Meeting Controls

- Mute/unmute
- Camera on/off
- Share screen
- Reactions
- Chat
- Polls
- Docs
- Participants
- Record
- Leave meeting

### Webinar Mode UI

- Stage area for host/presenter
- Audience list
- Hand raise
- Promote to stage placeholder
- Q&A placeholder

### Important

Use mock participants and mock media tiles first. Do not integrate mediasoup-client yet.

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 12: Reactions, Polls, Chat, and Docs UI

### Goal

Build interactive in-meeting collaboration UI using local state first.

### Features

#### Reactions

- Floating emoji animation
- Reaction picker

#### Polls

- Create poll modal
- Vote on poll
- Show results

#### Chat

- Message list
- Send message input
- Host/system notices

#### Docs

- In-meeting document panel
- Shared notes placeholder
- Download/export placeholder

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 13: eCinema and Playback Viewer UI

### Goal

Build synchronized media playback UI for external media sharing (eCinema Broadcast) and the Netflix-style recording viewer.

### Pages/Components

```text
components/recordings/RecordingPlayer.tsx
components/recordings/PlaybackTheater.tsx
components/meeting/ECinemaPanel.tsx
```

### Features

- Large video player layout
- Chapters/timeline placeholder
- Transcript side panel
- AI summary panel placeholder
- Playback speed controls
- Fullscreen-style theater layout
- Paid/free access display

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 14: API Integration Layer

### Goal

Replace mock data with API-ready service functions.

### Create API Modules

```text
lib/api/auth.ts
lib/api/dashboard.ts
lib/api/teams.ts
lib/api/rooms.ts
lib/api/scheduling.ts
lib/api/recordings.ts
lib/api/payments.ts
lib/api/telephony.ts
lib/api/meeting.ts
```

### Requirements

- Central API client
- Error handling
- Loading states
- Empty states
- Toast notifications
- Type-safe request/response models
- Environment variable for API base URL

### Example Environment Variable

```text
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 15: Real-Time Meeting Client Preparation

### Goal

Prepare the frontend architecture for mediasoup-client and WebSocket signaling.

### Important

Do not force full media implementation too early. First prepare the state architecture.

### Files/Modules

```text
lib/meeting/signaling-client.ts
lib/meeting/media-client.ts
lib/meeting/meeting-store.ts
hooks/useMeetingConnection.ts
hooks/useParticipants.ts
hooks/useMediaControls.ts
```

### Events to Model

- User joined
- User left
- Participant muted
- Participant unmuted
- Camera enabled
- Camera disabled
- Hand raised
- Poll created
- Poll voted
- Reaction sent
- Chat message sent
- Recording started
- Recording stopped

### Approval Checkpoint

Stop after this phase for review.

---

## Phase 16: Final Polish and QA

### Goal

Make the frontend production-ready.

### QA Areas

- Mobile responsiveness
- Dashboard navigation
- Form validation
- Empty states
- Loading states
- Error states
- Accessibility labels
- Keyboard navigation
- SEO metadata for public pages
- Route protection placeholders
- UI consistency
- Dark mode if required
- Performance review

### Final Deliverables

- Fully structured Next.js frontend
- Marketing website
- Auth screens
- Dashboard
- Rooms management
- Scheduling
- Team management
- Billing UI
- Recording UI
- Public playback pages
- Join screen
- Meeting room UI
- Collaboration panels
- API-ready architecture

---

# 5. AI Agent Build Instruction

Use the following prompt to instruct an AI coding agent to build the frontend step by step.

---

## AI Agent Master Prompt

```text
You are a senior frontend engineer building a premium Next.js web application called conn3ct.

conn3ct is a video conferencing, webinar, recording, billing, scheduling, and team collaboration platform. The frontend must be built with Next.js App Router, TypeScript, Tailwind CSS, clean reusable components, and a modern enterprise SaaS design.

Use this Figma link as visual guidance for colors, layout style, and product feel:
https://www.figma.com/design/hNV7a2hoFeaBowmczY9CSh/Konn3ct-Meeting-Design?node-id=1-2&p=f

IMPORTANT EXECUTION RULES:

1. Build the frontend step by step.
2. Do not build everything at once.
3. Complete only one phase at a time.
4. After each phase, stop and ask for review and approval.
5. Do not proceed to the next phase until approval is given.
6. Use mock data first where backend endpoints are not available.
7. Keep the code clean, typed, reusable, and scalable.
8. Avoid hardcoding repeated UI patterns.
9. Use reusable components for cards, buttons, inputs, modals, tables, badges, and layouts.
10. The application must be responsive on desktop, tablet, and mobile.
11. The design must feel premium, modern, secure, enterprise-ready, and polished.
12. Do not integrate real Paystack, mediasoup, WebSocket, or backend logic until the UI and mock states are approved.
13. At the end of every phase, provide:
    - Summary of files created/updated
    - Routes implemented
    - Components created
    - What can be reviewed visually
    - Any assumptions made
    - Approval request before continuing

BUILD PHASES:

Phase 1: Project Foundation
- Set up Next.js App Router with TypeScript and Tailwind CSS.
- Create global styles, route groups, base layouts, and reusable UI primitives.
- Create placeholder pages for marketing, auth, dashboard, and meeting routes.
- Stop for approval.

Phase 2: Marketing Website
- Build the public website homepage, features page, pricing page, and contact page.
- Highlight meetings, webinars, recordings, Paystack billing, eCinema, AI captions, transcriptions, low bandwidth mode, audio boost, telephony, and enterprise support.
- Stop for approval.

Phase 3: Authentication UI
- Build login, signup, forgot password, and reset password screens.
- Add validation, loading states, and error states using mock submit handlers.
- Stop for approval.

Phase 4: Dashboard Layout
- Build authenticated dashboard shell with sidebar, topbar, mobile menu, profile menu, overview stats, and recent activity.
- Stop for approval.

Phase 5: Rooms Management UI
- Build room list, create room, edit/view room screens.
- Include room slug, room type, ownership, recording setting, guest join, waiting room, access code/PIN, copy link, and start meeting controls.
- Stop for approval.

Phase 6: Scheduling UI
- Build scheduling page with meeting form, upcoming sessions list, calendar invite placeholder, attendee emails, capacity limit, and copy invite link.
- Stop for approval.

Phase 7: Team Management UI
- Build team creation, member table, invite modal, pending invites, roles, and permissions UI.
- Stop for approval.

Phase 8: Billing and Plans UI
- Build billing page with Starter, Pro, Business, and Enterprise plans.
- Add current plan card, subscription status, upgrade/downgrade/cancel UI, payment history, and Paystack placeholder.
- Stop for approval.

Phase 9: Recordings UI and Paywall Flow
- Build dashboard recordings list, recording detail page, publish/unpublish UI, price configuration, public playback page, and paid/free access states.
- Stop for approval.

Phase 10: Meeting Join Experience
- Build join page with name input, camera/mic placeholders, guest join, login option, access code input, and waiting room state.
- Stop for approval.

Phase 11: In-Room Meeting Interface
- Build the meeting room UI with stage/presenter view, participant grid, audience view, controls, side panels, chat, polls, docs, reactions, participants, and leave button.
- Use mock participants and mock media tiles only.
- Stop for approval.

Phase 12: Reactions, Polls, Chat, and Docs UI
- Build local-state interactions for reactions, polls, chat, and in-meeting docs.
- Stop for approval.

Phase 13: eCinema and Playback Viewer UI
- Build synchronized media player UI and Netflix-style recording viewer with chapters, transcript panel, AI summary placeholder, playback controls, and theater layout.
- Stop for approval.

Phase 14: API Integration Layer
- Create typed API service modules for auth, dashboard, teams, rooms, scheduling, recordings, payments, telephony, and meeting.
- Replace mock data gradually only after UI approval.
- Stop for approval.

Phase 15: Real-Time Meeting Client Preparation
- Prepare architecture for mediasoup-client and WebSocket signaling.
- Create meeting state hooks and client modules but do not force complete real media implementation yet.
- Stop for approval.

Phase 16: Final Polish and QA
- Review responsiveness, accessibility, SEO, empty/loading/error states, route protection placeholders, visual consistency, and performance.
- Provide final summary.

Start now with Phase 1 only.
Do not proceed beyond Phase 1 until I approve.
```

---

# 6. Review and Approval Template

Use this after every development phase.

```text
PHASE REVIEW

Phase completed:

Files created/updated:
- 

Routes implemented:
- 

Components created:
- 

Mock data added:
- 

What to review:
- 

Assumptions made:
- 

Issues or pending decisions:
- 

Please review and approve before I proceed to the next phase.
```

---

# 7. Recommended First Command to Give the AI Agent

```text
Start with Phase 1 only.
Set up the Next.js App Router frontend with TypeScript and Tailwind CSS.
Create the base folder structure, global layout, route groups, reusable UI primitives, dashboard shell placeholder, marketing placeholder, auth placeholder, and meeting placeholder.
Use mock data only.
Stop after Phase 1 and provide the phase review summary.
Do not continue to Phase 2 until I approve.
```

---

# 8. Notes for Human Review

When reviewing each phase, check:

- Does the UI look premium?
- Is it responsive?
- Are components reusable?
- Is the route structure clean?
- Is mock data separated from components?
- Are forms properly validated?
- Are loading and error states considered?
- Is the code ready for backend integration later?
- Did the agent stop at the correct checkpoint?

---

# 9. Important Product Reminders

The frontend should eventually support:

- Signup/login
- Team management
- Room creation
- Billing with Paystack
- Scheduling
- Meeting links
- Guest join
- Recording publishing
- Free and paid recording access
- Meeting interface
- Presenter/stage view
- Audience view
- Chat
- Polls
- Reactions
- In-meeting docs
- eCinema
- Recording playback
- Live captions
- Translate
- Transcriptions
- AI summaries
- Low bandwidth mode
- Audio boost
- Telephony call-in/call-out UI
- Support ticketing

Build the UI in a way that allows these features to be added progressively without redesigning the entire application.
