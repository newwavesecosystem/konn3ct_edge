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
  teamId: z.string().optional()
});

function generateSlug() {
  return crypto.randomBytes(4).toString('hex'); // e.g. "a1b2c3d4"
}

roomsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, teamId } = createRoomSchema.parse(req.body);
    const userId = req.user!.userId;

    if (teamId) {
      // Verify user is in team
      const membership = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } }
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

    const room = await db.room.create({
      data: {
        name,
        slug,
        ownerId: userId,
        teamId
      }
    });

    logger.info(`Room created: ${slug} by ${userId}`);
    res.status(201).json(room);
  } catch (error) {
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
