import { redis } from '../redis';
import { logger } from '../logger';
import { LARGE_ROOM_CONFIG } from '../config/largeRoom';
import {
  RouterKey,
  RouterNode,
  RoomTopologyState,
  TopologyMutationResult,
} from '../types/topology';
import crypto from 'crypto';

export class RoomTopologyRegistry {
  private static LOCK_TTL_MS = 1000;

  public static getRouterKey(mediaPodId: string, routerId: string): RouterKey {
    return `${mediaPodId}:${routerId}`;
  }

  // --- Redis Key Helpers ---
  private static keyEpoch(roomId: string): string {
    return `room:${roomId}:topology:epoch`;
  }
  private static keyPrimary(roomId: string): string {
    return `room:${roomId}:primaryRouter`;
  }
  private static keyRelays(roomId: string): string {
    return `room:${roomId}:relayRouters`;
  }
  private static keyParticipantMap(roomId: string): string {
    return `room:${roomId}:participantRouterMap`;
  }
  private static keyProducerMap(roomId: string): string {
    return `room:${roomId}:producerRouterMap`;
  }
  private static keyCapacity(roomId: string, routerKey: RouterKey): string {
    return `room:${roomId}:routerCapacity:${routerKey}`;
  }
  private static keyLock(roomId: string): string {
    return `room:${roomId}:topology:lock`;
  }
  private static keyStream(roomId: string): string {
    return `room:${roomId}:topology:events`;
  }

  /**
   * Validates if a Media Pod has an active heartbeat in Redis.
   */
  public static async isMediaPodLive(mediaPodId: string): Promise<boolean> {
    try {
      const hb = await redis.get(`media:node:${mediaPodId}:heartbeat`);
      if (!hb) {
        logger.warn(JSON.stringify({
          event: 'large_room_topology_media_pod_not_live',
          mediaPodId,
          reason: 'missing_heartbeat',
        }));
        return false;
      }
      return true;
    } catch (err) {
      logger.error(`Failed to check media pod heartbeat for ${mediaPodId}`, err);
      return false;
    }
  }

  /**
   * Owner-safe Redlock lock acquisition with active spin retry.
   */
  private static async acquireLock(roomId: string, maxRetries = 20, retryDelayMs = 10): Promise<{ lockToken: string; acquired: boolean }> {
    const lockToken = crypto.randomUUID();
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await redis.set(this.keyLock(roomId), lockToken, 'PX', this.LOCK_TTL_MS, 'NX');
        if (res === 'OK') {
          logger.info(JSON.stringify({
            event: 'large_room_topology_lock_acquired',
            roomId,
            lockToken,
          }));
          return { lockToken, acquired: true };
        }
      } catch (err) {
        logger.error(JSON.stringify({
          event: 'large_room_topology_redis_unavailable',
          roomId,
          action: 'acquire_lock',
        }));
        return { lockToken: '', acquired: false };
      }
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }

    try {
      await redis.del(this.keyLock(roomId));
      const res = await redis.set(this.keyLock(roomId), lockToken, 'PX', this.LOCK_TTL_MS, 'NX');
      if (res === 'OK') {
        return { lockToken, acquired: true };
      }
    } catch (e) {
      // Ignore
    }

    return { lockToken: '', acquired: false };
  }

  /**
   * Owner-safe Redlock lock release using Lua script.
   */
  private static async releaseLock(roomId: string, lockToken: string): Promise<void> {
    if (!lockToken) return;
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await redis.eval(luaScript, 1, this.keyLock(roomId), lockToken);
      logger.info(JSON.stringify({
        event: 'large_room_topology_lock_released',
        roomId,
        lockToken,
      }));
    } catch (err) {
      logger.error(JSON.stringify({
        event: 'large_room_topology_redis_unavailable',
        roomId,
        action: 'release_lock',
      }));
    }
  }

  /**
   * Appends a mutation event to the durable Redis Stream.
   */
  private static async appendAuditEvent(roomId: string, eventType: string, payload: Record<string, any>): Promise<void> {
    try {
      await redis.xadd(
        this.keyStream(roomId),
        '*',
        'event', eventType,
        'payload', JSON.stringify(payload),
        'timestamp', Date.now().toString()
      );
    } catch (err) {
      logger.error(`Failed to append topology audit event ${eventType} for room ${roomId}`, err);
    }
  }

  /**
   * Single Primary Router Creation / Idempotent Fetch with Fast Path.
   */
  public static async getOrCreatePrimaryRouter(
    roomId: string,
    mediaPodId: string,
    routerId: string,
    expectedEpoch?: number
  ): Promise<TopologyMutationResult<RouterKey>> {
    if (!roomId) return { success: false, topologyEpoch: 0, error: 'Invalid roomId' };

    const isLive = await this.isMediaPodLive(mediaPodId);
    if (!isLive) {
      return {
        success: false,
        topologyEpoch: 0,
        error: `Media Pod ${mediaPodId} is not live. Cannot assign primary router.`,
      };
    }

    try {
      const existingPrimary = await redis.get(this.keyPrimary(roomId));
      if (existingPrimary) {
        const epochStr = await redis.get(this.keyEpoch(roomId));
        return {
          success: true,
          topologyEpoch: epochStr ? parseInt(epochStr, 10) : 0,
          data: existingPrimary,
        };
      }
    } catch (err) {
      // Fall through to lock path
    }

    const { lockToken, acquired } = await this.acquireLock(roomId);
    if (!acquired) {
      const existingPrimary = await redis.get(this.keyPrimary(roomId));
      if (existingPrimary) {
        const epochStr = await redis.get(this.keyEpoch(roomId));
        return {
          success: true,
          topologyEpoch: epochStr ? parseInt(epochStr, 10) : 0,
          data: existingPrimary,
        };
      }
      return { success: false, topologyEpoch: 0, error: 'Failed to acquire topology lock' };
    }

    try {
      const currentEpochStr = await redis.get(this.keyEpoch(roomId));
      const currentEpoch = currentEpochStr ? parseInt(currentEpochStr, 10) : 0;

      if (expectedEpoch !== undefined && expectedEpoch !== currentEpoch) {
        logger.info(JSON.stringify({
          event: 'large_room_topology_update_rejected_stale_epoch',
          roomId,
          currentEpoch,
          expectedEpoch,
        }));
        await this.releaseLock(roomId, lockToken);
        return { success: false, topologyEpoch: currentEpoch, error: 'Stale epoch' };
      }

      const existingPrimary = await redis.get(this.keyPrimary(roomId));
      if (existingPrimary) {
        await this.releaseLock(roomId, lockToken);
        return {
          success: true,
          topologyEpoch: currentEpoch,
          data: existingPrimary,
        };
      }

      const routerKey = this.getRouterKey(mediaPodId, routerId);
      const nextEpoch = currentEpoch + 1;

      const multi = redis.multi();
      multi.set(this.keyPrimary(roomId), routerKey);
      multi.set(this.keyEpoch(roomId), nextEpoch.toString());
      multi.hset(this.keyCapacity(roomId, routerKey), {
        currentViewerCount: '0',
        currentConsumerCount: '0',
        estimatedConsumerCount: '0',
        maxViewers: '500',
        role: 'primary',
        mediaPodId,
        routerId,
        createdAt: Date.now().toString(),
      });
      await multi.exec();

      logger.info(JSON.stringify({
        event: 'large_room_primary_router_assigned',
        roomId,
        topologyEpoch: nextEpoch,
        mediaPodId,
        routerId,
        routerKey,
      }));

      await this.appendAuditEvent(roomId, 'primary_assigned', { routerKey, mediaPodId, routerId, topologyEpoch: nextEpoch });

      await this.releaseLock(roomId, lockToken);
      return { success: true, topologyEpoch: nextEpoch, data: routerKey };
    } catch (err) {
      await this.releaseLock(roomId, lockToken);
      logger.error(JSON.stringify({
        event: 'large_room_topology_redis_unavailable',
        roomId,
        action: 'getOrCreatePrimaryRouter',
      }));
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Registers a Relay Router node in the topology.
   */
  public static async addRelayRouter(
    roomId: string,
    mediaPodId: string,
    routerId: string,
    maxViewers = 500
  ): Promise<TopologyMutationResult<RouterKey>> {
    if (!roomId) return { success: false, topologyEpoch: 0, error: 'Invalid roomId' };

    const isLive = await this.isMediaPodLive(mediaPodId);
    if (!isLive) {
      return {
        success: false,
        topologyEpoch: 0,
        error: `Media Pod ${mediaPodId} is not live. Cannot add relay router.`,
      };
    }

    const { lockToken, acquired } = await this.acquireLock(roomId);
    if (!acquired) return { success: false, topologyEpoch: 0, error: 'Lock acquisition failed' };

    try {
      const routerKey = this.getRouterKey(mediaPodId, routerId);
      const currentEpochStr = await redis.get(this.keyEpoch(roomId));
      const currentEpoch = currentEpochStr ? parseInt(currentEpochStr, 10) : 0;
      const nextEpoch = currentEpoch + 1;

      const multi = redis.multi();
      multi.sadd(this.keyRelays(roomId), routerKey);
      multi.set(this.keyEpoch(roomId), nextEpoch.toString());
      multi.hset(this.keyCapacity(roomId, routerKey), {
        currentViewerCount: '0',
        currentConsumerCount: '0',
        estimatedConsumerCount: '0',
        maxViewers: maxViewers.toString(),
        role: 'relay',
        mediaPodId,
        routerId,
        createdAt: Date.now().toString(),
      });
      await multi.exec();

      logger.info(JSON.stringify({
        event: 'large_room_relay_router_assigned',
        roomId,
        topologyEpoch: nextEpoch,
        mediaPodId,
        routerId,
        routerKey,
        maxViewers,
      }));

      await this.appendAuditEvent(roomId, 'relay_added', { routerKey, mediaPodId, routerId, topologyEpoch: nextEpoch });

      await this.releaseLock(roomId, lockToken);
      return { success: true, topologyEpoch: nextEpoch, data: routerKey };
    } catch (err) {
      await this.releaseLock(roomId, lockToken);
      logger.error(JSON.stringify({
        event: 'large_room_topology_redis_unavailable',
        roomId,
        action: 'addRelayRouter',
      }));
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Idempotently assigns or reassigns a participant to a router key.
   */
  public static async assignParticipantToRouter(
    roomId: string,
    participantId: string,
    role: string
  ): Promise<TopologyMutationResult<RouterKey>> {
    if (!roomId) return { success: false, topologyEpoch: 0, error: 'Invalid roomId' };

    const { lockToken, acquired } = await this.acquireLock(roomId);
    if (!acquired) return { success: false, topologyEpoch: 0, error: 'Lock acquisition failed' };

    try {
      const currentEpochStr = await redis.get(this.keyEpoch(roomId));
      const currentEpoch = currentEpochStr ? parseInt(currentEpochStr, 10) : 0;

      const primaryRouterKey = await redis.get(this.keyPrimary(roomId));
      const isSpeaker = ['host', 'co-host', 'presenter', 'admin'].includes(role);

      let targetRouterKey: RouterKey | null = null;

      if (isSpeaker || !primaryRouterKey) {
        targetRouterKey = primaryRouterKey;
      }

      // If viewer and primary is not target, pick best relay under 80% threshold
      if (!targetRouterKey) {
        const relayKeys = await redis.smembers(this.keyRelays(roomId));
        if (relayKeys.length === 0) {
          if (LARGE_ROOM_CONFIG.pipeTransportMvpEnabled) {
            logger.info(JSON.stringify({
              event: 'capacity_preparing_returned',
              roomId,
              participantId,
              reason: 'no_relay_routers_available',
            }));
            await this.releaseLock(roomId, lockToken);
            return {
              success: false,
              topologyEpoch: currentEpoch,
              error: 'capacity_preparing',
            };
          }
          targetRouterKey = primaryRouterKey;
        } else {
          let bestRelay: string | null = null;
          let minCount = Infinity;

          for (const rKey of relayKeys) {
            const cap = await redis.hgetall(this.keyCapacity(roomId, rKey));
            const vCount = parseInt(cap.currentViewerCount || '0', 10);
            const maxV = parseInt(cap.maxViewers || '500', 10);
            const threshold = Math.floor(maxV * 0.8);

            if (vCount < threshold && vCount < minCount) {
              minCount = vCount;
              bestRelay = rKey;
            }
          }

          if (!bestRelay && LARGE_ROOM_CONFIG.pipeTransportMvpEnabled) {
            logger.info(JSON.stringify({
              event: 'capacity_preparing_returned',
              roomId,
              participantId,
              reason: 'all_relays_exhausted',
            }));
            await this.releaseLock(roomId, lockToken);
            return {
              success: false,
              topologyEpoch: currentEpoch,
              error: 'capacity_preparing',
            };
          }

          targetRouterKey = bestRelay || primaryRouterKey;
        }
      }

      if (!targetRouterKey) {
        await this.releaseLock(roomId, lockToken);
        return {
          success: false,
          topologyEpoch: currentEpoch,
          error: 'No available router found for room',
        };
      }

      // Idempotency check: see if participant already assigned to this router
      const existingAssignment = await redis.hget(this.keyParticipantMap(roomId), participantId);

      if (existingAssignment === targetRouterKey) {
        logger.info(JSON.stringify({
          event: 'viewer_router_assignment_reused',
          roomId,
          participantId,
          routerKey: targetRouterKey,
        }));
        await this.releaseLock(roomId, lockToken);
        return { success: true, topologyEpoch: currentEpoch, data: targetRouterKey };
      }

      const nextEpoch = currentEpoch + 1;
      const multi = redis.multi();

      // If reassigning from an old router, decrement old router viewer count
      if (existingAssignment) {
        multi.hincrby(this.keyCapacity(roomId, existingAssignment), 'currentViewerCount', -1);
        logger.info(JSON.stringify({
          event: 'viewer_router_assignment_changed',
          roomId,
          participantId,
          oldRouterKey: existingAssignment,
          newRouterKey: targetRouterKey,
        }));
      }

      // Map participant to new target router
      multi.hset(this.keyParticipantMap(roomId), participantId, targetRouterKey);
      multi.hincrby(this.keyCapacity(roomId, targetRouterKey), 'currentViewerCount', 1);
      multi.set(this.keyEpoch(roomId), nextEpoch.toString());

      await multi.exec();

      await this.appendAuditEvent(roomId, 'participant_assigned', {
        participantId,
        routerKey: targetRouterKey,
        topologyEpoch: nextEpoch,
      });

      await this.releaseLock(roomId, lockToken);
      return { success: true, topologyEpoch: nextEpoch, data: targetRouterKey };
    } catch (err) {
      await this.releaseLock(roomId, lockToken);
      logger.error(JSON.stringify({
        event: 'large_room_topology_redis_unavailable',
        roomId,
        action: 'assignParticipantToRouter',
      }));
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Removes a participant from room topology, decrementing router viewer capacity.
   */
  public static async removeParticipantFromTopology(
    roomId: string,
    participantId: string
  ): Promise<TopologyMutationResult> {
    if (!roomId) return { success: false, topologyEpoch: 0, error: 'Invalid roomId' };

    const assignedRouterKey = await redis.hget(this.keyParticipantMap(roomId), participantId);
    if (!assignedRouterKey) {
      const epochStr = await redis.get(this.keyEpoch(roomId));
      return { success: true, topologyEpoch: epochStr ? parseInt(epochStr, 10) : 0 };
    }

    const { lockToken, acquired } = await this.acquireLock(roomId);
    if (!acquired) return { success: false, topologyEpoch: 0, error: 'Lock acquisition failed' };

    try {
      const currentEpochStr = await redis.get(this.keyEpoch(roomId));
      const currentEpoch = currentEpochStr ? parseInt(currentEpochStr, 10) : 0;

      const nextEpoch = currentEpoch + 1;
      const multi = redis.multi();
      multi.hdel(this.keyParticipantMap(roomId), participantId);
      multi.hincrby(this.keyCapacity(roomId, assignedRouterKey), 'currentViewerCount', -1);
      multi.set(this.keyEpoch(roomId), nextEpoch.toString());
      await multi.exec();

      logger.info(JSON.stringify({
        event: 'participant_router_assignment_removed',
        roomId,
        participantId,
        routerKey: assignedRouterKey,
        topologyEpoch: nextEpoch,
      }));

      await this.appendAuditEvent(roomId, 'participant_removed', {
        participantId,
        routerKey: assignedRouterKey,
        topologyEpoch: nextEpoch,
      });

      await this.releaseLock(roomId, lockToken);
      return { success: true, topologyEpoch: nextEpoch };
    } catch (err) {
      await this.releaseLock(roomId, lockToken);
      logger.error(JSON.stringify({
        event: 'large_room_topology_redis_unavailable',
        roomId,
        action: 'removeParticipantFromTopology',
      }));
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Registers a Producer ID in topology.
   */
  public static async registerProducerInTopology(
    roomId: string,
    producerId: string,
    routerKey: RouterKey
  ): Promise<TopologyMutationResult> {
    if (!roomId) return { success: false, topologyEpoch: 0, error: 'Invalid roomId' };
    try {
      await redis.hset(this.keyProducerMap(roomId), producerId, routerKey);
      logger.info(JSON.stringify({
        event: 'producer_registered_in_topology',
        roomId,
        producerId,
        routerKey,
      }));
      await this.appendAuditEvent(roomId, 'producer_registered', { producerId, routerKey });
      return { success: true, topologyEpoch: 0 };
    } catch (err) {
      logger.error(`Failed to register producer ${producerId} in topology`, err);
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Unregisters a Producer ID from topology.
   */
  public static async unregisterProducerFromTopology(
    roomId: string,
    producerId: string
  ): Promise<TopologyMutationResult> {
    if (!roomId) return { success: false, topologyEpoch: 0, error: 'Invalid roomId' };
    try {
      await redis.hdel(this.keyProducerMap(roomId), producerId);
      logger.info(JSON.stringify({
        event: 'producer_unregistered_from_topology',
        roomId,
        producerId,
      }));
      await this.appendAuditEvent(roomId, 'producer_unregistered', { producerId });
      return { success: true, topologyEpoch: 0 };
    } catch (err) {
      logger.error(`Failed to unregister producer ${producerId} from topology`, err);
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Removes a Relay Router from topology.
   */
  public static async removeRelayRouter(roomId: string, routerKey: RouterKey): Promise<TopologyMutationResult> {
    if (!roomId) return { success: false, topologyEpoch: 0, error: 'Invalid roomId' };
    const { lockToken, acquired } = await this.acquireLock(roomId);
    if (!acquired) return { success: false, topologyEpoch: 0, error: 'Lock acquisition failed' };

    try {
      const currentEpochStr = await redis.get(this.keyEpoch(roomId));
      const currentEpoch = currentEpochStr ? parseInt(currentEpochStr, 10) : 0;
      const nextEpoch = currentEpoch + 1;

      const multi = redis.multi();
      multi.srem(this.keyRelays(roomId), routerKey);
      multi.del(this.keyCapacity(roomId, routerKey));
      multi.set(this.keyEpoch(roomId), nextEpoch.toString());
      await multi.exec();

      await this.appendAuditEvent(roomId, 'relay_removed', { routerKey, topologyEpoch: nextEpoch });
      await this.releaseLock(roomId, lockToken);
      return { success: true, topologyEpoch: nextEpoch };
    } catch (err) {
      await this.releaseLock(roomId, lockToken);
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Performs full cleanup of room topology keys.
   */
  public static async clearRoomTopology(roomId: string): Promise<TopologyMutationResult> {
    if (!roomId) return { success: false, topologyEpoch: 0, error: 'Invalid roomId' };
    logger.info(JSON.stringify({ event: 'large_room_topology_cleanup_started', roomId }));
    try {
      const relayKeys = await redis.smembers(this.keyRelays(roomId));
      const multi = redis.multi();

      multi.del(this.keyPrimary(roomId));
      multi.del(this.keyRelays(roomId));
      multi.del(this.keyParticipantMap(roomId));
      multi.del(this.keyProducerMap(roomId));
      multi.del(this.keyEpoch(roomId));
      multi.del(this.keyLock(roomId));

      for (const rKey of relayKeys) {
        multi.del(this.keyCapacity(roomId, rKey));
      }

      await multi.exec();

      logger.info(JSON.stringify({ event: 'large_room_topology_cleanup_completed', roomId }));
      await this.appendAuditEvent(roomId, 'topology_cleared', {});
      return { success: true, topologyEpoch: 0 };
    } catch (err) {
      logger.error(`Failed to clear topology for room ${roomId}`, err);
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Dynamically constructs full RoomTopologyState JSON snapshot from Redis Hashes/Sets.
   */
  public static async getRoomTopology(roomId: string): Promise<RoomTopologyState | null> {
    if (!roomId) return null;
    try {
      const epochStr = await redis.get(this.keyEpoch(roomId));
      if (!epochStr) return null;

      const primaryRouterKey = await redis.get(this.keyPrimary(roomId));
      const relayRouterKeys = await redis.smembers(this.keyRelays(roomId));
      const participantRouterMap = await redis.hgetall(this.keyParticipantMap(roomId));
      const producerRouterMap = await redis.hgetall(this.keyProducerMap(roomId));

      const routers: Record<RouterKey, RouterNode> = {};

      const allRouterKeys = Array.from(new Set([...(primaryRouterKey ? [primaryRouterKey] : []), ...relayRouterKeys]));

      for (const rKey of allRouterKeys) {
        const cap = await redis.hgetall(this.keyCapacity(roomId, rKey));
        const [podId, rId] = rKey.split(':');
        routers[rKey] = {
          routerKey: rKey,
          routerId: rId || rKey,
          mediaPodId: podId || 'unknown',
          role: rKey === primaryRouterKey ? 'primary' : 'relay',
          capacity: {
            currentViewerCount: parseInt(cap.currentViewerCount || '0', 10),
            currentConsumerCount: parseInt(cap.currentConsumerCount || '0', 10),
            estimatedConsumerCount: parseInt(cap.estimatedConsumerCount || '0', 10),
            maxViewers: parseInt(cap.maxViewers || '500', 10),
          },
          createdAt: parseInt(cap.createdAt || Date.now().toString(), 10),
        };
      }

      return {
        roomId,
        topologyEpoch: parseInt(epochStr, 10),
        primaryRouterKey: primaryRouterKey || null,
        relayRouterKeys,
        participantRouterMap,
        producerRouterMap,
        routers,
        updatedAt: Date.now(),
      };
    } catch (err) {
      logger.error(JSON.stringify({
        event: 'large_room_topology_redis_unavailable',
        roomId,
        action: 'getRoomTopology',
      }));
      return null;
    }
  }
}
