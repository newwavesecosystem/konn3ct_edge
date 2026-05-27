import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../logger';
import { requireAuth } from '../middleware/auth';
import { telephonyLimiter } from '../middleware/rateLimiter';

export const telephonyRouter = Router();

// --- 1. Inbound Routing (FreeSWITCH Webhook) ---
// This is called by FreeSWITCH when a user dials in and enters a PIN/Meeting Code via DTMF.
// No standard auth middleware here since it's called by FreeSWITCH locally/internally.
const inboundRouteSchema = z.object({
  callerId: z.string(),
  meetingCode: z.string() // The DTMF digits entered
});

telephonyRouter.post('/inbound/route', async (req: Request, res: Response) => {
  try {
    // Basic IP/Header security would go here in production to ensure only FreeSWITCH can call this
    const { callerId, meetingCode } = inboundRouteSchema.parse(req.body);

    // Find room by its ID prefix or a dedicated numeric meetingCode field.
    // For MVP, assuming room IDs start with the digits or we match against a numeric code.
    // Easiest is to lookup room where `id` starts with the code, but ideal is a dedicated `dialInCode` field.
    // We will simulate lookup:
    const room = await db.room.findFirst({
      where: {
        // If we added a numeric code, we'd search it here.
        // Using slug as placeholder for MVP
        slug: meetingCode 
      }
    });

    if (!room) {
      logger.info(`Telephony Inbound: Room not found for code ${meetingCode}`);
      return res.status(404).json({ action: 'reject', reason: 'Invalid meeting code' });
    }

    // Create a CDR for tracking
    await db.callDetailRecord.create({
      data: {
        roomId: room.id,
        callerId,
        direction: 'inbound',
        status: 'in-progress'
      }
    });

    logger.info(`Telephony Inbound: Caller ${callerId} routed to room ${room.slug}`);
    
    // Respond with FreeSWITCH instructions
    res.status(200).json({
      action: 'bridge',
      destination: `sofia/gateway/webrtc-gateway/${room.id}`
    });
  } catch (error) {
    logger.error('Error in telephony inbound route', error);
    res.status(500).json({ action: 'reject', reason: 'System error' });
  }
});

// --- 2. Outbound Dialing (Call-out) ---
const calloutSchema = z.object({
  roomId: z.string(),
  targetNumber: z.string().regex(/^\+[1-9]\d{1,14}$/) // E.164 format
});

telephonyRouter.post('/callout', telephonyLimiter, requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomId, targetNumber } = calloutSchema.parse(req.body);
    const userId = req.user!.userId;

    // Verify user owns the room
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room || room.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden. Only room owners can initiate call-outs.' });
    }

    // Insert CDR
    const cdr = await db.callDetailRecord.create({
      data: {
        roomId,
        callerId: targetNumber,
        direction: 'outbound',
        status: 'in-progress'
      }
    });

    logger.info(`Telephony Outbound: Initiating call to ${targetNumber} for room ${roomId}`);

    // In a real implementation, we would use FreeSWITCH Event Socket Library (ESL) to trigger the dial.
    // e.g. `bgapi originate sofia/gateway/provider/${targetNumber} &bridge(sofia/gateway/webrtc-gateway/${roomId})`
    
    res.status(200).json({ 
      message: 'Call initiated successfully',
      cdrId: cdr.id
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error initiating callout', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- 3. Available Dial-in Numbers ---
telephonyRouter.get('/numbers', async (req: Request, res: Response) => {
  try {
    const numbers = await db.dialInNumber.findMany({
      orderBy: { country: 'asc' }
    });
    res.status(200).json(numbers);
  } catch (error) {
    logger.error('Error fetching dial-in numbers', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- 4. Call Detail Records (Reporting) ---
telephonyRouter.get('/cdr/:roomId', requireAuth, async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId as string;
    const userId = req.user!.userId;

    // Verify ownership
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room || room.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const cdrs = await db.callDetailRecord.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(cdrs);
  } catch (error) {
    logger.error('Error fetching CDRs', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
