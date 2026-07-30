import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { roomsRouter } from '../../src/routes/rooms';

// Mock DB
vi.mock('../../src/db', () => ({
  db: {
    room: {
      findUnique: vi.fn(),
    },
    meetingFeedback: {
      create: vi.fn(),
    },
    // Mock other required parts for requireAuth, though our endpoint is before it
    user: {
      findUnique: vi.fn(),
    }
  },
}));

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock auth middleware so it doesn't fail on requireAuth routes
vi.mock('../../src/middleware/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

import { db } from '../../src/db';

const app = express();
app.use(express.json());
app.use('/rooms', roomsRouter);

describe('Rooms API - /rooms/:slug/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully submit feedback for a valid room', async () => {
    const mockRoom = { id: 'room-1', slug: 'test-room' };
    const mockFeedback = { id: 'fb-1', roomId: 'room-1', rating: 5, feedback: 'Great!' };

    (db.room.findUnique as any).mockResolvedValue(mockRoom);
    (db.meetingFeedback.create as any).mockResolvedValue(mockFeedback);

    const response = await request(app)
      .post('/rooms/test-room/feedback')
      .send({
        rating: 5,
        feedback: 'Great!'
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Feedback submitted');
    expect(response.body.feedback).toEqual(mockFeedback);
    
    // Ensure the DB was called with correct data
    expect(db.meetingFeedback.create).toHaveBeenCalledWith({
      data: {
        roomId: 'room-1',
        rating: 5,
        feedback: 'Great!',
      }
    });
  });

  it('should return 400 if rating is invalid (out of bounds)', async () => {
    const response = await request(app)
      .post('/rooms/test-room/feedback')
      .send({
        rating: 6 // Max is 5
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid input');
    expect(db.room.findUnique).not.toHaveBeenCalled();
    expect(db.meetingFeedback.create).not.toHaveBeenCalled();
  });

  it('should return 400 if rating is missing', async () => {
    const response = await request(app)
      .post('/rooms/test-room/feedback')
      .send({
        feedback: 'No rating given'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid input');
  });

  it('should return 404 if room is not found', async () => {
    (db.room.findUnique as any).mockResolvedValue(null);

    const response = await request(app)
      .post('/rooms/invalid-room/feedback')
      .send({
        rating: 4
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Room not found');
    expect(db.meetingFeedback.create).not.toHaveBeenCalled();
  });
});
