// Collect Signaling specific metrics from the /metrics endpoint
import axios from 'axios';

async function collect() {
  try {
    const res = await axios.get('http://localhost:3000/metrics');
    // Assuming Node.js default metrics are included (event loop, active handles)
    const lines = res.data.split('\n');
    const sigMetrics = lines.filter((l: string) => l.includes('nodejs_eventloop') || l.includes('nodejs_active'));
    console.log('--- Signaling Metrics ---');
    console.log(sigMetrics.join('\n'));
  } catch (err) {
    console.error('Failed to collect Signaling metrics:', err.message);
  }
}
collect();
