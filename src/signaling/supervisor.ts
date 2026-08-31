import { db } from '../db';
import { logger } from '../logger';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import crypto from 'crypto';
import { stitchRecording } from '../services/recordingStitcher';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export function startRecordingSupervisor() {
  setInterval(async () => {
    try {
      // Leader election: Only one signaling replica runs the supervisor sweep per interval
      const isLeader = await redis.set('supervisor:leader-lock', 'locked', 'EX', 12, 'NX');
      if (!isLeader) return;

      const activeRecordings = await db.recording.findMany({
        where: { 
          status: { in: ['starting', 'recording'] }
        },
        take: 10
      });
      
      for (const rec of activeRecordings) {
        const leaseKey = `recording:${rec.id}:lease`;
        const hasLease = await redis.exists(leaseKey);
        
        if (!hasLease) {
          const controlState = await redis.get(`recording:${rec.id}:control`);
          if (controlState === 'STARTING' || controlState === 'RECORDING' || controlState === 'RECOVERING') {
             
             // Atomic recovery lock
             const lockKey = `recording:${rec.id}:recovery-lock`;
             const lockAcquired = await redis.set(lockKey, 'locked', 'EX', 10, 'NX');
             
             if (lockAcquired) {
                 logger.warn(`[Supervisor] Lease expired for recording ${rec.id}. Claiming recovery lock and re-queueing job.`);
                 
                 // Update control state to RECOVERING
                 await redis.set(`recording:${rec.id}:control`, 'RECOVERING');
                 
                 const room = await db.room.findUnique({ where: { id: rec.roomId || '' } });
                 if (!room) continue;

                 const currentMaxSegment = await db.recordingSegment.findFirst({
                   where: { recordingId: rec.id },
                   orderBy: { workerGeneration: 'desc' }
                 });
                 const nextWorkerGeneration = (currentMaxSegment?.workerGeneration || 0) + 1;
                 
                 // Authoritative current worker generation in Redis
                 await redis.set(`recording:${rec.id}:current-worker-generation`, nextWorkerGeneration);
                 
                 // Atomic collision-proof range allocation
                 const nextSegmentIndex = nextWorkerGeneration * 10000;
                 
                 // Mint new credential matching standard recording bot token structure
                 const participantId = crypto.randomUUID();
                 const validToken = jwt.sign(
                    { role: 'recorder', purpose: 'recording_bot', roomId: room.id, roomSlug: room.slug, recordingId: rec.id, participantId }, 
                    process.env.JWT_SECRET || 'fallback',
                    { expiresIn: '4h' }
                 );

                 const frontendDomain = process.env.NEXT_PUBLIC_FRONTEND_DOMAIN || process.env.FRONTEND_DOMAIN || 'edge.konn3ct.net';
                 const protocol = frontendDomain.includes('localhost') ? 'http' : 'https';
                 const botUrl = `${protocol}://${frontendDomain}/recording/${room.slug}?botToken=${validToken}`;
                 
                 const job = {
                    roomId: room.id,
                    roomSlug: room.slug,
                    recordingId: rec.id,
                    url: botUrl,
                    botToken: validToken,
                    workerGeneration: nextWorkerGeneration,
                    nextSegmentIndex: nextSegmentIndex,
                    jobId: `rec_job_${Date.now()}`
                 };

                 await redis.lpush('recorder:queue', JSON.stringify(job));
                 
                 logger.info(`[Supervisor] Re-queued recording job for ${rec.id} (Gen: ${nextWorkerGeneration}, NextSegment: ${nextSegmentIndex})`);
             }
          }
        }
      }

      // Check for stopped/stopping recordings that need final stitching (prioritize newest first)
      const stoppingRecordings = await db.recording.findMany({
        where: { 
          status: { in: ['stopping', 'processing'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      for (const rec of stoppingRecordings) {
        const leaseKey = `recording:${rec.id}:lease`;
        const hasLease = await redis.exists(leaseKey);
        if (!hasLease) {
          // Worker is done capturing, trigger stitching sequentially by exact recordingId
          await stitchRecording(rec.id).catch(e => logger.error(`[Supervisor] Stitching failed for ${rec.id}:`, e));
        }
      }
    } catch (err) {
      logger.error('[Supervisor] Error checking leases', err);
    }
  }, 15000);
}
