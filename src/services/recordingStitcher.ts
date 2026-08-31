import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Redis from 'ioredis';
import { db } from '../db';
import { logger } from '../logger';

const execAsync = promisify(exec);

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

// DigitalOcean Spaces / S3 Config
const region = process.env.DO_SPACES_REGION || 'nyc3';
const accessKeyId = process.env.DO_SPACES_KEY || '';
const secretAccessKey = process.env.DO_SPACES_SECRET || '';
const rawEndpoint = process.env.DO_SPACES_ENDPOINT || 'nyc3.digitaloceanspaces.com';
const endpoint = rawEndpoint.startsWith('http') ? rawEndpoint : `https://${rawEndpoint}`;
const bucket = process.env.DO_SPACES_BUCKET || 'konn3ct-assets';
const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE).trim().toLowerCase() === 'true';

let s3Client: S3Client | null = null;
if (accessKeyId && secretAccessKey) {
  s3Client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    endpoint,
    forcePathStyle
  });
}

/**
 * Downloads a remote file to local disk
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download segment from ${url}: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(destPath, buffer);
}

/**
 * Combines/stitches all uploaded segments for a recording into a single cohesive video.
 */
export async function stitchRecording(recordingId: string): Promise<boolean> {
  const lockKey = `recording:${recordingId}:stitch-lock`;
  const lockAcquired = await redis.set(lockKey, 'locked', 'EX', 300, 'NX');
  if (!lockAcquired) {
    logger.info(`[Stitcher] Stitching already in progress for recording ${recordingId}`);
    return false;
  }

  const tempDir = path.join(os.tmpdir(), `stitch_${recordingId}_${Date.now()}`);

  try {
    const recording = await db.recording.findUnique({
      where: { id: recordingId },
      include: {
        room: { select: { slug: true } }
      }
    });

    if (!recording) {
      logger.warn(`[Stitcher] Recording ${recordingId} not found in database.`);
      return false;
    }

    // If already finalized and completed with a master URL, skip
    if (recording.status === 'completed' && recording.url) {
      logger.info(`[Stitcher] Recording ${recordingId} is already completed.`);
      return true;
    }

    const segments = await db.recordingSegment.findMany({
      where: {
        recordingId,
        status: { in: ['uploaded', 'UPLOADED_VERIFIED', 'COMPLETED', 'PARTIAL'] }
      },
      orderBy: { segmentIndex: 'asc' }
    });

    if (!segments || segments.length === 0) {
      logger.warn(`[Stitcher] No uploaded segments found for recording ${recordingId}.`);
      return false;
    }

    // Filter out segments without valid URLs
    const validSegments = segments.filter(s => s.url && s.url.startsWith('http'));
    if (validSegments.length === 0) {
      logger.warn(`[Stitcher] No segments with valid HTTP URLs for recording ${recordingId}.`);
      return false;
    }

    logger.info(`[Stitcher] Found ${validSegments.length} valid segments for recording ${recordingId}.`);

    // CASE 1: Single segment recorded - no stitching needed!
    if (validSegments.length === 1) {
      const single = validSegments[0];
      const durationSec = Math.round((single.durationMs || 0) / 1000);
      
      await db.recording.update({
        where: { id: recordingId },
        data: {
          status: 'completed',
          url: single.url,
          duration: durationSec,
          endedAt: recording.endedAt || new Date()
        }
      });

      logger.info(`[Stitcher] Single segment recording ${recordingId} marked as completed: ${single.url}`);
      return true;
    }

    // CASE 2: Multiple segments - download and concatenate with FFmpeg
    fs.mkdirSync(tempDir, { recursive: true });
    const localSegmentFiles: string[] = [];
    let totalDurationSec = 0;

    for (let i = 0; i < validSegments.length; i++) {
      const seg = validSegments[i];
      const localFile = path.join(tempDir, `seg_${i}.mp4`);
      logger.info(`[Stitcher] Downloading segment ${seg.segmentIndex} from ${seg.url}...`);
      await downloadFile(seg.url!, localFile);
      localSegmentFiles.push(localFile);
      totalDurationSec += Math.round((seg.durationMs || 0) / 1000);
    }

    // Write concat file list for FFmpeg concat demuxer
    const concatListPath = path.join(tempDir, 'concat_list.txt');
    const concatFileContent = localSegmentFiles
      .map(file => `file '${file.replace(/'/g, "'\\''")}'`)
      .join('\n');
    fs.writeFileSync(concatListPath, concatFileContent, 'utf8');

    const outputMergedPath = path.join(tempDir, 'merged_master.mp4');

    logger.info(`[Stitcher] Running FFmpeg stream copy concatenation on ${localSegmentFiles.length} segments...`);
    
    // First attempt: Stream Copy (Instant, zero quality loss)
    try {
      await execAsync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c copy -movflags +faststart "${outputMergedPath}"`);
    } catch (copyErr) {
      logger.warn(`[Stitcher] Stream-copy concat failed for ${recordingId}, falling back to fast transcode concat:`, copyErr);
      // Fallback: Re-encode concat (handles minor codec parameter shifts across worker generations)
      await execAsync(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -preset veryfast -crf 23 -c:a aac -movflags +faststart "${outputMergedPath}"`);
    }

    if (!fs.existsSync(outputMergedPath) || fs.statSync(outputMergedPath).size < 1000) {
      throw new Error(`Merged output file is empty or missing at ${outputMergedPath}`);
    }

    // Upload stitched master file to Spaces / S3
    if (!s3Client) {
      throw new Error('S3 Client is not configured with access credentials.');
    }

    const roomId = recording.roomId || 'general';
    const storageKey = `recordings/${roomId}/${recordingId}_complete_${Date.now()}.mp4`;
    const fileStream = fs.createReadStream(outputMergedPath);
    const fileSize = fs.statSync(outputMergedPath).size;

    logger.info(`[Stitcher] Uploading merged recording (${fileSize} bytes) to ${bucket}/${storageKey}...`);

    const putCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: fileStream,
      ContentType: 'video/mp4',
      ACL: 'private'
    });

    await s3Client.send(putCommand);

    const cleanEndpoint = rawEndpoint.replace(/^https?:\/\//, '');
    const masterUrl = forcePathStyle 
      ? `https://${cleanEndpoint}/${bucket}/${storageKey}`
      : `https://${bucket}.${cleanEndpoint}/${storageKey}`;

    logger.info(`[Stitcher] Successfully uploaded stitched master video: ${masterUrl}`);

    await db.recording.update({
      where: { id: recordingId },
      data: {
        status: 'completed',
        url: masterUrl,
        storageKey,
        storageBucket: bucket,
        contentType: 'video/mp4',
        duration: totalDurationSec,
        endedAt: recording.endedAt || new Date()
      }
    });

    return true;
  } catch (err) {
    logger.error(`[Stitcher] Error stitching recording ${recordingId}:`, err);
    return false;
  } finally {
    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {}

    // Release Redis lock
    await redis.del(lockKey).catch(() => {});
  }
}
