import Redis from 'ioredis';
import { logger } from './logger';
import { redisLatencyGauge } from './telemetry';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableAutoPipelining: true,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

redis.on('error', (err) => logger.error('Redis connection error:', err));
redis.on('connect', () => logger.info('Successfully connected to Redis'));

// Simple latency monitor
setInterval(() => {
  const start = Date.now();
  if (redis && typeof redis.ping === 'function') {
    redis.ping().then(() => {
      redisLatencyGauge.set(Date.now() - start);
    }).catch(() => {});
  }
}, 10000);

export function duplicateRedis(client: any) {
  if (client && typeof client.duplicate === 'function') {
    return client.duplicate();
  }
  return client;
}
