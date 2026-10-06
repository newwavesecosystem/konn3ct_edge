# Conn3ct Kubernetes Manifests (Kustomize Base & Overlays)

This directory contains the Kubernetes deployment manifests for the Conn3ct Meeting infrastructure, organized with **Kustomize Base & Overlays** to support DigitalOcean Managed Kubernetes (Test & Prod) and On-Premise/Bare-Metal deployments (1gov) with identical container images and zero-downtime rollouts.

---

## Directory Structure

```
k8s/
├── base/                                # Shared base templates, services, env vars & ingress
│   ├── kustomization.yaml
│   ├── frontend-deployment.yaml         # Next.js frontend
│   ├── frontend-service.yaml
│   ├── signaling-deployment.yaml        # Node.js backend & signaling
│   ├── service.yaml                     # Backend service
│   ├── media-deployment.yaml            # Mediasoup WebRTC SFU engine
│   ├── recorder-deployment.yaml         # Headless Chromium recording bot
│   ├── streaming-deployment.yaml        # RTMP live streaming worker
│   ├── redis.yaml                       # State sync & Pub/Sub
│   └── ingress.yaml                     # Ingress with sticky sessions
└── overlays/
    ├── test/                            # DigitalOcean Staging / Test (1-node cluster)
    │   ├── kustomization.yaml
    │   └── patch-test-resources.yaml
    ├── prod/                            # DigitalOcean Production (Multi-node HA with HPA)
    │   ├── kustomization.yaml
    │   ├── patch-prod-resources.yaml
    │   ├── media-hpa.yaml               # Auto-scaler for media pods
    │   └── signaling-hpa.yaml           # Auto-scaler for signaling pods
    └── 1gov/                            # On-Premise / Dedicated Bare-Metal Cluster
        ├── kustomization.yaml
        ├── patch-resources.yaml         # Resource limits, node pinning & secrets
        ├── patch-ingress.yaml           # Ingress routing & SSL certificates
        ├── cluster-issuer.yaml          # cert-manager Let's Encrypt
        ├── postgres.yaml                # PostgreSQL with permanent hostPath storage
        └── minio.yaml                   # In-cluster S3 object storage (MinIO)
```

---

## Environment Overlays

### 1. 1gov On-Premise / Bare-Metal Overlay (`k8s/overlays/1gov`)
Designed for standalone on-premise infrastructure with dedicated worker compute separation:

* **Node Topology & Scheduling:**
  * **`ubuntu20` (Core Node):** Runs all core platform services (`conn3ct-signaling`, `conn3ct-frontend`, `conn3ct-media`, `postgres`, `redis`, `minio`).
  * **`recorder-worker-213` (Dedicated Compute Node):** Dedicated worker isolated with `role: recorder` node-selector and `dedicated=recorder:NoSchedule` taint to protect core services from heavy Chromium & FFmpeg CPU spikes.
* **Persistent Storage Architecture (`hostPath`):**
  * **PostgreSQL:** Persists directly to `/var/lib/postgres-data` on host NVMe drive.
  * **MinIO S3:** Persists object storage directly to `/var/lib/minio-data`.
  * **Redis:** Configured with AOF (Append-Only File) disk persistence to `/var/lib/redis-data` (`--appendonly yes`, `--appendfsync everysec`).
* **High Availability & Resilience:**
  * **Frontend:** Scaled to **2 replicas** with `RollingUpdate` (`maxUnavailable: 0`) for zero-downtime deployments.
  * **Redis:** Scaled to **2 CPU cores / 4 GB RAM** (with 3GB LRU cache) capable of powering 50+ concurrent rooms and 5,000+ simultaneous participants.
  * **Postgres & Redis Strategy:** Configured with `strategy: Recreate` to guarantee single-writer disk lock safety.
* **Object Storage / MinIO Public Routing:**
  * Uses internal endpoint `http://minio-service:9000` for container uploads and translates to `PUBLIC_STORAGE_URL: https://meetingstorage.1gov.ng` for external browser playback.

---

### 2. Test / Staging Overlay (`k8s/overlays/test`)
* **Target Node:** 1 Droplet (4 vCPU, 8 GB RAM, 50 GB Disk) on DigitalOcean.
* **Scale:** Replicas set to `1` for all services.
* **Storage:** Connects to DigitalOcean Spaces for recording storage.

---

### 3. Production Overlay (`k8s/overlays/prod`)
* **Target Architecture:** Multi-Node High Availability (HA) on DigitalOcean Kubernetes (DOKS).
* **Scale & Autoscaling:** Replicas scaled via `HorizontalPodAutoscaler` (HPA) for signaling and media routers.
* **Storage:** DigitalOcean Spaces (S3-compatible).

---

## Deployment Commands

### Deploy to 1gov (On-Premise Master Server)
```bash
# 1. Ensure storage permissions exist
sudo mkdir -p /var/lib/postgres-data /var/lib/minio-data /var/lib/redis-data
sudo chmod 700 /var/lib/postgres-data
sudo chmod 777 /var/lib/redis-data /var/lib/minio-data

# 2. Apply manifests
kubectl apply -k k8s/overlays/1gov

# 3. Rollout restart if updating container images
kubectl rollout restart deployment conn3ct-signaling conn3ct-frontend conn3ct-media conn3ct-recorder redis
```

### Deploy to Test / Staging
```bash
kubectl apply -k k8s/overlays/test
```

### Deploy to Production
```bash
kubectl apply -k k8s/overlays/prod
```

---

## Registry Authentication (`regcred`)

If worker nodes require pulling private container images from DigitalOcean Registry:
```bash
kubectl create secret docker-registry regcred \
  --docker-server=registry.digitalocean.com \
  --docker-username=unused \
  --docker-password=<DO_API_TOKEN> \
  --docker-email=odejinmisa@newwavesecosystem.com \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl patch serviceaccount default -p '{"imagePullSecrets": [{"name": "regcred"}]}'
```
