import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';

export const schedulingRouter = Router();

schedulingRouter.use(requireAuth);

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

const createScheduleSchema = z.object({
  roomId: z.string(),
  title: z.string().min(1).max(200),
  startTime: z.string().datetime(),
  durationMin: z.number().min(1).max(1440).default(60)
});

schedulingRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { roomId, title, startTime, durationMin } = createScheduleSchema.parse(req.body);
    const userId = req.user!.userId;

    // Verify user owns the room or is in the team
    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { team: { include: { members: true } } }
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    let hasAccess = room.ownerId === userId;
    if (!hasAccess && room.team) {
      hasAccess = room.team.members.some((m: any) => m.userId === userId);
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const session = await db.meetingSession.create({
      data: {
        roomId,
        title,
        startTime: new Date(startTime),
        durationMin
      }
    });

    logger.info(`Session scheduled: ${session.id} for room ${roomId}`);
    
    // Generates a mock ICS content directly for MVP
    const frontendDomain = process.env.NEXT_PUBLIC_FRONTEND_DOMAIN || 'app.konn3ct.net';
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${escapeIcs(title)}\nDTSTART:${session.startTime.toISOString().replace(/[-:]/g, '').split('.')[0]}Z\nURL:https://${frontendDomain}/join/${room.slug}\nEND:VEVENT\nEND:VCALENDAR`;

    res.status(201).json({
      session,
      icsFileContent: icsContent
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error scheduling session', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

schedulingRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get all rooms user has access to
    const rooms = await db.room.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { team: { members: { some: { userId } } } }
        ]
      },
      select: { id: true }
    });

    const roomIds = rooms.map(r => r.id);

    // Get upcoming sessions
    const sessions = await db.meetingSession.findMany({
      where: {
        roomId: { in: roomIds },
        startTime: { gte: new Date() } // Future only
      },
      include: {
        room: { select: { name: true, slug: true } }
      },
      orderBy: { startTime: 'asc' }
    });

    res.status(200).json(sessions);
  } catch (error) {
    logger.error('Error fetching schedules', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
