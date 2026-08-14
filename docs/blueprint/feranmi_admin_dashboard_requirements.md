# Konn3ct Edge - Global Admin Web Interface Requirements

**Target Developer:** Feranmi  
**Tech Stack Requirement:** Next.js (React), TypeScript, Modular Component Design  
**Context:** This document outlines the requirements, expected interfaces, and strict acceptance criteria for the Konn3ct Global Admin Dashboard as defined by the Konn3ct Edge Blueprint.

---

## 1. Architectural & Interface Expectations
The Global Admin Dashboard is the central command center for Konn3ct platform operations. It sits separately from the end-user Participant/Host dashboards and the Odoo CRM interface.

*   **Framework:** Must be built using **Next.js** (App Router recommended for server-side rendering benefits and API route handling).
*   **Performance:** Fast page loads are critical. The dashboard will consume heavy data (WebRTC stats, large user tables). Implement pagination, lazy loading, and server-side filtering.
*   **Modular UI:** Build using a shared design system. The dashboard will evolve rapidly; widgets (e.g., AI Diagnostic logs) must be isolated components that don't break the main layout when updated.
*   **Responsiveness:** While primarily a desktop tool for administrators, the layout must not break on tablets (iPad Pro size) for on-the-go monitoring.
*   **Security (RBAC):** Strict Role-Based Access Control must be enforced on the frontend (hiding unauthorized navigation items) and strictly verified on every Next.js API route.

---

## 2. Core Modules & Acceptance Criteria

### Module A: User & Organization Management
Administrators need to view, manage, and intervene in user and organization accounts.

*   **Expected Interface:** A comprehensive data table with advanced filtering (by country, subscription status, role, organization) and a detailed slide-out/modal view for individual user profiles.
*   **Acceptance Criteria:**
    *   `[ ]` Admin can search for any user by email, ID, or name with sub-second response times.
    *   `[ ]` Admin can view a user's meeting history, replay ownership, and current subscription tier.
    *   `[ ]` Admin can suspend, ban, or force-logout a user.
    *   `[ ]` All state-changing actions (e.g., banning a user) must prompt a confirmation modal and log the action to the Audit Trail.

### Module B: Financial Overrides & Access Control
While Odoo handles invoicing, the Admin Dashboard handles immediate platform access overrides (PayGate Shield™).

*   **Expected Interface:** A transaction log view tied to specific events or users, with action buttons for manual overrides.
*   **Acceptance Criteria:**
    *   `[ ]` Admin can view the status of any payment attempt (Pending, Failed, Successful).
    *   `[ ]` Admin can manually grant "Comp" (complimentary) access to a paid event or replay for a specific user.
    *   `[ ]` Admin can revoke access to an entitlement.
    *   `[ ]` Every manual grant or revocation requires the admin to input a required "Reason" text field for audit purposes.

### Module C: Technical Diagnostics & QA Monitoring
This is a critical view for DevOps and QA to monitor platform stability (Volume 6 & 7).

*   **Expected Interface:** A real-time monitoring dashboard showing active meetings, server loads, and a searchable log of "Issue Snapshots."
*   **Acceptance Criteria:**
    *   `[ ]` Admin can view a list of all currently active meetings and their participant counts.
    *   `[ ]` Admin can view WebRTC health metrics (packet loss, jitter, reconnect events) for a specific meeting in progress.
    *   `[ ]` Admin can view the status of backend AI Jobs (e.g., "Transcript Generation - Pending/Failed/Complete").
    *   `[ ]` Admin can export a "Diagnostic Snapshot" of a failed meeting for the engineering team.

### Module D: Recording & Content Governance
Admins must enforce TrustLock™ and ReplayVault™ privacy rules (Volume 10).

*   **Expected Interface:** A media management table showing all platform recordings, their storage footprint, and their privacy status.
*   **Acceptance Criteria:**
    *   `[ ]` Admin can view metadata for all recordings (Host, Duration, Size, Status).
    *   `[ ]` Admin cannot view/play private recordings directly without triggering a "Break Glass" security protocol (which must be heavily audited).
    *   `[ ]` Admin can manually delete a recording to comply with GDPR/Data Deletion requests.
    *   `[ ]` Admin can view AI summary outputs attached to public/paid replays for moderation.

### Module E: Analytics & Country Growth
High-level KPIs for executive review (Volume 5).

*   **Expected Interface:** Visual charts and KPI cards tracking the "Primary KPI Doctrine": Free Users vs. Paid Users.
*   **Acceptance Criteria:**
    *   `[ ]` Dashboard displays total Free Users and Paid Users, filterable by date range and Country.
    *   `[ ]` Dashboard displays secondary metrics: Total Meetings Hosted, Total Replay Views, and System Uptime.
    *   `[ ]` Charts must use a reliable charting library (e.g., Recharts, Chart.js) and handle empty data states gracefully.

---

## 3. Security & Audit Logging (Crucial)
*   **Requirement:** Every `POST`, `PUT`, `DELETE` request originating from the Next.js frontend must be logged.
*   **Acceptance Criteria:**
    *   `[ ]` There is a dedicated "Audit Log" view accessible only to Super Admins.
    *   `[ ]` The log displays: Timestamp, Admin User ID, Action Taken, Target Entity ID, and IP Address.
    *   `[ ]` The audit log table cannot be edited or deleted from the frontend interface.
