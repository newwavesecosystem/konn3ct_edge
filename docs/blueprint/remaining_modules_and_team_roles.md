# Konn3ct Edge - Remaining Modules & Team Allocation Matrix

This document provides the CTO with an inventory of all remaining workstreams, technical modules, and engineering roles required by the 12-volume Konn3ct Edge Blueprint that have not yet been assigned to Feranmi, Kay, or Zammy.

---

## 1. Summary of Currently Assigned Workstreams

| Developer | Assigned Role | Primary Focus Area | Task File Reference |
| :--- | :--- | :--- | :--- |
| **Feranmi** | Next.js Frontend Lead | Global Admin Web Portal (Dashboards, Overrides, UI) | `feranmi_admin_tasks_v2.csv` |
| **Kay** | Backend API & Data Lead | Core REST APIs, Authentication, DB Models, Odoo Event Dispatchers | `kay_api_tasks.csv` |
| **Zammy** | Odoo 19 ERP Lead | Odoo 19 Base Modules, Custom Addons, Lead Scoring, Automation | `zammy_odoo_tasks.csv` |

---

## 2. Remaining Unassigned Engineering Modules

To complete the V1 launch and meet the technical requirements of the Blueprint, the following 5 engineering pods/roles need to be assigned:

### Module Pod 1: WebRTC & Real-Time Media Engine
*   **Blueprint Focus:** Volumes 6 & 7 (Media Infrastructure & Meeting Reliability).
*   **Key Responsibilities:**
    *   Deploy and configure WebRTC SFU (Selective Forwarding Unit) media servers.
    *   Set up global TURN/STUN servers in **India, South America, and North America** for low latency.
    *   Implement simulcast / adaptive bitrate streams, packet loss recovery, and audio-first fallback logic.
    *   Build client-side WebRTC reconnection hooks for variable network conditions.
*   **Ideal Assignee Role:** Real-Time Media Engineer / WebRTC Specialist.

### Module Pod 2: Mobile Applications (Android & iOS)
*   **Blueprint Focus:** Volume 4 (Mobile-First Experience & Distribution).
*   **Key Responsibilities:**
    *   Develop native or cross-platform (React Native / Flutter / Native iOS & Android) mobile apps.
    *   Implement deep-linking (`konn3ct://join/{roomId}`), push notifications (FCM/APNs), and mobile onboarding.
    *   Build mobile pre-meeting permissions handler (Camera/Microphone) and native mobile replay player.
    *   Ensure mobile checkout and paid replay access flows work smoothly on small screens.
*   **Ideal Assignee Role:** Mobile Lead Engineer.

### Module Pod 3: End-User & Host Web Application (Core Product UX)
*   **Blueprint Focus:** Volumes 3 & 4 (Product Pillars & Participant Experience).
*   **Key Responsibilities:**
    *   Build the main Konn3ct client web app (separate from Feranmi's Admin Portal).
    *   Host Dashboard: Meeting scheduling, webinar setup, paid event configuration, and replay publishing.
    *   Participant Experience: Pre-meeting lobby, room grid/stage layout, screen share controls, in-meeting chat, and hand raising.
    *   Public Replay Library & Paid Event Checkout UI.
*   **Ideal Assignee Role:** Core Web Product Frontend Engineer.

### Module Pod 4: DevOps, Infrastructure & Cyber Security (SecOps)
*   **Blueprint Focus:** Volumes 6, 7, and 10 (Cloud Architecture, WAF, Security & Automated Bots).
*   **Key Responsibilities:**
    *   Provision and manage **Digital Ocean Kubernetes (DOKS)** clusters and database replication.
    *   Configure **Cloudflare WAF** (firewalls against DDoS, SQLi, XSS) and CDN streaming for replays.
    *   Build the **Automated Load & Stress Test Bots** (to load the system until 3 server nodes scale up automatically).
    *   Build automated **Penetration & Vulnerability Scanning Bots** and human-simulation performance bots.
    *   Manage CI/CD deployment pipelines, staging environments, and secrets rotation.
*   **Ideal Assignee Role:** DevOps / SecOps Engineer.

### Module Pod 5: AI Pipeline & Quality Assurance (QA Engine)
*   **Blueprint Focus:** Volumes 5, 6, and 7 (AI Services & Intelligent QA Engine).
*   **Key Responsibilities:**
    *   Build the background AI pipeline: Automated audio transcription, LLM meeting summarization, action item extraction.
    *   Develop the **Independent AI QA Test Engine**: Automated test runner executing sprint quality checks against the Intelligent SLA Library before human QA.
    *   Build the support-ticket-to-regression-test learning loop.
*   **Ideal Assignee Role:** AI Engineer / QA Automation Lead.

---

## 3. Recommended Next Steps for Team Assignment

1.  **Assign SecOps / DevOps:** Priority #1 so Kay, Feranmi, and Zammy have stable staging infrastructure to deploy to.
2.  **Assign Core Product Frontend Engineer:** To build the host scheduling and participant meeting interface that Kay's APIs will power.
3.  **Assign WebRTC Media Specialist:** To ensure low-latency media routing and global TURN server availability.
4.  **Assign Mobile & AI/QA Engineers:** As Phase 2 deliverables during the 0–90 day timeline.
