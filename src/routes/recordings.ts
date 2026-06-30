import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';
import { launchRecorderBot } from '../services/recorderLauncher';
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

const startRecordingSchema = z.object({
  title: z.string().min(1),
  roomSlug: z.string().min(1),
  durationMinutes: z.number().min(1).max(120).optional()
});

import jwt from 'jsonwebtoken';

recordingsRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { title, roomSlug, durationMinutes } = startRecordingSchema.parse(req.body);
    const userId = req.user!.userId;

    const room = await db.room.findUnique({ where: { slug: roomSlug } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    let recordingId: string;
    
    // Race-safe transaction
    const result = await db.$transaction(async (tx: any) => {
      const active = await tx.recording.findFirst({
        where: { roomId: room.id, status: { in: ['starting', 'recording', 'stopping'] } }
      });
      if (active) return { activeRecording: active };

      const newRec = await tx.recording.create({
        data: {
          title,
          url: '',
          roomId: room.id,
          ownerId: userId,
          status: 'starting'
        }
      });
      return { newRecording: newRec };
    });

    if (result.activeRecording) {
      return res.status(200).json({ 
        status: 'already_recording', 
        recordingId: result.activeRecording.id,
        currentStatus: result.activeRecording.status
      });
    }

    const recording = result.newRecording!;

    const frontendDomain = process.env.NEXT_PUBLIC_FRONTEND_DOMAIN || 'edge.konn3ct.net';
    
    // Generate secure short-lived token for the bot
    const botToken = jwt.sign(
      { role: 'recorder', purpose: 'recording_bot', roomId: room.id, recordingId: recording.id },
      process.env.JWT_SECRET || 'fallback',
      { expiresIn: '4h' }
    );
    
    const launchResult = await launchRecorderBot({
      roomId: room.id,
      roomSlug,
      recordingId: recording.id,
      botToken,
      url: `https://${frontendDomain}/meeting/${roomSlug}?botToken=${botToken}`
    });

    if (!launchResult.queued) {
      await db.recording.update({
        where: { id: recording.id },
        data: { status: 'failed' }
      });
      return res.status(500).json({ error: launchResult.error || 'Failed to launch recorder' });
    }

    res.status(202).json({ message: 'Recording started', recordingId: recording.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error starting recording', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

recordingsRouter.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const recording = await db.recording.findUnique({ where: { id } });
    if (!recording || recording.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (['stopping'].includes(recording.status)) {
      return res.status(200).json({ message: 'Recording already stopping', status: recording.status });
    }
    if (['processing'].includes(recording.status)) {
      return res.status(200).json({ message: 'Recording already stopped and processing', status: recording.status });
    }
    if (['completed', 'failed', 'cancelled'].includes(recording.status)) {
      return res.status(200).json({ message: 'Recording already finished', status: recording.status });
    }
    if (!['starting', 'recording'].includes(recording.status)) {
      return res.status(400).json({ error: 'Invalid state transition' });
    }

    await db.recording.update({
      where: { id },
      data: { status: 'stopping', endedAt: new Date() }
    });

    res.status(200).json({ message: 'Stop signal sent to recording bot', status: 'stopping' });
  } catch (error) {
    logger.error('Error stopping recording', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Secure Bot Callbacks ---
recordingsRouter.post('/:id/callback/started', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback');
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (decoded.purpose !== 'recording_bot' || decoded.recordingId !== id) {
      return res.status(403).json({ error: 'Token mismatch' });
    }

    const rec = await db.recording.findUnique({ where: { id } });
    if (!rec || rec.status !== 'starting') {
      return res.status(400).json({ error: 'Invalid state transition' });
    }

    await db.recording.update({
      where: { id },
      data: { status: 'recording' }
    });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

recordingsRouter.post('/:id/callback/finalized', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback');
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (decoded.purpose !== 'recording_bot' || decoded.recordingId !== id) {
      return res.status(403).json({ error: 'Token mismatch' });
    }

    const { status, url, duration, failureReason, storageKey, storageBucket, contentType } = req.body;
    
    if (status === 'processing') {
      await db.recording.update({
        where: { id },
        data: { status: 'processing' }
      });
    } else if (status === 'completed') {
      await db.recording.update({
        where: { id },
        data: { status: 'completed', url, storageKey, storageBucket, contentType, duration, endedAt: new Date() }
      });
    } else if (status === 'failed') {
      await db.recording.update({
        where: { id },
        data: { status: 'failed', failureReason, endedAt: new Date() }
      });
    } else {
      return res.status(400).json({ error: 'Invalid finalized status' });
    }

    res.status(200).json({ success: true });
  } catch (err) {
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

import { generateSignedPlaybackUrl } from '../services/s3SignedUrl';
import { determineRecordingAccess } from '../utils/helpers';

// Secure endpoint to get the actual media URL (Paywall Logic)
recordingsRouter.get('/:id/play', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const recording = await db.recording.findUnique({ where: { id } });
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    if (recording.status !== 'completed') {
      return res.status(400).json({ error: 'Recording is not completed' });
    }

    if (!recording.storageKey && !recording.url) {
      return res.status(404).json({ error: 'Recording file missing' });
    }

    // Is it published? Only owner/admin can access unpublished
    if (!recording.isPublished && recording.ownerId !== userId) {
      // NOTE: Admin check goes here if there's an admin role
      return res.status(403).json({ error: 'Recording is not published' });
    }

    // Use our helper to check access
    let hasPaid = false;
    if (recording.priceKobo > 0) {
      const payment = await db.paymentTransaction.findFirst({
        where: { userId, recordingId: id, status: 'success' }
      });
      hasPaid = !!payment;
    }

    const hasAccess = determineRecordingAccess(
      { ownerId: recording.ownerId, isPrivate: recording.accessType === 'private', priceKobo: recording.priceKobo },
      userId,
      hasPaid
    );

    if (!hasAccess) {
      return res.status(402).json({ 
        error: 'Payment required or access denied',
        priceKobo: recording.priceKobo
      });
    }

    // Generate signed URL
    const ttl = parseInt(process.env.SIGNED_RECORDING_URL_TTL_SECONDS || '3600', 10);
    let playbackUrl = recording.url; // fallback

    if (recording.storageKey) {
      playbackUrl = await generateSignedPlaybackUrl(recording.storageKey, ttl);
    } else if (!playbackUrl) {
       return res.status(500).json({ error: 'Storage key missing' });
    }

    res.status(200).json({ 
      playbackUrl,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      recordingId: recording.id,
      accessType: recording.accessType,
      duration: recording.duration
    });
  } catch (error) {
    logger.error('Error accessing recording media', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Comprehensive endpoint for the Playback Page
recordingsRouter.get('/:id/details', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    const recording = await db.recording.findUnique({ 
      where: { id },
      include: {
        owner: { select: { name: true, email: true } },
        room: { select: { name: true, slug: true } }
      }
    });
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    // Permissions check
    let hasAccess = false;
    if (recording.ownerId === userId) {
      hasAccess = true;
    } else if (!recording.isPaid) {
      hasAccess = true;
    } else {
      const hasPaid = await db.paymentTransaction.findFirst({
        where: {
          userId,
          recordingId: id,
          status: 'success'
        }
      });
      if (hasPaid) hasAccess = true;
    }

    if (!hasAccess) {
      return res.status(402).json({ 
        error: 'Payment required',
        priceKobo: recording.priceKobo
      });
    }

    // Fetch related data
    let chatMessages: any[] = [];
    let summary = null;

    if (recording.roomId) {
      chatMessages = await db.chatMessage.findMany({
        where: { roomId: recording.roomId },
        orderBy: { createdAt: 'asc' }
      });

      summary = await db.meetingSummary.findUnique({
        where: { roomId: recording.roomId }
      });
    }

    res.status(200).json({
      recording,
      chatMessages,
      summary
    });
  } catch (error) {
    logger.error('Error fetching recording details', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
