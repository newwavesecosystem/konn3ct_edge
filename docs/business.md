# conn3ct — Business Document

## 1) Executive Summary
conn3ct is a modern meeting + webinar platform designed for teams, communities, and creators who need reliable large-scale live sessions, branded experiences, and monetizable recordings. The product focuses on three outcomes:
- Host high-scale meetings/webinars with excellent audio/video and clean UI
- Manage teams, rooms, invites, and recordings from a single dashboard
- Monetize content via paid recordings and subscriptions (Paystack)

## 2) Problem Statement
Current meeting products are strong at “meet now”, but weak (or complex/expensive) at:
- Hosting large events with flexible roles (speakers vs audience) without overwhelming UX
- Creating branded room experiences and durable “content hubs” (rooms + recordings)
- Monetizing recordings with simple paywalls and local payments (Paystack)
- Managing teams and permissions simply (owner, admins, presenters, assistants)

## 3) Target Customers (ICP)
Primary ICPs:
- **SMBs and remote teams** (10–500 employees): weekly meetings, trainings, onboarding
- **Event hosts** (webinars, townhalls, product launches): 200–10,000 attendees
- **Education and training providers**: cohorts, live sessions, paid replays
- **Communities and creators**: masterclasses, AMAs, paid content libraries

Geography focus:
- Nigeria + Africa-first payments via Paystack, expandable globally

## 4) Personas
- **Owner/Admin**: configures org/team, plans, rooms, roles, recordings, billing
- **Host/Presenter**: runs sessions, manages participants, starts recordings
- **Team Member**: schedules, invites, moderates chats/Q&A
- **Attendee/Guest**: joins quickly on web/mobile, optionally pays for recordings

## 5) Value Proposition
- **Scale-ready by design**: webinar mode optimized for many attendees and few publishers
- **Revenue features built-in**: paid recordings + subscriptions integrated with Paystack
- **Team operations**: invite team members, assign roles, manage access centrally
- **Room-as-a-product**: each room has a persistent link, settings, and recording library

## 6) Competitive Differentiation (“Better than Zoom/Meet/Teams”)
conn3ct wins by being purpose-built for:
- **Webinar-grade UI**: stage/presenter view, audience view, Q&A, moderation tools
- **Monetization**: recording paywall (Paystack) and “paid replay” links
- **Branding**: branded rooms, custom join pages, domain and themes (roadmap)
- **Local payments + pricing flexibility**: Paystack, local cards/bank transfer/USSD (where available)

## 7) Core Product Modules
Dashboard:
- Signup/login
- Profile and organization/team management
- Room creation and settings
- Invites (team + meeting) and access control
- Recordings: list, publish/unpublish, free/paid toggle, price, share links
- Billing: plans, invoices/transactions, subscription status

In-meeting:
- Join by link
- Roles: host/co-host/presenter/audience
- Chat + Q&A (webinar)
- Reactions and hand-raise (roadmap)
- Recording controls (subject to permissions and plan)

Recording Access:
- Public recording page with metadata + preview
- Free recordings: play immediately
- Paid recordings: Paystack checkout → verify payment → grant access

## 8) Pricing (4 Plans)
All prices are placeholders; finalize after cost modeling.

1) **Starter (Free)**
- Limited rooms
- Limited participant caps
- Free recordings disabled (or very limited)
- Basic branding

2) **Pro**
- Higher participant caps
- Recording enabled (free recordings)
- Team members included
- Basic analytics

3) **Business**
- Larger events/webinars
- Advanced roles/moderation
- Paid recordings enabled
- SSO (roadmap), advanced analytics

4) **Enterprise**
- Custom caps and SLAs
- Dedicated infrastructure options
- Security/compliance pack
- Priority support

Add-ons (optional):
- Extra cloud storage for recordings
- Extra concurrent events

## 9) Monetization Model
Revenue streams:
- Subscriptions (monthly/annual) via Paystack
- Paid recordings revenue share (platform fee) or “owner keeps 100% + subscription” model
- Add-ons (storage, concurrency)

## 10) Cost Model (Key Drivers)
- SFU compute and bandwidth (largest driver)
- TURN relay bandwidth (worst-case NAT traversal)
- Recording pipeline compute + storage + CDN egress
- Email delivery (invites) and transactional messages
- Observability (metrics/logs/tracing)

## 11) Go-To-Market (High-Level)
Phase 1 (MVP → early adopters):
- Creators/trainers + SMB teams
- Focus on “webinar mode + paid replay”

Phase 2 (Scale):
- Partnerships: training providers, coworking hubs, community platforms
- Reseller/affiliate program for trainers

## 12) KPIs
Product:
- Activation: room created → first meeting hosted
- Meeting success rate: % sessions with no major quality issues
- Recording attach rate: % meetings recorded
Revenue:
- Conversion to paid plan
- ARPA / LTV
- Paid recording conversion rate
Operations:
- Cost per participant-minute (live)
- Cost per recording-hour (storage + egress)

## 13) Risks & Mitigations
- **10,000 in one session**: treat as webinar mode (few publishers, many viewers), staged rollout, capacity limits by plan, progressive enhancement.
- **Abuse/fraud**: webhook verification, rate-limits, anti-bot on recording checkout, audit logs.
- **Quality variance**: TURN fallback, adaptive bitrate, simulcast, regional media clusters.

## 14) Product Roadmap (Suggested)
MVP:
- Auth, teams, rooms, invites, basic meeting join, recording links + paywall, Paystack plans
V1:
- Webinar mode: audience, stage, Q&A, moderation
- Recording pipeline + storage + playback
V2:
- Branding, analytics, integrations, mobile apps, enterprise controls
