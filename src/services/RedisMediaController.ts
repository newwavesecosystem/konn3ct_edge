import { EventEmitter } from 'events';
import crypto from 'crypto';
const uuidv4 = () => crypto.randomUUID();
import { MediaControllerInterface, RtpCapabilities, RtpParameters, DtlsParameters } from '../interfaces/MediaControllerInterface';
import { redis, duplicateRedis } from '../redis';
import { logger } from '../logger';

export class RedisMediaController extends EventEmitter implements MediaControllerInterface {
  private responseWaiters = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void, timeout: NodeJS.Timeout }>();

  constructor() {
    super();
    this.initSubscriber();
  }

  private async initSubscriber() {
    const sub = duplicateRedis(redis);
    await sub.subscribe('media:events:producerClose', 'media:events:activeSpeaker');
    await sub.psubscribe('media:rpc:response:*');

    sub.on('pmessage', (pattern: string, channel: string, message: string) => {
      if (channel.startsWith('media:rpc:response:')) {
        try {
          const res = JSON.parse(message);
          const waiter = this.responseWaiters.get(res.requestId);
          if (waiter) {
            clearTimeout(waiter.timeout);
            this.responseWaiters.delete(res.requestId);
            if (res.error) waiter.reject(new Error(res.error));
            else waiter.resolve(res.result);
          }
        } catch (e) {
          logger.error('Failed to parse RPC response', e);
        }
      }
    });

    sub.on('message', (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        if (channel === 'media:events:producerClose') {
          this.emit('producerClose', data);
        } else if (channel === 'media:events:activeSpeaker') {
          this.emit('activeSpeaker', data);
        }
      } catch (e) {
        logger.error('Failed to parse media event', e);
      }
    });
  }

  private async getRoomMediaPod(roomId: string): Promise<string> {
    let podId = await redis.get(`room:${roomId}:mediaPodId`);
    if (podId) return podId;

    // Pick a random active media pod
    const keys = await redis.keys('media:node:*:heartbeat');
    if (keys.length === 0) {
      logger.warn('No active Media Pods found! Falling back to local/default routing for now.');
      return 'media-default';
    }
    
    // Quick random selection
    podId = keys[Math.floor(Math.random() * keys.length)].split(':')[2];
    
    // SetNX to prevent race conditions
    const set = await redis.setnx(`room:${roomId}:mediaPodId`, podId);
    if (!set) {
        return await redis.get(`room:${roomId}:mediaPodId`) as string;
    }
    return podId;
  }

  private async rpcCall(method: string, args: any[], roomId?: string): Promise<any> {
    if (process.env.NODE_ENV === 'test') {
      const { localMediaController } = await import('./LocalMediaController');
      // @ts-ignore
      if (typeof localMediaController[method] === 'function') {
        // @ts-ignore
        return localMediaController[method](...args);
      }
    }
    
    const requestId = uuidv4();
    let podId = 'media-default';
    if (roomId) {
      podId = await this.getRoomMediaPod(roomId);
    } else {
      // If no roomId is provided (e.g., some closeProducer calls), we might have to broadcast
      // or we must update all callers to pass roomId.
      logger.warn(`RPC call ${method} lacks roomId! Routing might fail if multiple media pods exist.`);
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseWaiters.delete(requestId);
        reject(new Error(`RPC Timeout for ${method}`));
      }, 5000);

      this.responseWaiters.set(requestId, { resolve, reject, timeout });

      redis.publish(`media:rpc:request:${podId}`, JSON.stringify({
        requestId,
        method,
        args
      })).catch((err: any) => {
        clearTimeout(timeout);
        this.responseWaiters.delete(requestId);
        reject(err);
      });
    });
  }

  // --- Routers ---
  async getOrCreateRouter(roomId: string): Promise<{ id: string, rtpCapabilities: RtpCapabilities }> {
    return this.rpcCall('getOrCreateRouter', [roomId], roomId);
  }
  async canConsume(roomId: string, producerId: string, rtpCapabilities: any): Promise<boolean> {
    return this.rpcCall('canConsume', [roomId, producerId, rtpCapabilities], roomId);
  }
  async closeRouter(roomId: string): Promise<void> {
    return this.rpcCall('closeRouter', [roomId], roomId);
  }
  
  // --- Transports ---
  async createWebRtcTransport(roomId: string): Promise<{ id: string; iceParameters: any; iceCandidates: any[]; dtlsParameters: DtlsParameters; }> {
    return this.rpcCall('createWebRtcTransport', [roomId], roomId);
  }
  async connectTransport(transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    // Note: We don't have roomId here! We might need to map transportId -> roomId in Redis, 
    // or update the caller to pass roomId. For now we just broadcast or rely on single media pod.
    return this.rpcCall('connectTransport', [transportId, dtlsParameters]);
  }
  async closeTransport(transportId: string): Promise<void> {
    return this.rpcCall('closeTransport', [transportId]);
  }
  async restartIce(transportId: string): Promise<{ iceParameters: any }> {
    return this.rpcCall('restartIce', [transportId]);
  }

  // --- Producers ---
  async createProducer(transportId: string, kind: 'audio' | 'video', rtpParameters: RtpParameters, roomId?: string, userId?: string, userName?: string, clientData?: { isBot?: boolean, role?: string }): Promise<{ id: string }> {
    return this.rpcCall('createProducer', [transportId, kind, rtpParameters, roomId, userId, userName, clientData], roomId);
  }
  async closeProducer(producerId: string): Promise<void> {
    return this.rpcCall('closeProducer', [producerId]);
  }
  async getProducer(producerId: string): Promise<{ id: string, kind: string, appData: any, userId?: string, rtpParameters?: any } | null> {
    return this.rpcCall('getProducer', [producerId]);
  }

  // --- Consumers ---
  async createConsumer(transportId: string, producerId: string, rtpCapabilities: RtpCapabilities, roomId: string): Promise<{ id: string; producerId: string; kind: string; rtpParameters: RtpParameters; appData?: any; }> {
    return this.rpcCall('createConsumer', [transportId, producerId, rtpCapabilities, roomId], roomId);
  }
  async resumeConsumer(consumerId: string): Promise<void> {
    return this.rpcCall('resumeConsumer', [consumerId]);
  }
  async pauseConsumer(consumerId: string): Promise<void> {
    return this.rpcCall('pauseConsumer', [consumerId]);
  }
  async requestConsumerKeyFrame(consumerId: string): Promise<void> {
    return this.rpcCall('requestConsumerKeyFrame', [consumerId]);
  }

  // --- Features ---
  async setupAudioObserver(roomId: string): Promise<void> {
    return this.rpcCall('setupAudioObserver', [roomId], roomId);
  }
  async cleanupAudioObserver(roomId: string): Promise<void> {
    return this.rpcCall('cleanupAudioObserver', [roomId], roomId);
  }
  async handleTranscriptionMute(producerId: string, roomId: string, userId: string, userName: string, isMuted: boolean, clientData?: { isBot?: boolean, role?: string }): Promise<void> {
    return this.rpcCall('handleTranscriptionMute', [producerId, roomId, userId, userName, isMuted, clientData], roomId);
  }
}

export const redisMediaController = new RedisMediaController();
