import { getOrLoadRoomHistory, appendChatToCache, readRoomHistoryCache, invalidateRoomHistoryCache } from './src/signaling/historyCache';
import { db } from './src/db';
import { redis } from './src/signaling/server';
import crypto from 'crypto';

async function runTests() {
  const roomId = "test_room_" + crypto.randomUUID();
  const roomCreatedDate = new Date();
  
  console.log("=== TEST A: Cold Cache Join Storm ===");
  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(getOrLoadRoomHistory(roomId, roomCreatedDate));
  }
  await Promise.all(promises);
  console.log("Test A Completed. Check logs for only ONE loaded_from_db.");
  
  console.log("\n=== TEST B: Warm Cache Join Storm ===");
  const promisesB = [];
  for (let i = 0; i < 50; i++) {
    promisesB.push(getOrLoadRoomHistory(roomId, roomCreatedDate));
  }
  await Promise.all(promisesB);
  console.log("Test B Completed. Check logs for cache hits and zero db loads.");
  
  console.log("\n=== TEST C: Chat Concurrency ===");
  const chatPromises = [];
  for (let i = 0; i < 100; i++) {
    chatPromises.push(appendChatToCache(roomId, { id: i, text: `Msg ${i}` }));
  }
  await Promise.all(chatPromises);
  const historyC = await readRoomHistoryCache(roomId);
  console.log(`Chat length (should be 50): ${historyC?.chatHistory.length}`);
  console.log(`First message id (should be 50): ${historyC?.chatHistory[0].id}`);
  console.log(`Last message id (should be 99): ${historyC?.chatHistory[49].id}`);
  
  console.log("\n=== TEST E: Corrupt Cache ===");
  await redis.set(`room:${roomId}:polls`, "{ bad json");
  await getOrLoadRoomHistory(roomId, roomCreatedDate);
  console.log("Test E Completed. Check logs for corrupt_reloading and a subsequent loaded_from_db.");
  
  console.log("\nCleaning up...");
  await invalidateRoomHistoryCache(roomId);
  await db.$disconnect();
  redis.disconnect();
  console.log("All tests finished.");
}

runTests().catch(console.error);
