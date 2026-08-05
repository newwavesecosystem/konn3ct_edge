import 'dotenv/config';
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();
import { initializeWorkers } from './media/sfu';
import { logger } from './logger';
import { redis, duplicateRedis } from './redis';
import { localMediaController } from './services/LocalMediaController';

const MEDIA_POD_ID = process.env.POD_ID || 'media-' + uuidv4();

async function startMediaServer() {
  logger.info(`Starting Media Server Pod: ${MEDIA_POD_ID}`);

  // 1. Boot Mediasoup
  await initializeWorkers();
  
  // 2. Start Heartbeat (so signaling pods know we exist and our load)
  setInterval(async () => {
    const load = process.cpuUsage(); // Simplified load metric
    await redis.setex(`media:node:${MEDIA_POD_ID}:heartbeat`, 10, JSON.stringify({
      cpu: load.user / 1000000,
      timestamp: Date.now()
    }));
  }, 5000);

  // 3. Listen for RPC Requests
  const rpcSubscriber = duplicateRedis(redis);
  await rpcSubscriber.subscribe(`media:rpc:request:${MEDIA_POD_ID}`);

  rpcSubscriber.on('message', async (channel: string, message: string) => {
    try {
      const req = JSON.parse(message);
      const { requestId, method, args } = req;
      
      let result;
      let error = null;

      try {
        // @ts-ignore
        if (typeof localMediaController[method] === 'function') {
          // @ts-ignore
          result = await localMediaController[method](...args);
        } else {
          throw new Error(`Method ${method} not found on media controller`);
        }
      } catch (err: any) {
        error = err.message || 'RPC Failed';
      }

      // Publish response back to the specific request channel
      await redis.publish(`media:rpc:response:${requestId}`, JSON.stringify({
        requestId,
        result,
        error
      }));

    } catch (err) {
      logger.error('Failed to process media RPC message', err);
    }
  });

  // 4. Relay Events (Producer Close, Active Speaker) back to Signaling
  localMediaController.on('producerClose', (data) => {
    redis.publish(`media:events:producerClose`, JSON.stringify({ podId: MEDIA_POD_ID, ...data }));
  });
  
  localMediaController.on('activeSpeaker', (data) => {
    redis.publish(`media:events:activeSpeaker`, JSON.stringify({ podId: MEDIA_POD_ID, ...data }));
  });

  logger.info(`Media Server ${MEDIA_POD_ID} listening for RPC...`);
}

startMediaServer().catch(err => {
  logger.error('Fatal error starting media server', err);
  process.exit(1);
});
