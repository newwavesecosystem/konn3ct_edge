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

## 8) Pricing (4 Plans)

1) **Basic (Free)**
- 40-minute limit on group meetings
- Up to 100 participants
- Standard video quality
- Watermarked recordings

2) **Lite (₦66,000/year)**
- Unlimited meeting duration
- Up to 300 participants
- Cloud recording enabled
- Basic team management

3) **Pro (₦88,000/year)**
- Up to 1,000 participants (Webinar ready)
- Paid Recordings enabled (Paystack integration)
- Custom room branding
- Priority processing for headless recording bot

4) **Enterprise (Contact Sales)**
- 10,000+ participant capacity
- Custom SLAs and dedicated infrastructure
- Dedicated account manager
- SSO & Advanced Security

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

## 11) Go-To-Market & Hyper-Growth Strategy (1M Free / 3.5k Paid in 60 Days)
To achieve the aggressive target of 1,000,000 free users and 3,500 paying customers within a 2-month launch window, we must rely heavily on Product-Led Growth (PLG) viral loops and leverage our new scalable DigitalOcean/Mediasoup architecture.

### A. The "One-to-Many" Viral Loop (Acquiring 1M Free Users)
Meeting platforms are naturally viral. We will exploit the **Host-to-Attendee** relationship:
1. **Watermarked Free Recordings:** Free users can record meetings, but the recording playback page features a highly prominent "Host your own webinar for free on Konn3ct" call-to-action. If a single university lecturer or influencer uses a free account to host a session for 500 students, all 500 students are immediately funneled into our free tier.
2. **Frictionless Guest Joins:** Attendees do not need to create an account to join a meeting. However, when the meeting ends, they are redirected to a beautiful Post-Meeting Landing Page offering them a free Konn3ct account. 
3. **The "10k Capacity" PR Stunt:** Because our new Kubernetes NGINX `upstream-hash-by` architecture handles traffic beautifully, we will host a massive, heavily-marketed free online masterclass with a major African influencer (e.g., in tech or finance) boasting a 10,000-person capacity. This stresses our SFU architecture as a public proof-of-concept and instantly drives tens of thousands of free signups.

### B. The Monetization Funnel (Converting 3,500 Paying Customers)
To hit 3,500 paid users, we only need a **0.35% conversion rate** from our 1M free user base.
1. **The "Paywall" Hook:** The absolute strongest feature we have is the Paystack integration for paid recordings. We will target EdTech creators, coaches, and consultants. We offer them the platform for free, but if they want to charge their users to view a recording, they must upgrade to the $15/mo "Pro" tier. 
2. **Time Limits on Free Tier:** Free meetings hard-stop at 45 minutes. The headless recording bot automatically shuts down and finalizes the video. When a host gets cut off mid-presentation, the friction to upgrade immediately via Paystack is very high.
3. **Agency & B2B Outreach:** We will run targeted LinkedIn outreach to 5,000 SMBs and remote companies across Africa, offering a "Zoom Alternative" priced locally in Naira/Cedis/Rand (no forex hassle).

### C. The 60-Day Marketing Action Plan (Social, Digital, & 1-1)

#### 1. Social Marketing (The "Hype" Engine)
**Goal:** Drive massive awareness and funnel 1M top-of-funnel users to free accounts.
*   **The "Konn3ct Masterclass Series":** Partner with 10 high-profile African thought leaders (Tech, Finance, Real Estate). We sponsor their masterclass if they host it on Konn3ct. When they blast their Twitter/LinkedIn followers with the link, we capture all attendees.
*   **Viral UGC (User Generated Content):** Create a TikTok/Reels challenge showing how ridiculous Zoom's 40-minute cutoff is, contrasted with Konn3ct's smooth UI and built-in paywalls.
*   **Community Engineering:** Create a dedicated "Konn3ct Creators" Facebook and Discord group. Share weekly tips on "How to make ₦500k a month selling masterclass recordings."

#### 2. Digital Marketing (The "Conversion" Engine)
**Goal:** Capture high-intent users looking for solutions and push them to Lite/Pro.
*   **Search Intent (Google Ads):** Aggressive bidding on keywords like *"Zoom alternative Nigeria,"* *"Sell webinars online,"* and *"Paystack video platform."* 
*   **Retargeting Funnel:** Anyone who attends a Konn3ct meeting as a guest gets tracked. We hit them with Facebook/Instagram ads: *"You just had a great meeting on Konn3ct. Host your own for free."*
*   **Email Drip Campaigns:** 
    *   *Day 1 (Sign Up):* Welcome to Basic.
    *   *Day 3:* "Did you know you can sell your recordings?" (Upsell to Pro).
    *   *Day 14 (Hit 40-min limit):* "Tired of the countdown? Get Lite for just ₦66,000/year."

#### 3. B2B & 1-to-1 Marketing (The "Corporate Whale" Engine)
**Goal:** Secure the 3,500 paying Lite/Pro users and land multi-seat Enterprise/Team contracts.

**The "Teams" Multi-Seat Strategy:**
Corporate clients are the holy grail of recurring revenue because they buy in bulk (Teams). 
*   **The FX/Naira Angle (Local Advantage):** Pitch 500 mid-sized remote companies across Africa who are currently struggling with USD limits on their corporate cards. The pitch: *"Stop battling CBN limits to pay for Zoom/Teams. Buy a 50-seat Konn3ct Teams License and pay seamlessly in Naira via Paystack."*
*   **Centralized Corporate Control:** Highlight the Teams module. Sell HR and IT managers on the fact that they get a single dashboard to onboard employees, control recording permissions, and manage billing centrally, rather than reimbursing 50 separate Zoom accounts.

**Direct Outreach Tactics:**
*   **EdTech & Consultant Scraping:** Use tools like Apollo.io to scrape 5,000 Nigerian/African coaches, consultants, and online tutors for the Pro tier. Send personalized Loom videos showing the Paystack recording integration.
*   **HR & IT Director Cold Calls:** Build a lead list of HR Directors and IT Managers at startups, law firms, and agencies. Pitch them the Lite/Pro "Teams License" to move their entire staff over to Konn3ct.
*   **The "Concierge" Onboarding:** For the first 50 corporate Team signups, the founders do a personalized onboarding call for their IT staff. We help them invite their employees and set up their team dashboard. This guarantees deep integration into their daily workflow and a 0% churn rate.

### D. Architectural Readiness for 1 Million Users
The infrastructure we just deployed was specifically designed to prevent "success disasters":
- **Stateless Signaling:** Our frontend Next.js nodes and backend WebSockets are fully decoupled. We can spin up 50 backend DigitalOcean droplets during a viral spike, and Kubernetes will balance the load instantly.
- **Dedicated Egress Bots:** Because our recording bot is a headless Puppeteer microservice, a massive influx of recording requests will just queue up in the background without slowing down live video for active users.
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
