import { createClient } from 'redis';
import { logger } from '../logger';

// In a real Kubernetes environment, this would be the internal IP of the current pod
// exposed via the Downward API (status.podIP)
const POD_IP = process.env.POD_IP || '127.0.0.1';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({ url: REDIS_URL });

redisClient.on('error', (err) => logger.error('Redis Client Error', err));

/**
 * Initializes the Room Allocator Redis connection.
 */
export async function initializeAllocator() {
  await redisClient.connect();
  logger.info(`Room Allocator connected to Redis at ${REDIS_URL}`);
}

/**
 * Assigns a room to the current pod if it's not already assigned.
 * If the room is already assigned to another pod, it returns that pod's IP.
 * This ensures all users joining the same room are routed to the same Mediasoup worker.
 */
export async function allocateRoom(roomId: string): Promise<string> {
  const key = `room_allocation:${roomId}`;
  
  // Try to set the key to this POD_IP, but ONLY if the key does not already exist (NX)
  // Give it an expiration of 12 hours (43200 seconds)
  const result = await redisClient.set(key, POD_IP, { NX: true, EX: 43200 });
  
  if (result === 'OK') {
    // We successfully claimed the room
    logger.info(`Room ${roomId} allocated to Pod ${POD_IP}`);
    return POD_IP;
  } else {
    // The room is already claimed by another pod, get its IP
    const assignedIp = await redisClient.get(key);
    logger.info(`Room ${roomId} is already allocated to Pod ${assignedIp}`);
    return assignedIp || POD_IP;
  }
}

/**
 * Removes the allocation for a room when it ends, freeing up the name space.
 */
export async function deallocateRoom(roomId: string) {
  const key = `room_allocation:${roomId}`;
  await redisClient.del(key);
  logger.info(`Room ${roomId} deallocated`);
}
