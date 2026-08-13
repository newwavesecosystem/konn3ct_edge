# Konn3ct Edge - Zammy's Odoo 19 Developer Guide & Ecosystem Master Spec

**Target Developer:** Zammy  
**Target Platform:** Odoo 19 Enterprise  
**Backend Partner:** Kay (Konn3ct Backend Lead)  
**Context:** This document provides Zammy with full technical clarity on setting up Odoo 19 Enterprise, configuring the base modules, establishing his dev environment, building custom addons, and consuming backend data signals from Kay's worker queue dispatches.

---

## 1. Zammy's Development Environment & Setup Guide

### Environment Architecture:
*   **Odoo Version:** **Odoo 19 Enterprise**
*   **Python Runtime:** Python 3.11+
*   **Database:** PostgreSQL 16+ (Host/Containerized with pg_vector / indexing support)
*   **Containerization:** Docker & Docker Compose setup (`/docker-compose.yml`)
*   **Custom Addons Directory:** Mounted at `/var/lib/odoo/custom-addons`

### Dev Machine Setup Commands:
```bash
# 1. Clone Konn3ct Odoo 19 Addons Repo
git clone git@github.com:konn3ct/odoo19-custom-addons.git

# 2. Spin up Docker Dev Environment (Odoo 19 + Postgres 16)
docker-compose up -d

# 3. Scaffold a New Custom Addon
docker-compose exec odoo odoo-bin scaffold konn3ct_subscriber_sync /var/lib/odoo/custom-addons
```

---

## 2. Base Odoo 19 Modules to Activate

Zammy will activate and configure the following 10 standard Odoo 19 base modules:

1.  **CRM:** Lead capture, qualification pipelines, and sales assignment rules.
2.  **Marketing Automation:** Automated drip sequences, demo reminders, and abandoned checkout recoveries.
3.  **Email Marketing:** Newsletter broadcasts, feature release announcements, and replay notifications.
4.  **Events:** Webinar registrations, demo signups, and landing page form sync.
5.  **Sales:** Quotations, custom enterprise packages, and pricing tiers.
6.  **Subscriptions:** Recurring billing plans, auto-renewals, upgrade triggers, and churn tracking.
7.  **Accounting / Invoicing:** Invoicing, automated payment reconciliation, MRR/ARR financial reporting.
8.  **Helpdesk:** Support ticket management, diagnostic snapshot attachments, and SLA tracking.
9.  **Knowledge:** Sales scripts, objection handling playbooks, support FAQs.
10. **Survey:** Post-event feedback, NPS, and churn feedback collection.

---

## 3. Metric & Signal Handoffs: Kay (Backend) $\rightarrow$ Zammy (Odoo 19)

To power Odoo 19, Kay's background worker queues will dispatch exact JSON payloads to Zammy's Odoo 19 inbound API endpoints. Zammy's custom modules will ingest these metrics to drive automations:

| Signal / Event Name | Kay's API Worker Task | Zammy's Odoo 19 Module Handler | Data Payload Fields Sent to Zammy | Odoo 19 Operational Action |
| :--- | :--- | :--- | :--- | :--- |
| **`USER_REGISTERED`** | `API-026` | `konn3ct_subscriber_sync` | User ID, Name, Email, Country Code, Referral Code, Lead Source, IP | Creates Contact & Lead in Odoo 19. Tags Lead Source. |
| **`USAGE_METRICS`** | `API-027` | `konn3ct_usage_intelligence` | User ID, Meetings Hosted, Meetings Joined, Watch Duration, AI Notes Used | Updates `x_customer_health_score` (0-100). Triggers alert if < 40. |
| **`PAYMENT_SUCCESS`** | `API-028` | `konn3ct_subscriber_sync` | Tx Ref, User ID, Amount, Currency, Plan/Event ID, Gateway | Activates Subscription, generates Invoice, updates MRR. |
| **`PAYMENT_FAILED`** | `API-028` | `konn3ct_payment_recovery` | Tx Ref, User ID, Amount, Gateway, Error Code, Abandoned Cart Flag | Triggers Abandoned Checkout email/SMS recovery sequence. |
| **`PAID_EVENT_PURCHASE`**| `API-028` | `konn3ct_paid_events` | User ID, Event ID, Ticket Price, Payment Status | Creates Sale Order in Odoo 19 and triggers webhook to grant access. |
| **`SUPPORT_TICKET`** | `API-029` | `Odoo Helpdesk` | Ticket ID, User Email, Issue Category, Diagnostic Snapshot JSON URL | Creates Helpdesk ticket. Maps priority based on plan. Attaches JSON link. |

---

## 4. Custom Konn3ct Odoo 19 Addons (To Be Developed by Zammy)

1.  **`konn3ct_subscriber_sync`:** Ingests Kay's `USER_REGISTERED` and `PAYMENT_SUCCESS` payloads to keep Contacts and Subscriptions synchronized.
2.  **`konn3ct_usage_intelligence`:** Ingests Kay's daily activity metrics (`API-027`) and dynamically calculates `x_customer_health_score` (0–100).
3.  **`konn3ct_paid_events`:** Links Odoo 19 Events/Sales to Konn3ct webinar ticket purchases and fires webhooks back to Kay to grant room access.
4.  **`konn3ct_replay_monetization`:** Tracks paid replay purchases and calculates host/creator revenue share percentages in Odoo 19 Invoicing.
5.  **`konn3ct_partner_attribution`:** Maps referral codes from Kay's payloads to Ambassador contact cards and calculates monthly commission payouts.

---

## 5. Zammy's 4-Tier Lead Scoring Model in Odoo 19

Zammy will configure Odoo 19 automated lead scoring combining four 25-point blocks:

*   **Fit Score (0-25 pts):** Match against Ideal Customer Profile (Enterprise, School, Association, High-Volume Creator).
*   **Intent Score (0-25 pts):** Intent signals (Pricing page clicks, demo requests, app downloads, paid event signups).
*   **Engagement Score (0-25 pts):** Telemetry ingested from Kay (Meetings hosted, replays watched, AI notes used).
*   **Revenue Potential Score (0-25 pts):** Account size and seat count potential.

### Routing Actions:
*   **Cold (0–39):** Automated onboarding drip sequence.
*   **Warm (40–64):** Demo invitation campaign.
*   **Hot (65–84):** Assigned to Sales Representative for outreach within 24 hours.
*   **Strategic (85–100):** Routed directly to Executive Leadership / Enterprise Sales team.

---

## 6. Handoff Files & Delivery Directory

*   **Zammy's Odoo 19 Task CSV:** [zammy_odoo_tasks.csv](file:///C:/conn3ct_meeting/docs/blueprint/zammy_odoo_tasks.csv) (Tasks `ODOO-001` through `ODOO-015`).
*   **Kay's Backend API Task CSV:** [kay_api_tasks.csv](file:///C:/conn3ct_meeting/docs/blueprint/kay_api_tasks.csv) (Tasks `API-026` through `API-029` dispatch data to Zammy).
*   **Feranmi's Next.js Frontend CSV:** [feranmi_admin_tasks_v2.csv](file:///C:/conn3ct_meeting/docs/blueprint/feranmi_admin_tasks_v2.csv).
