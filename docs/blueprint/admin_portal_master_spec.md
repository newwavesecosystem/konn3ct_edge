# Konn3ct Edge - Admin Portal Master Scope & Blueprint Specification

This document provides a definitive, volume-by-volume synthesis of the **Konn3ct Global Admin Portal**. It synthesizes all scopes, technical requirements, architectural dependencies, and operational summaries extracted from the 12-volume Konn3ct Edge Blueprint.

---

## 1. Executive Summary & Strategic Role
The **Konn3ct Global Admin Portal** serves as the operational command center for the entire collaboration ecosystem. While the **Participant/Host App** handles live meeting experiences and **Odoo ERP** handles commercial CRM, invoicing, and marketing campaigns, the **Admin Portal** is strictly built for:

1.  **Platform Governance:** User, role, and organization access management.
2.  **Financial Overrides (PayGate Shield™):** Manual entitlement grants, payment failure inspection, and comp access.
3.  **Real-time Diagnostics & QA:** WebRTC stream quality inspection, SFU node monitoring, and diagnostic snapshot generation (Volumes 6 & 7).
4.  **Security & Privacy (TrustLock™ & ReplayVault™):** Emergency recording access under strict "Break Glass" audit controls (Volume 10).
5.  **Executive KPI Tracking:** Monitoring the "Primary KPI Doctrine" (Free Users vs. Paid Users) and international expansion (Volume 5).

---

## 2. Blueprint Volume Mapping for the Admin Portal

| Volume | Admin Portal Responsibilities & Scope |
| :--- | :--- |
| **Volume 1: Brand & Foundation** | Enforces consistent K3 branding, role terminology (Host, Co-Host, Moderator, OrgAdmin, SuperAdmin). |
| **Volume 3: Product Strategy** | Workspace administration, paid event controls, and replay library entitlement management. |
| **Volume 5: AI Hypergrowth & KPIs** | Displays Free vs. Paid User North Star metrics, usage trends, and Country Hub growth widgets. |
| **Volume 6: Technical Architecture** | Exposes WebRTC stats, SFU load diagnostics, DB/Redis health, and API gateway rate limits. |
| **Volume 7: QA & Release Governance** | Integrates AI QA Engine status, sprint release scoring, and diagnostic snapshot exports. |
| **Volume 8: Commercial Model** | Handles manual financial overrides, entitlement revocations, and payment gateway transaction logs. |
| **Volume 9: Customer Success & Support** | Monitors AI support queue performance, ticket escalations, and customer health signals. |
| **Volume 10: Security, Privacy & Trust** | Controls "Break Glass" private recording access, GDPR purges, and immutable audit logs. |
| **Volume 11: Integrations & Odoo** | Monitors Odoo sync queue health, webhook retry queues, and API integration logs. |
| **Volume 12: Execution & Governance** | Enforces Role-Based Access Control (RBAC) and executive reporting dashboards. |

---

## 3. Full Scope of Functional Domains

### Domain 1: User & Organization Governance
*   **User Directory:** Full-text search and server-side paginated tables of all registered hosts and participants.
*   **Account Lifecycle Actions:** Instant suspension, unsuspension, and full ban (which triggers SFU socket disconnection to kick banned users from live meetings).
*   **Organization Management:** Managing enterprise/institutional accounts, allocating seat caps, and editing plan tiers.

### Domain 2: Financial Overrides & PayGate Shield™
*   **Transaction Logs:** Viewing real-time payment attempt logs across Paystack, Stripe, and direct transfers.
*   **Webhook Payload Inspector:** Debugging raw JSON payloads from payment gateways for failed checkouts.
*   **Manual Entitlements:** Granting complimentary ("Comp") access to paid events or replays with mandatory audit reason logging.
*   **Revocation:** Revoking expired or fraudulent entitlements instantly in Redis.

### Domain 3: Real-Time WebRTC Diagnostics & SFU Monitoring
*   **Active Rooms Summary:** Live monitoring grid displaying room count, connected participants, and server node distribution.
*   **WebRTC Quality Inspector:** Real-time time-series charts showing packet loss, jitter, audio/video bitrates, and flagging loss > 3%.
*   **Participant Connection Inspector:** Inspecting client types (Web, Android, iOS), network scores, and triggering remote socket reconnects.
*   **Diagnostic Snapshot Export:** One-click download of sanitized JSON snapshots for engineering handoffs.

### Domain 4: AI Services & Content Moderation
*   **Queue Monitoring:** Tracking background job queues (Transcripts, Meeting Summaries, Action Points).
*   **Job Retry:** One-click retry trigger for failed AI background jobs.
*   **Summary Moderation:** Editing and approving AI-generated meeting summaries prior to public replay publication.

### Domain 5: Content Governance & ReplayVault™
*   **Media Inventory:** Table listing all recorded assets, storage footprint, and hot/cold storage tiers.
*   **"Break Glass" Security Protocol:** Accessing private recordings in emergency support/legal scenarios. Requires password re-authentication, mandatory ticket ID entry, 15-minute signed URL generation, and security team alert dispatching.
*   **GDPR Purge Action:** Hard-deleting recordings, transcripts, and metadata from S3 buckets and databases.

### Domain 6: Executive Analytics & Country Growth
*   **North Star KPI Header:** Real-time tracking of Total Free Users and Total Paid Users with MTD growth percentages.
*   **Trend Visualizations:** Interactive charts for Meetings Hosted, Subscription Upgrades/Cancellations, and Replay Revenue.
*   **Country Growth Breakdown:** Regional widget tracking conversion rates and Country Hub readiness metrics.

### Domain 7: Security & Immutable Audit Logging
*   **Read-Only Audit Trail:** Strict table recording every `POST`, `PUT`, `DELETE` action taken by any admin.
*   **Event Details Viewer:** Syntax-highlighted JSON viewer showing pre-action and post-action state payloads.
*   **CSV Export:** Compliance-ready export of audit trails.

---

## 4. Things Needed (Technical Prerequisites & Infrastructure)

To build and run the Admin Portal, the engineering team requires the following tech stack and infrastructural components:

### A. Frontend Prerequisites (Feranmi's Stack)
*   **Framework:** Next.js 14+ (App Router, Server Components).
*   **Language:** TypeScript (Strict mode enabled).
*   **Styling:** Tailwind CSS & Reusable UI Component Library.
*   **State & Auth:** React Context API, NextAuth/Custom Auth Provider, HTTP-Only Cookie storage.
*   **Data Visualization:** Recharts or Chart.js for diagnostics and KPI reporting.
*   **Data Formatting:** Syntax-highlighted JSON viewer components (e.g., `react-json-view`).

### B. Backend API & Real-Time Prerequisites (Kay's Stack)
*   **API Protocol:** RESTful JSON APIs with versioning (`/api/v1/admin/*`).
*   **Real-time Engine:** WebSockets or Redis Pub-Sub connection to SFU nodes for live WebRTC stream telemetry.
*   **Caching & Session Storage:** Redis cluster for session blacklists, active meeting counters, and short TTL metric caching.
*   **Database:** Indexed Relational Database (PostgreSQL/MySQL) for users, organizations, transactions, and audit logs.
*   **Queue System:** BullMQ / Celery / RabbitMQ for AI background job monitoring and Odoo sync retries.
*   **Object Storage:** AWS S3 or Digital Ocean Spaces for signed URL generation and media storage management.

### C. Security & Permission Middleware
*   **RBAC Matrix:** Middleware enforcing permission scopes (`users:read`, `users:write`, `financials:override`, `system:superadmin`).
*   **Central Audit Interceptor:** `@AuditLog` decorator on backend API routes to automatically log admin IDs, IPs, user agents, and payloads without delaying API responses.

---

## 5. Delivery Checklist & Handoff Summary

1.  **Frontend Engineering:** Refer to [feranmi_admin_tasks_v2.csv](file:///C:/conn3ct_meeting/docs/blueprint/feranmi_admin_tasks_v2.csv) (Tasks `TSK-001` through `TSK-031`).
2.  **Backend Engineering:** Refer to [kay_api_tasks.csv](file:///C:/conn3ct_meeting/docs/blueprint/kay_api_tasks.csv) (Tasks `API-001` through `API-030`).
3.  **Detailed Requirements:** Refer to [feranmi_admin_dashboard_requirements.md](file:///C:/conn3ct_meeting/docs/blueprint/feranmi_admin_dashboard_requirements.md) and [admin_dashboard_spec.md](file:///C:/conn3ct_meeting/docs/blueprint/admin_dashboard_spec.md).

This master document serves as the single source of truth for the scope, architecture, and technical dependencies of the Konn3ct Admin Portal.
