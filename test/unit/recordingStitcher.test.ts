import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  return {
    recordingFindUnique: vi.fn(),
    recordingUpdate: vi.fn().mockResolvedValue({}),
    segmentFindMany: vi.fn(),
    redisSet: vi.fn().mockResolvedValue('OK'),
    redisDel: vi.fn().mockResolvedValue(1),
    s3Send: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('ioredis', () => {
  return {
    default: function MockRedis() {
      return {
        set: mocks.redisSet,
        del: mocks.redisDel,
      };
    }
  };
});

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: function MockS3() {
      return {
        send: mocks.s3Send,
      };
    },
    PutObjectCommand: function MockPutCommand(args: any) {
      return args;
    },
  };
});

vi.mock('../../src/db', () => ({
  db: {
    recording: {
      findUnique: mocks.recordingFindUnique,
      update: mocks.recordingUpdate,
    },
    recordingSegment: {
      findMany: mocks.segmentFindMany,
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

describe('Recording Stitcher Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DO_SPACES_KEY = 'mock-key';
    process.env.DO_SPACES_SECRET = 'mock-secret';
    process.env.DO_SPACES_BUCKET = 'test-bucket';
    process.env.DO_SPACES_ENDPOINT = 'nyc3.digitaloceanspaces.com';
  });

  it('should skip stitching if Redis lock is not acquired', async () => {
    mocks.redisSet.mockResolvedValueOnce(null); // lock not acquired

    const { stitchRecording } = await import('../../src/services/recordingStitcher');
    const result = await stitchRecording('rec-busy');

    expect(result).toBe(false);
    expect(mocks.recordingFindUnique).not.toHaveBeenCalled();
  });

  it('should immediately complete single-segment recordings without invoking FFmpeg', async () => {
    mocks.redisSet.mockResolvedValueOnce('OK');
    mocks.recordingFindUnique.mockResolvedValueOnce({
      id: 'rec-single',
      status: 'stopping',
      roomId: 'room-1',
      endedAt: new Date()
    });
    mocks.segmentFindMany.mockResolvedValueOnce([
      { segmentIndex: 0, url: 'https://test-bucket.nyc3.digitaloceanspaces.com/seg0.mp4', durationMs: 45000, status: 'uploaded' }
    ]);

    const { stitchRecording } = await import('../../src/services/recordingStitcher');
    const result = await stitchRecording('rec-single');

    expect(result).toBe(true);
    expect(mocks.recordingUpdate).toHaveBeenCalledWith({
      where: { id: 'rec-single' },
      data: expect.objectContaining({
        status: 'completed',
        url: 'https://test-bucket.nyc3.digitaloceanspaces.com/seg0.mp4',
        duration: 45
      })
    });
  });

  it('should skip if recording is already completed with URL', async () => {
    mocks.redisSet.mockResolvedValueOnce('OK');
    mocks.recordingFindUnique.mockResolvedValueOnce({
      id: 'rec-done',
      status: 'completed',
      url: 'https://test-bucket.nyc3.digitaloceanspaces.com/master.mp4'
    });

    const { stitchRecording } = await import('../../src/services/recordingStitcher');
    const result = await stitchRecording('rec-done');

    expect(result).toBe(true);
    expect(mocks.recordingUpdate).not.toHaveBeenCalled();
  });
});
