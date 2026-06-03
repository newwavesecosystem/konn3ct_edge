import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';
import Redis from 'ioredis';

export const streamingRouter = Router();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

streamingRouter.use(requireAuth);

const startStreamingSchema = z.object({
  roomId: z.string().min(1),
  rtmpUrls: z.array(z.string().url()).min(1).max(5), // Cap at 5 simultaneous streams
});

streamingRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { roomId, rtmpUrls } = startStreamingSchema.parse(req.body);
    const userId = req.user!.userId;

    // Verify room and ownership
    const room = await db.room.findUnique({ where: { slug: roomId } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.ownerId !== userId) {
      return res.status(403).json({ error: 'Only the room owner can start a stream' });
    }

    // Create stream record in DB
    const streamDbEntry = await db.liveStream.create({
      data: {
        roomId: room.id,
        rtmpUrls: rtmpUrls,
        status: 'processing',
      }
    });

    const frontendDomain = process.env.NEXT_PUBLIC_FRONTEND_DOMAIN || 'app.konn3ct.net';

    // Push job to Redis
    const job = {
      streamId: streamDbEntry.id,
      roomId: room.id,
      roomSlug: room.slug,
      rtmpUrls,
      url: `https://${frontendDomain}/join/${room.slug}`
    };

    await redis.lpush('streamer:queue', JSON.stringify(job));

    logger.info(`Streaming job created: ${streamDbEntry.id} by ${userId} for room ${room.slug}`);
    res.status(202).json({ message: 'Streaming started', streamId: streamDbEntry.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error starting stream', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

streamingRouter.post('/:streamId/stop', async (req: Request, res: Response) => {
  try {
    const streamId = req.params.streamId as string;
    const userId = req.user!.userId;

    const stream = await db.liveStream.findUnique({ 
      where: { id: streamId },
      include: { room: true } as any
    }) as any;

    if (!stream || stream.room.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (stream.status !== 'live' && stream.status !== 'processing') {
      return res.status(400).json({ error: 'Stream is not currently active' });
    }

    // Send stop signal via Redis
    await redis.publish(`streamer:stop:${streamId}`, 'stop');

    await db.liveStream.update({
      where: { id: streamId },
      data: { status: 'stopped', endedAt: new Date() }
    });

    res.status(200).json({ message: 'Stop signal sent to streaming bot' });
  } catch (error) {
    logger.error('Error stopping stream', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

streamingRouter.get('/:roomSlug', async (req: Request, res: Response) => {
  try {
    const roomSlug = req.params.roomSlug as string;
    const userId = req.user!.userId;

    const room = await db.room.findUnique({ where: { slug: roomSlug } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Ensure they have access to view this room's streams
    if (room.ownerId !== userId) {
       return res.status(403).json({ error: 'Forbidden' });
    }

    const streams = await db.liveStream.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(streams);
  } catch (error) {
    logger.error('Error fetching streams', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
