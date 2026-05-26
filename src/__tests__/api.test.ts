import { test, expect, describe, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { prismaMock } from './mockPrisma';
import { app } from '../server';
import jwt from 'jsonwebtoken';

describe('Health Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('GET /health returns 200', async () => {
    // @ts-ignore
    prismaMock.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});

describe('Dashboard API (Mocked Auth & DB)', () => {
  const mockUserId = 'user-123';
  const mockToken = jwt.sign({ userId: mockUserId }, process.env.JWT_SECRET || 'secret');

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
  });

  test('GET /api/dashboard returns combined metrics for authenticated user', async () => {
    // 1. Mock DB responses
    prismaMock.room.count.mockResolvedValue(5);
    prismaMock.teamMember.count.mockResolvedValue(2);
    prismaMock.recording.findMany.mockResolvedValue([]);
    prismaMock.meetingSession.findMany.mockResolvedValue([]);

    // 2. Make authenticated request
    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', [`token=${mockToken}`]);

    // 3. Assert correct mapping
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      stats: {
        totalRooms: 5,
        totalTeams: 2
      },
      upcomingSessions: [],
      recentRecordings: []
    });
  });

  test('GET /api/dashboard fails without token', async () => {
    const res = await request(app).get('/api/dashboard');
    // Auth middleware throws 401
    expect(res.status).toBe(401);
  });
});
