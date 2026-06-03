import express, { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';
import { paymentLimiter } from '../middleware/rateLimiter';

export const paymentsRouter = Router();

const initPaymentSchema = z.object({
  recordingId: z.string()
});

// Initialize payment (Requires Auth)
paymentsRouter.post('/initialize', paymentLimiter, requireAuth, async (req: Request, res: Response) => {
  try {
    const { recordingId } = initPaymentSchema.parse(req.body);
    const userId = req.user!.userId;
    const email = req.user!.email;

    const recording = await db.recording.findUnique({ where: { id: recordingId } });
    
    if (!recording || !recording.isPaid) {
      return res.status(400).json({ error: 'Recording is not valid for payment' });
    }

    const reference = `ref_${crypto.randomBytes(8).toString('hex')}`;
    const amountKobo = recording.priceKobo;

    // Log transaction to DB
    await db.paymentTransaction.create({
      data: {
        userId,
        recordingId,
        kind: 'recording',
        reference,
        amountKobo,
        status: 'initialized'
      }
    });

    // Note: In production, call Paystack API to initialize transaction here
    // const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', ...)

    res.status(200).json({
      message: 'Payment initialized',
      reference,
      amountKobo,
      email,
      // authorization_url: paystackRes.data.authorization_url
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
    if (paystackSecret) {
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

    if (room) {
      // For anonymous donations, use the room owner's ID or a generic logic.
      // In a real app, you'd extract the user ID from the JWT.
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
        }
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error verifying donation', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Paystack Webhook (No Auth, relies on Paystack signature)
paymentsRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      logger.error('PAYSTACK_SECRET_KEY is not defined');
      return res.sendStatus(500);
    }

    const hash = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      // Idempotent update
      await db.paymentTransaction.updateMany({
        where: { reference, status: 'initialized' },
        data: { status: 'success' }
      });

      logger.info(`Payment successful for reference: ${reference}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Webhook processing error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
