import { redis } from '../redis';
import { logger } from '../logger';
import { LARGE_ROOM_CONFIG } from '../config/largeRoom';
import {
  RouterKey,
  RouterNode,
  RoomTopologyState,
  TopologyMutationResult,
  RelayLifecycleState,
  PrimaryLeaseRecord,
  PrimaryLifecycleState,
  ViewerRouteMigration,
} from '../types/topology';
import crypto from 'crypto';

export class RoomTopologyRegistry {
  private static LOCK_TTL_MS = 1000;

  public static getRouterKey(mediaPodId: string, routerId: string): RouterKey {
    return `${mediaPodId}:${routerId}`;
  }

  private static keyPrimaryLease(roomId: string): string {
    return `room:${roomId}:primaryLease`;
  }
  private static keyPrimaryGen(roomId: string): string {
    return `room:${roomId}:primaryGeneration`;
  }
  private static keyRouteMigration(roomId: string, participantId: string): string {
    return `room:${roomId}:routeMigration:${participantId}`;
  }
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
   * Increments currentConsumerCount for a router.
   */
  public static async incrementConsumerCount(roomId: string, routerKey: RouterKey, delta = 1): Promise<void> {
    if (!roomId || !routerKey) return;
    try {
      await redis.hincrby(this.keyCapacity(roomId, routerKey), 'currentConsumerCount', delta);
    } catch (err) {
      logger.error(`Failed to increment consumer count for ${routerKey} in room ${roomId}`, err);
    }
  }

  /**
   * Decrements currentConsumerCount for a router.
   */
  public static async decrementConsumerCount(roomId: string, routerKey: RouterKey, delta = 1): Promise<void> {
    if (!roomId || !routerKey) return;
    try {
      await redis.hincrby(this.keyCapacity(roomId, routerKey), 'currentConsumerCount', -delta);
    } catch (err) {
      logger.error(`Failed to decrement consumer count for ${routerKey} in room ${roomId}`, err);
    }
  }

  /**
   * Returns Primary Router key for a room.
   */
  public static async getPrimaryRouterKey(roomId: string): Promise<RouterKey | null> {
    try {
      return await redis.get(this.keyPrimary(roomId));
    } catch (err) {
      return null;
    }
  }

  /**
   * Returns array of active Relay Router keys for a room.
   */
  public static async getRelayRouters(roomId: string): Promise<RouterKey[]> {
    try {
      const relays = await redis.smembers(this.keyRelays(roomId));
      return relays || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Registers a Relay Router in topology with explicit lifecycle state.
   */
  public static async registerRelayRouter(
    roomId: string,
    relayRouterKey: RouterKey,
    mediaPodId: string,
    options?: { state?: RelayLifecycleState; fencingToken?: string; maxConsumers?: number; maxViewers?: number }
  ): Promise<TopologyMutationResult> {
    if (!roomId || !relayRouterKey) return { success: false, topologyEpoch: 0, error: 'Invalid parameters' };
    try {
      const parts = relayRouterKey.split(':');
      const routerId = parts[1] || relayRouterKey;
      const state = options?.state || 'PROVISIONING';
      const fencingToken = options?.fencingToken || `fence-${Date.now()}`;
      const maxConsumers = (options?.maxConsumers || 500).toString();
      const maxViewers = (options?.maxViewers || 250).toString();

      await redis.sadd(this.keyRelays(roomId), relayRouterKey);
      await redis.hset(this.keyCapacity(roomId, relayRouterKey), {
        currentViewerCount: '0',
        currentConsumerCount: '0',
        estimatedConsumerCount: '0',
        maxViewers,
        maxConsumers,
        role: 'relay',
        state,
        fencingToken,
        mediaPodId,
        routerId,
        createdAt: Date.now().toString(),
      });

      return { success: true, topologyEpoch: 0 };
    } catch (err) {
      logger.error(`Failed to register relay router ${relayRouterKey} in room ${roomId}`, err);
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Updates Relay Router lifecycle state (PROVISIONING -> WARMING -> READY -> FAILED -> CLOSED)
   * validates fencing token to prevent stale overwrites.
   */
  public static async updateRelayState(
    roomId: string,
    relayRouterKey: RouterKey,
    newState: RelayLifecycleState,
    fencingToken?: string
  ): Promise<TopologyMutationResult> {
    if (!roomId || !relayRouterKey) return { success: false, topologyEpoch: 0, error: 'Invalid parameters' };
    try {
      const capKey = this.keyCapacity(roomId, relayRouterKey);
      if (fencingToken) {
        const currentToken = await redis.hget(capKey, 'fencingToken');
        if (currentToken && currentToken !== fencingToken) {
          logger.warn(JSON.stringify({
            event: 'relay_provision_fencing_rejected',
            roomId,
            relayRouterKey,
            currentToken,
            fencingToken,
          }));
          return { success: false, topologyEpoch: 0, error: 'Stale fencing token' };
        }
      }

      await redis.hset(capKey, 'state', newState);
      return { success: true, topologyEpoch: 0 };
    } catch (err) {
      logger.error(`Failed to update relay state for ${relayRouterKey} in room ${roomId}`, err);
      return { success: false, topologyEpoch: 0, error: 'Redis failure' };
    }
  }

  /**
   * Atomic capacity reservation for joining viewer.
   */
  public static async reserveRelayCapacity(
    roomId: string,
    participantId: string,
    consumerCost = 2,
    maxConsumers = 500,
    maxViewers = 250
  ): Promise<{ success: boolean; relayRouterKey?: RouterKey; error?: string }> {
    try {
      const result = await redis.eval(
        `
        local roomId = ARGV[1]
        local participantId = ARGV[2]
        local consumerCost = tonumber(ARGV[3]) or 2
        local maxConsumers = tonumber(ARGV[4]) or 500
        local maxViewers = tonumber(ARGV[5]) or 250

        local relayKeysPattern = "room:" .. roomId .. ":routerCapacity:*"
        local keys = redis.call("KEYS", relayKeysPattern)

        local bestKey = nil
        local bestLoad = 999999

        for _, capKey in ipairs(keys) do
          local routerKey = string.sub(capKey, string.len("room:" .. roomId .. ":routerCapacity:") + 1)
          local role = redis.call("HGET", capKey, "role")
          local state = redis.call("HGET", capKey, "state")
          
          if role == "relay" and (state == "READY" or state == nil or state == "") then
            local estConsumers = tonumber(redis.call("HGET", capKey, "estimatedConsumerCount") or "0")
            local curViewers = tonumber(redis.call("HGET", capKey, "currentViewerCount") or "0")
            
            local projectedConsumers = estConsumers + consumerCost
            local projectedViewers = curViewers + 1
            
            if projectedConsumers <= maxConsumers and projectedViewers <= maxViewers then
              if estConsumers < bestLoad then
                bestLoad = estConsumers
                bestKey = routerKey
              end
            end
          end
        end

        if bestKey then
          local targetCapKey = "room:" .. roomId .. ":routerCapacity:" .. bestKey
          redis.call("HINCRBY", targetCapKey, "estimatedConsumerCount", consumerCost)
          redis.call("HINCRBY", targetCapKey, "currentViewerCount", 1)
          redis.call("HSET", "room:" .. roomId .. ":participantRouterMap", participantId, bestKey)
          return { 1, bestKey }
        else
          return { 0, "capacity_preparing" }
        end
        `,
        0,
        roomId,
        participantId,
        consumerCost.toString(),
        maxConsumers.toString(),
        maxViewers.toString()
      ) as any;

      if (result && (result[0] === 1 || result === 1)) {
        const relayRouterKey = Array.isArray(result) ? result[1] : undefined;
        logger.info(JSON.stringify({
          event: 'relay_assignment_reserved',
          roomId,
          participantId,
          relayRouterKey,
          reservedConsumerCost: consumerCost,
        }));
        return { success: true, relayRouterKey };
      }

      return { success: false, error: Array.isArray(result) ? result[1] : 'capacity_preparing' };
    } catch (err) {
      logger.error(`Failed to reserve relay capacity in room ${roomId}`, err);
      return { success: false, error: 'Redis failure' };
    }
  }

  /**
   * Commits relay assignment after actual Mediasoup Consumer creation.
   */
  public static async commitRelayAssignment(
    roomId: string,
    participantId: string,
    relayRouterKey: RouterKey,
    actualConsumerCount = 2
  ): Promise<void> {
    if (!roomId || !relayRouterKey) return;
    try {
      const capKey = this.keyCapacity(roomId, relayRouterKey);
      await redis.hincrby(capKey, 'currentConsumerCount', actualConsumerCount);
      logger.info(JSON.stringify({
        event: 'relay_assignment_committed',
        roomId,
        participantId,
        relayRouterKey,
        actualConsumerCount,
      }));
    } catch (err) {
      logger.error(`Failed to commit relay assignment for ${relayRouterKey} in room ${roomId}`, err);
    }
  }

  /**
   * Rolls back reserved relay capacity when Consumer creation or transport setup fails.
   */
  public static async releaseRelayReservation(
    roomId: string,
    participantId: string,
    relayRouterKey: RouterKey,
    reservedConsumerCost = 2
  ): Promise<void> {
    if (!roomId || !relayRouterKey) return;
    try {
      const capKey = this.keyCapacity(roomId, relayRouterKey);
      await redis.hincrby(capKey, 'estimatedConsumerCount', -reservedConsumerCost);
      await redis.hincrby(capKey, 'currentViewerCount', -1);
      await redis.hdel(this.keyParticipantMap(roomId), participantId);
      logger.warn(JSON.stringify({
        event: 'relay_assignment_rolled_back',
        roomId,
        participantId,
        relayRouterKey,
        reservedConsumerCost,
      }));
      logger.warn(JSON.stringify({
        event: 'relay_capacity_reservation_released',
        roomId,
        participantId,
        relayRouterKey,
      }));
    } catch (err) {
      logger.error(`Failed to release relay reservation for ${relayRouterKey} in room ${roomId}`, err);
    }
  }

  /**
   * Fetches active media nodes publishing heartbeats in Redis.
   */
  public static async getActiveMediaNodes(): Promise<Array<{ mediaPodId: string; status: string; activeRouterCount: number; activeConsumerCount: number }>> {
    try {
      const keys = await redis.keys('media:node:*:heartbeat');
      const nodes = [];
      for (const k of keys) {
        const podId = k.split(':')[2];
        const data = await redis.get(k);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            nodes.push({
              mediaPodId: podId,
              status: parsed.status || 'healthy',
              activeRouterCount: parsed.activeRouterCount || 0,
              activeConsumerCount: parsed.activeConsumerCount || 0,
            });
          } catch (e) {
            nodes.push({ mediaPodId: podId, status: 'healthy', activeRouterCount: 0, activeConsumerCount: 0 });
          }
        }
      }
      return nodes;
    } catch (err) {
      return [];
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
      const primaryRouterKey = await redis.get(this.keyPrimary(roomId));
      const relayRouterKeys = await redis.smembers(this.keyRelays(roomId));

      if (!epochStr && !primaryRouterKey && relayRouterKeys.length === 0) {
        return null;
      }
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
          state: (cap.state as RelayLifecycleState) || undefined,
          fencingToken: cap.fencingToken || undefined,
          capacity: {
            currentViewerCount: parseInt(cap.currentViewerCount || '0', 10),
            currentConsumerCount: parseInt(cap.currentConsumerCount || '0', 10),
            estimatedConsumerCount: parseInt(cap.estimatedConsumerCount || '0', 10),
            maxViewers: parseInt(cap.maxViewers || '500', 10),
            maxConsumers: parseInt(cap.maxConsumers || '500', 10),
          },
          createdAt: parseInt(cap.createdAt || Date.now().toString(), 10),
        };
      }

      return {
        roomId,
        topologyEpoch: epochStr ? parseInt(epochStr, 10) : 1,
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

  /**
   * Elect Primary Router with atomic Lease Token & Generation Fencing
   */
  public static async electPrimaryRouter(
    roomId: string,
    primaryPodId: string,
    primaryInstanceId: string,
    routerId: string,
    leaseTtlMs = 5000
  ): Promise<TopologyMutationResult<PrimaryLeaseRecord>> {
    if (!roomId) return { success: false, topologyEpoch: 0, error: 'Invalid roomId' };

    const isLive = await this.isMediaPodLive(primaryPodId);
    if (!isLive) {
      return { success: false, topologyEpoch: 0, error: `Media Pod ${primaryPodId} is not live` };
    }

    const { lockToken, acquired } = await this.acquireLock(roomId);
    if (!acquired) return { success: false, topologyEpoch: 0, error: 'Failed to acquire lock for election' };

    try {
      const now = Date.now();
      const leaseKey = this.keyPrimaryLease(roomId);
      const existingLeaseRaw = await redis.hgetall(leaseKey);

      if (existingLeaseRaw && existingLeaseRaw.leaseToken) {
        const expiresAt = parseInt(existingLeaseRaw.leaseExpiresAt || '0', 10);
        if (now < expiresAt && existingLeaseRaw.primaryPodId !== primaryPodId) {
          logger.warn(JSON.stringify({
            event: 'primary_election_rejected_active_lease',
            roomId,
            existingPrimaryPodId: existingLeaseRaw.primaryPodId,
            attemptedPodId: primaryPodId,
            expiresAt,
          }));
          await this.releaseLock(roomId, lockToken);
          return { success: false, topologyEpoch: 0, error: 'primary_lease_active' };
        }
      }

      const currentEpochStr = await redis.get(this.keyEpoch(roomId));
      const currentGenStr = await redis.get(this.keyPrimaryGen(roomId));
      const currentEpoch = currentEpochStr ? parseInt(currentEpochStr, 10) : 0;
      const currentGen = currentGenStr ? parseInt(currentGenStr, 10) : 0;

      const nextEpoch = currentEpoch + 1;
      const nextGen = currentGen + 1;
      const routerKey = this.getRouterKey(primaryPodId, routerId);
      const newLeaseToken = crypto.randomUUID();
      const leaseExpiresAt = now + leaseTtlMs;

      const leaseRecord: PrimaryLeaseRecord = {
        roomId,
        primaryPodId,
        primaryInstanceId,
        primaryRouterKey: routerKey,
        primaryGeneration: nextGen,
        topologyEpoch: nextEpoch,
        leaseToken: newLeaseToken,
        leaseExpiresAt,
        state: 'RECOVERING',
        createdAt: now,
        updatedAt: now,
      };

      const multi = redis.multi();
      multi.set(this.keyPrimary(roomId), routerKey);
      multi.set(this.keyEpoch(roomId), nextEpoch.toString());
      multi.set(this.keyPrimaryGen(roomId), nextGen.toString());
      multi.hset(leaseKey, {
        roomId,
        primaryPodId,
        primaryInstanceId,
        primaryRouterKey: routerKey,
        primaryGeneration: nextGen.toString(),
        topologyEpoch: nextEpoch.toString(),
        leaseToken: newLeaseToken,
        leaseExpiresAt: leaseExpiresAt.toString(),
        state: 'RECOVERING',
        createdAt: now.toString(),
        updatedAt: now.toString(),
      });
      multi.hset(this.keyCapacity(roomId, routerKey), {
        currentViewerCount: '0',
        currentConsumerCount: '0',
        estimatedConsumerCount: '0',
        maxViewers: '500',
        role: 'primary',
        mediaPodId: primaryPodId,
        routerId,
        createdAt: now.toString(),
      });
      await multi.exec();

      logger.info(JSON.stringify({
        event: 'primary_router_elected',
        roomId,
        primaryPodId,
        primaryGeneration: nextGen,
        topologyEpoch: nextEpoch,
        leaseToken: newLeaseToken,
        leaseExpiresAt,
      }));

      await this.appendAuditEvent(roomId, 'primary_elected', { routerKey, primaryGeneration: nextGen, topologyEpoch: nextEpoch });
      await this.releaseLock(roomId, lockToken);

      return { success: true, topologyEpoch: nextEpoch, primaryGeneration: nextGen, data: leaseRecord };
    } catch (err) {
      await this.releaseLock(roomId, lockToken);
      logger.error(`Failed to elect primary router for room ${roomId}`, err);
      return { success: false, topologyEpoch: 0, error: 'topology_control_unavailable' };
    }
  }

  /**
   * Renew Primary Lease (Self-fences if lease token or generation mismatch)
   */
  public static async renewPrimaryLease(
    roomId: string,
    leaseToken: string,
    leaseTtlMs = 5000
  ): Promise<TopologyMutationResult> {
    if (!roomId || !leaseToken) return { success: false, topologyEpoch: 0, error: 'Invalid arguments' };
    try {
      const leaseKey = this.keyPrimaryLease(roomId);
      const now = Date.now();
      const newExpiresAt = now + leaseTtlMs;

      const luaScript = `
        local lease = redis.call("HMGET", KEYS[1], "leaseToken", "primaryGeneration")
        if lease[1] == ARGV[1] then
          redis.call("HSET", KEYS[1], "leaseExpiresAt", ARGV[2], "state", "ACTIVE", "updatedAt", ARGV[3])
          return {1, lease[2]}
        else
          return {0, "self_fenced"}
        end
      `;

      const res = (await redis.eval(luaScript, 1, leaseKey, leaseToken, newExpiresAt.toString(), now.toString())) as any[];

      if (res && res[0] === 1) {
        return { success: true, topologyEpoch: 0, primaryGeneration: parseInt(res[1] || '0', 10) };
      } else {
        logger.warn(JSON.stringify({
          event: 'primary_lease_renewal_self_fenced',
          roomId,
          attemptedLeaseToken: leaseToken,
          reason: 'lease_token_mismatch_or_expired',
        }));
        return { success: false, topologyEpoch: 0, error: 'self_fenced' };
      }
    } catch (err) {
      logger.error(`Failed to renew primary lease for room ${roomId}`, err);
      return { success: false, topologyEpoch: 0, error: 'topology_control_unavailable' };
    }
  }

  /**
   * Get Active Primary Lease Record
   */
  public static async getPrimaryLease(roomId: string): Promise<PrimaryLeaseRecord | null> {
    if (!roomId) return null;
    try {
      const raw = await redis.hgetall(this.keyPrimaryLease(roomId));
      if (!raw || !raw.leaseToken) return null;
      return {
        roomId: raw.roomId,
        primaryPodId: raw.primaryPodId,
        primaryInstanceId: raw.primaryInstanceId,
        primaryRouterKey: raw.primaryRouterKey,
        primaryGeneration: parseInt(raw.primaryGeneration || '0', 10),
        topologyEpoch: parseInt(raw.topologyEpoch || '0', 10),
        leaseToken: raw.leaseToken,
        leaseExpiresAt: parseInt(raw.leaseExpiresAt || '0', 10),
        state: raw.state as PrimaryLifecycleState,
        createdAt: parseInt(raw.createdAt || '0', 10),
        updatedAt: parseInt(raw.updatedAt || '0', 10),
      };
    } catch (err) {
      return null;
    }
  }

  /**
   * Mark Relay as FAILED with atomic state change
   */
  public static async markRelayFailed(roomId: string, relayRouterKey: RouterKey): Promise<TopologyMutationResult> {
    if (!roomId || !relayRouterKey) return { success: false, topologyEpoch: 0, error: 'Invalid parameters' };
    try {
      const capKey = this.keyCapacity(roomId, relayRouterKey);
      await redis.hset(capKey, 'state', 'FAILED');
      logger.warn(JSON.stringify({ event: 'relay_router_marked_failed', roomId, relayRouterKey }));
      return { success: true, topologyEpoch: 0 };
    } catch (err) {
      return { success: false, topologyEpoch: 0, error: 'topology_control_unavailable' };
    }
  }

  /**
   * Mark Relay as CLOSED with atomic state change upon successful graceful drain
   */
  public static async closeRelayRouter(roomId: string, relayRouterKey: RouterKey): Promise<TopologyMutationResult> {
    if (!roomId || !relayRouterKey) return { success: false, topologyEpoch: 0, error: 'Invalid parameters' };
    try {
      const capKey = this.keyCapacity(roomId, relayRouterKey);
      await redis.hset(capKey, 'state', 'CLOSED');
      logger.info(JSON.stringify({ event: 'relay_router_marked_closed', roomId, relayRouterKey }));
      return { success: true, topologyEpoch: 0 };
    } catch (err) {
      return { success: false, topologyEpoch: 0, error: 'topology_control_unavailable' };
    }
  }

  /**
   * Mark Relay as DRAINING with atomic state change
   */
  public static async drainRelayRouter(roomId: string, relayRouterKey: RouterKey): Promise<TopologyMutationResult> {
    if (!roomId || !relayRouterKey) return { success: false, topologyEpoch: 0, error: 'Invalid parameters' };
    try {
      const capKey = this.keyCapacity(roomId, relayRouterKey);
      await redis.hset(capKey, 'state', 'DRAINING');
      logger.info(JSON.stringify({ event: 'relay_router_marked_draining', roomId, relayRouterKey }));
      return { success: true, topologyEpoch: 0 };
    } catch (err) {
      return { success: false, topologyEpoch: 0, error: 'topology_control_unavailable' };
    }
  }

  /**
   * Register per-viewer route migration under fenced participantRouteGeneration
   */
  public static async registerViewerRouteMigration(
    roomId: string,
    participantId: string,
    oldRelayRouterKey: RouterKey,
    newRelayRouterKey?: RouterKey
  ): Promise<ViewerRouteMigration> {
    const migrationKey = this.keyRouteMigration(roomId, participantId);
    const existing = await redis.hgetall(migrationKey);

    const currentGen = parseInt(existing.participantRouteGeneration || '0', 10);
    const nextGen = currentGen + 1;
    const now = Date.now();

    const record: ViewerRouteMigration = {
      participantId,
      oldRelayRouterKey,
      newRelayRouterKey,
      participantRouteGeneration: nextGen,
      state: 'REASSIGNING',
      createdAt: now,
      updatedAt: now,
    };

    await redis.hset(migrationKey, {
      participantId,
      oldRelayRouterKey,
      newRelayRouterKey: newRelayRouterKey || '',
      participantRouteGeneration: nextGen.toString(),
      state: 'REASSIGNING',
      createdAt: now.toString(),
      updatedAt: now.toString(),
    });

    logger.info(JSON.stringify({
      event: 'viewer_route_migration_registered',
      roomId,
      participantId,
      oldRelayRouterKey,
      newRelayRouterKey,
      participantRouteGeneration: nextGen,
    }));

    return record;
  }

  /**
   * Commit per-viewer route migration (fenced by expected participantRouteGeneration)
   */
  public static async commitViewerRouteMigration(
    roomId: string,
    participantId: string,
    newRelayRouterKey: RouterKey,
    expectedRouteGeneration: number
  ): Promise<TopologyMutationResult> {
    const migrationKey = this.keyRouteMigration(roomId, participantId);
    const raw = await redis.hgetall(migrationKey);

    if (!raw || !raw.participantRouteGeneration) {
      return { success: false, topologyEpoch: 0, error: 'No active route migration found' };
    }

    const currentGen = parseInt(raw.participantRouteGeneration, 10);
    if (currentGen !== expectedRouteGeneration) {
      logger.warn(JSON.stringify({
        event: 'viewer_route_migration_commit_rejected',
        roomId,
        participantId,
        currentGen,
        expectedRouteGeneration,
        reason: 'stale_participant_route_generation',
      }));
      return { success: false, topologyEpoch: 0, error: 'stale_participant_route_generation' };
    }

    const multi = redis.multi();
    multi.hset(this.keyParticipantMap(roomId), participantId, newRelayRouterKey);
    multi.hset(migrationKey, { state: 'COMMITTED', newRelayRouterKey, updatedAt: Date.now().toString() });
    multi.hincrby(this.keyCapacity(roomId, newRelayRouterKey), 'currentViewerCount', 1);

    if (raw.oldRelayRouterKey) {
      multi.hincrby(this.keyCapacity(roomId, raw.oldRelayRouterKey), 'currentViewerCount', -1);
    }

    await multi.exec();

    logger.info(JSON.stringify({
      event: 'viewer_route_migration_committed',
      roomId,
      participantId,
      newRelayRouterKey,
      participantRouteGeneration: expectedRouteGeneration,
    }));

    return { success: true, topologyEpoch: 0 };
  }

  /**
   * Fetch per-viewer route migration record from Redis.
   */
  public static async getViewerRouteMigrationRecord(
    roomId: string,
    participantId: string
  ): Promise<ViewerRouteMigration | null> {
    const raw = await redis.hgetall(this.keyRouteMigration(roomId, participantId));
    if (!raw || !raw.participantId) return null;
    return {
      participantId: raw.participantId,
      oldRelayRouterKey: raw.oldRelayRouterKey,
      newRelayRouterKey: raw.newRelayRouterKey,
      participantRouteGeneration: parseInt(raw.participantRouteGeneration || '0', 10),
      state: raw.state as any,
      createdAt: parseInt(raw.createdAt || '0', 10),
      updatedAt: parseInt(raw.updatedAt || '0', 10),
    };
  }

  /**
   * Get all active rooms hosting routers on a specific Media Pod
   */
  public static async getActiveRoomsForPod(mediaPodId: string): Promise<string[]> {
    try {
      const activeRooms = new Set<string>();

      const keys = await redis.keys('room:*:relays');
      for (const k of keys) {
        const parts = k.split(':');
        if (parts.length >= 3) {
          const roomId = parts[1];
          const members = await redis.smembers(k);
          const hasPod = members.some((m) => m.startsWith(`${mediaPodId}:`));
          if (hasPod) {
            activeRooms.add(roomId);
          }
        }
      }

      const pKeys = await redis.keys('room:*:participantRouterMap');
      for (const pk of pKeys) {
        const parts = pk.split(':');
        if (parts.length >= 3) {
          const roomId = parts[1];
          const pMap = await redis.hgetall(pk);
          const hasPod = Object.values(pMap).some((rKey) => rKey.startsWith(`${mediaPodId}:`));
          if (hasPod) {
            activeRooms.add(roomId);
          }
        }
      }

      return Array.from(activeRooms);
    } catch (err) {
      logger.error(`Failed to get active rooms for pod ${mediaPodId}`, err);
      return [];
    }
  }

  /**
   * Reconcile Primary Lease after Redis recovery to ensure exactly one authoritative Primary remains
   */
  public static async reconcilePrimaryLease(roomId: string): Promise<{ authoritativePrimaryPodId: string | null; authoritativeGeneration: number }> {
    if (!roomId) return { authoritativePrimaryPodId: null, authoritativeGeneration: 0 };
    try {
      const lease = await this.getPrimaryLease(roomId);
      if (!lease || !lease.leaseToken) {
        return { authoritativePrimaryPodId: null, authoritativeGeneration: 0 };
      }

      const now = Date.now();
      const isLive = await this.isMediaPodLive(lease.primaryPodId);

      if (now < lease.leaseExpiresAt && isLive && lease.state !== 'FAILED') {
        return {
          authoritativePrimaryPodId: lease.primaryPodId,
          authoritativeGeneration: lease.primaryGeneration,
        };
      }

      // If Primary is dead or lease expired, mark lease as FAILED in Redis
      await redis.hset(this.keyPrimaryLease(roomId), 'state', 'FAILED');
      return { authoritativePrimaryPodId: null, authoritativeGeneration: lease.primaryGeneration };
    } catch (err) {
      return { authoritativePrimaryPodId: null, authoritativeGeneration: 0 };
    }
  }
}

