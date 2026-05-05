# conn3ct — Architecture Comparison (BigBlueButton vs Zoom)

## 1) Summary
This document compares the proposed conn3ct architecture (mediasoup + coturn + FreeSWITCH + API/signaling + recording pipeline) against:
- **BigBlueButton (BBB)**: open-source virtual classroom platform
- **Zoom**: proprietary meeting platform (with published information about hybrid/on-prem media routing)

The goal is to highlight architectural differences and the practical advantages/trade-offs.

## 2) High-Level Architecture Comparison

### 2.1 Media Plane (Audio/Video)
**conn3ct (proposed)**
- WebRTC SFU: mediasoup cluster (webinar-first, role-based publishing)
- NAT traversal: coturn (TURN/STUN)
- Telephony: FreeSWITCH for SIP/PSTN bridging + IVR + call-in/out + SIP interop
- Recording: server-side recording workers + object storage + CDN

**BigBlueButton**
- Uses FreeSWITCH for voice conferencing and phone dial-in
- Uses an SFU (mediasoup / WebRTC-SFU) for webcams, listen-only audio, and screensharing
- Uses TURN (coturn) for restrictive networks

**Zoom (general + hybrid module reference)**
- Proprietary global media routing infrastructure (cloud)
- Offers “Zoom Meetings Hybrid” which uses an on-prem SFU/iMMR module to redistribute media locally and reduce external bandwidth for internal participants

### 2.2 Control Plane (Meetings, Roles, State)
**conn3ct (proposed)**
- API service: auth, teams, rooms, invites, billing, recording metadata/paywall
- Signaling gateway: WebSocket-based room join, roles, presence, chat/Q&A events
- Room allocator: assigns each webinar/room to an SFU node based on load/capacity

**BigBlueButton**
- Designed around classroom workflows and LMS integrations; server-side apps coordinate meeting state and collaboration features (whiteboard, presentations, chat)

**Zoom**
- Proprietary control plane and feature set; hybrid media does not replace cloud signaling for cloud-hybrid meetings (signaling stays cloud, media can route locally)

## 3) Scaling: “20 Concurrent Webinars” and Auto-Scaling

### 3.1 conn3ct Auto-Scaling Approach (Media)
Design points:
- Webinar mode: few publishers, many subscribers (predictable scaling)
- Room allocator places each webinar on an SFU node/router with headroom
- Separate node pools: SFU (high egress), TURN (network heavy), recording workers (CPU), signaling (WS)
- Scale triggers (custom metrics): egress bitrate, packet rate, publishers/subscribers, active routers, TURN relay %
- Kubernetes HPA scales pods; cluster autoscaler scales nodes; pre-warm capacity ahead of scheduled spikes

What happens with 20 webinars:
- Each new webinar is assigned to the “best” SFU node by allocator
- As concurrency rises, SFU replicas scale out automatically
- Admission control prevents overload (audio-first degradation, limit video layers/tiles, cap stage)

### 3.2 BigBlueButton Scaling Pattern (Typical)
- BBB supports horizontal scaling, but operationally it is often deployed as multiple BBB servers behind a load balancer with meetings distributed across servers.
- BBB provides a strong “single-purpose appliance” model per server; scaling commonly means adding more servers and balancing meetings across them.

### 3.3 Zoom Scaling Pattern (Typical)
- Zoom cloud scales transparently to customers.
- Zoom Meetings Hybrid can reduce bandwidth at customer sites by aggregating local media (many internal users → fewer external connections), but requires customer-managed on-prem modules and capacity planning.

## 4) Bandwidth Optimization Comparison

### 4.1 conn3ct (proposed)
Core tactics:
- Simulcast/SVC publishing
- Active-speaker + stage-only subscriptions in webinars
- Role-based bitrate caps (audience vs presenter)
- Default policies: audience video off; low default resolution for scale
- Audio-first degradation under congestion (Opus/DTX; preserve audio)
- TURN minimization: proper ICE and regional TURN placement to reduce relay usage

### 4.2 BigBlueButton
- Supports WebRTC-based media and TURN; bandwidth depends heavily on how meetings are configured and how many webcams are enabled.
- Primary strength is “virtual classroom” collaboration; large events typically require specific operational guidance and configuration to keep bandwidth predictable.

### 4.3 Zoom
- Mature bandwidth management and long-term optimizations across a proprietary stack.
- Zoom Meetings Hybrid explicitly targets bandwidth reduction by redistributing media locally for internal users (campus/enterprise networks).

## 5) SIP/PSTN + IVR + Call-In/Out Comparison

### 5.1 conn3ct Advantage (When Telephony Is a First-Class Requirement)
- FreeSWITCH is a first-class component from day one in the conn3ct architecture:
  - inbound dial-in (DIDs)
  - IVR (DTMF routing, PINs, announcements)
  - outbound call-out (plan/role gated)
  - SIP interop (PBX, SIP endpoints)
- Tight integration with rooms, roles, and billing:
  - telephony can be a paid feature
  - per-room policies (allow call-in/out, region restrictions)
  - CDRs for audit and cost management

### 5.2 BigBlueButton
- Also uses FreeSWITCH for voice conferencing and phone dial-in, making it a strong baseline for education/classroom telephony needs.

### 5.3 Zoom
- Zoom Phone and PSTN integrations exist, but details are proprietary and productized; Zoom provides enterprise-grade telephony capabilities but with less “build-your-own IVR + workflow” flexibility compared to owning a FreeSWITCH layer.

## 6) Advantages: conn3ct vs BigBlueButton
conn3ct advantages (for your product goals):
- **Product model**: teams/rooms/recordings + paid recording paywall + Paystack-first billing is central, not an add-on.
- **Webinar-first scaling plan**: explicit room allocator + autoscaling metrics + admission control aligned to “many webinars at once.”
- **Modern monetization**: paid replay links with controlled access (signed URLs/proxy) designed into the core.
- **UI/UX freedom**: BBB is optimized for education workflows; conn3ct can pursue “modern meeting UI + creator/SMB workflows” without legacy constraints.

BigBlueButton advantages (where BBB may be stronger):
- **Mature virtual classroom features**: whiteboard, presentation workflows, LMS integrations, learning-focused tooling.
- **Operational maturity**: established deployment patterns and community knowledge.

## 7) Advantages: conn3ct vs Zoom
conn3ct advantages (where you can win):
- **Customization and vertical focus**: tailor webinar + paid replay workflows tightly to your users.
- **Cost governance controls**: plan-based caps, allocator policies, and explicit bandwidth defaults can reduce surprise bills.
- **Paystack-native**: local payments and pricing flexibility as a first-class feature.
- **Telephony workflow control**: owning FreeSWITCH enables custom IVR, bespoke routing, and SIP interop choices.

Zoom advantages (where Zoom is typically stronger today):
- **Global scale and reliability**: large, mature proprietary infrastructure and continuous optimization.
- **Enterprise compliance and ecosystem**: broad certifications, integrations, device support, and support organization.
- **Turnkey experience**: minimal operational burden for customers compared to self-managed media clusters.

## 8) Practical Recommendation
- If your primary market is **training, communities, SMB webinars, and paid replays**, conn3ct’s architecture and product model can create clear differentiation.
- If you need deep **education/LMS features**, BBB is a strong reference point; conn3ct should selectively adopt only the pieces that support your target workflows.
- If you need guaranteed **global enterprise readiness on day one**, Zoom’s maturity is hard to match primarily due to years of production operations, global footprint, and ecosystem depth. This is an execution advantage, not a fundamental architectural limit. conn3ct can still be designed for Zoom-class enterprise operation and can exceed Zoom in targeted areas (customization, monetization-native workflows, Paystack-first billing).

## 9) Sources (Public)
- BigBlueButton 3.0 Architecture: https://docs.bigbluebutton.org/3.0/development/architecture/
- Zoom Meetings Hybrid Explainer (Zoom Technical Library): https://library.zoom.com/advanced-enterprise-services/zoom-node/zoom-meetings-hybrid/zoom-meetings-hybrid-explainer
