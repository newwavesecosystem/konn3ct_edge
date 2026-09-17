import { Router, Request, Response } from 'express';
import { db } from '../db';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-here';

/**
 * kv4 compatibility routes for local development and edge integration
 */

// 1. Validate meeting / room existence
router.post('/validate-meeting', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Missing room name/slug' });
    }

    const room = await db.room.findUnique({
      where: { slug: name },
      include: { owner: true }
    });

    if (!room) {
      return res.json({
        success: false,
        message: 'Room url or name does not exist, kindly check your input and try again!'
      });
    }

    return res.json({
      success: true,
      access_code: !!room.accessPin,
      data: {
        name: room.name,
        owner: room.owner?.name || 'Host',
        room_id: room.slug,
        slug: room.slug,
        mode: room.mode || 'meeting'
      }
    });
  } catch (error) {
    logger.error('kv4 /validate-meeting error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 2. Join room and issue sessionToken
router.post('/join-room', async (req: Request, res: Response) => {
  try {
    const { name, user_name, user_email, role, access_code, camera, mic, isMobile } = req.body;
    const roomSlug = name || req.body.slug || req.body.meeting_id;

    if (!roomSlug) {
      return res.status(400).json({ success: false, message: 'Missing room identifier' });
    }

    const room = await db.room.findUnique({
      where: { slug: roomSlug }
    });

    if (!room) {
      return res.json({
        success: false,
        message: 'Room url or name does not exist, kindly check your input and try again!'
      });
    }

    // Access pin check
    if (room.accessPin && (!access_code || access_code.trim() !== room.accessPin)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid access PIN'
      });
    }

    let finalRole: 'host' | 'co-host' | 'attendee' = 'attendee';
    let userId = `guest_${Math.random().toString(36).substring(2, 10)}`;

    // 1. Check if authenticated via authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decodedAuth = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
        if (decodedAuth.userId || decodedAuth.id) {
          userId = decodedAuth.userId || decodedAuth.id;
          if (room.ownerId === userId) {
            finalRole = 'host';
          }
        }
      } catch (e) {}
    }

    // 2. Check if a valid previous session token for this room was presented
    if (req.body.previousSessionToken) {
      try {
        const prevSession = jwt.verify(req.body.previousSessionToken, JWT_SECRET) as any;
        if (prevSession.roomId === room.slug) {
          if (prevSession.userId) userId = prevSession.userId;
          if (prevSession.role === 'host' || prevSession.role === 'co-host') {
            finalRole = prevSession.role;
          }
        }
      } catch (e) {}
    }

    // 3. Room owner validation
    if (room.ownerId === userId) {
      finalRole = 'host';
    }

    const finalName = (user_name || name || 'Guest').trim();
    const finalEmail = (user_email || 'guest@conn3ct.com').trim();

    const sessionToken = jwt.sign({
      userId,
      roomId: room.slug,
      name: finalName,
      email: finalEmail,
      role: finalRole,
      isMobile: !!isMobile,
      camera: camera !== false,
      mic: mic !== false,
      logoutUrl: room.logoutUrl || null,
    }, JWT_SECRET, { expiresIn: '6h' });

    return res.json({
      success: true,
      sessionToken,
      data: {
        sessionToken,
        roomId: room.slug
      }
    });
  } catch (error) {
    logger.error('kv4 /join-room error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export const kv4Router = router;
