import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';

export const roomsRouter = Router();

roomsRouter.use(requireAuth);

const createRoomSchema = z.object({
  name: z.string().min(1),
  teamId: z.string().optional(),
  mode: z.enum(['meeting', 'webinar']).default('meeting'),
  recordingSetting: z.enum(['off', 'free', 'paid']).default('off'),
  guestJoinAllowed: z.boolean().default(true),
  accessPin: z.string().min(4).max(12).optional(),
  isWaitingRoomEnabled: z.boolean().optional(),
});

const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  mode: z.enum(['meeting', 'webinar']).optional(),
  recordingSetting: z.enum(['off', 'free', 'paid']).optional(),
  guestJoinAllowed: z.boolean().optional(),
  accessPin: z.string().min(4).max(12).nullable().optional(), // null clears the PIN
  isWaitingRoomEnabled: z.boolean().optional(),
});

function generateSlug() {
  return crypto.randomBytes(4).toString('hex'); // e.g. "a1b2c3d4"
}

roomsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const data = createRoomSchema.parse(req.body);
    const userId = req.user!.userId;

    if (data.teamId) {
      // Verify user is in team
      const membership = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: data.teamId, userId } }
      });
      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this team' });
      }
    }

    let slug = generateSlug();
    let slugExists = await db.room.findUnique({ where: { slug } });
    while (slugExists) {
      slug = generateSlug();
      slugExists = await db.room.findUnique({ where: { slug } });
    }

    // Webinar mode automatically enables the waiting room
    const isWaitingRoomEnabled = data.mode === 'webinar'
      ? true
      : (data.isWaitingRoomEnabled ?? true);

    const room = await db.room.create({
      data: {
        name: data.name,
        slug,
        ownerId: userId,
        teamId: data.teamId,
        mode: data.mode,
        recordingSetting: data.recordingSetting,
        guestJoinAllowed: data.guestJoinAllowed,
        accessPin: data.accessPin ?? null,
        isWaitingRoomEnabled,
      }
    });

    logger.info(`Room created: ${slug} by ${userId} (mode: ${data.mode})`);
    res.status(201).json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error creating room', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

roomsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const rooms = await db.room.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            team: {
              members: {
                some: { userId }
              }
            }
          }
        ]
      }
    });

    res.status(200).json(rooms);
  } catch (error) {
    logger.error('Error fetching rooms', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

roomsRouter.get('/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const room = await db.room.findUnique({
      where: { slug },
      include: { owner: { select: { name: true, email: true } } }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.status(200).json(room);
  } catch (error) {
    logger.error('Error fetching room', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

roomsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    // Verify ownership
    const existing = await db.room.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates = updateRoomSchema.parse(req.body);

    // Webinar mode automatically enables the waiting room
    const isWaitingRoomEnabled =
      updates.mode === 'webinar'
        ? true
        : updates.isWaitingRoomEnabled ?? existing.isWaitingRoomEnabled;

    const room = await db.room.update({
      where: { id },
      data: {
        ...updates,
        isWaitingRoomEnabled,
      }
    });

    logger.info(`Room updated: ${id} by ${userId}`);
    res.status(200).json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error updating room', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

roomsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user!.userId;

    // Verify ownership
    const existing = await db.room.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.room.delete({ where: { id } });

    logger.info(`Room deleted: ${id} by ${userId}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting room', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
