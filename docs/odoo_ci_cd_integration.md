# Konn3ct Edge CI/CD to Odoo Integration

## Overview
As part of the Konn3ct Edge Execution Environment PM Strategy (Week 3 Automation), our GitHub Actions CI/CD pipelines are fully integrated with the Odoo 19 PM module. This integration uses standard Odoo JSON-RPC to link code changes, deployment evidence, and critical defects directly to Odoo requirements.

## Architecture
The integration is driven by a single Node.js script located at `scripts/odoo_integration.js`. This script acts as an API client connecting to Odoo. It is triggered automatically by GitHub Actions.

### Environment Variables Required
To use the integration, your GitHub repository must have the following variables/secrets configured:
*   **Secrets:**
    *   `ODOO_API_KEY`: A developer API key generated from Odoo (Account Security > Developer API Keys).
*   **Variables:**
    *   `ODOO_URL`: The full URL to your Odoo instance (e.g., `https://odoo.newwaves.com`).
    *   `ODOO_DB`: The name of the Odoo database.
    *   `ODOO_USER`: The username/email of the service account generating the API key.

## Workflows & Capabilities

### 1. PR Traceability Check (Task 35)
**Trigger:** `pull_request` (via `.github/workflows/pr_check.yml`)
**Description:** Every PR title or source branch must contain a valid Blueprint Traceability ID (e.g., `KE-V06-MEDIA-REQ-001`). If this ID is missing, the CI pipeline will fail, blocking the merge. This enforces 100% traceability from code to Odoo requirement.

### 2. Automated Evidence Ingestion (Task 36)
**Trigger:** `push` to main branches (via `.github/workflows/deploy.yml`)
**Description:** After every deployment or main build, the pipeline runs a step that searches Odoo for the Traceability ID found in the merged branch/commit. It then posts a comment to that specific Odoo task. The comment contains the build status (Success/Failure), commit SHA, and a direct link to the GitHub Actions logs.

### 3. Automated Defect Creation (Task 37)
**Trigger:** `push` pipeline failure on `main` or `prod` (via `.github/workflows/deploy.yml`)
**Description:** If a critical deployment pipeline fails on the protected production branches, the script automatically creates a new Task in Odoo. This new task is titled with the repository and branch name, contains a link to the failing logs, and is intended to be picked up immediately by the Tech & Ops dashboard as an open defect.

## Development & Testing
The script is located at `scripts/odoo_integration.js`. To test it locally:
```bash
export ODOO_URL=your_url
export ODOO_DB=your_db
export ODOO_USER=your_user
export ODOO_API_KEY=your_key

node scripts/odoo_integration.js --action verify_pr --pr-title "Fixing KE-V06-REQ-001"
```
