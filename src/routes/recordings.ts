import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';

export const recordingsRouter = Router();

// Public route to view recording metadata (no media access yet)
recordingsRouter.get('/:id/public', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const recording = await db.recording.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, email: true } },
        room: { select: { name: true, slug: true } }
      }
    }) as any;

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    res.status(200).json({
      title: recording.title,
      owner: recording.owner.name || recording.owner.email,
      roomName: recording.room?.name,
      isPaid: recording.isPaid,
      priceKobo: recording.priceKobo,
      createdAt: recording.createdAt
    });
  } catch (error) {
    logger.error('Error fetching public recording', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// All following routes require authentication
recordingsRouter.use(requireAuth);

const createRecordingSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  roomId: z.string().optional()
});

const updateRecordingSchema = z.object({
  title: z.string().optional(),
  isPaid: z.boolean().optional(),
  priceKobo: z.number().min(0).optional()
});

recordingsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, url, roomId } = createRecordingSchema.parse(req.body);
    const userId = req.user!.userId;

    const recording = await db.recording.create({
      data: {
        title,
        url,
        roomId,
        ownerId: userId
      }
    });

    logger.info(`Recording created: ${recording.id} by ${userId}`);
    res.status(201).json(recording);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error creating recording', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

recordingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const recordings = await db.recording.findMany({
      where: { ownerId: userId }
    });

    res.status(200).json(recordings);
  } catch (error) {
    logger.error('Error fetching recordings', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

recordingsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updates = updateRecordingSchema.parse(req.body);
    const userId = req.user!.userId;

    // Verify ownership
    const existing = await db.recording.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const recording = await db.recording.update({
      where: { id },
      data: updates
    });

    logger.info(`Recording updated: ${id} by ${userId}`);
    res.status(200).json(recording);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error updating recording', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Secure endpoint to get the actual media URL (Paywall Logic)
recordingsRouter.get('/:id/play', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const recording = await db.recording.findUnique({ where: { id } });
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    // 1. Owner always has access
    if (recording.ownerId === userId) {
      return res.status(200).json({ url: recording.url });
    }

    // 2. If it's free, grant access
    if (!recording.isPaid) {
      return res.status(200).json({ url: recording.url });
    }

    // 3. If paid, verify transaction
    const hasPaid = await db.paymentTransaction.findFirst({
      where: {
        userId,
        recordingId: id,
        status: 'success' // Updated by Paystack webhook
      }
    });

    if (!hasPaid) {
      return res.status(402).json({ 
        error: 'Payment required',
        priceKobo: recording.priceKobo
      });
    }

    // Grant access (in a real app, generate a signed expiring CDN url here)
    res.status(200).json({ url: recording.url });
  } catch (error) {
    logger.error('Error accessing recording media', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
