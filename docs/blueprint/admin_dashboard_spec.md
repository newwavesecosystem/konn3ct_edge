# Konn3ct Edge - Global Admin Dashboard Specification

The Global Admin Console is the central command center for the Konn3ct platform. While Odoo handles the commercial CRM and billing operations, the Admin Dashboard is strictly for platform operations, technical diagnostics, user management, and quality control.

## Core Responsibilities

### 1. Operational Visibility
*   **User Management:** Ability to view, suspend, or upgrade user accounts, organizations, and roles across the platform.
*   **Payment & Subscription Overrides:** Ability to inspect failed transactions, issue refunds, or grant manual "comp" access to paid events and replays.

### 2. Quality Assurance & Diagnostics
*   **Meeting Health:** View active rooms, WebRTC performance stats (packet loss, jitter), and SFU media server loads.
*   **QA Diagnostic Overlay:** Access diagnostic snapshots, crash analytics, and exported issue evidence for developer handoff.
*   **AI Service Monitoring:** Monitor the success/failure rates of AI jobs (transcripts, summaries) and queue health.

### 3. Trust, Security & Compliance
*   **Recording Governance:** Enforce privacy rules, manage storage lifecycles, and securely access or delete recordings based on compliance requests.
*   **Audit Logging:** Trace admin, support, and payment actions to maintain a strict accountability trail.

### 4. Country Growth & Analytics
*   **Usage Metrics:** High-level analytics on active meetings, participant volumes, and feature adoption.
*   **Regional Monitoring:** Track performance and usage spikes across different geographical locations to aid in country hub expansion and load balancer tuning.

## Development Principles
*   **Modular Interface:** Built using the shared Konn3ct design system so new widgets (e.g., a new AI diagnostic tool) can be added without breaking the core layout.
*   **Role-Based Access Control (RBAC):** Strict permissions ensuring that support agents, finance users, and super-admins only see the data relevant to their role.
