import { redis } from '../redis';
import logger from '../logger';
import { RoomTopologyRegistry } from './RoomTopologyRegistry';
import { LocalMediaController } from './LocalMediaController';
import { RouterKey, RelayLifecycleState, RelayProvisioningIntent } from '../types/topology';
import { LARGE_ROOM_CONFIG, isMultiRelayActive } from '../config/largeRoomConfig';
import crypto from 'crypto';

export class RelayProvisioner {
  private static keyProvisioningLock(roomId: string): string {
    return `room:${roomId}:relayProvisioningLock`;
  }

  private static keyProvisioningIntent(roomId: string, provisioningId: string): string {
    return `room:${roomId}:provisioningIntent:${provisioningId}`;
  }

  /**
   * Main entry point for dynamic Relay Router provisioning.
   * Creates a PROVISIONING intent, selects an eligible Media Pod, creates the remote Router,
   * establishes PipeTransport, fans out active producers, and transitions state to READY.
   */
  public static async provisionRelayRouter(
    roomId: string,
    overrideConfig?: any
  ): Promise<{ success: boolean; relayRouterKey?: RouterKey; error?: string }> {
    const config = { ...LARGE_ROOM_CONFIG, ...overrideConfig };
    const lockToken = crypto.randomUUID();

    // Check maximum relay limit per room
    const currentRelays = await RoomTopologyRegistry.getRelayRouters(roomId);
    if (currentRelays.length >= config.maxRelayRoutersPerRoom) {
      logger.warn(JSON.stringify({
        event: 'relay_max_count_reached',
        roomId,
        currentRelaysCount: currentRelays.length,
        maxLimit: config.maxRelayRoutersPerRoom,
      }));
      return { success: false, error: 'relay_max_count_reached' };
    }

    // Acquire provisioning lock to prevent duplicate concurrent relay creation
    const acquired = await redis.set(this.keyProvisioningLock(roomId), lockToken, 'PX', 15000, 'NX');
    if (!acquired) {
      logger.info(JSON.stringify({
        event: 'relay_provision_lock_contended',
        roomId,
      }));
      // Another thread is provisioning; return capacity_preparing
      return { success: false, error: 'capacity_preparing' };
    }

    const provisioningId = `prov-${crypto.randomUUID()}`;
    const fencingToken = `fence-${crypto.randomUUID()}`;

    try {
      logger.info(JSON.stringify({
        event: 'relay_provision_requested',
        roomId,
        provisioningId,
        fencingToken,
      }));

      // Step 1: Select an eligible running Media Pod
      const selectedPodId = await this.selectEligibleMediaPod(roomId);
      if (!selectedPodId) {
        logger.warn(JSON.stringify({
          event: 'relay_capacity_needed',
          roomId,
          reason: 'no_eligible_media_pod',
        }));
        await this.releaseLock(roomId, lockToken);
        return { success: false, error: 'capacity_preparing' };
      }

      logger.info(JSON.stringify({
        event: 'relay_media_pod_selected',
        roomId,
        provisioningId,
        selectedPodId,
      }));

      // Step 2: Create PROVISIONING intent in Redis before remote creation
      const intent: RelayProvisioningIntent = {
        provisioningId,
        roomId,
        targetPodId: selectedPodId,
        topologyEpoch: Date.now(),
        state: 'PROVISIONING',
        fencingToken,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30000,
      };
      await redis.set(this.keyProvisioningIntent(roomId, provisioningId), JSON.stringify(intent), 'EX', 30);

      // Step 3: RPC to create Relay Router on target Media Pod
      const routerResult = await LocalMediaController.createRelayRouterOnPod(roomId, selectedPodId);
      if (!routerResult.success || !routerResult.routerKey) {
        logger.error(JSON.stringify({
          event: 'relay_provision_failed',
          roomId,
          provisioningId,
          targetPodId: selectedPodId,
          reason: routerResult.error || 'rpc_failed',
        }));
        await this.releaseLock(roomId, lockToken);
        return { success: false, error: 'relay_provision_failed' };
      }

      const relayRouterKey = routerResult.routerKey;
      intent.relayRouterKey = relayRouterKey;
      intent.state = 'WARMING';
      await redis.set(this.keyProvisioningIntent(roomId, provisioningId), JSON.stringify(intent), 'EX', 30);

      logger.info(JSON.stringify({
        event: 'relay_router_created',
        roomId,
        provisioningId,
        relayRouterKey,
        targetPodId: selectedPodId,
        state: 'WARMING',
      }));

      // Step 4: Register topology with state WARMING
      await RoomTopologyRegistry.registerRelayRouter(roomId, relayRouterKey, selectedPodId, {
        state: 'WARMING',
        fencingToken,
        maxConsumers: config.maxConsumersPerRelay,
        maxViewers: config.maxViewersPerRelay,
      });

      // Step 5: Establish PipeTransport and Fan Out existing Primary producers
      const primaryKey = await RoomTopologyRegistry.getPrimaryRouterKey(roomId);
      if (primaryKey) {
        logger.info(JSON.stringify({
          event: 'relay_producer_fanout_started',
          roomId,
          provisioningId,
          primaryRouterKey: primaryKey,
          relayRouterKey,
        }));

        const pipeResult = await LocalMediaController.ensurePipeTransport(roomId, primaryKey, relayRouterKey);
        if (!pipeResult.success) {
          logger.error(JSON.stringify({
            event: 'relay_fanout_failed',
            roomId,
            provisioningId,
            primaryRouterKey: primaryKey,
            relayRouterKey,
            reason: pipeResult.error,
          }));
          await RoomTopologyRegistry.updateRelayState(roomId, relayRouterKey, 'FAILED', fencingToken);
          await this.releaseLock(roomId, lockToken);
          return { success: false, error: 'relay_fanout_failed' };
        }

        const fanoutResult = await LocalMediaController.fanOutAllProducersToRelay(roomId, primaryKey, relayRouterKey);
        if (!fanoutResult.success) {
          logger.error(JSON.stringify({
            event: 'relay_fanout_failed',
            roomId,
            provisioningId,
            reason: 'producer_piping_failed',
          }));
          await RoomTopologyRegistry.updateRelayState(roomId, relayRouterKey, 'FAILED', fencingToken);
          await this.releaseLock(roomId, lockToken);
          return { success: false, error: 'relay_fanout_failed' };
        }

        logger.info(JSON.stringify({
          event: 'relay_producer_fanout_completed',
          roomId,
          provisioningId,
          primaryRouterKey: primaryKey,
          relayRouterKey,
          pipedCount: fanoutResult.pipedCount,
        }));
      }

      // Step 6: Mark Relay state READY
      const stateUpdated = await RoomTopologyRegistry.updateRelayState(roomId, relayRouterKey, 'READY', fencingToken);
      if (!stateUpdated.success) {
        logger.warn(JSON.stringify({
          event: 'relay_provision_fencing_rejected',
          roomId,
          provisioningId,
          relayRouterKey,
          reason: 'stale_fencing_token',
        }));
        await this.releaseLock(roomId, lockToken);
        return { success: false, error: 'stale_fencing_token' };
      }

      logger.info(JSON.stringify({
        event: 'relay_ready',
        roomId,
        provisioningId,
        relayRouterKey,
        targetPodId: selectedPodId,
      }));

      await this.releaseLock(roomId, lockToken);
      return { success: true, relayRouterKey };
    } catch (err: any) {
      logger.error(JSON.stringify({
        event: 'relay_provision_failed',
        roomId,
        provisioningId,
        error: err?.message || String(err),
      }));
      await this.releaseLock(roomId, lockToken);
      return { success: false, error: 'relay_provision_failed' };
    }
  }

  /**
   * Selects an eligible live Media Pod for new Relay Router placement.
   * Prefers least-loaded running pod, excluding Primary pod, existing Relay pods, and stale pods.
   */
  public static async selectEligibleMediaPod(roomId: string): Promise<string | null> {
    const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
    const primaryPodId = topology?.primaryRouterKey ? topology.primaryRouterKey.split(':')[0] : null;
    
    const existingRelayPods = new Set<string>();
    if (topology?.routers) {
      for (const routerNode of Object.values(topology.routers)) {
        if (routerNode.role === 'relay') {
          existingRelayPods.add(routerNode.mediaPodId);
        }
      }
    }

    const activeNodes = await RoomTopologyRegistry.getActiveMediaNodes();
    let bestPodId: string | null = null;
    let lowestLoad = 999999;

    for (const node of activeNodes) {
      if (node.mediaPodId === primaryPodId) continue; // Exclude Primary Pod
      if (existingRelayPods.has(node.mediaPodId)) continue; // Exclude Pod carrying existing Relay for room
      if (node.status === 'draining' || node.status === 'unhealthy') continue;

      const podLoad = (node.activeRouterCount || 0) * 10 + (node.activeConsumerCount || 0);
      if (podLoad < lowestLoad) {
        lowestLoad = podLoad;
        bestPodId = node.mediaPodId;
      }
    }

    // Fallback: If all available pods already carry a relay, select the least-loaded non-primary active pod
    if (!bestPodId) {
      for (const node of activeNodes) {
        if (node.mediaPodId === primaryPodId) continue;
        if (node.status === 'draining' || node.status === 'unhealthy') continue;

        const podLoad = (node.activeRouterCount || 0) * 10 + (node.activeConsumerCount || 0);
        if (podLoad < lowestLoad) {
          lowestLoad = podLoad;
          bestPodId = node.mediaPodId;
        }
      }
    }

    return bestPodId;
  }

  /**
   * Pre-provisioning Threshold Check:
   * Checks if all currently READY Relays have crossed relayProvisionThresholdPercent capacity.
   * If crossed, asynchronously triggers pre-warming of the next Relay.
   */
  public static async checkAndTriggerPreProvisioning(roomId: string, overrideConfig?: any): Promise<void> {
    const config = { ...LARGE_ROOM_CONFIG, ...overrideConfig };
    const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
    if (!topology || !topology.routers) return;

    const readyRelays = Object.values(topology.routers).filter(
      r => r.role === 'relay' && r.state === 'READY'
    );

    if (readyRelays.length === 0) return;

    let allCrossedThreshold = true;
    for (const relay of readyRelays) {
      const loadPercent = ((relay.capacity.estimatedConsumerCount || 0) / (relay.capacity.maxConsumers || config.maxConsumersPerRelay)) * 100;
      if (loadPercent < config.relayProvisionThresholdPercent) {
        allCrossedThreshold = false;
        break;
      }
    }

    if (allCrossedThreshold && readyRelays.length < config.maxRelayRoutersPerRoom) {
      logger.info(JSON.stringify({
        event: 'relay_capacity_threshold_reached',
        roomId,
        readyRelaysCount: readyRelays.length,
        thresholdPercent: config.relayProvisionThresholdPercent,
      }));

      // Asynchronously pre-provision next Relay in background
      this.provisionRelayRouter(roomId, overrideConfig).catch(err => {
        logger.warn('Pre-provisioning background task error:', err);
      });
    }
  }

  private static async releaseLock(roomId: string, lockToken: string): Promise<void> {
    try {
      const current = await redis.get(this.keyProvisioningLock(roomId));
      if (current === lockToken) {
        await redis.del(this.keyProvisioningLock(roomId));
      }
    } catch (e) {
      // Ignore cleanup error
    }
  }
}
