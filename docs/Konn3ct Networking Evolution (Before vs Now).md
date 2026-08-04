# Konn3ct Networking Evolution: Before (BBB) vs. Now (Mediasoup & Kubernetes)

This document highlights the evolution of the Konn3ct network architecture, transitioning from our previous infrastructure built on BigBlueButton (BBB) to the newly engineered, modern architecture powered by Mediasoup and Kubernetes.

---

## 1. Architectural Paradigm Shift

### The "Before" (Previous Konn3ct / BigBlueButton)
- **Monolithic Setup:** The previous version relied on BigBlueButton, which was fundamentally designed to run as a monolithic stack on a single, large virtual machine.
- **Media Engines:** It used multiple disparate media components: FreeSWITCH for audio and Kurento/webrtc-sfu for video. These components required significant CPU overhead and complicated routing rules on a single server.
- **Vertical Scaling Only:** To support more users, you had to provision a larger server (more CPU/RAM). Scaling horizontally across multiple servers was highly complex and inefficient (requiring external load balancers like Scalelite).

### The "Now" (New Konn3ct / Mediasoup + K8s)
- **Cloud-Native Microservices:** The new infrastructure is fully containerized and runs on Kubernetes. Signaling, APIs, Frontend, and Media are all decoupled.
- **Unified Media Engine:** Uses **Mediasoup**, a highly efficient, modern WebRTC C++ worker that handles both audio and video multiplexing in a single engine.
- **Horizontal Autoscaling:** Kubernetes automatically scales the backend pods in and out based on CPU utilization (via Horizontal Pod Autoscaler). 
- **Kubernetes `hostNetwork`:** Media pods bind directly to the Kubernetes Worker Node's network interface to optimize UDP media traffic, bypassing the internal cluster NAT.

---

## 2. WebRTC UDP Port and Firewall Differences

The most critical difference for network engineers is the shift in required firewall rules and UDP port ranges for media traffic.

### Firewall Configuration: Before (BigBlueButton)
BBB required a massive range of UDP ports because of the separation between audio (FreeSWITCH) and video (Kurento) engines.

| Protocol | Port Range | Purpose |
| :--- | :--- | :--- |
| **TCP** | 80, 443 | Standard HTTP/HTTPS web traffic (Nginx) |
| **UDP** | **16384 - 32768** | Massive port range for WebRTC Audio & Video streams. |
| **TCP / UDP** | 3478, 5349 | Optional Coturn (STUN/TURN) if hosted on the same server. |
| **TCP** | 7443 | Optional secure WebSocket for older integrations. |

### Firewall Configuration: Now (Konn3ct Mediasoup)
The new architecture is much more deliberate and conservative with port usage, reducing the attack surface and making firewall rules easier to audit.

| Protocol | Port Range | Purpose |
| :--- | :--- | :--- |
| **TCP** | 80, 443 | HTTP/HTTPS pointing to the Cloud Load Balancer (not directly to the server). |
| **UDP** | **10000 - 20000** | Narrower, dedicated port range specifically for Mediasoup WebRTC routing directly to the K8s Worker Nodes. |
| **TCP** | 3000 | Internal K8s health checks and Ingress routing (restricted to internal VPC). |

**Key Firewall Difference:** 
Instead of opening `16384-32768` (16,384 ports) directly to a single monolith, you now open `10000-20000` (10,000 ports) on your **Kubernetes Worker Node Security Groups**, while web traffic (TCP 80/443) is safely offloaded to a Managed Cloud Load Balancer.

---

## 3. Load Balancing and Session Routing

### The "Before" (BBB)
- Load balancing was almost non-existent natively. If multiple servers were used, traffic was distributed by a front-proxy (like Scalelite), which would assign an entire meeting to a single backend server.
- The single server would handle the Nginx web tier, the Redis queue, the MongoDB database, and the media engines.

### The "Now" (Mediasoup)
- **L4/L7 Managed Load Balancers:** External traffic hits a managed cloud load balancer (e.g., DigitalOcean).
- **Ingress Controller (Nginx K8s):** The Ingress controller dynamically routes requests to the correct internal pods.
- **Sticky Sessions:** Because WebRTC signaling must remain stateful, the Ingress uses `upstream-hash-by: "$arg_roomId"` to guarantee that all WebSockets for a specific meeting room are pinned to the exact Kubernetes pod managing that room's Mediasoup router.

## Summary of the Upgrade

By migrating from BigBlueButton to the Mediasoup/Kubernetes stack, Konn3ct has achieved:
1. **Lower Latency:** Unified C++ media routing (Mediasoup) replaces the bulky FreeSWITCH/Kurento bridge.
2. **Scalability:** Horizontal scaling across multiple nodes replaces expensive vertical single-server scaling.
3. **Tighter Security:** The UDP media port range has been reduced by nearly 40%, and edge web traffic is now shielded by managed Cloud Load Balancers rather than directly exposing the application server.
