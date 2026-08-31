import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => {
  return {
    lpush: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    recordingFindMany: vi.fn(),
    roomFindUnique: vi.fn(),
    segmentFindFirst: vi.fn(),
  };
});

vi.mock('ioredis', () => {
  return {
    default: function MockRedis() {
      return {
        lpush: mocks.lpush,
        exists: mocks.exists,
        get: mocks.get,
        set: mocks.set,
      };
    }
  };
});

vi.mock('../../src/db', () => ({
  db: {
    recording: {
      findMany: mocks.recordingFindMany,
    },
    room: {
      findUnique: mocks.roomFindUnique,
    },
    recordingSegment: {
      findFirst: mocks.segmentFindFirst,
    },
  },
}));

vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Recording Supervisor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_FRONTEND_DOMAIN = 'edge.konn3ct.net';
  });

  it('should format recovery job with valid URL and botToken containing all required fields', async () => {
    // Import after mocks
    const { startRecordingSupervisor } = await import('../../src/signaling/supervisor');

    mocks.recordingFindMany.mockResolvedValueOnce([
      { id: 'rec-123', roomId: 'room-abc', status: 'recording' }
    ]);
    mocks.exists.mockResolvedValueOnce(0); // lease expired
    mocks.get.mockImplementation(async (key: string) => {
      if (key === 'recording:rec-123:control') return 'RECORDING';
      return null;
    });
    mocks.set.mockImplementation(async (key: string) => {
      if (key === 'recording:rec-123:recovery-lock') return 'OK'; // lock acquired
      return 'OK';
    });
    mocks.roomFindUnique.mockResolvedValueOnce({ id: 'room-abc', slug: 'test-room-slug' });
    mocks.segmentFindFirst.mockResolvedValueOnce({ workerGeneration: 1 });

    vi.useFakeTimers();
    startRecordingSupervisor();
    await vi.advanceTimersByTimeAsync(15000);
    vi.useRealTimers();

    expect(mocks.lpush).toHaveBeenCalledTimes(1);
    const [queueName, jobStr] = mocks.lpush.mock.calls[0];
    expect(queueName).toBe('recorder:queue');

    const job = JSON.parse(jobStr);
    expect(job.recordingId).toBe('rec-123');
    expect(job.roomId).toBe('room-abc');
    expect(job.roomSlug).toBe('test-room-slug');
    expect(job.workerGeneration).toBe(2);
    expect(job.nextSegmentIndex).toBe(20000);
    expect(job.url).toContain('https://edge.konn3ct.net/recording/test-room-slug?botToken=');

    // Verify token claims
    const decoded: any = jwt.verify(job.botToken, 'test-secret');
    expect(decoded.role).toBe('recorder');
    expect(decoded.purpose).toBe('recording_bot');
    expect(decoded.roomId).toBe('room-abc');
    expect(decoded.roomSlug).toBe('test-room-slug');
    expect(decoded.recordingId).toBe('rec-123');
    expect(decoded.participantId).toBeDefined();
  });
});
