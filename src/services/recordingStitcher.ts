import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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
 * Downloads a segment from S3 using credentials (or public HTTP fetch as fallback)
 */
async function downloadSegment(segment: { url?: string | null; storageKey?: string | null }, destPath: string): Promise<void> {
  // If S3 client is configured, download directly from S3 (handles private buckets)
  if (s3Client) {
    let key = segment.storageKey;
    let targetBucket = bucket;

    if (segment.url) {
      try {
        const parsed = new URL(segment.url);
        const hostParts = parsed.hostname.split('.');
        if (hostParts.length >= 4 && hostParts.slice(1).join('.').includes('digitaloceanspaces.com')) {
          targetBucket = hostParts[0];
        }
        if (!key) {
          key = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
          if (targetBucket && key.startsWith(`${targetBucket}/`)) {
            key = key.slice(targetBucket.length + 1);
          }
        }
      } catch {
        if (!key) key = segment.url;
      }
    }

    if (key && targetBucket) {
      try {
        const command = new GetObjectCommand({
          Bucket: targetBucket,
          Key: key
        });
        const response = await s3Client.send(command);
        if (response.Body) {
          const stream = response.Body as any;
          if (typeof stream.transformToByteArray === 'function') {
            const bytes = await stream.transformToByteArray();
            fs.writeFileSync(destPath, Buffer.from(bytes));
            return;
          } else {
            await new Promise<void>((resolve, reject) => {
              const writer = fs.createWriteStream(destPath);
              stream.pipe(writer);
              writer.on('finish', resolve);
              writer.on('error', reject);
            });
            return;
          }
        }
      } catch (err: any) {
        logger.warn(`[Stitcher] Direct S3 download failed for key ${key} from bucket ${targetBucket}: ${err.message}. Trying public fetch.`);
      }
    }
  }

  if (!segment.url) {
    throw new Error('No URL or storageKey provided to download segment');
  }

  const res = await fetch(segment.url);
  if (!res.ok) {
    throw new Error(`Failed to download segment from ${segment.url}: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
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

    const totalSegmentsCount = await db.recordingSegment.count({
      where: { recordingId, status: { in: ['uploaded', 'UPLOADED_VERIFIED', 'COMPLETED', 'PARTIAL'] } }
    });

    // If already finalized and completed with a master URL, skip unless new segments arrived
    if (recording.status === 'completed' && recording.url) {
      if (totalSegmentsCount > 1 && !recording.url.includes('_complete_')) {
        logger.info(`[Stitcher] Recording ${recordingId} has ${totalSegmentsCount} segments but only single-segment URL. Upgrading to full stitched video.`);
      } else {
        logger.info(`[Stitcher] Recording ${recordingId} is already completed.`);
        return true;
      }
    }

    const segments = await db.recordingSegment.findMany({
      where: {
        recordingId,
        status: { in: ['uploaded', 'UPLOADED_VERIFIED', 'COMPLETED', 'PARTIAL'] }
      },
      orderBy: { segmentIndex: 'asc' }
    });

    if (!segments || segments.length === 0) {
      logger.warn(`[Stitcher] No uploaded segments found for recording ${recordingId}. Marking as failed.`);
      await db.recording.update({
        where: { id: recordingId },
        data: { status: 'failed', failureReason: 'No uploaded segments found', endedAt: recording.endedAt || new Date() }
      });
      return false;
    }

    // Filter out segments without valid URLs
    const validSegments = segments.filter(s => s.url && s.url.startsWith('http'));
    if (validSegments.length === 0) {
      logger.warn(`[Stitcher] No segments with valid HTTP URLs for recording ${recordingId}. Marking as failed.`);
      await db.recording.update({
        where: { id: recordingId },
        data: { status: 'failed', failureReason: 'No valid segment URLs', endedAt: recording.endedAt || new Date() }
      });
      return false;
    }

    logger.info(`[Stitcher] Found ${validSegments.length} valid segments for recording ${recordingId}.`);

    // CASE 1: Single segment recorded - only finalize if recording is stopped and capture is done
    if (validSegments.length === 1) {
      const leaseKey = `recording:${recordingId}:lease`;
      const hasLease = await redis.exists(leaseKey);
      const controlState = await redis.get(`recording:${recordingId}:control`);
      const isStopped = !hasLease && (recording.status === 'stopping' || recording.status === 'processing' || controlState === 'STOP_REQUESTED' || controlState === 'STOPPING' || controlState === 'STOPPED');

      if (!isStopped) {
        logger.info(`[Stitcher] Recording ${recordingId} has 1 segment uploaded but is still actively recording. Awaiting further segments.`);
        return false;
      }

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
      await downloadSegment(seg, localFile);
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
