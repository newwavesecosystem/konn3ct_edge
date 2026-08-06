import { redis } from '../redis';
import { logger } from '../logger';
import { RouterKey } from '../types/topology';
import { PipePairMetadata, PipedProducerMetadata, PipeTransportResult } from '../types/pipeTransport';

export class PipeTransportRegistry {
  private static keyPipeSet(roomId: string): string {
    return `room:${roomId}:pipeTransports`;
  }
  private static keyPipePair(roomId: string, primaryKey: RouterKey, relayKey: RouterKey): string {
    return `room:${roomId}:pipe:${primaryKey}:${relayKey}`;
  }
  private static keyPipedProducerMap(roomId: string): string {
    return `room:${roomId}:pipedProducers`;
  }
  private static pipedProducerField(originalProducerId: string, relayRouterKey: RouterKey): string {
    return `${originalProducerId}:${relayRouterKey}`;
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
        primaryPipeTransportId: data.primaryPipeTransportId,
        relayPipeTransportId: data.relayPipeTransportId,
        connected: data.connected === 'true',
        pipedProducerIds: data.pipedProducerIds ? JSON.parse(data.pipedProducerIds) : [],
        createdAt: parseInt(data.createdAt || '0', 10),
        updatedAt: parseInt(data.updatedAt || '0', 10),
      };
    } catch (err) {
      logger.error(`Failed to fetch PipeTransport pair for room ${roomId}`, err);
      return null;
    }
  }

  /**
   * Registers a new PipeTransport pair in Redis idempotently.
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
      if (existing) {
        logger.info(JSON.stringify({
          event: 'pipe_transport_pair_reused',
          roomId,
          primaryRouterKey,
          relayRouterKey,
          pipePairId: existing.pipePairId,
        }));
        return { success: true, pipePairId: existing.pipePairId, data: existing };
      }

      const pairKey = this.keyPipePair(roomId, primaryRouterKey, relayRouterKey);
      const multi = redis.multi();

      multi.sadd(this.keyPipeSet(roomId), pairKey);
      multi.hset(pairKey, {
        pipePairId: meta.pipePairId,
        roomId: meta.roomId,
        primaryRouterKey: meta.primaryRouterKey,
        relayRouterKey: meta.relayRouterKey,
        primaryPipeTransportId: meta.primaryPipeTransportId,
        relayPipeTransportId: meta.relayPipeTransportId,
        connected: meta.connected ? 'true' : 'false',
        pipedProducerIds: JSON.stringify(meta.pipedProducerIds || []),
        createdAt: meta.createdAt.toString(),
        updatedAt: meta.updatedAt.toString(),
      });

      await multi.exec();

      logger.info(JSON.stringify({
        event: 'pipe_transport_pair_created',
        roomId,
        primaryRouterKey,
        relayRouterKey,
        pipePairId: meta.pipePairId,
      }));

      return { success: true, pipePairId: meta.pipePairId, data: meta };
    } catch (err) {
      logger.error(`Failed to register PipeTransport pair for room ${roomId}`, err);
      return { success: false, error: 'Redis failure' };
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
            primaryPipeTransportId: data.primaryPipeTransportId,
            relayPipeTransportId: data.relayPipeTransportId,
            connected: data.connected === 'true',
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
