# GitHub Actions Workflows

This directory contains the GitHub Actions configurations used for CI/CD pipelines in the Konn3ct Meeting platform.

## Workflows

### 1. Build and Deploy (`workflows/deploy.yml`)

The primary CI/CD pipeline responsible for building Docker images and deploying the application to DigitalOcean Kubernetes.

**Triggers:**
- Push to `main` branch (Staging environment)
- Push to `prod` branch (Production environment)
- Push to `1gov_stag` branch (Specialized staging environment)

**Key Steps:**
1. **Docker Build & Push**: Builds the Docker images for the frontend, backend, and recorder microservices. It pushes these images to the DigitalOcean Container Registry using the commit SHA as well as environment-specific tags (e.g., `staging-latest`, `prod-latest`).
2. **Kubernetes Authentication**: Uses `doctl` to authenticate with the DigitalOcean Kubernetes cluster.
3. **Manifest Injection**: Uses `sed` to dynamically inject the correct image tags into the Kubernetes YAML files in the `/k8s` directory based on the deployment branch.
4. **Secrets Management**: Dynamically generates a `conn3ct-secrets` Kubernetes secret from GitHub repository secrets. This securely passes environment variables (like Database URLs and API keys) into the pods.
5. **Rollout**: Applies the modified Kubernetes manifests to the cluster and triggers a `rollout restart` for the deployments to ensure the new images are picked up immediately (specifically for the staging environment).

## Required GitHub Secrets

To ensure the deployment workflow executes successfully, the following secrets must be configured in the GitHub repository settings:

- `DIGITALOCEAN_ACCESS_TOKEN`
- `DO_CLUSTER_NAME`
- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `EXTERNAL_API_KEY`
- `BOT_SECRET`
- `NEXT_PUBLIC_BACKEND_DOMAIN`, `NEXT_PUBLIC_FRONTEND_DOMAIN`, `NEXT_PUBLIC_FRONTEND_URL`, `NEXT_PUBLIC_APP_NAME`
- `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
- DO Spaces secrets (`DO_SPACES_ENDPOINT`, `DO_SPACES_REGION`, `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_BUCKET`)

## Troubleshooting

- **Image Not Updating**: If an image isn't updating in the cluster after a deployment, verify that the `rollout restart` step executed properly or check the deployment logs in DigitalOcean.
- **Recorder Build Issues**: Ensure the recorder build step is uncommented in `deploy.yml` if you need the headless recording bot deployed alongside the main application.
