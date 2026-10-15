import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { externalRouter } from '../../src/routes/external';

// Mock DB
vi.mock('../../src/db', () => ({
  db: {
    room: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn((...args) => console.error("LOGGER ERROR:", ...args)),
  },
}));

import { db } from '../../src/db';

const app = express();
app.use(express.json());
app.use('/external', externalRouter);

describe('External API - /meetings/join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a unique guest_ ID for attendees to prevent WebRTC overlap', async () => {
    // Mock a valid room that allows guests
    (db.room.findUnique as any).mockResolvedValue({
      slug: 'test-room',
      guestJoinAllowed: true,
      accessPin: null,
      logoutUrl: 'https://example.com/logout'
    });

    // Mock an existing user (we want to ensure they STILL get a guest ID if they join as attendee)
    (db.user.findUnique as any).mockResolvedValue({
      id: 'existing-db-user-id',
      email: 'guest@conn3ct.com'
    });

    const response = await request(app)
      .post('/external/meetings/join')
      .set('x-api-key', process.env.EXTERNAL_API_KEY || 'test_api_key_for_vitest')
      .send({
        roomId: 'test-room',
        name: 'Guest User',
        email: 'guest@conn3ct.com',
        role: 'attendee',
        isMobile: true,
        camera: false,
        mic: true
      });

    if (response.status !== 200) console.error("Error from /meetings/join (attendee):", response.body);
    expect(response.status).toBe(200);
    expect(response.body.sessionToken).toBeDefined();

    // Verify the JWT payload
    const decoded = jwt.verify(response.body.sessionToken, process.env.JWT_SECRET!) as any;
    expect(decoded.userId).toMatch(/^guest_/);
    expect(decoded.userId).not.toBe('existing-db-user-id');
    expect(decoded.role).toBe('attendee');
    expect(decoded.isMobile).toBe(true);
    expect(decoded.camera).toBe(false);
    expect(decoded.mic).toBe(true);
  });

  it('should use the persistent DB user ID if the user is a host', async () => {
    // Mock a valid room
    (db.room.findUnique as any).mockResolvedValue({
      slug: 'test-room',
      guestJoinAllowed: true,
      accessPin: null,
    });

    // Mock an existing user who is a host
    (db.user.findUnique as any).mockResolvedValue({
      id: 'host-db-user-id',
      email: 'host@conn3ct.com'
    });

    const response = await request(app)
      .post('/external/meetings/join')
      .set('x-api-key', process.env.EXTERNAL_API_KEY || 'test_api_key_for_vitest')
      .send({
        roomId: 'test-room',
        name: 'Host User',
        email: 'host@conn3ct.com',
        role: 'host',
      });

    expect(response.status).toBe(200);
    expect(response.body.sessionToken).toBeDefined();

    // Verify the JWT payload uses the DB user ID
    const decoded = jwt.verify(response.body.sessionToken, process.env.JWT_SECRET!) as any;
    expect(decoded.userId).toBe('host-db-user-id');
    expect(decoded.role).toBe('host');
  });
});

describe('External API - /meetings/create-and-join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new room with roomName when meetingSlug does not exist', async () => {
    (db.user.findUnique as any).mockResolvedValue({
      id: 'host-db-user-id',
      email: 'host@conn3ct.com'
    });
    (db.room.findUnique as any).mockResolvedValue(null);
    (db.room.create as any).mockResolvedValue({
      id: 'room-1',
      slug: 'new-slug',
      name: 'Initial Meeting Name',
      mode: 'meeting',
      recordingSetting: 'off',
      guestJoinAllowed: true,
      isWaitingRoomEnabled: true,
      maxParticipants: 100,
      maxWebinarAudience: 1000,
      maxActiveCameras: 15,
      logoutUrl: null,
    });

    const response = await request(app)
      .post('/external/meetings/create-and-join')
      .set('x-api-key', process.env.EXTERNAL_API_KEY || 'test_api_key_for_vitest')
      .send({
        name: 'Host User',
        email: 'host@conn3ct.com',
        meetingSlug: 'new-slug',
        roomName: 'Initial Meeting Name',
      });

    expect(response.status).toBe(200);
    expect(db.room.create).toHaveBeenCalledOnce();
    expect(db.room.update).not.toHaveBeenCalled();
    expect(response.body.roomName).toBe('Initial Meeting Name');
  });

  it('should update the room name when an existing meetingSlug is called with a new roomName', async () => {
    (db.user.findUnique as any).mockResolvedValue({
      id: 'host-db-user-id',
      email: 'host@conn3ct.com'
    });
    (db.room.findUnique as any).mockResolvedValue({
      id: 'room-1',
      slug: 'existing-slug',
      name: 'Old Meeting Name',
      mode: 'meeting',
      recordingSetting: 'off',
      guestJoinAllowed: true,
      isWaitingRoomEnabled: true,
      maxParticipants: 100,
      maxWebinarAudience: 1000,
      maxActiveCameras: 15,
      logoutUrl: null,
    });
    (db.room.update as any).mockResolvedValue({
      id: 'room-1',
      slug: 'existing-slug',
      name: 'Updated Meeting Name',
      mode: 'meeting',
      recordingSetting: 'off',
      guestJoinAllowed: true,
      isWaitingRoomEnabled: true,
      maxParticipants: 100,
      maxWebinarAudience: 1000,
      maxActiveCameras: 15,
      logoutUrl: null,
    });

    const response = await request(app)
      .post('/external/meetings/create-and-join')
      .set('x-api-key', process.env.EXTERNAL_API_KEY || 'test_api_key_for_vitest')
      .send({
        name: 'Host User',
        email: 'host@conn3ct.com',
        meetingSlug: 'existing-slug',
        roomName: 'Updated Meeting Name',
      });

    expect(response.status).toBe(200);
    expect(db.room.update).toHaveBeenCalledWith({
      where: { id: 'room-1' },
      data: { name: 'Updated Meeting Name' },
    });
    expect(response.body.roomName).toBe('Updated Meeting Name');

    const decoded = jwt.verify(response.body.sessionToken, process.env.JWT_SECRET!) as any;
    expect(decoded.roomName).toBe('Updated Meeting Name');
  });
});
