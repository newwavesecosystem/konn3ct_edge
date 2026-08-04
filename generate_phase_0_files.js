const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs', 'architecture', 'baseline');
const scriptsDir = path.join(__dirname, 'scripts', 'baseline');

const files = {
  // --- SCRIPTS ---
  [`${scriptsDir}/collect-system-metrics.sh`]: `#!/bin/bash
# Collect OS-level system metrics (CPU, Memory, I/O)
echo "Collecting System Metrics at $(date)"
echo "--- CPU ---"
top -b -n 1 | head -n 10
echo "--- Memory ---"
free -m
echo "--- I/O ---"
vmstat 1 5
`,

  [`${scriptsDir}/collect-kubernetes-metrics.sh`]: `#!/bin/bash
# Collect Kubernetes Pod and Node metrics
echo "Collecting Kubernetes Metrics at $(date)"
echo "--- Nodes ---"
kubectl top nodes
echo "--- Pods (Konn3ct Namespace) ---"
kubectl top pods -n konn3ct-prod
echo "--- Endpoints ---"
kubectl get endpoints -n konn3ct-prod
`,

  [`${scriptsDir}/collect-mediasoup-metrics.ts`]: `// Collect Mediasoup specific metrics from the /metrics endpoint
import axios from 'axios';

async function collect() {
  try {
    const res = await axios.get('http://localhost:3000/metrics');
    const lines = res.data.split('\\n');
    const mediasoupMetrics = lines.filter((l: string) => l.startsWith('konn3ct_active_'));
    console.log('--- Mediasoup Metrics ---');
    console.log(mediasoupMetrics.join('\\n'));
  } catch (err) {
    console.error('Failed to collect Mediasoup metrics:', err.message);
  }
}
collect();
`,

  [`${scriptsDir}/collect-signaling-metrics.ts`]: `// Collect Signaling specific metrics from the /metrics endpoint
import axios from 'axios';

async function collect() {
  try {
    const res = await axios.get('http://localhost:3000/metrics');
    // Assuming Node.js default metrics are included (event loop, active handles)
    const lines = res.data.split('\\n');
    const sigMetrics = lines.filter((l: string) => l.includes('nodejs_eventloop') || l.includes('nodejs_active'));
    console.log('--- Signaling Metrics ---');
    console.log(sigMetrics.join('\\n'));
  } catch (err) {
    console.error('Failed to collect Signaling metrics:', err.message);
  }
}
collect();
`,

  [`${scriptsDir}/baseline-health-check.sh`]: `#!/bin/bash
# Check health of Konn3ct backend
echo "Checking API Health..."
curl -s http://localhost:3000/health | grep -i "status"
echo "Checking Metrics Endpoint..."
curl -s http://localhost:3000/metrics | head -n 5
echo "Health Check Complete."
`,

  [`${scriptsDir}/export-baseline-results.sh`]: `#!/bin/bash
# Export the collected baseline results into a CSV format
echo "timestamp,cpu_usage,memory_usage,active_rooms,active_workers,routers,transports,producers,consumers" > baseline_export.csv
echo "$(date +%s),N/A,N/A,N/A,N/A,N/A,N/A,N/A,N/A" >> baseline_export.csv
echo "Exported to baseline_export.csv"
`,

  // --- DOCS ---
  [`${docsDir}/00-phase-0-executive-summary.md`]: `# 00 Phase 0 Executive Summary
Phase 0 establishes the baseline metrics for the Konn3ct monolith architecture before transitioning to the Kubernetes-native Control Plane / Data Plane separation.
Objective: Identify existing performance bottlenecks and establish Go/No-Go criteria for Phase 1.
`,

  [`${docsDir}/01-current-architecture-inventory.md`]: `# 01 Current Architecture Inventory
Current State: Monolithic Node.js server (\`server.ts\`) running both WebSocket signaling and Mediasoup C++ worker orchestration (\`sfu.ts\`).
- Signaling: \`ws\` library on \`http.Server\`
- Media: \`mediasoup\` 3.x
- DB: \`ioredis\` and \`prisma/postgresql\`
`,

  [`${docsDir}/02-infrastructure-and-kubernetes-inventory.md`]: `# 02 Infrastructure and Kubernetes Inventory
Current Infrastructure Profile:
- Node Type: [PENDING CAPTURE]
- vCPUs: [PENDING CAPTURE]
- Memory: [PENDING CAPTURE]
- Kubernetes Config: Currently running as a single large pod or VMs, lacking true separation of Media and Signaling pods.
`,

  [`${docsDir}/03-current-mediasoup-configuration.md`]: `# 03 Current Mediasoup Configuration
- Workers: \`os.cpus().length\`
- Audio Codec: Opus (DTX and FEC enabled)
- Video Codec: H264 (packetization-mode=1, profile-level-id=42e01f)
- WebRTC Transport: UDP and TCP fallback configured.
`,

  [`${docsDir}/04-baseline-metrics-definition.md`]: `# 04 Baseline Metrics Definition
The following metrics are strictly monitored during Phase 0:
- Event Loop Delay (P50/P95/P99)
- Active WebSockets
- Mediasoup Workers, Routers, Transports, Producers, Consumers
- Time to First Audio/Video (Client-side)
- Node.js CPU and Memory
`,

  [`${docsDir}/06-monitoring-and-observability-gap-analysis.md`]: `# 06 Monitoring and Observability Gap Analysis
- Initial Gaps: No TSDB exporter, no granular Time-to-First-Media logs.
- Resolutions: \`prom-client\` added to \`server.ts\` and \`sfu.ts\`. Telemetry events added to \`webrtc.ts\`.
- Remaining Gaps: End-to-end Kubernetes ingress latency tracking.
`,

  [`${docsDir}/07-baseline-test-execution-guide.md`]: `# 07 Baseline Test Execution Guide
To execute tests:
1. Provision infrastructure.
2. Run \`scripts/baseline/baseline-health-check.sh\`.
3. Launch Puppeteer bots for Profiles A through J.
4. Run \`scripts/baseline/collect-*-metrics.sh\` during peak load.
5. Run \`scripts/baseline/export-baseline-results.sh\` to finalize.
`,

  [`${docsDir}/08-baseline-results.md`]: `# 08 Baseline Results
[PENDING EXECUTION]
This document will hold the CSV/Table outputs generated by the baseline test profiles.
`,

  [`${docsDir}/09-bottleneck-and-capacity-analysis.md`]: `# 09 Bottleneck and Capacity Analysis
[PENDING EXECUTION]
This document will analyze the results from Document 08 to pinpoint the exact failure threshold of the monolith (e.g. CPU starvation vs Event Loop locking).
`,

  [`${docsDir}/10-phase-1-go-no-go-assessment.md`]: `# 10 Phase 1 Go/No-Go Assessment
[PENDING EXECUTION]
Final decision on whether the baseline has been successfully captured and Phase 1 (Internal Boundaries) can commence.
`
};

for (const [filePath, content] of Object.entries(files)) {
  fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o755 });
  console.log('Created:', filePath);
}
