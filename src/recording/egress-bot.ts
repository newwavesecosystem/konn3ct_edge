import puppeteer, { Browser } from 'puppeteer';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import jwt from 'jsonwebtoken';
import { logger } from '../logger';

const db = new PrismaClient();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    if (process.env.NODE_ENV !== 'production') return null;
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1,
});
redis.on('error', (e) => logger.error('Bot Redis error', e));

const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: process.env.DO_SPACES_REGION || 'lon1',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false,
});

async function startRecording({
  roomId,
  roomSlug,
  recordingId,
  url: frontendUrl,
}: {
  roomId: string;
  roomSlug: string;
  recordingId: string;
  url: string;
}) {
  const bucketName = process.env.DO_SPACES_BUCKET;
  if (!bucketName) throw new Error('[FATAL] DO_SPACES_BUCKET must be set');

  const region = process.env.DO_SPACES_REGION || 'lon1';
  const fileId = `${roomSlug}_${Date.now()}`;
  const objectKey = `recordings/${fileId}.webm`;
  const tempFilePath = path.join(os.tmpdir(), `recording_${fileId}.webm`);

  // Generate a short-lived bot JWT so the meeting page / WS can authenticate the bot
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('[FATAL] JWT_SECRET must be set');
  const botToken = jwt.sign(
    { userId: `bot_${fileId}`, email: 'bot@conn3ct.internal', name: 'RecordingBot', role: 'bot' },
    jwtSecret,
    { expiresIn: '2h' }
  );

  const meetingUrl = `${frontendUrl}?t=${botToken}&name=RecordingBot&role=bot`;

  // Resolve the room owner so we can set ownerId on the recording
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) throw new Error(`[FATAL] Room ${roomId} not found`);

  // Update existing DB record
  const recordingDbEntry = await db.recording.update({
    where: { id: recordingId },
    data: {
      roomId,
      status: 'recording',
      duration: 0,
    },
  });

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    });

    const page = await browser.newPage();
    await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for meeting to load (look for a known DOM element)
    await page.waitForSelector('[data-testid="meeting-controls"]', { timeout: 30000 }).catch(() => {
      logger.warn(`Recording bot: meeting-controls not found for room ${roomSlug}, continuing anyway`);
    });

    // Start capturing the tab's audio+video
    // puppeteer-stream is a community package without bundled typings
    const { getStream } = await import('puppeteer-stream');
    const stream = await getStream(page, { audio: true, video: true });

    const fileStream = fs.createWriteStream(tempFilePath);
    stream.pipe(fileStream);

    logger.info(`Recording started for room ${roomSlug} -> ${tempFilePath}`);

    // Wait for stop signal from Redis OR timeout (default 60 min)
    const durationMinutes = parseInt(process.env.MAX_RECORDING_DURATION_MINUTES || '60', 10);
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        logger.info(`Recording for room ${roomSlug} hit max duration (${durationMinutes} min)`);
        resolve();
      }, durationMinutes * 60 * 1000);

      // Subscribe to stop signal on a separate Redis connection
      const stopSubscriber = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
      stopSubscriber.on('error', (e) => logger.error('Stop subscriber error', e));
      stopSubscriber.subscribe(`recorder:stop:${roomId}`, (err) => {
        if (err) logger.error(`Failed to subscribe to stop channel for room ${roomId}`, err);
      });
      stopSubscriber.on('message', (channel) => {
        if (channel === `recorder:stop:${roomId}`) {
          logger.info(`Stop signal received for room ${roomSlug}`);
          clearTimeout(timeout);
          stopSubscriber.disconnect();
          resolve();
        }
      });
    });

    // Stop the stream
    stream.destroy();
    await new Promise<void>((resolve) => fileStream.end(resolve));

    // Upload to S3 using a read stream (not readFileSync)
    logger.info(`Uploading recording for room ${roomSlug} to S3...`);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: fs.createReadStream(tempFilePath),
        ContentType: 'video/webm',
        ACL: 'public-read',
      })
    );

    const publicUrl = `https://${bucketName}.${region}.digitaloceanspaces.com/${objectKey}`;
    logger.info(`Recording uploaded: ${publicUrl}`);

    // Update DB record
    await db.recording.update({
      where: { id: recordingDbEntry.id },
      data: { url: publicUrl, status: 'completed' },
    });

    // Notify via Redis pub/sub so the signaling server can broadcast to room
    await redis.publish('recorder:completed', JSON.stringify({ roomId, recordingUrl: publicUrl }));

  } catch (error) {
    logger.error(`Recording failed for room ${roomSlug}:`, error);
    await db.recording.update({
      where: { id: recordingDbEntry.id },
      data: { status: 'failed' },
    }).catch((e) => logger.error('Failed to update recording status to failed', e));
  } finally {
    if (browser) {
      await browser.close().catch((e: unknown) => logger.warn('Failed to close browser', e));
    }
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      logger.warn(`Failed to delete temp file ${tempFilePath}`, e);
    }
  }
}

// Worker loop: reads jobs from the Redis queue
async function runWorker() {
  logger.info('Recording worker started, listening on recorder:queue');
  while (true) {
    try {
      const result = await redis.brpop('recorder:queue', 0);
      if (!result) continue;
      const job = JSON.parse(result[1]);
      logger.info(`Processing recording job for room ${job.roomSlug}`);
      await startRecording(job);
    } catch (e) {
      logger.error('Recording worker error:', e);
      await new Promise((r) => setTimeout(r, 5000)); // backoff on error
    }
  }
}

runWorker().catch((e) => {
  logger.error('Recording worker crashed:', e);
  process.exit(1);
});
