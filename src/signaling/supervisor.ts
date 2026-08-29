import { db } from '../db';
import { logger } from '../logger';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export function startRecordingSupervisor() {
  setInterval(async () => {
    try {
      const activeRecordings = await db.recording.findMany({
        where: { status: { in: ['starting', 'recording'] } }
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
                 // Mint new credential
                 const validToken = jwt.sign(
                    { purpose: 'recording_bot', recordingId: rec.id }, 
                    process.env.JWT_SECRET || 'fallback',
                    { expiresIn: '24h' }
                 );

                 const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                 
                 const job = {
                    roomId: room.id,
                    recordingId: rec.id,
                    url: `${frontendUrl}/room/${room.slug}/recording`,
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
    } catch (err) {
      logger.error('[Supervisor] Error checking leases', err);
    }
  }, 15000);
}
