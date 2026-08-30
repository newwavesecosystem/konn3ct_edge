# Konn3ct Edge - WebRTC & Real-Time Media Engine Master Specification

**Target Role:** Sam (WebRTC & Real-Time Media Engine Lead)  
**Blueprint Reference:** Volumes 6 and 7  
**Context:** This document provides the master technical specification for the core WebRTC media routing architecture that powers the live video and audio experiences in Konn3ct Edge.

---

## 1. Media Architecture (SFU Topology)

To support massive scale (up to 1,000 participants in a single room with dozens broadcasting), a pure peer-to-peer (P2P) mesh is insufficient. Konn3ct Edge uses a Selective Forwarding Unit (SFU) topology.
*   **SFU Engine:** Leveraging `mediasoup` (as indicated by the mobile client) to route media streams efficiently.
*   **Media Workers:** Multiple Node.js/C++ media worker processes running across the K8s cluster.
*   **Dynamic Routing:** The SFU receives one upstream media track from a publisher and intelligently forwards it only to consumers actively requesting it (e.g., those currently visible on screen or active speakers).

## 2. Global TURN & STUN Infrastructure

Enterprise networks, strict firewalls, and carrier-grade NATs require robust traversal.
*   **Global TURN Fleet:** Deployment of Coturn servers strategically placed in:
    *   **India (Mumbai/Delhi)** for the Asian market.
    *   **South America (São Paulo)** for LATAM adoption.
    *   **North America (N. Virginia)** for baseline global routing.
*   **Latency Optimization:** Clients dynamically query the nearest TURN server based on latency pings to minimize round-trip times (RTT) during relay fallback.

## 3. Resilience & Bandwidth Adaptation (Simulcast)

*   **Simulcast Streaming:** Publishers send multiple qualities of the same video stream (e.g., 720p, 360p, 180p).
*   **Adaptive Bitrate (ABR):** The SFU dynamically downgrades the stream sent to a specific consumer if their network bandwidth drops, preventing video freezing.
*   **Audio-First Fallback:** If a consumer's packet loss exceeds critical thresholds, the SFU stops forwarding video entirely, prioritizing the transmission of the audio track to keep them connected to the conversation.

## 4. Delivery Checklist

Sam will execute these requirements via the task list in [sam_webrtc_tasks.csv](file:///C:/conn3ct_meeting/docs/blueprint/sam_webrtc_tasks.csv). Tasks are scheduled starting `08/10/2026`.
