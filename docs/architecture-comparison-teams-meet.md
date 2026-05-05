# conn3ct — Architecture Comparison (Microsoft Teams vs Google Meet)

## 1) Scope and Disclaimer
This document compares the current conn3ct proposed architecture against Microsoft Teams and Google Meet at a high level.

Teams and Meet are proprietary systems, so the comparison focuses on publicly described concepts (media relays/SFU behavior, bandwidth approaches, and enterprise integration patterns) rather than internal implementation details.

## 2) Baseline: conn3ct Architecture (Current)
Media and real-time:
- WebRTC SFU: mediasoup cluster for meetings/webinars
- NAT traversal: coturn (TURN/STUN)
- Telephony: FreeSWITCH for SIP/PSTN bridging + IVR + inbound call-in + outbound call-out + SIP interoperability
- Recording: server-side recording workers, object storage + CDN delivery, free/paid access via Paystack paywall

Control plane:
- API service: auth, teams, rooms, invites, billing, recordings metadata + access control
- Signaling gateway: WebSocket-based join/roles/presence and meeting events
- Room allocator: places rooms/webinars onto SFU capacity pools; autoscaling with custom metrics
- Optional enterprise upgrade: hybrid edge “Conn3ct Edge” SFU/iMMR concept for on-prem bandwidth reduction

## 2.1 Standpoint (What conn3ct is Best At)
conn3ct is best positioned as a purpose-built platform for:
- Webinar-first meetings at scale with explicit cost/bandwidth controls
- Monetizable recordings (free vs paid) with Paystack-first billing
- Telephony workflows that require SIP/PSTN, IVR, call-in/out, and interoperability (FreeSWITCH-first design)
- Product flexibility: room allocator policies, plan caps, and customized UX without suite constraints

## 3) Microsoft Teams: Architecture Characteristics (Public View)
Microsoft Teams is built as cloud services on Microsoft Azure and integrates deeply with Microsoft 365 identity and collaboration services.

Media/voice components called out publicly include:
- Media Transport Relays, Media Controllers, and Media Processors as Azure services (Teams Phone context) (Source: Microsoft Learn).

Enterprise platform strengths (typical outcomes of the ecosystem):
- Identity and policy governance via Microsoft Entra ID
- Storage integration (recordings/files) into SharePoint/OneDrive and compliance tooling
- Large ecosystem of meeting apps and collaboration experiences

## 3.1 Standpoint (What Teams is Best At)
Teams is best positioned for:
- Organizations that are already “all-in” on Microsoft 365 and want meetings embedded in the productivity suite
- Enterprise governance, identity, and compliance-centric deployments (policies, retention, admin controls)
- Integrated collaboration: chat, channels, files, and meetings in one place
- Enterprise telephony packaging (Teams Phone ecosystem) for a standardized, managed experience

## 4) Google Meet: Architecture Characteristics (Public View)
Google Meet uses WebRTC clients connecting to Meet servers. Public developer documentation for the Meet Media API describes an SFU pattern that multiplexes participant media into a fixed set of “virtual media streams” to reduce client processing and bandwidth requirements (Source: Google Meet Media API).

Bandwidth reduction for large internal audiences:
- Google Meet eCDN (Enterprise Content Delivery Network) supports peer-assisted media delivery for live streaming, reducing how many viewers must fetch from Google servers (Source: Google Meet eCDN On-Premises API).

## 4.1 Standpoint (What Google Meet is Best At)
Google Meet is best positioned for:
- Organizations standardized on Google Workspace who want the simplest path to adoption and admin management
- Calendar-first scheduling and low-friction join experiences (within the Workspace ecosystem)
- Large internal broadcasts where bandwidth reduction can be achieved through Meet eCDN (livestreaming scenarios)

## 5) Comparison by Architecture Axis

### 5.1 Media Plane (SFU / Routing)
conn3ct:
- Direct ownership of SFU layer (mediasoup) with explicit room allocation + autoscaling strategy.
- Easier to implement strict webinar modes (stage vs audience) and enforce plan-based caps at the allocator.

Teams:
- Azure-hosted media services optimized across a mature global cloud footprint.
- Less transparent internal media routing, but generally strong global reliability due to operational maturity.

Google Meet:
- SFU concepts are explicit in developer docs (virtual media streams, speaker-based routing).
- Strong emphasis on reducing client load for scalable conferences.

### 5.2 Bandwidth Optimization
conn3ct (current + planned):
- Simulcast/SVC policies, active-speaker/stage-only subscriptions, role-based bitrate caps.
- Optional hybrid edge module (“Conn3ct Edge”) to keep/redistribute media locally for enterprise campuses.
- TURN minimization, plus admission control and audio-first degradation ladders.

Teams:
- Strong enterprise network posture by virtue of Microsoft’s global infrastructure and enterprise network guidance ecosystem (proxies, firewall requirements, etc.).
- Mature client-side adaptation and enterprise network tooling (typically an advantage in practice).

Google Meet:
- SFU virtual streams reduce number of concurrent incoming streams on clients (Meet Media API).
- eCDN for live streaming can reduce bandwidth consumption significantly inside a corporate network via peer-assisted delivery (Meet eCDN).

Key note:
- Meet eCDN is focused on **live streaming** scenarios; conn3ct’s planned “Conn3ct Edge” is aimed at interactive meetings/webinars as well as potentially streaming-like fanout through cascaded SFUs.

### 5.3 Telephony (SIP/PSTN + IVR + Call-In/Out)
conn3ct:
- Explicit design includes FreeSWITCH for SIP/PSTN, IVR, inbound dial-in, outbound call-out, and SIP interoperability.
- Advantage: full workflow control (custom IVR flows, room routing, per-tenant policy, custom billing rules).

Teams:
- Strong enterprise telephony product surface (Teams Phone ecosystem), with Azure-hosted voice services and enterprise SBC integration patterns (conceptually similar outcomes).
- Advantage: packaged enterprise experience; disadvantages: less custom IVR/workflow control compared to owning FreeSWITCH directly.

Google Meet:
- Meet is primarily positioned for meetings within Google Workspace; PSTN/telephony depth varies by offering and region and is generally not the “primary differentiator” compared to Meet’s conferencing + ecosystem.

### 5.4 Recording + Storage + Access Control
conn3ct:
- Recording is a first-class product feature with monetization (free vs paid recording links) via Paystack and secure delivery strategies (signed URLs/proxy).

Teams:
- Tight integration with Microsoft 365 storage and compliance; enterprise-friendly retention/eDiscovery is a typical strength.

Google Meet:
- Strong integration into Google Workspace storage/admin controls; also has focus on admin governance and large-organization settings.

### 5.5 Control Plane and Ecosystem
conn3ct:
- Purpose-built control plane for: rooms-as-products + team management + paid replay monetization + Paystack-first billing.
- Advantage: can be laser-focused on “webinar + paid replay” workflows and UX.

Teams:
- Deep Microsoft 365 integration (identity, files, apps, compliance) and a massive ecosystem.
- Advantage: enterprise adoption flywheel and integrated collaboration suite.

Google Meet:
- Deep Google Workspace integration, especially calendar and organization admin controls.
- Advantage: frictionless adoption for Google Workspace orgs.

## 6) Advantages vs Teams and Meet (Where conn3ct Can Win)
Product-native monetization:
- Paid recordings and Paystack-first billing are central to conn3ct’s architecture and product model.

Telephony workflow control:
- Owning FreeSWITCH enables bespoke IVR + routing + billing policy and SIP interoperability options.

Architectural flexibility:
- conn3ct can adopt “best of both worlds” patterns:
  - Meet-style fixed virtual stream fanout strategies
  - Teams/enterprise-style hybrid edge bandwidth reduction (Conn3ct Edge)
  - Cascaded SFUs for global webinar fanout

## 7) Gaps to Close (Where Teams/Meet Tend to Excel)
- Enterprise governance depth (policy inheritance, compliance exports, retention/eDiscovery sophistication)
- Ecosystem breadth (marketplace, device support, native apps, admin tooling maturity)
- Global operational maturity (years of incident learning, release engineering, capacity forecasting)
- Streaming bandwidth optimization extras like eCDN for large internal audiences (Meet’s eCDN model is a strong reference)

## 8) Practical Recommendations for conn3ct
- Implement the “Conn3ct Edge” concept for enterprise/campus bandwidth reduction and position it as a Business/Enterprise feature.
- Add an eCDN-like approach for true livestream-style events (optional), while keeping SFU webinar mode for interactive audiences.
- Prioritize QoE tooling (meeting quality dashboards, automated mitigation, and cost telemetry) early; this is a major real-world advantage in Teams/Meet.

## 9) Sources (Public)
- Microsoft Learn (Teams voice services on Azure, including Media Transport Relays/Controllers/Processors): https://learn.microsoft.com/en-us/training/modules/extend-teams-phone-system-additional-services/2-understand-how-teams-interacts
- Google Meet Media API (SFU + “virtual media streams” for scaling/bandwidth reduction): https://developers.google.com/workspace/meet/media-api/guides/virtual-streams
- Google Meet eCDN On-Premises API (peer-assisted delivery to reduce bandwidth for live streaming): https://developers.google.cn/meet/live-streaming/ecdn-on-premises-api

## 10) “How Best They All Are” (Balanced Take)
conn3ct is best when:
- You need Paystack-native monetization (subscriptions + paid replays) as a core workflow
- You need deep telephony control (custom IVR and routing) and want to own the SIP/PSTN layer
- You want explicit, product-owned scaling policies (allocator + caps + bandwidth defaults) for webinars

Teams is best when:
- You need Microsoft 365 suite integration and enterprise governance as the default
- You need mature enterprise admin tooling and compliance workflows tied into Microsoft ecosystems
- Your customers prioritize “one collaboration hub” over a specialized webinar monetization product

Google Meet is best when:
- You need Google Workspace-native adoption (calendar-first, low friction) and admin management
- Your customers benefit from Meet’s enterprise livestream bandwidth tooling patterns (eCDN) inside corporate networks
- You want a tightly integrated, standardized meeting experience within Google’s ecosystem
