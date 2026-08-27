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
    await sub.subscribe('media:events:producerClose', 'media:events:activeSpeaker', 'media:events:caption');
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
        } else if (channel === 'media:events:caption') {
          this.emit('caption', data);
        }
      } catch (e) {
        logger.error('Failed to parse media event', e);
      }
    });
  }

  private async getRoomMediaPod(roomId: string): Promise<string> {
    let podId = await redis.get(`room:${roomId}:mediaPodId`);
    if (podId) {
      const alive = await redis.exists(`media:node:${podId}:heartbeat`);
      if (alive) {
        return podId;
      }
      logger.warn(`Media Pod ${podId} for room ${roomId} is no longer alive. Re-assigning room to an active Media Pod.`);
      await redis.del(`room:${roomId}:mediaPodId`);
    }

    const keys = await redis.keys('media:node:*:heartbeat');
    if (keys.length === 0) {
      logger.warn('No active Media Pods found! Falling back to local/default routing for now.');
      return 'media-default';
    }
    
    const chosenKey = keys[Math.floor(Math.random() * keys.length)];
    podId = chosenKey.replace('media:node:', '').replace(':heartbeat', '');
    
    const set = await redis.setnx(`room:${roomId}:mediaPodId`, podId);
    if (!set) {
        return (await redis.get(`room:${roomId}:mediaPodId`)) as string;
    }
    return podId;
  }

  /**
   * Directly sends an RPC call targeting a specific Media Pod ID.
   */
  public async rpcCallToPod(targetPodId: string, method: string, args: any[], timeoutMs = 5000): Promise<any> {
    const requestId = uuidv4();

    logger.info(JSON.stringify({
      event: 'pipe_transport_rpc_target_selected',
      targetPodId,
      method,
      requestId,
    }));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responseWaiters.delete(requestId);
        reject(new Error(`RPC Timeout for ${method} to pod ${targetPodId}`));
      }, timeoutMs);

      this.responseWaiters.set(requestId, { resolve, reject, timeout });

      redis.publish(`media:rpc:request:${targetPodId}`, JSON.stringify({
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
      const keys = await redis.keys('media:node:*:heartbeat');
      if (keys.length > 0) {
        podId = keys[0].replace('media:node:', '').replace(':heartbeat', '');
        logger.warn(`RPC call ${method} lacks roomId! Dynamically routed to active media pod: ${podId}`);
      } else {
        logger.warn(`RPC call ${method} lacks roomId and no active media pods found! Using default queue.`);
      }
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        this.responseWaiters.delete(requestId);
        if (roomId) {
          redis.del(`room:${roomId}:mediaPodId`).catch(e => logger.warn('Failed to clear stale mediaPodId on RPC timeout', e));
        }
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
  async connectTransport(transportId: string, dtlsParameters: DtlsParameters, roomId?: string): Promise<void> {
    return this.rpcCall('connectTransport', [transportId, dtlsParameters], roomId);
  }
  async closeTransport(transportId: string, roomId?: string): Promise<void> {
    return this.rpcCall('closeTransport', [transportId], roomId);
  }
  async restartIce(transportId: string, roomId?: string): Promise<{ iceParameters: any }> {
    return this.rpcCall('restartIce', [transportId], roomId);
  }

  // --- Producers ---
  async createProducer(transportId: string, kind: 'audio' | 'video', rtpParameters: RtpParameters, roomId?: string, userId?: string, userName?: string, clientData?: { isBot?: boolean, role?: string }, appData?: any, paused?: boolean): Promise<{ id: string }> {
    return this.rpcCall('createProducer', [transportId, kind, rtpParameters, roomId, userId, userName, clientData, appData, paused], roomId);
  }
  async closeProducer(producerId: string, roomId?: string): Promise<void> {
    return this.rpcCall('closeProducer', [producerId], roomId);
  }
  async getProducer(producerId: string, roomId?: string): Promise<{ id: string, kind: string, appData: any, userId?: string, rtpParameters?: any } | null> {
    return this.rpcCall('getProducer', [producerId], roomId);
  }

  // --- Consumers ---
  async createConsumer(transportId: string, producerId: string, rtpCapabilities: RtpCapabilities, roomId: string): Promise<{ id: string; producerId: string; kind: string; rtpParameters: RtpParameters; appData?: any; }> {
    return this.rpcCall('createConsumer', [transportId, producerId, rtpCapabilities, roomId], roomId);
  }
  async resumeConsumer(consumerId: string, roomId?: string): Promise<void> {
    return this.rpcCall('resumeConsumer', [consumerId], roomId);
  }
  async pauseConsumer(consumerId: string, roomId?: string): Promise<void> {
    return this.rpcCall('pauseConsumer', [consumerId], roomId);
  }
  async requestConsumerKeyFrame(consumerId: string, roomId?: string): Promise<void> {
    return this.rpcCall('requestConsumerKeyFrame', [consumerId], roomId);
  }
  async setConsumerPreferredLayersAndPriority(consumerId: string, spatialLayer?: number, temporalLayer?: number, priority?: number, roomId?: string): Promise<void> {
    return this.rpcCall('setConsumerPreferredLayersAndPriority', [consumerId, spatialLayer, temporalLayer, priority], roomId);
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
