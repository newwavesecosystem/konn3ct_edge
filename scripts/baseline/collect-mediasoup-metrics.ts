// Collect Mediasoup specific metrics from the /metrics endpoint
import axios from 'axios';

async function collect() {
  try {
    const res = await axios.get('http://localhost:3000/metrics');
    const lines = res.data.split('\n');
    const mediasoupMetrics = lines.filter((l: string) => l.startsWith('konn3ct_active_'));
    console.log('--- Mediasoup Metrics ---');
    console.log(mediasoupMetrics.join('\n'));
  } catch (err) {
    console.error('Failed to collect Mediasoup metrics:', err.message);
  }
}
collect();
