import { Router, Request, Response } from 'express';
import { db } from '../db';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Redis from 'ioredis';
import { logger } from '../logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

// Initialize Redis for status checks
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    if (process.env.NODE_ENV !== 'production') return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1,
  connectTimeout: 2000
});
redis.on("error", () => {});

// Middleware to validate the API key
function requireApiKey(req: Request, res: Response, next: Function) {
  const apiKey = process.env.EXTERNAL_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'External API not configured' });
  }
  if (req.headers['x-api-key'] !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// Generate a random slug
function generateRoomSlug() {
  const adjectives = ["quick", "bright", "smart", "cool", "calm", "vibrant", "blue", "swift"];
  const nouns = ["eagle", "fox", "river", "mountain", "ocean", "sky", "forest", "star"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}-${noun}-${num}`;
}

router.use(requireApiKey);

// 1. Create Meeting
router.post('/meetings', async (req, res) => {
  try {
    const {
      name,
      ownerEmail,
      isWaitingRoomEnabled,
      mode = 'meeting',          // "meeting" | "webinar"
      recordingSetting = 'off',  // "off" | "free" | "paid"
      guestJoinAllowed = true,
      accessPin,
      logoutUrl,
      maxParticipants,
      maxWebinarAudience,
      maxActiveCameras,
    } = req.body;

    const finalEmail = ownerEmail || "api_guest@conn3ct.com";
    const roomName = name || "API Created Meeting";

    // Lookup or create owner
    let owner = await db.user.findUnique({ where: { email: finalEmail } });
    if (!owner) {
      const randomPassword = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      owner = await db.user.create({
        data: {
          email: finalEmail,
          name: finalEmail.split('@')[0],
          passwordHash
        }
      });
    }

    const roomSlug = generateRoomSlug();

    // Webinar mode automatically enables the waiting room
    const finalWaitingRoom = mode === 'webinar' ? true : (isWaitingRoomEnabled !== false);

    // Create room in database
    const room = await db.room.create({
      data: {
        name: roomName,
        slug: roomSlug,
        ownerId: owner.id,
        isWaitingRoomEnabled: finalWaitingRoom,
        mode,
        recordingSetting,
        guestJoinAllowed,
        accessPin: accessPin || null,
        logoutUrl: logoutUrl || null,
        maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : 100,
        maxWebinarAudience: maxWebinarAudience ? parseInt(maxWebinarAudience, 10) : 1000,
        maxActiveCameras: maxActiveCameras ? parseInt(maxActiveCameras, 10) : 15,
      }
    });

    res.json({
      roomId: room.slug,
      mode: room.mode,
      recordingSetting: room.recordingSetting,
      guestJoinAllowed: room.guestJoinAllowed,
      isWaitingRoomEnabled: room.isWaitingRoomEnabled,
      logoutUrl: room.logoutUrl,
      maxParticipants: room.maxParticipants,
      maxWebinarAudience: room.maxWebinarAudience,
      maxActiveCameras: room.maxActiveCameras,
      message: "Meeting created successfully"
    });
  } catch (error) {
    logger.error("External API /meetings error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. Generate Join Token
router.post('/meetings/join', async (req, res) => {
  try {
    const { roomId, name, email, role, isMobile, camera, mic, pin } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: "Missing roomId" });
    }
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Missing name" });
    }

    // Verify room exists in DB
    const room = await db.room.findUnique({ where: { slug: roomId } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Enforce Access PIN if the room requires one
    if (room.accessPin) {
      if (!pin || pin !== room.accessPin) {
        return res.status(403).json({ error: "Invalid or missing access PIN" });
      }
    }

    // Enforce guest join policy
    if (!room.guestJoinAllowed && role !== 'host') {
      return res.status(403).json({ error: "Guest join is not allowed for this room" });
    }

    const trustedRole = role || "attendee";
    const finalEmail = email?.trim() || "guest@conn3ct.com";

    // Lookup or create joining user to assign them a proper DB userId
    let userId: string;
    const user = await db.user.findUnique({ where: { email: finalEmail } });
    
    if (user && trustedRole === 'host') {
      userId = user.id;
    } else {
      // Always generate a unique ID for attendees to ensure multiple people using 
      // the same email do not overlap in the WebRTC SFU.
      userId = `guest_${crypto.randomUUID().replace(/-/g, '').substring(0, 10)}`;
    }

    const sessionData = {
      userId,
      roomId: room.slug,
      name: name.trim(),
      email: finalEmail,
      role: trustedRole,
      isMobile: !!isMobile,
      camera: camera !== false,
      mic: mic !== false,
      logoutUrl: room.logoutUrl,
    };

    const sessionToken = jwt.sign(sessionData, JWT_SECRET, { expiresIn: "6h" });
    const joinPath = `/meeting/${room.slug}?t=${sessionToken}`;

    res.json({
      sessionToken,
      joinPath,
      message: "Join token generated successfully"
    });
  } catch (error) {
    logger.error("External API /meetings/join error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. Create and Join
router.post('/meetings/create-and-join', async (req, res) => {
  try {
    const {
      name,
      email,
      role,
      isMobile,
      camera,
      mic,
      roomName,
      meetingSlug,
      mode = 'meeting',
      recordingSetting = 'off',
      guestJoinAllowed = true,
      accessPin,
      logoutUrl,
      maxParticipants,
      maxWebinarAudience,
      maxActiveCameras,
      aiFeaturesEnabled,
      captionsEnabled,
      donationsEnabled,
      persistChat,
      networkDetectionEnabled,
    } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Missing name" });
    }

    const trustedRole = role || "host";
    const finalEmail = email?.trim() || "host@conn3ct.com";
    const finalRoomName = roomName || "API Created Meeting";

    // Lookup or create owner
    let owner = await db.user.findUnique({ where: { email: finalEmail } });
    if (!owner) {
      const randomPassword = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      owner = await db.user.create({
        data: {
          email: finalEmail,
          name: name.trim(),
          passwordHash
        }
      });
    }

    let room = null;
    let finalSlug = meetingSlug;

    if (finalSlug) {
      room = await db.room.findUnique({ where: { slug: finalSlug } });
    } else {
      finalSlug = generateRoomSlug();
    }

    if (!room) {
      // Webinar mode automatically enables the waiting room
      const isWaitingRoomEnabled = mode === 'webinar' ? true : true;

      room = await db.room.create({
        data: {
          name: finalRoomName,
          slug: finalSlug,
          ownerId: owner.id,
          isWaitingRoomEnabled,
          mode,
          recordingSetting,
          guestJoinAllowed,
          accessPin: accessPin || null,
          logoutUrl: logoutUrl || null,
          maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : 100,
          maxWebinarAudience: maxWebinarAudience ? parseInt(maxWebinarAudience, 10) : 1000,
          maxActiveCameras: maxActiveCameras ? parseInt(maxActiveCameras, 10) : 15,
          aiFeaturesEnabled: aiFeaturesEnabled !== undefined ? aiFeaturesEnabled : true,
          captionsEnabled: captionsEnabled !== undefined ? captionsEnabled : true,
          donationsEnabled: donationsEnabled !== undefined ? donationsEnabled : true,
          persistChat: persistChat !== undefined ? persistChat : true,
          networkDetectionEnabled: networkDetectionEnabled !== undefined ? networkDetectionEnabled : true,
        }
      });
    }

    const sessionData = {
      userId: owner.id,
      roomId: room.slug,
      name: name.trim(),
      email: finalEmail,
      role: trustedRole,
      isMobile: !!isMobile,
      camera: camera !== false,
      mic: mic !== false,
      logoutUrl: room.logoutUrl,
    };

    const sessionToken = jwt.sign(sessionData, JWT_SECRET, { expiresIn: "6h" });
    const joinPath = `/meeting/${room.slug}?t=${sessionToken}`;

    res.json({
      roomId: room.slug,
      mode: room.mode,
      recordingSetting: room.recordingSetting,
      guestJoinAllowed: room.guestJoinAllowed,
      isWaitingRoomEnabled: room.isWaitingRoomEnabled,
      maxParticipants: room.maxParticipants,
      maxWebinarAudience: room.maxWebinarAudience,
      maxActiveCameras: room.maxActiveCameras,
      sessionToken,
      joinPath,
      message: "Meeting created and host token generated successfully"
    });
  } catch (error) {
    logger.error("External API /meetings/create-and-join error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 4. Meeting Status
router.get('/meetings/:roomId/status', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    if (!roomId) {
      return res.status(400).json({ error: "Missing roomId parameter" });
    }

    let participantsStr = null;
    try {
      participantsStr = await redis.get(`room:${roomId}:participants`);
    } catch (e) {
      logger.warn("Failed to get room status from Redis", e);
      return res.status(503).json({ error: "Status service unavailable" });
    }

    if (!participantsStr) {
      return res.json({
        isRunning: false,
        participantCount: 0,
        participants: []
      });
    }

    const participants = JSON.parse(participantsStr);
    
    res.json({
      isRunning: true,
      participantCount: participants.length,
      participants
    });

  } catch (error) {
    logger.error("External API /status error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 5. Room Recordings
router.get('/meetings/:roomId/recordings', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    if (!roomId) {
      return res.status(400).json({ error: "Missing roomId parameter" });
    }

    const room = await db.room.findUnique({ where: { slug: roomId } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const recordings = await db.recording.findMany({
      where: { roomId: room.id, status: 'completed' },
      select: {
        id: true,
        title: true,
        url: true,
        duration: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      roomId: room.slug,
      recordings
    });
  } catch (error) {
    logger.error("External API /recordings error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 6. Global Recordings (Fetch all recordings, optionally filter by various params)
router.get('/recordings', async (req, res) => {
  try {
    const { 
      email, 
      roomSlug, 
      status, 
      accessType, 
      isPaid, 
      isPublished,
      limit = '50', 
      offset = '0' 
    } = req.query;

    const whereClause: any = {};

    // Defaults to 'completed' unless explicitly requested otherwise (e.g. status=all or status=processing)
    if (status && status !== 'all') {
      whereClause.status = String(status);
    } else if (!status) {
      whereClause.status = 'completed';
    }

    if (email) {
      const user = await db.user.findUnique({ where: { email: String(email) } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      whereClause.ownerId = user.id;
    }

    if (roomSlug) {
      const room = await db.room.findUnique({ where: { slug: String(roomSlug) } });
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      whereClause.roomId = room.id;
    }

    if (accessType) {
      whereClause.accessType = String(accessType);
    }

    if (isPaid !== undefined) {
      whereClause.isPaid = isPaid === 'true';
    }

    if (isPublished !== undefined) {
      whereClause.isPublished = isPublished === 'true';
    }

    const recordings = await db.recording.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        url: true,
        duration: true,
        status: true,
        isPaid: true,
        isPublished: true,
        accessType: true,
        createdAt: true,
        room: {
          select: {
            slug: true,
            name: true
          }
        },
        owner: {
          select: {
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit), 10),
      skip: parseInt(String(offset), 10)
    });

    res.json({
      recordings
    });
  } catch (error) {
    logger.error("External API /recordings error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export { router as externalRouter };
