import { Router, Request, Response } from 'express';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Fetch aggregates concurrently for performance
    const [roomsCount, teamsCount, recentRecordings, upcomingSessions] = await Promise.all([
      db.room.count({
        where: { OR: [{ ownerId: userId }, { team: { members: { some: { userId } } } }] }
      }),
      db.teamMember.count({
        where: { userId }
      }),
      db.recording.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      db.meetingSession.findMany({
        where: {
          room: { OR: [{ ownerId: userId }, { team: { members: { some: { userId } } } }] },
          startTime: { gte: new Date() }
        },
        orderBy: { startTime: 'asc' },
        take: 3,
        include: { room: { select: { name: true, slug: true } } }
      })
    ]);

    res.status(200).json({
      stats: {
        totalRooms: roomsCount,
        totalTeams: teamsCount
      },
      upcomingSessions,
      recentRecordings
    });
  } catch (error) {
    logger.error('Error fetching dashboard data', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
