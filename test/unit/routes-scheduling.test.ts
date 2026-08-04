import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { schedulingRouter } from '../../src/routes/scheduling';
import { db } from '../../src/db';

vi.mock('../../src/db', () => ({
  db: {
    room: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    meetingSession: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock requireAuth
vi.mock('../../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { userId: 'user-1', email: 'test@example.com' };
    next();
  },
}));

describe('Scheduling Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_FRONTEND_DOMAIN = 'test.domain.com';

    app = express();
    app.use(express.json());
    app.use('/scheduling', schedulingRouter);
  });

  describe('POST /scheduling', () => {
    it('schedules a session successfully for room owner', async () => {
      (db.room.findUnique as any).mockResolvedValueOnce({
        id: 'room-1',
        ownerId: 'user-1',
        slug: 'test-room'
      });

      (db.meetingSession.create as any).mockResolvedValueOnce({
        id: 'session-1',
        roomId: 'room-1',
        startTime: new Date('2030-01-01T10:00:00Z'),
      });

      const response = await request(app)
        .post('/scheduling')
        .send({
          roomId: 'room-1',
          title: 'My Meeting, with commas; and slashes\\',
          startTime: '2030-01-01T10:00:00Z',
          durationMin: 60
        });

      expect(response.status).toBe(201);
      expect(response.body.session.id).toBe('session-1');
      expect(response.body.icsFileContent).toContain('SUMMARY:My Meeting\\, with commas\\; and slashes\\\\');
      expect(response.body.icsFileContent).toContain('URL:https://test.domain.com/join/test-room');
    });

    it('schedules a session successfully for team member', async () => {
      (db.room.findUnique as any).mockResolvedValueOnce({
        id: 'room-1',
        ownerId: 'user-2', // not the requester
        slug: 'team-room',
        team: {
          members: [{ userId: 'user-1' }]
        }
      });

      (db.meetingSession.create as any).mockResolvedValueOnce({
        id: 'session-1',
        roomId: 'room-1',
        startTime: new Date('2030-01-01T10:00:00Z'),
      });

      const response = await request(app)
        .post('/scheduling')
        .send({
          roomId: 'room-1',
          title: 'Team Sync',
          startTime: '2030-01-01T10:00:00Z',
          durationMin: 30
        });

      expect(response.status).toBe(201);
    });

    it('returns 403 if not owner and not team member', async () => {
      (db.room.findUnique as any).mockResolvedValueOnce({
        id: 'room-1',
        ownerId: 'user-3',
        team: {
          members: [{ userId: 'user-2' }]
        }
      });

      const response = await request(app)
        .post('/scheduling')
        .send({
          roomId: 'room-1',
          title: 'Hacked Sync',
          startTime: '2030-01-01T10:00:00Z'
        });

      expect(response.status).toBe(403);
    });

    it('returns 404 if room does not exist', async () => {
      (db.room.findUnique as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/scheduling')
        .send({
          roomId: 'room-1',
          title: 'Sync',
          startTime: '2030-01-01T10:00:00Z'
        });

      expect(response.status).toBe(404);
    });

    it('returns 400 for invalid data', async () => {
      const response = await request(app)
        .post('/scheduling')
        .send({
          roomId: 'room-1',
          title: '', // too short
          startTime: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid input');
    });

    it('returns 500 on db error', async () => {
      (db.room.findUnique as any).mockRejectedValueOnce(new Error('db down'));

      const response = await request(app)
        .post('/scheduling')
        .send({
          roomId: 'room-1',
          title: 'Sync',
          startTime: '2030-01-01T10:00:00Z'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('GET /scheduling', () => {
    it('returns upcoming sessions for accessible rooms', async () => {
      (db.room.findMany as any).mockResolvedValueOnce([
        { id: 'room-1' },
        { id: 'room-2' }
      ]);
      (db.meetingSession.findMany as any).mockResolvedValueOnce([
        { id: 'session-1' },
        { id: 'session-2' }
      ]);

      const response = await request(app).get('/scheduling');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(db.meetingSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          roomId: { in: ['room-1', 'room-2'] }
        })
      }));
    });

    it('returns 500 on db error', async () => {
      (db.room.findMany as any).mockRejectedValueOnce(new Error('db down'));

      const response = await request(app).get('/scheduling');

      expect(response.status).toBe(500);
    });
  });
});
