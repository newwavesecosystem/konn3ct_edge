# Conn3ct Kubernetes Manifests

This directory contains the Kubernetes deployment manifests for the Conn3ct Meeting infrastructure. The application is built using a microservices architecture, running components for signaling, frontend, meeting recording, streaming, and caching.

## Architecture & Components

The cluster consists of the following components:

- **Backend (`deployment.yaml`, `service.yaml`)**
  - Handles WebSocket signaling, room management, and WebRTC media streams.
  - Deploys with `hostNetwork: true` to bypass standard K8s NAT and allow direct UDP WebRTC traffic.
  - Includes a HorizontalPodAutoscaler (HPA) to scale between 1 and 20 replicas based on CPU utilization.
  - Exposed via `conn3ct-backend-service` of type `LoadBalancer`.

- **Frontend (`frontend-deployment.yaml`, `frontend-service.yaml`)**
  - Serves the Next.js user interface.
  - Connects to the backend via internally routed URLs and domain environment variables.

- **Recorder (`recorder-deployment.yaml`)**
  - A background worker for recording meetings.
  - Includes `podAntiAffinity` rules to avoid scheduling on the same nodes as the backend, ensuring backend WebRTC performance isn't degraded.

- **Streaming Worker (`streaming-deployment.yaml`)**
  - A worker utilizing Puppeteer and FFmpeg for RTMP streaming.
  - Defaults to `0` replicas, scaling dynamically based on active streaming jobs. Requires `SYS_ADMIN` capability for Puppeteer.

- **Redis (`redis.yaml`)**
  - A simple Redis Alpine deployment and service (`redis-service`) utilized for pub/sub and distributed state synchronization among instances.

- **Ingress (`ingress.yaml`)**
  - Configured for the NGINX Ingress Controller.
  - Vital configuration: Uses `nginx.ingress.kubernetes.io/upstream-hash-by: "$arg_roomId"` to ensure **sticky sessions by Room ID**. This guarantees that all users connecting to the same meeting room are routed to the exact same backend pod, critical for WebRTC SFU mesh logic.
  - Configures long WebSocket timeouts to prevent disconnections during extended meetings.

## Prerequisites

- A Kubernetes cluster (e.g., DigitalOcean Kubernetes).
- **NGINX Ingress Controller** installed.
- Docker images for each component pushed to `registry.digitalocean.com/konn3ct-registry/`.

## Configuration

Before applying these manifests, you **must** create a Kubernetes Secret named `conn3ct-secrets` that holds all environment variables required by the services. 

Example:
```bash
kubectl create secret generic conn3ct-secrets \
  --from-literal=DATABASE_URL="postgres://..." \
  --from-literal=JWT_SECRET="your-jwt-secret" \
  --from-literal=GEMINI_API_KEY="..." \
  --from-literal=EXTERNAL_API_KEY="..." \
  --from-literal=DEEPGRAM_API_KEY="..." \
  --from-literal=PAYSTACK_SECRET_KEY="..." \
  --from-literal=DO_SPACES_ENDPOINT="..." \
  --from-literal=DO_SPACES_REGION="..." \
  --from-literal=DO_SPACES_KEY="..." \
  --from-literal=DO_SPACES_SECRET="..." \
  --from-literal=DO_SPACES_BUCKET="..." \
  --from-literal=NEXT_PUBLIC_FRONTEND_URL="..." \
  --from-literal=NEXT_PUBLIC_FRONTEND_DOMAIN="..." \
  --from-literal=NEXT_PUBLIC_BACKEND_DOMAIN="..." \
  --from-literal=NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY="..." \
  --from-literal=OPENAI_API_KEY="..." \
  --from-literal=BOT_SECRET="..." \
  --from-literal=NEXT_PUBLIC_MEETING_ONLY_MODE="..."
```

## Deployment

Deploy the entire stack in the following order:

1. **Deploy Secrets** (as shown above).
2. **Deploy Redis**:
   ```bash
   kubectl apply -f redis.yaml
   ```
3. **Deploy Backend**:
   ```bash
   kubectl apply -f deployment.yaml
   kubectl apply -f service.yaml
   ```
4. **Deploy Frontend**:
   ```bash
   kubectl apply -f frontend-deployment.yaml
   kubectl apply -f frontend-service.yaml
   ```
5. **Deploy Workers**:
   ```bash
   kubectl apply -f recorder-deployment.yaml
   kubectl apply -f streaming-deployment.yaml
   ```
6. **Configure Ingress**:
   Note: GitHub Actions or your CI/CD will dynamically replace `__NEXT_PUBLIC_BACKEND_DOMAIN__` in the ingress file before deployment. To deploy manually, replace it first.
   ```bash
   sed 's/__NEXT_PUBLIC_BACKEND_DOMAIN__/api.yourdomain.com/g' ingress.yaml | kubectl apply -f -
   ```

## Networking Details

Due to the intensive network requirements of WebRTC:
- The **Backend** pods run with `hostNetwork: true`. This binds the Node.js server directly to the host node's IP, avoiding SNAT/DNAT overhead for UDP packets. 
- Ensure that your cluster's firewall allows incoming UDP traffic on the specified WebRTC UDP ports (default `10000`).
- Because of `hostNetwork`, the pod might conflict if multiple backends are scheduled on the same node. Node anti-affinity handles constraints, or ensure nodes have available resources.
