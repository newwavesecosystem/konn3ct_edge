# Konn3ct Edge - Core Web Product Master Scope & Frontend Specification

**Target Developer:** Feranmi  
**Tech Stack:** Next.js (React), TypeScript, WebRTC Client SDK, Tailwind/CSS System  
**Context:** This document outlines the full scope, interface expectations, and technical requirements for the **Core Konn3ct Web Application** (End-User Participant Experience, Host Workspace, Live Meeting Controls, Webinar Panel, TrustLock™ Security Family, and Paid Replay Storefront) as defined across the Konn3ct Edge Blueprint.

---

## 1. Executive Summary & Product Architecture

While Feranmi's previous task scope focused on the **Global Admin Portal**, this specification covers the **Core Konn3ct Web Application**—the primary web product used by hosts, participants, webinar attendees, and replay viewers.

### Primary UI Domains:
1.  **Host Workspace & Scheduling Center:** Meeting creation, webinar pricing setup, recording publishing, and host analytics.
2.  **Pre-Meeting Device Lobby & Onboarding:** Camera/mic permissions checks, device selection, audio meters, and waiting room admission.
3.  **Live Meeting Room Experience (WebRTC Client):** Dynamic layout switching (Grid, Active Speaker, Stage), screen sharing, participant list, bottom control bar, and live chat.
4.  **TrustLock™ Security & Privacy Suite (Volume 10):** Dynamic video watermarking, room locking, verified identity badges, E2EE status shields, and anti-leak screen share overlays.
5.  **Webinar & Moderation Panel:** Q&A submission module, attendee-to-presenter promotion, and host moderation controls.
6.  **Replay Library & Paid Storefront:** Interactive replay video player with AI-generated summary timestamps, transcript search, and PayGate Shield checkout flows.

---

## 2. Blueprint Volume Mapping

| Volume | Core Web Product Responsibilities & Scope |
| :--- | :--- |
| **Volume 1: Brand & Positioning** | Establishes the K3 UI design language, typography, and connection ritual. |
| **Volume 3: Product Strategy** | Host journey map, participant experience, grid/stage layout switching, webinar paid access flows. |
| **Volume 4: Multi-Platform UX** | Shared desktop and mobile web experiences, responsive breakpoints, low-bandwidth UI indicators. |
| **Volume 6: Technical Architecture** | WebRTC signaling integration, SFU stream rendering, screen share overlay, and WebRTC stat displays. |
| **Volume 8: Revenue Model** | Paid event ticket checkout modals, paid replay entitlement gates, and subscription upgrade prompts. |
| **Volume 10: TrustLock™ & Security** | Dynamic video watermarks, verified identity badges, E2EE shields, room locking, and anti-leak protection. |

---

## 3. Detailed Interface Modules & Expectations

### Module 1: Host Workspace & Scheduling Center
*   **Overview:** A dedicated workspace where hosts schedule meetings, manage webinars, set up paid events, and publish replays.
*   **Key Views:**
    *   `Upcoming Meetings List`: Displays scheduled meetings with one-click 'Start Session' and 'Copy Invite Link' buttons.
    *   `Schedule Session Modal`: Options for Instant Meeting, Scheduled Session, or Paid Webinar.
    *   `Paid Event Setup`: Input fields for ticket price, max attendee capacity, and payment gateway selection.
    *   `Replay Publishing Manager`: List of unreleased meeting recordings with toggles for Public, Private, or Paid Access.

### Module 2: Pre-Meeting Device Lobby & Onboarding
*   **Overview:** The pre-session landing page where users test hardware and prepare before entering the live meeting room.
*   **Key Views:**
    *   `Media Device Setup`: Camera dropdown selector, Microphone dropdown selector, Speaker test button, and live Audio Input volume meter.
    *   `Video Preview Screen`: Self-view video box with background blur toggle and camera preview.
    *   `User Identity Input`: Name entry for guest users; auto-filled profile for logged-in hosts.
    *   `Waiting Room Screen`: Rendered when host has waiting room enabled, displaying a branded "Host will admit you shortly" animation.

### Module 3: Live Meeting Room Experience (WebRTC Client)
*   **Overview:** The real-time collaboration canvas rendering WebRTC audio/video streams from the SFU media server.
*   **Key Views:**
    *   `Dynamic Canvas Layouts`:
        *   **Grid View:** Equal 2x2, 3x3, 4x4 participant video tiles with active speaker highlight borders.
        *   **Active Speaker View:** Large primary speaker video box with filmstrip of participants at the top/bottom.
        *   **Screen Share Stage View:** Prominent screen share canvas with floating speaker overlay windows.
    *   `Bottom Control Bar`: Mute/Unmute, Video On/Off, Screen Share Toggle, Raise Hand, Reaction Emojis, Chat Panel Toggle, Participant Panel Toggle, Leave Meeting.
    *   `In-Meeting Chat Drawer`: Tabbed chat (Public Room Chat, Private Host Chat) with emoji support.
    *   `Participant List Drawer`: Searchable list of participants showing mute icons, video status, raise-hand badges, and Host moderation actions (Mute Participant, Pin Video, Lower Hand).

### Module 4: TrustLock™ Security & Privacy Suite (Volume 10 Feature Family)
*   **Overview:** Enterprise-grade in-meeting security features protecting confidential sessions from unauthorized viewing or leaks.
*   **Key Views & Features:**
    *   `Dynamic Video Watermarking Overlay`: Semi-transparent overlay of the viewing participant's email/IP address rendered over live video streams to deter phone camera recordings or leaks.
    *   `Verified Identity Badges`: Green verified checkmark badge on participant tiles indicating authenticated enterprise/institutional identity vs unverified guest join.
    *   `End-to-End Encryption (E2EE) & Trust Shield`: Top bar badge displaying active TrustLock status, encryption profile, and security settings.
    *   `Host Security Control Panel`: Quick-access security modal allowing hosts to lock room, disable participant screen sharing, disable participant chat, or toggle watermarking on/off mid-session.
    *   `Anti-Leak Screen Share Protection`: Protective CSS/canvas blur rules applied when browser window loses focus during sensitive presentations.

### Module 5: Webinar & Moderation Panel
*   **Overview:** Specialized controls for large-scale, moderated webinars where attendees are view-only.
*   **Key Views:**
    *   `Q&A Module`: Dedicated drawer where attendees submit text questions, upvote existing questions, and hosts mark questions as 'Answered Live'.
    *   `Presenter Promotion Modal`: Host action to elevate a view-only attendee to a live Presenter (enabling camera/mic permissions).

### Module 6: Replay Library & Paid Storefront
*   **Overview:** The public and monetized content portal where users watch past recorded sessions.
*   **Key Views:**
    *   `Replay Video Player`: Custom video player with interactive AI Summary chapters (clicking a chapter jumps video to timestamp).
    *   `Transcript Sidebar`: Auto-scrolling, searchable transcript synchronized with video playback.
    *   `PayGate Shield Checkout Modal`: Rendered when a user attempts to watch a paid replay, presenting payment options before unlocking stream access.

---

## 4. Deliverables Checklist for Feranmi

Feranmi will execute these requirements via the task list in [feranmi_core_web_tasks.csv](file:///C:/conn3ct_meeting/docs/blueprint/feranmi_core_web_tasks.csv). All tasks follow the `MM/DD/YYYY` timeline starting from `08/10/2026`.
