import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server';
import { db } from '../../src/db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

describe('Payments API', () => {
  let token: string;
  let userId: string;
  let planId: string;
  let recordingId: string;

  beforeAll(async () => {
    // Cleanup any stale test data
    await db.paymentTransaction.deleteMany({ where: { user: { email: 'testpay@example.com' } } });
    await db.subscription.deleteMany({ where: { user: { email: 'testpay@example.com' } } });
    await db.recording.deleteMany({ where: { owner: { email: 'testpay@example.com' } } });
    await db.room.deleteMany({ where: { owner: { email: 'testpay@example.com' } } });
    await db.user.deleteMany({ where: { email: 'testpay@example.com' } });

    // Setup test data
    const user = await db.user.create({
      data: {
        email: 'testpay@example.com',
        passwordHash: 'hashed',
        name: 'Test Pay User'
      }
    });
    userId = user.id;
    token = jwt.sign({ userId, email: user.email }, process.env.JWT_SECRET || 'testsecret');

    const plan = await db.plan.upsert({
      where: { code: 'PRO_MONTHLY_TEST' },
      update: {},
      create: {
        code: 'PRO_MONTHLY_TEST',
        name: 'Pro Monthly Test',
        priceKobo: 500000,
        durationDays: 30,
        featuresJson: '[]'
      }
    });
    planId = plan.id;

    const recording = await db.recording.create({
      data: {
        ownerId: userId,
        title: 'Test Recording',
        url: 'http://test',
        isPaid: true,
        priceKobo: 100000
      }
    });
    recordingId = recording.id;

    process.env.PAYSTACK_MOCK_MODE = 'true';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_secret';
  });

  afterAll(async () => {
    await db.paymentTransaction.deleteMany({ where: { userId } });
    await db.subscription.deleteMany({ where: { userId } });
    await db.recording.deleteMany({ where: { ownerId: userId } });
    await db.plan.delete({ where: { id: planId } });
    await db.user.delete({ where: { id: userId } });
  });

  describe('Subscriptions', () => {
    let mockRef: string;

    it('should initialize subscription payment in mock mode', async () => {
      const res = await request(app)
        .post('/api/payments/subscribe/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId });

      expect(res.status).toBe(200);
      expect(res.body.reference).toBeDefined();
      expect(res.body.authorization_url).toContain('mock=true');
      mockRef = res.body.reference;
    });

    it('should reject invalid planId', async () => {
      const res = await request(app)
        .post('/api/payments/subscribe/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId: 'invalid_id' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid plan selected.');
    });

    it('should ignore frontend amount and use plan amount', async () => {
      const res = await request(app)
        .post('/api/payments/subscribe/initialize')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId, amountKobo: 100 }); // Attempting to cheat

      expect(res.status).toBe(200);
      expect(res.body.amountKobo).toBe(500000); // Should still use plan amount
    });

    it('should simulate valid webhook signature and activate subscription', async () => {
      const payload = {
        event: 'charge.success',
        data: {
          reference: mockRef,
          amount: 500000,
          id: 123456
        }
      };

      const hash = crypto.createHmac('sha512', 'sk_test_secret')
        .update(JSON.stringify(payload))
        .digest('hex');

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-paystack-signature', hash)
        .send(payload);

      expect(res.status).toBe(200);

      const tx = await db.paymentTransaction.findUnique({ where: { reference: mockRef } });
      expect(tx?.status).toBe('success');

      const sub = await db.subscription.findFirst({ where: { userId } });
      expect(sub?.status).toBe('active');
    });

    it('should reject invalid webhook signature', async () => {
      const payload = {
        event: 'charge.success',
        data: { reference: mockRef, amount: 500000 }
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-paystack-signature', 'invalid_hash_signature')
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should be idempotent (same webhook twice)', async () => {
      const payload = {
        event: 'charge.success',
        data: { reference: mockRef, amount: 500000, id: 123456 }
      };

      const hash = crypto.createHmac('sha512', 'sk_test_secret')
        .update(JSON.stringify(payload))
        .digest('hex');

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('x-paystack-signature', hash)
        .send(payload);

      expect(res.status).toBe(200);
      // Ensure no duplicate subscription rows exist
      const subs = await db.subscription.findMany({ where: { userId } });
      expect(subs.length).toBe(1);
    });
  });
});
