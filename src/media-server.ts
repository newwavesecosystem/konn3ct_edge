import 'dotenv/config';
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();
import { initializeWorkers } from './media/sfu';
import { logger } from './logger';
import { redis, duplicateRedis } from './redis';
import { localMediaController } from './services/LocalMediaController';
import { transcriberEvents } from './media/transcriber';

const MEDIA_POD_ID = process.env.POD_ID || 'media-' + uuidv4();

async function startMediaServer() {
  logger.info(`Starting Media Server Pod: ${MEDIA_POD_ID}`);

  // 1. In production (Kubernetes), dynamically fetch the true public IP for WebRTC routing
  if (process.env.NODE_ENV === 'production') {
    const http = require('http');
    const https = require('https');
    const { config } = require('./media/config');
    
    const fetchDO = () => new Promise<string>((resolve, reject) => {
      const req = http.get('http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address', { timeout: 2000 }, (res: any) => {
        if (res.statusCode !== 200) return reject(new Error('DO Metadata not found'));
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => resolve(data.trim()));
      });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('timeout')));
    });

    const fetchIpify = () => new Promise<string>((resolve, reject) => {
      const req = https.get('https://api.ipify.org', { timeout: 3000 }, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => resolve(data.trim()));
      });
      req.on('error', reject);
      req.on('timeout', () => req.destroy(new Error('timeout')));
    });

    let publicIp = process.env.WEBRTC_ANNOUNCED_IP || '127.0.0.1';
    const isPrivateOrLoopback = (ip: string) => 
      !ip || ip === '127.0.0.1' || ip === '0.0.0.0' || ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip);

    if (isPrivateOrLoopback(publicIp)) {
      try {
        publicIp = await fetchIpify();
        logger.info(`Detected Public IP via ipify: ${publicIp}`);
      } catch (err) {
        logger.warn('ipify failed, falling back to DO Metadata...');
        try {
          publicIp = await fetchDO();
          logger.info(`Detected Public IP via DO Metadata: ${publicIp}`);
        } catch (err2) {
          logger.error('Failed to fetch public IP for WebRTC', err2);
        }
      }
    }
    config.mediasoup.webRtcTransport.listenIps[0].announcedIp = publicIp;
  }

  // 2. Boot Mediasoup
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

  transcriberEvents.on('caption', (data) => {
    redis.publish(`media:events:caption`, JSON.stringify({ podId: MEDIA_POD_ID, ...data }));
  });

  logger.info(`Media Server ${MEDIA_POD_ID} listening for RPC...`);
}

startMediaServer().catch(err => {
  logger.error('Fatal error starting media server', err);
  process.exit(1);
});
