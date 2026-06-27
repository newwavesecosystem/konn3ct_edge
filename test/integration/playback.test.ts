import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server';
import { db } from '../../src/db';
import * as s3Service from '../../src/services/s3SignedUrl';

vi.mock('../../src/services/s3SignedUrl', () => ({
  generateSignedPlaybackUrl: vi.fn().mockResolvedValue('https://mocked-signed-url.s3.amazonaws.com/video.mp4')
}));

describe('Secure Recording Playback (Step 7A)', () => {
  let ownerId: string;
  let nonOwnerId: string;
  let ownerToken: string;
  let nonOwnerToken: string;
  let roomId: string;
  let recordingId: string;

  beforeAll(async () => {
    // Upsert owner
    const owner = await db.user.upsert({
      where: { email: 'playback-owner@konn3ct.test' },
      update: {},
      create: { email: 'playback-owner@konn3ct.test', name: 'Owner', passwordHash: 'hash' }
    });
    ownerId = owner.id;

    // Upsert non-owner
    const nonOwner = await db.user.upsert({
      where: { email: 'playback-viewer@konn3ct.test' },
      update: {},
      create: { email: 'playback-viewer@konn3ct.test', name: 'Viewer', passwordHash: 'hash' }
    });
    nonOwnerId = nonOwner.id;

    // Upsert Room
    const room = await db.room.upsert({
      where: { slug: 'playback-room' },
      update: {},
      create: { slug: 'playback-room', name: 'Playback Room', ownerId }
    });
    roomId = room.id;

    // Generate tokens
    const jwt = require('jsonwebtoken');
    ownerToken = jwt.sign({ userId: ownerId }, process.env.JWT_SECRET || 'secret');
    nonOwnerToken = jwt.sign({ userId: nonOwnerId }, process.env.JWT_SECRET || 'secret');
  });

  afterAll(async () => {
    await db.paymentTransaction.deleteMany({ where: { user: { email: { contains: 'playback' } } } });
    await db.recording.deleteMany({ where: { roomId } });
    await db.room.deleteMany({ where: { id: roomId } });
    await db.user.deleteMany({ where: { email: { contains: 'playback' } } });
  });

  const createTestRecording = async (overrides: any) => {
    return db.recording.create({
      data: {
        title: 'Test Playback',
        url: 'https://public.url',
        storageKey: 'recordings/test.mp4',
        status: 'completed',
        isPublished: true,
        accessType: 'private',
        ownerId,
        roomId,
        ...overrides
      }
    });
  };

  it('Owner can get signed playback URL', async () => {
    const rec = await createTestRecording({ accessType: 'private' });
    const res = await request(app).get(`/api/recordings/${rec.id}/play`).set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.playbackUrl).toBe('https://mocked-signed-url.s3.amazonaws.com/video.mp4');
    expect(s3Service.generateSignedPlaybackUrl).toHaveBeenCalled();
  });

  it('Non-owner cannot access unpublished recording', async () => {
    const rec = await createTestRecording({ accessType: 'public', isPublished: false });
    const res = await request(app).get(`/api/recordings/${rec.id}/play`).set('Authorization', `Bearer ${nonOwnerToken}`);
    
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not published');
  });

  it('Free published recording returns signed URL for non-owner', async () => {
    const rec = await createTestRecording({ accessType: 'public', isPublished: true, isPaid: false, priceKobo: 0 });
    const res = await request(app).get(`/api/recordings/${rec.id}/play`).set('Authorization', `Bearer ${nonOwnerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.playbackUrl).toBe('https://mocked-signed-url.s3.amazonaws.com/video.mp4');
  });

  it('Paid recording without verified payment is blocked', async () => {
    const rec = await createTestRecording({ accessType: 'paid', isPublished: true, isPaid: true, priceKobo: 50000 });
    const res = await request(app).get(`/api/recordings/${rec.id}/play`).set('Authorization', `Bearer ${nonOwnerToken}`);
    
    expect(res.status).toBe(402);
    expect(res.body.error).toContain('Payment required');
  });

  it('Paid recording with verified payment returns signed URL', async () => {
    const rec = await createTestRecording({ accessType: 'paid', isPublished: true, isPaid: true, priceKobo: 50000 });
    
    await db.paymentTransaction.create({
      data: {
        userId: nonOwnerId,
        recordingId: rec.id,
        amountKobo: 50000,
        currency: 'NGN',
        status: 'success',
        reference: 'test-pay-ref',
        kind: 'RECORDING'
      }
    });

    const res = await request(app).get(`/api/recordings/${rec.id}/play`).set('Authorization', `Bearer ${nonOwnerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.playbackUrl).toBe('https://mocked-signed-url.s3.amazonaws.com/video.mp4');
  });

  it('Missing or failed recording does not return signed URL', async () => {
    const rec = await createTestRecording({ status: 'failed' });
    const res = await request(app).get(`/api/recordings/${rec.id}/play`).set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not completed');
  });

  it('Recording with missing storageKey uses fallback or returns clear error', async () => {
    // If URL is missing and storageKey is missing
    const rec = await createTestRecording({ storageKey: null, url: null });
    const res = await request(app).get(`/api/recordings/${rec.id}/play`).set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('missing');
  });

  it('Backend response does not expose permanent public S3 URL when storageKey exists', async () => {
    const rec = await createTestRecording({ url: 'https://permanent.s3.amazonaws.com/video.mp4', storageKey: 'test/key.mp4' });
    const res = await request(app).get(`/api/recordings/${rec.id}/play`).set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.playbackUrl).not.toBe('https://permanent.s3.amazonaws.com/video.mp4');
    expect(res.body.playbackUrl).toBe('https://mocked-signed-url.s3.amazonaws.com/video.mp4');
  });
});
