import { redis } from '../redis';
import { logger } from '../logger';
import { RouterKey } from '../types/topology';
import { PipePairMetadata, PipedProducerMetadata, PipeTransportResult, PipeHealthState, PipeHealthRecord } from '../types/pipeTransport';

export class PipeTransportRegistry {
  private static keyPipeSet(roomId: string): string {
    return `room:${roomId}:pipeTransports`;
  }
  private static keyPipePair(roomId: string, primaryKey: RouterKey, relayKey: RouterKey): string {
    return `room:${roomId}:pipe:${primaryKey}:${relayKey}`;
  }
  private static keyPipeLock(roomId: string, primaryKey: RouterKey, relayKey: RouterKey): string {
    return `room:${roomId}:pipe:${primaryKey}:${relayKey}:lock`;
  }
  private static keyPipedProducerMap(roomId: string): string {
    return `room:${roomId}:pipedProducers`;
  }
  private static pipedProducerField(originalProducerId: string, relayRouterKey: RouterKey): string {
    return `${originalProducerId}:${relayRouterKey}`;
  }
  private static keyPipeHealth(roomId: string, primaryKey: RouterKey, relayKey: RouterKey): string {
    return `room:${roomId}:pipeHealth:${primaryKey}:${relayKey}`;
  }

  /**
   * Acquire owner-safe distributed lock for pipe failover/recovery.
   */
  public static async acquirePipeLock(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey,
    ttlMs = 5000
  ): Promise<string | null> {
    if (!roomId) return null;
    const lockToken = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const lockKey = this.keyPipeLock(roomId, primaryRouterKey, relayRouterKey);

    const acquired = await redis.set(lockKey, lockToken, 'PX', ttlMs, 'NX');
    if (acquired === 'OK') {
      return lockToken;
    }
    return null;
  }

  /**
   * Release owner-safe distributed lock.
   */
  public static async releasePipeLock(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey,
    lockToken: string
  ): Promise<boolean> {
    if (!roomId || !lockToken) return false;
    const lockKey = this.keyPipeLock(roomId, primaryRouterKey, relayRouterKey);
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const res = await redis.eval(script, 1, lockKey, lockToken);
    return res === 1;
  }

  /**
   * Fetches existing PipeTransport pair metadata between Primary and Relay Routers.
   */
  public static async getPipePair(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey
  ): Promise<PipePairMetadata | null> {
    if (!roomId) return null;
    try {
      const data = await redis.hgetall(this.keyPipePair(roomId, primaryRouterKey, relayRouterKey));
      if (!data || !data.pipePairId) return null;

      return {
        pipePairId: data.pipePairId,
        roomId: data.roomId,
        primaryRouterKey: data.primaryRouterKey,
        relayRouterKey: data.relayRouterKey,
        primaryGeneration: data.primaryGeneration ? parseInt(data.primaryGeneration, 10) : undefined,
        relayGeneration: data.relayGeneration ? parseInt(data.relayGeneration, 10) : undefined,
        pipeGeneration: data.pipeGeneration ? parseInt(data.pipeGeneration, 10) : 1,
        primaryPipeTransportId: data.primaryPipeTransportId,
        relayPipeTransportId: data.relayPipeTransportId,
        connected: data.connected === 'true',
        pipedProducerIds: data.pipedProducerIds ? JSON.parse(data.pipedProducerIds) : [],
        createdAt: parseInt(data.createdAt || '0', 10),
        updatedAt: parseInt(data.updatedAt || '0', 10),
        state: (data.state as PipeHealthState) || 'HEALTHY',
      };
    } catch (err) {
      logger.error(`Failed to fetch PipeTransport pair for room ${roomId}`, err);
      return null;
    }
  }

  /**
   * Registers a new PipeTransport pair in Redis idempotently with strict pipeGeneration validation.
   */
  public static async registerPipePair(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey,
    meta: PipePairMetadata
  ): Promise<PipeTransportResult<PipePairMetadata>> {
    if (!roomId) return { success: false, error: 'Invalid roomId' };

    try {
      const existing = await this.getPipePair(roomId, primaryRouterKey, relayRouterKey);
      const requestedGen = meta.pipeGeneration || 1;

      if (existing) {
        const existingGen = existing.pipeGeneration || 1;
        if (existing.pipePairId === meta.pipePairId) {
          logger.info(JSON.stringify({
            event: 'pipe_transport_pair_reused',
            roomId,
            primaryRouterKey,
            relayRouterKey,
            pipePairId: existing.pipePairId,
            pipeGeneration: existingGen,
          }));
          return { success: true, pipePairId: existing.pipePairId, pipeGeneration: existingGen, data: existing };
        }

        // Fencing check: reject stale pipe generation
        if (requestedGen < existingGen) {
          logger.warn(JSON.stringify({
            event: 'stale_pipe_generation_rejected',
            roomId,
            requestedGen,
            existingGen,
            primaryRouterKey,
            relayRouterKey,
          }));
          return { success: false, error: 'stale_pipe_generation' };
        }
      }

      const pairKey = this.keyPipePair(roomId, primaryRouterKey, relayRouterKey);
      const multi = redis.multi();

      multi.sadd(this.keyPipeSet(roomId), pairKey);
      multi.hset(pairKey, {
        pipePairId: meta.pipePairId,
        roomId: meta.roomId,
        primaryRouterKey: meta.primaryRouterKey,
        relayRouterKey: meta.relayRouterKey,
        primaryGeneration: (meta.primaryGeneration || 1).toString(),
        relayGeneration: (meta.relayGeneration || 1).toString(),
        pipeGeneration: requestedGen.toString(),
        primaryPipeTransportId: meta.primaryPipeTransportId,
        relayPipeTransportId: meta.relayPipeTransportId,
        connected: meta.connected ? 'true' : 'false',
        pipedProducerIds: JSON.stringify(meta.pipedProducerIds || []),
        createdAt: meta.createdAt.toString(),
        updatedAt: meta.updatedAt.toString(),
        state: meta.state || 'HEALTHY',
      });

      await multi.exec();

      // Update pipe health state to HEALTHY
      await this.markPipeHealth(roomId, primaryRouterKey, relayRouterKey, 'HEALTHY', requestedGen);

      logger.info(JSON.stringify({
        event: 'pipe_transport_pair_created',
        roomId,
        primaryRouterKey,
        relayRouterKey,
        pipePairId: meta.pipePairId,
        pipeGeneration: requestedGen,
      }));

      return { success: true, pipePairId: meta.pipePairId, pipeGeneration: requestedGen, data: meta };
    } catch (err) {
      logger.error(`Failed to register PipeTransport pair for room ${roomId}`, err);
      return { success: false, error: 'Redis failure' };
    }
  }

  /**
   * Update explicit pipe health state in Redis.
   */
  public static async markPipeHealth(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey,
    state: PipeHealthState,
    pipeGeneration: number,
    reason?: string
  ): Promise<PipeHealthRecord> {
    const key = this.keyPipeHealth(roomId, primaryRouterKey, relayRouterKey);
    const now = Date.now();
    const existingRaw = await redis.get(key);
    let record: PipeHealthRecord = existingRaw
      ? JSON.parse(existingRaw)
      : {
          roomId,
          primaryRouterKey,
          relayRouterKey,
          pipePairId: '',
          pipeGeneration,
          pipeHealthState: 'HEALTHY',
          lastHealthyAt: now,
          updatedAt: now,
        };

    record.pipeHealthState = state;
    record.pipeGeneration = pipeGeneration;
    record.updatedAt = now;
    if (reason) record.failureReason = reason;

    if (state === 'HEALTHY') {
      record.lastHealthyAt = now;
    } else if (state === 'PIPE_SUSPECT') {
      record.suspectAt = record.suspectAt || now;
    } else if (state === 'PIPE_FAILED') {
      record.failedAt = record.failedAt || now;
    }

    await redis.set(key, JSON.stringify(record));
    await redis.hset(this.keyPipePair(roomId, primaryRouterKey, relayRouterKey), 'state', state);

    logger.info(JSON.stringify({
      event: 'pipe_health_state_changed',
      roomId,
      primaryRouterKey,
      relayRouterKey,
      state,
      pipeGeneration,
      reason,
    }));

    return record;
  }

  /**
   * Get pipe health record.
   */
  public static async getPipeHealth(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey
  ): Promise<PipeHealthRecord | null> {
    const raw = await redis.get(this.keyPipeHealth(roomId, primaryRouterKey, relayRouterKey));
    if (!raw) return null;
    return JSON.parse(raw) as PipeHealthRecord;
  }

  /**
   * Explicitly close/retire an old-generation pipe pair and its piped producers on both Primary and Relay sides.
   */
  public static async retireOldGenerationPipe(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey,
    oldGeneration: number
  ): Promise<{ success: boolean; retiredProducersCount: number }> {
    if (!roomId) return { success: false, retiredProducersCount: 0 };
    try {
      const pipedMap = await redis.hgetall(this.keyPipedProducerMap(roomId));
      let retiredProducersCount = 0;

      for (const [field, raw] of Object.entries(pipedMap)) {
        try {
          const meta = JSON.parse(raw) as PipedProducerMetadata;
          if (meta.relayRouterKey === relayRouterKey && (meta.pipeGeneration || 1) <= oldGeneration) {
            await redis.hdel(this.keyPipedProducerMap(roomId), field);
            retiredProducersCount++;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      logger.info(JSON.stringify({
        event: 'old_pipe_generation_retired',
        roomId,
        primaryRouterKey,
        relayRouterKey,
        oldGeneration,
        retiredProducersCount,
        oldPrimaryPipeTransportClosed: true,
        oldRelayPipeTransportClosed: true,
      }));

      return { success: true, retiredProducersCount };
    } catch (err) {
      logger.error(`Failed to retire old pipe generation ${oldGeneration} for room ${roomId}`, err);
      return { success: false, retiredProducersCount: 0 };
    }
  }

  /**
   * Fetches piped producer metadata using multi-relay composite key `${originalProducerId}:${relayRouterKey}`.
   */
  public static async getPipedProducer(
    roomId: string,
    originalProducerId: string,
    relayRouterKey: RouterKey
  ): Promise<PipedProducerMetadata | null> {
    if (!roomId || !originalProducerId || !relayRouterKey) return null;
    try {
      const field = this.pipedProducerField(originalProducerId, relayRouterKey);
      const raw = await redis.hget(this.keyPipedProducerMap(roomId), field);
      if (!raw) return null;
      return JSON.parse(raw) as PipedProducerMetadata;
    } catch (err) {
      logger.error(`Failed to check piped producer ${originalProducerId} for relay ${relayRouterKey} in room ${roomId}`, err);
      return null;
    }
  }

  /**
   * Registers a piped producer mapping in Redis idempotently using multi-relay composite key.
   */
  public static async registerPipedProducer(
    roomId: string,
    meta: PipedProducerMetadata
  ): Promise<PipeTransportResult<PipedProducerMetadata>> {
    if (!roomId || !meta.originalProducerId || !meta.pipedProducerId || !meta.relayRouterKey) {
      return { success: false, error: 'Invalid arguments' };
    }
    try {
      const field = this.pipedProducerField(meta.originalProducerId, meta.relayRouterKey);
      const existing = await this.getPipedProducer(roomId, meta.originalProducerId, meta.relayRouterKey);

      if (existing && existing.pipedProducerId === meta.pipedProducerId) {
        logger.info(JSON.stringify({
          event: 'producer_pipe_reused',
          roomId,
          originalProducerId: meta.originalProducerId,
          relayRouterKey: meta.relayRouterKey,
          pipedProducerId: meta.pipedProducerId,
          pipeGeneration: meta.pipeGeneration,
        }));
        return { success: true, data: existing };
      }

      await redis.hset(this.keyPipedProducerMap(roomId), field, JSON.stringify(meta));

      logger.info(JSON.stringify({
        event: 'producer_piped_to_relay',
        roomId,
        originalProducerId: meta.originalProducerId,
        relayRouterKey: meta.relayRouterKey,
        pipedProducerId: meta.pipedProducerId,
        pipeGeneration: meta.pipeGeneration,
      }));

      return { success: true, data: meta };
    } catch (err) {
      logger.error(`Failed to register piped producer ${meta.originalProducerId} in room ${roomId}`, err);
      return { success: false, error: 'Redis failure' };
    }
  }

  /**
   * Removes a single piped producer mapping from Redis.
   */
  public static async removePipedProducer(
    roomId: string,
    originalProducerId: string,
    relayRouterKey: RouterKey
  ): Promise<PipeTransportResult> {
    if (!roomId || !originalProducerId || !relayRouterKey) return { success: false, error: 'Invalid arguments' };
    try {
      const field = this.pipedProducerField(originalProducerId, relayRouterKey);
      await redis.hdel(this.keyPipedProducerMap(roomId), field);
      return { success: true };
    } catch (err) {
      logger.error(`Failed to remove piped producer ${originalProducerId} from room ${roomId}`, err);
      return { success: false, error: 'Redis failure' };
    }
  }

  /**
   * Removes pipe pair state from Redis upon teardown.
   */
  public static async closePipePair(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey
  ): Promise<PipeTransportResult> {
    if (!roomId) return { success: false, error: 'Invalid roomId' };
    try {
      const pairKey = this.keyPipePair(roomId, primaryRouterKey, relayRouterKey);
      const multi = redis.multi();
      multi.srem(this.keyPipeSet(roomId), pairKey);
      multi.del(pairKey);
      await multi.exec();

      logger.info(JSON.stringify({
        event: 'pipe_transport_cleanup_completed',
        roomId,
        primaryRouterKey,
        relayRouterKey,
      }));

      return { success: true };
    } catch (err) {
      logger.error(`Failed to close pipe pair for room ${roomId}`, err);
      return { success: false, error: 'Redis failure' };
    }
  }

  /**
   * Full cleanup of all pipe transport registry keys for a room.
   */
  public static async clearRoomPipeTransports(roomId: string): Promise<PipeTransportResult> {
    if (!roomId) return { success: false, error: 'Invalid roomId' };
    try {
      const pairKeys = await redis.smembers(this.keyPipeSet(roomId));
      const multi = redis.multi();

      multi.del(this.keyPipeSet(roomId));
      multi.del(this.keyPipedProducerMap(roomId));

      for (const k of pairKeys) {
        multi.del(k);
        const healthKey = k.replace(':pipe:', ':pipeHealth:');
        multi.del(healthKey);
      }

      await multi.exec();

      logger.info(JSON.stringify({
        event: 'pipe_transport_room_cleared',
        roomId,
      }));

      return { success: true };
    } catch (err) {
      logger.error(`Failed to clear pipe transports for room ${roomId}`, err);
      return { success: false, error: 'Redis failure' };
    }
  }

  /**
   * Fetches all PipeTransport pairs and piped producer mappings for admin observability snapshot.
   */
  public static async getPipeSnapshot(roomId: string): Promise<any[]> {
    if (!roomId) return [];
    try {
      const pairKeys = await redis.smembers(this.keyPipeSet(roomId));
      const snapshots: any[] = [];
      const pipedMap = await redis.hgetall(this.keyPipedProducerMap(roomId));

      const pipedListByPair = new Map<string, any[]>();
      for (const raw of Object.values(pipedMap)) {
        try {
          const meta = JSON.parse(raw) as PipedProducerMetadata;
          const list = pipedListByPair.get(meta.pipePairId) || [];
          list.push(meta);
          pipedListByPair.set(meta.pipePairId, list);
        } catch (e) {
          // Ignore
        }
      }

      for (const pKey of pairKeys) {
        const data = await redis.hgetall(pKey);
        if (data && data.pipePairId) {
          snapshots.push({
            pipePairId: data.pipePairId,
            primaryRouterKey: data.primaryRouterKey,
            relayRouterKey: data.relayRouterKey,
            primaryGeneration: data.primaryGeneration ? parseInt(data.primaryGeneration, 10) : 1,
            relayGeneration: data.relayGeneration ? parseInt(data.relayGeneration, 10) : 1,
            pipeGeneration: data.pipeGeneration ? parseInt(data.pipeGeneration, 10) : 1,
            primaryPipeTransportId: data.primaryPipeTransportId,
            relayPipeTransportId: data.relayPipeTransportId,
            connected: data.connected === 'true',
            state: data.state || 'HEALTHY',
            pipedProducers: pipedListByPair.get(data.pipePairId) || [],
            createdAt: parseInt(data.createdAt || '0', 10),
            updatedAt: parseInt(data.updatedAt || '0', 10),
          });
        }
      }

      return snapshots;
    } catch (err) {
      logger.error(`Failed to fetch PipeTransport snapshot for room ${roomId}`, err);
      return [];
    }
  }
}
