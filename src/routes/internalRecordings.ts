import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../logger';
import { launchRecorderBot } from '../services/recorderLauncher';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

export const internalRecordingsRouter = Router();

// Simple admin middleware
const requireAdminSecret = (req: Request, res: Response, next: any) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== (process.env.INTERNAL_ADMIN_SECRET || 'smoke-test-secret')) {
    return res.status(403).json({ error: 'Forbidden: Invalid Admin Secret' });
  }
  next();
};

internalRecordingsRouter.use(requireAdminSecret);

const smokeTestSchema = z.object({
  roomUrl: z.string().url(),
  durationSeconds: z.number().min(10).max(300).default(30),
  upload: z.boolean().default(true),
  testMode: z.boolean().default(true)
});

internalRecordingsRouter.post('/smoke-test', async (req: Request, res: Response) => {
  try {
    const { roomUrl, durationSeconds, testMode } = smokeTestSchema.parse(req.body);

    // 1. Parse room slug
    const urlObj = new URL(roomUrl);
    const pathParts = urlObj.pathname.split('/');
    const roomSlug = pathParts[pathParts.length - 1];

    // 2. Verify room exists
    const room = await db.room.findUnique({ where: { slug: roomSlug } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // 3. Create recording record
    const recording = await db.recording.create({
      data: {
        title: `Smoke Test - ${new Date().toISOString()}`,
        url: '',
        roomId: room.id,
        ownerId: room.ownerId, // Map to room owner for test
        status: 'starting'
      }
    });

    // 4. Generate valid recorder JWT
    const participantId = crypto.randomUUID();
    logger.info(`recorder_token_participant_id_generated: ${participantId}`);
    const botToken = jwt.sign(
      { 
        role: 'recorder', 
        purpose: 'recording_bot', 
        roomId: room.id, 
        roomSlug: room.slug, 
        recordingId: recording.id, 
        participantId 
      },
      process.env.JWT_SECRET || 'fallback',
      { expiresIn: '1h' }
    );

    const frontendDomain = process.env.NEXT_PUBLIC_FRONTEND_DOMAIN || 'edge.konn3ct.net';
    
    const protocol = frontendDomain.includes('localhost') ? 'http' : 'https';
    const recorderUrl = `${protocol}://${frontendDomain}/recording/${roomSlug}?botToken=${botToken}`;

    // 6. Queue the recorder job
    const launchResult = await launchRecorderBot({
      roomId: room.id,
      roomSlug,
      recordingId: recording.id,
      botToken,
      url: recorderUrl
    });

    if (!launchResult.queued) {
      await db.recording.update({
        where: { id: recording.id },
        data: { status: 'failed' }
      });
      return res.status(500).json({ error: launchResult.error || 'Failed to launch recorder' });
    }

    // 7. Auto-stop the recording after it actually starts
    const checkInterval = setInterval(async () => {
      const rec = await db.recording.findUnique({ where: { id: recording.id } });
      if (rec && rec.status === 'recording') {
        clearInterval(checkInterval);
        logger.info(`[SMOKE TEST] Recording status is 'recording'. Starting ${durationSeconds}-second timer now (Reference event: DB status reached 'recording').`);
        setTimeout(() => {
          const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
          const redis = new Redis(redisUrl);
          
          logger.info(`[SMOKE TEST] Auto-stopping recording ${recording.id} after ${durationSeconds} seconds of active recording.`);
          
          // Update DB to stopping
          db.recording.update({
            where: { id: recording.id },
            data: { status: 'stopping', endedAt: new Date() }
          }).catch(e => logger.error('Failed to update DB for smoke test stop', e));

          // Publish stop command to worker
          redis.publish(`recorder:stop:${room.id}`, JSON.stringify({ reason: 'smoke_test_auto_stop' }))
            .then(() => redis.quit())
            .catch(e => logger.error('Failed to publish stop recording for smoke test', e));
        }, durationSeconds * 1000);
      } else if (rec && (rec.status === 'failed' || rec.status === 'completed')) {
        clearInterval(checkInterval);
      }
    }, 1000);


    const maskedUrl = recorderUrl.replace(botToken, '***MASKED***');
    logger.info(`[SMOKE TEST] Queued smoke test recording ${recording.id} for room ${roomSlug}. Target URL: ${maskedUrl}`);

    res.status(200).json({
      recordingId: recording.id,
      roomSlug: room.slug,
      recorderUrl: maskedUrl,
      statusUrl: `/api/internal/recordings/smoke-test/${recording.id}/status`,
      message: `${durationSeconds}-second recorder smoke test started`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.flatten().fieldErrors });
    }
    logger.error('Error starting smoke test recording', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

internalRecordingsRouter.get('/smoke-test/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const recording = await db.recording.findUnique({ where: { id } }) as any;
    
    if (!recording) return res.status(404).json({ error: 'Recording not found' });
    
    // Check if we have files locally to report
    const fs = require('fs');
    const path = require('path');
    
    const manifestPath = path.join(__dirname, '../../recorder/data', id, 'manifest.json');
    const ffmpegOutPath = path.join(__dirname, '../../recorder/data', id, 'ffmpeg.out.log');
    const ffmpegErrPath = path.join(__dirname, '../../recorder/data', id, 'ffmpeg.err.log');
    const screenshotPath = path.join(__dirname, '../../recorder/data', id, 'screenshot_diagnostic.png');
    
    res.status(200).json({
      recordingId: id,
      status: recording.status,
      failureReason: recording.failureReason || null,
      manifestPath: fs.existsSync(manifestPath) ? path.resolve(manifestPath) : null,
      ffmpegStdoutPath: fs.existsSync(ffmpegOutPath) ? path.resolve(ffmpegOutPath) : null,
      ffmpegStderrPath: fs.existsSync(ffmpegErrPath) ? path.resolve(ffmpegErrPath) : null,
      screenshotPath: fs.existsSync(screenshotPath) ? path.resolve(screenshotPath) : null,
      url: recording.url,
      uploadStatus: recording.url ? 'completed' : (recording.status === 'failed' ? 'failed' : 'pending'),
      spacesObjectKey: recording.url ? new URL(recording.url).pathname.substring(1) : null
    });
  } catch (error) {
    logger.error('Error fetching smoke test status', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
