import { redis } from '../redis';
import { db } from '../db';
import { logger } from '../logger';
import crypto from 'crypto';

const TTL = 86400; // 24 hours

// Helper for Lua script atomic lock release
const releaseLockScript = `
if redis.call("get",KEYS[1]) == ARGV[1]
then
    return redis.call("del",KEYS[1])
else
    return 0
end
`;

export async function withRoomHistoryLoadLock<T>(roomId: string, fn: () => Promise<T>): Promise<T | null> {
  const lockKey = `room:${roomId}:history:lock`;
  const token = crypto.randomUUID();
  const maxRetries = 20; // Up to ~10s total wait
  const baseDelay = 500; // 500ms
  
  for (let i = 0; i < maxRetries; i++) {
    const acquired = await redis.set(lockKey, token, 'PX', 15000, 'NX'); // 15s lock TTL
    
    if (acquired) {
      logger.info(`[HISTORY] room_history_cache_lock_acquired for room ${roomId}`);
      try {
        return await fn();
      } finally {
        // Release lock owner-safely
        await redis.eval(releaseLockScript, 1, lockKey, token);
      }
    }
    
    logger.info(`[HISTORY] room_history_cache_wait_for_loader for room ${roomId} (attempt ${i+1}/${maxRetries})`);
    const delay = baseDelay + Math.random() * 200; // 500-700ms with jitter
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Check if loaded during our wait
    const isLoaded = await redis.get(`room:${roomId}:history:loaded`);
    if (isLoaded) {
      return null; // Signals that another pod loaded it successfully
    }
  }
  
  logger.warn(`[HISTORY] room_history_cache_lock_timeout for room ${roomId}`);
  return null;
}

export async function loadRoomHistoryFromDb(roomId: string, roomCreatedDate: Date, participantId?: string, userId?: string) {
  try {
    const t0 = performance.now();
    const [chatHistory, pollHistory, qaHistory, noteHistory] = await Promise.all([
      db.chatMessage.findMany({
        where: { 
          roomId: roomId, 
          createdAt: { gte: roomCreatedDate },
          OR: [
            { isPrivate: false },
            { targetUserId: participantId || undefined },
            { userId: userId || undefined }
          ]
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      db.meetingPoll.findMany({
        where: { roomId, isActive: true },
        orderBy: { createdAt: 'asc' }
      }),
      db.meetingQA.findMany({
        where: { roomId },
        orderBy: { upvotes: 'desc' }
      }),
      db.sharedNote.findUnique({
        where: { roomId }
      })
    ]);
    const duration = Math.round(performance.now() - t0);
    logger.info(`[HISTORY] room_history_cache_loaded_from_db for room ${roomId} (took ${duration}ms)`);
    
    return { chatHistory, pollHistory, qaHistory, noteHistory };
  } catch (error) {
    logger.error(`[HISTORY] room_history_cache_load_failed for room ${roomId}`, error);
    throw error;
  }
}

export async function populateRoomHistoryCache(roomId: string, history: any) {
  try {
    const pipeline = redis.pipeline();
    
    // Clear old chat list if replacing entirely
    pipeline.del(`room:${roomId}:chat:list`);
    
    if (history.chatHistory && history.chatHistory.length > 0) {
      const messages = history.chatHistory.map((m: any) => JSON.stringify(m));
      pipeline.rpush(`room:${roomId}:chat:list`, ...messages);
      pipeline.expire(`room:${roomId}:chat:list`, TTL);
    }
    
    pipeline.set(`room:${roomId}:polls`, JSON.stringify(history.pollHistory || []), 'EX', TTL);
    pipeline.set(`room:${roomId}:qa`, JSON.stringify(history.qaHistory || []), 'EX', TTL);
    pipeline.set(`room:${roomId}:note`, JSON.stringify(history.noteHistory ? history.noteHistory.content : ''), 'EX', TTL);
    
    const meta = {
      version: 1,
      roomId,
      loadedAt: new Date().toISOString(),
      chatLimit: 50
    };
    // Set loaded flag last
    pipeline.set(`room:${roomId}:history:loaded`, JSON.stringify(meta), 'EX', TTL);
    
    await pipeline.exec();
    logger.info(`[HISTORY] room_history_cache_update_completed for room ${roomId}`);
  } catch (error) {
    logger.error(`[HISTORY] room_history_cache_update_failed for room ${roomId}`, error);
    throw error; // If this fails, we won't set loaded flag
  }
}

export async function readRoomHistoryCache(roomId: string) {
  try {
    const isLoadedStr = await redis.get(`room:${roomId}:history:loaded`);
    if (!isLoadedStr) {
      return null;
    }
    
    // Fetch all keys in parallel
    const [chatList, pollsStr, qaStr, noteStr] = await Promise.all([
      redis.lrange(`room:${roomId}:chat:list`, 0, -1),
      redis.get(`room:${roomId}:polls`),
      redis.get(`room:${roomId}:qa`),
      redis.get(`room:${roomId}:note`),
      
      // Refresh TTLs on active read
      redis.expire(`room:${roomId}:history:loaded`, TTL),
      redis.expire(`room:${roomId}:chat:list`, TTL),
      redis.expire(`room:${roomId}:polls`, TTL),
      redis.expire(`room:${roomId}:qa`, TTL),
      redis.expire(`room:${roomId}:note`, TTL)
    ]);
    
    // If any required key is missing unexpectedly (though empty array/string is fine)
    if (pollsStr === null || qaStr === null || noteStr === null) {
      throw new Error("Missing required cache keys despite loaded flag");
    }
    
    const chatHistory = chatList.map(m => JSON.parse(m));
    const pollHistory = JSON.parse(pollsStr);
    const qaHistory = JSON.parse(qaStr);
    const noteHistory = noteStr ? { content: JSON.parse(noteStr) } : null;
    
    let payloadSize = 0;
    if (chatList) payloadSize += chatList.join('').length;
    if (pollsStr) payloadSize += pollsStr.length;
    if (qaStr) payloadSize += qaStr.length;
    if (noteStr) payloadSize += noteStr.length;
    
    logger.info(`[HISTORY] room_history_cache_hit for room ${roomId}. Payload Size: ${payloadSize} bytes`);
    return { chatHistory, pollHistory, qaHistory, noteHistory };
  } catch (error) {
    logger.error(`[HISTORY] room_history_cache_corrupt_reloading for room ${roomId}`, error);
    await invalidateRoomHistoryCache(roomId);
    return null; // Will trigger reload
  }
}

export async function getOrLoadRoomHistory(roomId: string, roomCreatedDate: Date, participantId?: string, userId?: string) {
  try {
    // 1. Try Cache
    const cached = await readRoomHistoryCache(roomId);
    if (cached) return cached;
    
    logger.info(`[HISTORY] room_history_cache_miss for room ${roomId}`);
    
    // 2. Lock & Load
    const loadedFromDb = await withRoomHistoryLoadLock(roomId, async () => {
      const history = await loadRoomHistoryFromDb(roomId, roomCreatedDate, participantId, userId);
      await populateRoomHistoryCache(roomId, history);
      return history;
    });
    
    if (loadedFromDb) return loadedFromDb;
    
    // 3. If someone else loaded it while we waited, read again
    const rechecked = await readRoomHistoryCache(roomId);
    if (rechecked) return rechecked;
    
    // Fallback: If we couldn't lock or read, load directly without caching (avoid crash)
    return await loadRoomHistoryFromDb(roomId, roomCreatedDate, participantId, userId);
    
  } catch (error) {
    logger.error(`[HISTORY] room_history_cache_redis_unavailable or fatal error for room ${roomId}`, error);
    logger.warn(`[HISTORY] room_history_cache_fallback_to_db for room ${roomId}`);
    // Fallback to direct DB load if Redis goes down
    return await loadRoomHistoryFromDb(roomId, roomCreatedDate, participantId, userId);
  }
}

export async function invalidateRoomHistoryCache(roomId: string) {
  try {
    const pipeline = redis.pipeline();
    pipeline.del(`room:${roomId}:history:loaded`);
    pipeline.del(`room:${roomId}:chat:list`);
    pipeline.del(`room:${roomId}:polls`);
    pipeline.del(`room:${roomId}:qa`);
    pipeline.del(`room:${roomId}:note`);
    await pipeline.exec();
  } catch (e) {
    logger.error(`[HISTORY] Failed to invalidate cache for room ${roomId}`, e);
  }
}

// -------------------------------------
// Write-Through Helpers
// -------------------------------------

export async function appendChatToCache(roomId: string, message: any) {
  try {
    const isLoaded = await redis.exists(`room:${roomId}:history:loaded`);
    if (!isLoaded) return; // If cache is cold, don't create phantom history
    
    const pipeline = redis.pipeline();
    pipeline.rpush(`room:${roomId}:chat:list`, JSON.stringify(message));
    pipeline.ltrim(`room:${roomId}:chat:list`, -50, -1);
    pipeline.expire(`room:${roomId}:chat:list`, TTL);
    await pipeline.exec();
  } catch (e) {
    logger.error(`[HISTORY] Failed to append chat to cache for room ${roomId}`, e);
  }
}

export async function refreshPollsCache(roomId: string) {
  try {
    const isLoaded = await redis.exists(`room:${roomId}:history:loaded`);
    if (!isLoaded) return;
    
    const pollHistory = await db.meetingPoll.findMany({
      where: { roomId, isActive: true },
      orderBy: { createdAt: 'asc' }
    });
    await redis.set(`room:${roomId}:polls`, JSON.stringify(pollHistory), 'EX', TTL);
  } catch (e) {
    logger.error(`[HISTORY] Failed to refresh polls cache for room ${roomId}`, e);
  }
}

export async function refreshQaCache(roomId: string) {
  try {
    const isLoaded = await redis.exists(`room:${roomId}:history:loaded`);
    if (!isLoaded) return;
    
    const qaHistory = await db.meetingQA.findMany({
      where: { roomId },
      orderBy: { upvotes: 'desc' }
    });
    await redis.set(`room:${roomId}:qa`, JSON.stringify(qaHistory), 'EX', TTL);
  } catch (e) {
    logger.error(`[HISTORY] Failed to refresh QA cache for room ${roomId}`, e);
  }
}

export async function refreshNoteCache(roomId: string, content: string) {
  try {
    const isLoaded = await redis.exists(`room:${roomId}:history:loaded`);
    if (!isLoaded) return;
    
    await redis.set(`room:${roomId}:note`, JSON.stringify(content), 'EX', TTL);
  } catch (e) {
    logger.error(`[HISTORY] Failed to refresh note cache for room ${roomId}`, e);
  }
}
