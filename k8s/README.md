# Conn3ct Kubernetes Manifests (Kustomize Base & Overlays)

This directory contains the Kubernetes deployment manifests for the Conn3ct Meeting infrastructure, organized with **Kustomize Base & Overlays** to seamlessly support both low-cost single-node testing and multi-node high-availability production environments with identical container images.

---

## Directory Structure

```
k8s/
├── base/                              # Shared templates, services, env vars & ingress
│   ├── kustomization.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── signaling-deployment.yaml
│   ├── service.yaml                   # Backend LoadBalancer service
│   ├── media-deployment.yaml          # Mediasoup SFU deployment
│   ├── recorder-deployment.yaml       # Headless Chromium recording bot
│   ├── streaming-deployment.yaml      # RTMP streaming worker
│   ├── redis.yaml                     # State sync and pub/sub
│   └── ingress.yaml                   # NGINX Ingress with room sticky sessions
├── overlays/
│   ├── test/                          # Optimized for 1 Node (4 vCPU / 8 GB RAM)
│   │   ├── kustomization.yaml
│   │   └── patch-test-resources.yaml  # Replicas: 1, relaxed affinities, 1-node requests
│   └── prod/                          # Scaled for Multi-Node High Availability (HA)
│       ├── kustomization.yaml
│       ├── patch-prod-resources.yaml  # Multi-replica, Node Anti-Affinity
│       ├── media-hpa.yaml             # Auto-scaler for media pods
│       └── signaling-hpa.yaml         # Auto-scaler for signaling pods
```

---

## Environment Overlays

### 1. Test / Staging Overlay (`k8s/overlays/test`)
- **Target Node**: 1 Node (4 vCPU, 8 GB RAM, 50 GB Disk).
- **Scale**: Replicas set to `1` for all services (`conn3ct-signaling`, `conn3ct-media`, `conn3ct-frontend`, `conn3ct-recorder`, `redis`).
- **Scheduling**: Clears hard `podAntiAffinity` rules so recorder and media pods schedule smoothly on the single node without getting stuck in `Pending`.
- **Resource Sizing**: Requests sized at ~1.5 vCPU and ~3.0 GB RAM total across all containers, leaving ample headroom for OS, Kubelet, and Ingress.

### 2. Production Overlay (`k8s/overlays/prod`)
- **Target Architecture**: Multi-Node High Availability (HA).
- **Scale**: Replicas set to `4` for Signaling, `3` for Media, `2` for Frontend, `1` for Recorder.
- **Autoscaling**: Connected to `HorizontalPodAutoscaler` (HPA) scaling signaling (4–15) and media (3–10).
- **Node Isolation**: Strict `podAntiAffinity` prevents CPU-heavy recording jobs from sharing nodes with live WebRTC media routers.

---

## Deployment Instructions

### Deploy to Test / Staging
```bash
kubectl apply -k k8s/overlays/test
```

### Deploy to Production
```bash
kubectl apply -k k8s/overlays/prod
```

---

## CI/CD Pipeline (GitHub Actions)

The deployment workflow (`.github/workflows/deploy.yml`) automatically routes deployments based on git branch:
- **`main` branch** $\rightarrow$ Automatically applies `k8s/overlays/test` (and rolls out restart for `staging-latest`).
- **`prod` branch** $\rightarrow$ Automatically applies `k8s/overlays/prod` (with image tag matching commit SHA).
