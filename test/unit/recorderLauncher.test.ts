import { describe, it, expect, vi } from 'vitest';
import { launchRecorderBot } from '../../src/services/recorderLauncher';
import Redis from 'ioredis';

const mocks = vi.hoisted(() => {
  return {
    lpush: vi.fn().mockResolvedValue(1),
    disconnect: vi.fn()
  };
});

vi.mock('ioredis', () => {
  return {
    default: function MockRedis() {
      return mocks;
    }
  };
});

describe('Recorder Launcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enqueue payload to Redis successfully', async () => {
    mocks.lpush.mockResolvedValueOnce(1);

    const payload = {
      roomId: 'room-1',
      roomSlug: 'slug',
      recordingId: 'rec-1',
      botToken: 'token',
      url: 'https://edge.konn3ct.net'
    };

    const result = await launchRecorderBot(payload);
    
    expect(result.queued).toBe(true);
    expect(result.jobId).toBe('queued-rec-1');
  });

  it('should handle enqueue failure', async () => {
    mocks.lpush.mockRejectedValueOnce(new Error('Redis connection error'));

    const result = await launchRecorderBot({
      roomId: 'room-2',
      roomSlug: 'slug',
      recordingId: 'rec-2',
      botToken: 'token',
      url: 'https://edge.konn3ct.net'
    });
    
    expect(result.queued).toBe(false);
    expect(result.error).toContain('Redis connection error');
  });
});
