import express, { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';
import { paymentLimiter } from '../middleware/rateLimiter';

export const paymentsRouter = Router();

const initRecordingPaymentSchema = z.object({
  recordingId: z.string()
});

// Initialize recording payment (Requires Auth)
paymentsRouter.post('/initialize', paymentLimiter, requireAuth, async (req: Request, res: Response) => {
  try {
    const { recordingId } = initRecordingPaymentSchema.parse(req.body);
    const userId = req.user!.userId;
    const email = req.user!.email;

    const recording = await db.recording.findUnique({ where: { id: recordingId } });
    
    if (!recording || !recording.isPaid) {
      return res.status(400).json({ error: 'Recording is not valid for payment' });
    }

    const reference = `rec_${crypto.randomBytes(8).toString('hex')}`;
    const amountKobo = recording.priceKobo;

    // Log transaction to DB
    await db.paymentTransaction.create({
      data: {
        userId,
        recordingId,
        kind: 'recording',
        reference,
        amountKobo,
        payerEmail: email,
        status: 'initialized'
      }
    });

    res.status(200).json({
      message: 'Payment initialized',
      reference,
      amountKobo,
      email,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error initializing payment', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const verifyDonationSchema = z.object({
  reference: z.string(),
  amountKobo: z.number(),
  currency: z.string(),
  roomId: z.string(),
});

paymentsRouter.post('/donate/verify', async (req: Request, res: Response) => {
  try {
    const { reference, amountKobo, currency, roomId } = verifyDonationSchema.parse(req.body);

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (paystackSecret && process.env.PAYSTACK_MOCK_MODE !== 'true') {
      const pRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
        },
      });
      const pData = (await pRes.json()) as any;
      if (!pData.status || pData.data.status !== "success") {
        return res.status(400).json({ error: "Payment verification failed" });
      }
    }

    const room = await db.room.findUnique({ where: { slug: roomId } });

    if (room && room.donationsEnabled === false) {
      logger.info(`donations_disabled_for_room: room ${roomId}`);
      return res.status(403).json({ error: "Donations are disabled for this room." });
    }

    if (room) {
      const userId = room.ownerId; 
      await db.paymentTransaction.create({
        data: {
          userId,
          kind: "donation",
          roomId: room.id,
          reference,
          amountKobo,
          currency,
          status: "success",
          verifiedAt: new Date(),
        }
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error verifying donation', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Subscription Endpoints
const initSubscriptionSchema = z.object({
  planId: z.string()
});

paymentsRouter.post('/subscribe/initialize', paymentLimiter, requireAuth, async (req: Request, res: Response) => {
  try {
    const { planId } = initSubscriptionSchema.parse(req.body);
    const userId = req.user!.userId;
    const email = req.user!.email;

    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    const reference = `sub_${crypto.randomBytes(8).toString('hex')}`;
    const amountKobo = plan.priceKobo;

    await db.paymentTransaction.create({
      data: {
        userId,
        planId,
        kind: 'subscription',
        reference,
        amountKobo,
        payerEmail: email,
        status: 'initialized'
      }
    });

    if (process.env.PAYSTACK_MOCK_MODE === 'true') {
      return res.status(200).json({
        message: 'Mock payment initialized',
        reference,
        amountKobo,
        email,
        authorization_url: `${process.env.PAYSTACK_CALLBACK_URL}?reference=${reference}&mock=true`
      });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) return res.status(500).json({ error: 'Server configuration error' });

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
        metadata: { kind: 'subscription', planId, userId }
      })
    });
    
    const pData = await paystackRes.json() as any;
    if (!pData.status) {
      return res.status(400).json({ error: 'Failed to initialize payment gateway' });
    }

    res.status(200).json({
      message: 'Payment initialized',
      reference,
      amountKobo,
      email,
      authorization_url: pData.data.authorization_url
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error initializing subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

paymentsRouter.get('/subscribe/verify/:reference', requireAuth, async (req: Request, res: Response) => {
  try {
    const reference = req.params.reference as string;
    const userId = req.user!.userId;

    const tx = await db.paymentTransaction.findUnique({ where: { reference } });
    if (!tx || tx.userId !== userId) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Fast path: webhook already processed it
    if (tx.status === 'success') {
      return res.status(200).json({ status: 'success', message: 'Subscription active' });
    }

    if (process.env.PAYSTACK_MOCK_MODE === 'true') {
      // Allow frontend mock bypass for dev
      if (req.query.mock === 'true') {
         await handleSuccessfulPayment(reference, tx.amountKobo);
         return res.status(200).json({ status: 'success', message: 'Mock Subscription active' });
      }
      return res.status(200).json({ status: tx.status });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const pRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    });
    const pData = await pRes.json() as any;

    if (pData.status && pData.data.status === 'success') {
      if (pData.data.amount === tx.amountKobo) {
         await handleSuccessfulPayment(reference, pData.data.amount, pData.data.id?.toString());
         return res.status(200).json({ status: 'success', message: 'Subscription active' });
      } else {
        await db.paymentTransaction.update({ where: { reference }, data: { status: 'failed', metadata: { error: 'Amount mismatch' } } });
        return res.status(400).json({ error: 'Payment amount mismatch' });
      }
    }

    if (pData.data?.status === 'abandoned' || pData.data?.status === 'failed') {
      await db.paymentTransaction.update({ where: { reference }, data: { status: pData.data.status } });
    }

    return res.status(200).json({ status: pData.data?.status || 'pending' });
  } catch (error) {
    logger.error('Error verifying subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Paystack Webhook (No Auth, relies on Paystack signature)
paymentsRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      logger.error('PAYSTACK_SECRET_KEY is not defined');
      return res.sendStatus(500);
    }

    if (!req.rawBody) {
      logger.error('Webhook missing raw body');
      return res.status(400).json({ error: 'Missing raw body' });
    }

    const hash = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex');
    const signatureHeader = req.headers['x-paystack-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (hash !== signature) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const amount = event.data.amount;
      const providerRef = event.data.id?.toString();

      await handleSuccessfulPayment(reference, amount, providerRef);
      logger.info(`Payment successful via webhook for reference: ${reference}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Webhook processing error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper for idempotent success handling
async function handleSuccessfulPayment(reference: string, verifiedAmountKobo: number, providerRef?: string) {
  const tx = await db.paymentTransaction.findUnique({ where: { reference }, include: { plan: true } });
  if (!tx) return;

  // Idempotency check
  if (tx.status === 'success') return;

  if (tx.amountKobo !== verifiedAmountKobo) {
    await db.paymentTransaction.update({
      where: { reference },
      data: { status: 'failed', metadata: { error: 'Webhook amount mismatch' } }
    });
    return;
  }

  if (tx.kind === 'donation' && tx.roomId) {
    const room = await db.room.findUnique({ where: { id: tx.roomId } });
    if (room && room.donationsEnabled === false) {
      logger.info(`donation_rejected_feature_disabled: room ${tx.roomId}`);
      await db.paymentTransaction.update({
        where: { reference },
        data: { status: 'failed', metadata: { error: 'donation_rejected_feature_disabled' } }
      });
      return;
    }
  }

  // Mark tx as success
  await db.paymentTransaction.update({
    where: { reference },
    data: { status: 'success', verifiedAt: new Date(), providerReference: providerRef }
  });

  if (tx.kind === 'subscription' && tx.planId && tx.userId && tx.plan) {
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + (tx.plan.durationDays || 30));

    // Upsert subscription
    const existingSub = await db.subscription.findFirst({ where: { userId: tx.userId } });
    if (existingSub) {
      await db.subscription.update({
        where: { id: existingSub.id },
        data: {
          planId: tx.planId,
          status: 'active',
          currentPeriodEnd
        }
      });
    } else {
      await db.subscription.create({
        data: {
          userId: tx.userId,
          planId: tx.planId,
          status: 'active',
          currentPeriodEnd
        }
      });
    }
  }
}
