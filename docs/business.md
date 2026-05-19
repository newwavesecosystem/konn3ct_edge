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
- eCinema Broadcast Feature (synchronized streaming of external content to all participants)
- Recording controls (subject to permissions and plan)

Recording Access:
- Recording viewer (integrated directly in frontend Next.js app)
- Configurable access settings: email list, anyone with link, or only meeting participants
- Free recordings: play immediately based on access settings
- Paid recordings: Paystack checkout → verify payment → grant access

Events Module (Unique to Konn3ct):
- Any user can create a Virtual Event from their dashboard
- Events can be set as **Free** or **Paid** (amount in ₦ Naira or $ USD)
- A shareable registration link is automatically generated and can be distributed via social media, email, or WhatsApp
- Attendees register and pay on the spot via Paystack (cards, bank transfer, USSD) before the event starts
- Host sees a live **Registered Participants Dashboard** with names, payment status, and contact info
- Built-in **Reminder Engine**: Host can send email/SMS reminders to registered participants (1 week before, 1 day before, 1 hour before)
- *Use Cases: Webinars, masterclasses, conferences, government town halls, school open days, church programs*

Donation Feature (Unique to Konn3ct):
- A live "Donate" button available inside any active meeting session
- Attendees can donate any amount in ₦ Naira or $ USD via Paystack without leaving the meeting
- Host sees a real-time donation feed and total collected on their screen
- *Use Cases: Church offerings & tithes, book launches, fundraising campaigns, charity events, NGO drives, live concerts*

## 8) Pricing Strategy & Website Copy (The "Zoom Killer" Model)
Our pricing is engineered specifically to trigger mass migration from competitors like Zoom and Microsoft Teams. The breakdown below is formatted exactly as it should appear on the Konn3ct website pricing page.

### 1) Basic (Free Forever)
*Best for individual users, students, and freelancers.*

**The Hook:** Zoom cuts you off at 40 minutes, causing embarrassment and disruption. Konn3ct gives you **1 Full Hour**—enough for a complete professional meeting or class.

**Key Limits:**
- **Participant Limit:** 250 Users *(More than double Zoom's free limit!)*
- **Session Timeout:** 1 Hour *(20 minutes more than Zoom!)*
- **Number of Rooms:** 1
- **Recording Limit:** Local Recording Only *(No Cloud Storage)*
- **AI Limits:** 3 AI Meeting Summaries/mo, Basic Live Captions *(No Translations/Highlights)*

**Included Features:**
- ✔ Local Recording
- ✔ AI Meeting Summary *(Limited to 3/mo)*
- ✔ Live Captions *(English Only)*
- ✔ Audio & Video Preview Window
- ✔ Screen Sharing
- ✔ Whiteboard & Annotation Tools
- ✔ User Status (Online/Away)
- ✔ Breakout Rooms
- ✔ Full-Featured Admin Controls
- ✔ Share Webcam
- ✔ Shared Notes
- ✔ Share YouTube Videos
- ✔ Attendance Tracking

---

### 2) Lite ($44 / ₦66,000 per year)
*Best for small teams, consultants, and growing startups.*

**The Hook:** Zoom Pro costs ~$150/year. Konn3ct Lite gives you **all the essential Pro features for less than a third of the price**, payable locally in Naira without FX restrictions.

**Key Limits:**
- **Participant Limit:** 500 Users *(Ideal for large company all-hands)*
- **Session Timeout:** 10 Hours
- **Cloud Storage:** 5GB *(Approx. 15 Hours of Recording)*
- **Number of Rooms:** 2
- **AI Limits:** Unlimited Summaries/Highlights/Notes + 5 Hrs Transcriptions/Captions + 2 Hrs Translations

**Included Features:**
- ✔ **Cloud Recording**
- ✔ **Unlimited AI Meeting Summaries**
- ✔ **Unlimited AI Meeting Highlights & Technical/General Notes**
- ✔ **AI Transcriptions & Live Captions (5 hrs/mo)**
- ✔ **AI Real-time Translations (150 Languages - 2 hrs/mo)**
- ✔ Audio & Video Preview Window
- ✔ Screen Sharing
- ✔ Whiteboard & Annotation Tools
- ✔ User Status
- ✔ Breakout Rooms
- ✔ Full-Featured Admin Controls
- ✔ Share Webcam
- ✔ Shared Notes
- ✔ Share YouTube Videos
- ✔ Attendance Tracking

---

### 3) Pro ($59 / ₦88,000 per year) — ⭐ *Most Popular*
*Best for mid-sized teams, EdTech creators, and webinar hosts.*

**The Hook:** Unlocks the "Paid Recording / Monetization" engine. Creators who charge for their classes will make back the ₦88,000 subscription cost in a single successful webinar.

**Key Limits:**
- **Participant Limit:** 1,000 Users *(Full Webinar-Scale Capacity)*
- **Session Timeout:** 24 Hours
- **Cloud Storage:** 15GB *(Approx. 45 Hours of Recording)*
- **Number of Rooms:** 3
- **AI Limits:** Fully Unlimited AI Suite (Summaries, Highlights, Notes, Captions, Translations)

**Included Features:**
- ✔ **Paid Recording Engine (Paystack Integration)**
- ✔ **Cloud Recording**
- ✔ **Unlimited AI Meeting Summaries**
- ✔ **Unlimited AI Meeting Highlights & Technical/General Notes**
- ✔ **Unlimited AI Transcriptions & Live Captions**
- ✔ **Unlimited AI Real-time Translations (150 Languages)**
- ✔ Audio & Video Preview Window
- ✔ Screen Sharing
- ✔ Whiteboard & Annotation Tools
- ✔ User Status
- ✔ Breakout Rooms
- ✔ Full-Featured Admin Controls
- ✔ Share Webcam
- ✔ Shared Notes
- ✔ Share YouTube Videos
- ✔ Attendance Tracking

---

### 4) Enterprise
*Best for Universities, Mega-Churches, and Government Ministries.*

- **Custom Capacity:** 10,000+ participants
- **White-labeling & Integrations:** Custom SLAs, SSO, and dedicated infrastructure.
- **Dedicated Account Manager**
- *Contact Sales for Pricing*

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

## 11) Go-To-Market & Hyper-Growth Strategy (10M Free / 6k Paid in 60 Days)
To achieve the massive target of 10,000,000 free users and 6,000 paying customers within a 2-month launch window, standard organic growth is insufficient. We must rely on B2B2C mass-acquisition, unprecedented virality, and high-leverage partnerships.

### A. The "Whale" B2B2C Play (Acquiring 500k Users at a Time)
You cannot acquire 10 million users one by one. You must acquire the gatekeepers of massive audiences.
1. **The University Takeover:** Identify the top 50 universities across Africa. Offer their IT departments a completely FREE Enterprise License for the first year. If a university mandates Konn3ct for online lectures, we instantly acquire 80,000 students and staff per university. Securing just 20 universities guarantees 1.5M+ users.
2. **The Mega-Church / Religious Integration:** Pitch the top 10 mega-churches to host their mid-week online services on Konn3ct. When a pastor directs their congregation to the Konn3ct link, we will see 100,000+ concurrent users instantly.
3. **The Government / Ministry Mandate:** Pitch State Ministries of Education to use Konn3ct for remote teacher training or public service broadcasts.

### B. The Telco "Zero-Rating" Partnership (The Ultimate Growth Hack)
Data cost is the single biggest barrier to video conferencing in emerging markets.
1. **The MTN/Airtel Deal:** Aggressively negotiate a "Zero-Rating" or "Discounted Data" partnership with a major telco. Advertising "Use Konn3ct on MTN without burning your data" or "Buy a ₦500 Konn3ct Data Pass" will obliterate competitors. Millions will switch simply because it saves them money.

### C. Gamified Hyper-Virality (The "Referral Nuke")
To get 10 million users, the platform itself must become a viral game.
1. **The ₦10,000,000 Giveaway:** Host a massive, highly-publicized giveaway. Rules: 1 ticket for hosting a meeting. 5 tickets for every new user who joins your meeting and creates an account. This turns every existing user into a rabid sales agent.
2. **"Pay-to-Attend" Affiliate Networks:** Allow creators to turn their attendees into affiliates. If a creator sells a masterclass on Konn3ct, attendees can share a unique link to invite others and earn a 20% commission on tickets sold.
3. **The 50/50 Revenue Split:** Offer influencers and course creators a massive 50% revenue share on their paid recordings for the first 3 months to incentivize them to move their entire existing audience over to Konn3ct immediately.

### D. Explosive Tactics for 6,000 Paying Customers
To convert 6,000 paying B2B and Creator customers quickly, we need urgency and scale.
1. **The "Lifetime Deal" (The AppSumo Strategy):** For the first 30 days of launch, offer a highly restricted "Founders Lifetime Deal" (e.g., Pay ₦250,000 ONCE and get Konn3ct Pro forever). Create extreme scarcity to inject massive upfront cash and spike paid user counts.
2. **The B2B Reseller Army:** Reach out to 500 local IT consulting firms, web agencies, and hardware vendors. Give them a 40% recurring commission for every company they migrate from Zoom/Teams to Konn3ct. This creates an army of 500 salespeople pushing our product.
3. **The "Done-For-You" Webinar Agency:** Offer a premium package where the Konn3ct team sets up a creator's room, configures the Paystack paywall, and moderates the chat for their first event. Charge them the annual Pro fee upfront for this "White-Glove" service.
4. **Product-Led "Team" Chokeholds:** On the free tier, allow a company to create a Team dashboard, but hard-cap it at 3 employees. The moment they try to invite a 4th employee, hit them with a paywall to upgrade to the Lite plan.

### E. Architectural Readiness for 10 Million Users
- **Stateless Signaling:** Our frontend Next.js nodes and backend WebSockets are fully decoupled. We can spin up 50+ backend DigitalOcean droplets during a viral spike, and Kubernetes will balance the load instantly.
- **Dedicated Egress Bots:** Because our recording bot is a headless Puppeteer microservice, a massive influx of recording requests will queue up in the background without slowing down live video for active users.
- **Auto-Scaling Node Pools:** We will configure DigitalOcean to automatically spawn new 4-vCPU/8GB droplets the moment our cluster hits 70% CPU capacity, ensuring we never drop a live connection during hyper-growth.

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
