import * as promClient from 'prom-client';
import { db } from './db';
import Redis from 'ioredis';
import { logger } from './logger';

export const redisLatencyGauge = new promClient.Gauge({ name: 'konn3ct_redis_latency_ms', help: 'Redis ping latency in ms' });
export const pgLatencyGauge = new promClient.Gauge({ name: 'konn3ct_pg_latency_ms', help: 'PostgreSQL ping latency in ms' });

let redisClient: Redis | null = null;
try {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
} catch(e) {
  logger.warn('[Telemetry] Redis client failed to initialize for telemetry', e);
}

export function startDeepTelemetry() {
  logger.info('[Telemetry] Starting deep metrics polling (15s interval)');
  
  setInterval(async () => {
    try {
      if (redisClient) {
        const rStart = performance.now();
        await redisClient.ping();
        redisLatencyGauge.set(performance.now() - rStart);
      }
    } catch(err) {
      logger.warn('[Telemetry] Failed to ping Redis', err);
    }

    try {
      const pStart = performance.now();
      await db.$queryRawUnsafe('SELECT 1');
      pgLatencyGauge.set(performance.now() - pStart);
    } catch(err) {
      logger.warn('[Telemetry] Failed to ping PostgreSQL', err);
    }
  }, 15000);
}
