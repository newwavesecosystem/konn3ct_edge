import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server'; 
import { db } from '../../src/db';
import jwt from 'jsonwebtoken';
import * as launcher from '../../src/services/recorderLauncher';

// Mock the recorder launcher instead of child_process
vi.mock('../../src/services/recorderLauncher', () => ({
  launchRecorderBot: vi.fn().mockResolvedValue({ queued: true, jobId: 'mock-job-id' })
}));

describe('Recordings API & Idempotency', () => {
  let token: string;
  let userId: string;
  let roomId: string;
  let roomSlug = 'test-rec-room';
  let botToken: string;
  let recordingId: string;

  beforeAll(async () => {
    // Clean up stale test data
    await db.recording.deleteMany({ where: { owner: { email: 'rectest@example.com' } } });
    await db.room.deleteMany({ where: { owner: { email: 'rectest@example.com' } } });
    await db.user.deleteMany({ where: { email: 'rectest@example.com' } });

    // Setup test user
    const user = await db.user.create({
      data: { email: 'rectest@example.com', passwordHash: 'hashed', name: 'Rec Test User' }
    });
    userId = user.id;
    token = jwt.sign({ userId, email: user.email }, process.env.JWT_SECRET || 'testsecret');

    // Setup room
    const room = await db.room.create({
      data: { name: 'Test Rec Room', slug: roomSlug, ownerId: userId }
    });
    roomId = room.id;
  });

  afterAll(async () => {
    if (userId) await db.recording.deleteMany({ where: { ownerId: userId } });
    if (roomId) await db.room.delete({ where: { id: roomId } });
    if (userId) await db.user.delete({ where: { id: userId } });
  });

  it('Start recording creates one active recording', async () => {
    const res = await request(app)
      .post('/api/recordings/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test Rec 1', roomSlug });

    // Assuming we modified start recording to return 202 quickly without hanging on Puppeteer
    expect([200, 202]).toContain(res.status);
    recordingId = res.body.recordingId;

    const active = await db.recording.findUnique({ where: { id: recordingId } });
    expect(active?.status).toBe('starting');
  }, 10000);

  it('Concurrent duplicate start does not create more than one active recording', async () => {
    // Clear mock history before test
    vi.clearAllMocks();

    // Delete the recording from the previous test so we can test a fresh concurrent start
    await db.recording.deleteMany({ where: { roomId } });

    // Generate 5 concurrent requests
    const promises = Array.from({ length: 5 }).map(() =>
      request(app)
        .post('/api/recordings/start')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Concurrent Rec', roomSlug })
    );

    const responses = await Promise.all(promises);
    
    // Exactly one should be 202 (or 200 with new), the rest 200 already_recording
    const newRecordings = responses.filter(r => [200, 202].includes(r.status) && r.body.message === 'Recording started');
    const existingRecordings = responses.filter(r => r.status === 200 && r.body.status === 'already_recording');

    expect(newRecordings.length).toBe(1);
    expect(existingRecordings.length).toBe(4);

    // Ensure the db only has 1 active recording for this room
    const active = await db.recording.findMany({
      where: { roomId, status: { in: ['starting', 'recording'] } }
    });
    expect(active.length).toBe(1);
    
    // Re-assign recordingId for subsequent tests
    recordingId = newRecordings[0].body.recordingId;
    
    // Verify that the launcher was called exactly once
    expect(launcher.launchRecorderBot).toHaveBeenCalledTimes(1);
  }, 15000);

  it('Invalid recorder token is rejected in callback', async () => {
    const res = await request(app)
      .post(`/api/recordings/${recordingId}/callback/started`)
      .set('Authorization', `Bearer invalid_token`)
      .send();

    expect(res.status).toBe(401);
  });

  it('Valid recorder started callback changes status to recording', async () => {
    // Mint valid token
    botToken = jwt.sign(
      { role: 'recorder', purpose: 'recording_bot', roomId, recordingId },
      process.env.JWT_SECRET || 'testsecret'
    );

    const res = await request(app)
      .post(`/api/recordings/${recordingId}/callback/started`)
      .set('Authorization', `Bearer ${botToken}`)
      .send();

    expect(res.status).toBe(200);
    
    const rec = await db.recording.findUnique({ where: { id: recordingId } });
    expect(rec?.status).toBe('recording');
  });

  it('Stop recording is idempotent', async () => {
    const res1 = await request(app)
      .post(`/api/recordings/${recordingId}/stop`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('stopping');

    // Duplicate stop
    const res2 = await request(app)
      .post(`/api/recordings/${recordingId}/stop`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    expect(res2.status).toBe(200);
    expect(res2.body.message).toBe('Recording already stopping');
  });

  it('Finalized callback updates completed status and URL', async () => {
    const res = await request(app)
      .post(`/api/recordings/${recordingId}/callback/status`)
      .set('Authorization', `Bearer ${botToken}`)
      .send({ status: 'completed', url: 'https://storage/rec.mp4', duration: 120 });

    expect(res.status).toBe(200);

    const rec = await db.recording.findUnique({ where: { id: recordingId } });
    expect(rec?.status).toBe('completed');
    expect(rec?.url).toBe('https://storage/rec.mp4');
  });
});
