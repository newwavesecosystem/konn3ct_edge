import Redis from 'ioredis';
import { logger } from '../logger';

export interface RecorderJobPayload {
  roomId: string;
  roomSlug: string;
  recordingId: string;
  botToken: string;
  url: string;
}

export interface RecorderLaunchResult {
  queued: boolean;
  jobId?: string;
  error?: string;
}

export async function launchRecorderBot(payload: RecorderJobPayload): Promise<RecorderLaunchResult> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redis = new Redis(redisUrl);
    
    await redis.lpush('recorder:queue', JSON.stringify(payload));
    
    // Clean up connection after pushing
    redis.disconnect();

    return {
      queued: true,
      jobId: `queued-${payload.recordingId}`
    };
  } catch (err: any) {
    logger.error('Failed to enqueue recorder bot', err);
    return {
      queued: false,
      error: err.message || 'Failed to enqueue recorder process'
    };
  }
}
