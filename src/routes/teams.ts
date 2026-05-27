import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';

export const teamsRouter = Router();

// Apply auth middleware to all team routes
teamsRouter.use(requireAuth);

const createTeamSchema = z.object({
  name: z.string().min(1).max(100)
});

const inviteSchema = z.object({
  email: z.string().email()
});

teamsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const memberships = await db.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            _count: { select: { members: true } }
          }
        }
      },
      orderBy: { team: { name: 'asc' } }
    });
    const teams = memberships.map(m => ({
      id: m.team.id,
      name: m.team.name,
      role: m.role,
      memberCount: m.team._count.members,
    }));
    res.status(200).json(teams);
  } catch (error) {
    logger.error('Error fetching teams', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

teamsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = createTeamSchema.parse(req.body);
    const userId = req.user!.userId;

    const team = await db.team.create({
      data: {
        name,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'owner'
          }
        }
      }
    });

    logger.info(`Team created: ${team.id} by ${userId}`);
    res.status(201).json(team);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error creating team', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

teamsRouter.post('/:teamId/invites', async (req: Request, res: Response) => {
  try {
    const teamId = req.params.teamId as string;
    const { email } = inviteSchema.parse(req.body);
    const userId = req.user!.userId;

    // Verify user is owner or admin of the team
    const membership = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } }
    });

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await db.teamInvite.create({
      data: {
        teamId,
        email,
        token,
        invitedById: userId,
        expiresAt
      }
    });

    logger.info(`Invite created for ${email} to team ${teamId}`);
    // TODO: Send actual email here (Milestone 0/1 MVP skips email delivery implementation)
    res.status(201).json({ message: 'Invite created successfully. The invitation link has been sent via email.' });
  } catch (error) {
    logger.error('Error creating invite', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

teamsRouter.post('/invites/:token/accept', async (req: Request, res: Response) => {
  try {
    const token = req.params.token as string;
    const userId = req.user!.userId;
    const userEmail = req.user!.email;

    const invite = await db.teamInvite.findUnique({ where: { token } });

    if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invite' });
    }

    if (invite.email !== userEmail) {
      return res.status(403).json({ error: 'Invite was sent to a different email address' });
    }

    const existingMember = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: invite.teamId, userId } }
    });
    if (existingMember) {
      return res.status(409).json({ error: 'You are already a member of this team.' });
    }

    // Add to team and update invite
    await db.$transaction([
      db.teamMember.create({
        data: {
          teamId: invite.teamId,
          userId,
          role: 'member'
        }
      }),
      db.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'accepted' }
      })
    ]);

    logger.info(`User ${userId} accepted invite to team ${invite.teamId}`);
    res.status(200).json({ message: 'Joined team successfully' });
  } catch (error) {
    logger.error('Error accepting invite', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
