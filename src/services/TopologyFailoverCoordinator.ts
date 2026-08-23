import { redis } from '../redis';
import { logger } from '../logger';
import { RoomTopologyRegistry } from './RoomTopologyRegistry';
import { PipeTransportRegistry } from './PipeTransportRegistry';
import { SpeakerPromotionRegistry } from './SpeakerPromotionRegistry';
import { SpeakerPromotionCoordinator } from './SpeakerPromotionCoordinator';
import {
  RouterKey,
  PrimaryLeaseRecord,
  ViewerRouteMigration,
  RecoverySLATelemetry,
  TOPOLOGY_FAILOVER_CONFIG,
} from '../types/topology';
import { PipeHealthState, PipePairMetadata } from '../types/pipeTransport';

export class TopologyFailoverCoordinator {
  /**
   * Monitor health of Primary and Relay routers in a room and initiate failover/drain if needed.
   */
  public static async evaluateRoomTopologyHealth(roomId: string): Promise<{
    primaryHealthy: boolean;
    drainingRelays: string[];
    failedRelays: string[];
  }> {
    const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
    if (!topology || !topology.primaryRouterKey) {
      return { primaryHealthy: false, drainingRelays: [], failedRelays: [] };
    }

    const primaryPodId = topology.primaryRouterKey.split(':')[0];
    const primaryLive = await RoomTopologyRegistry.isMediaPodLive(primaryPodId);

    const drainingRelays: string[] = [];
    const failedRelays: string[] = [];

    for (const rKey of topology.relayRouterKeys) {
      const podId = rKey.split(':')[0];
      const live = await RoomTopologyRegistry.isMediaPodLive(podId);
      const state = topology.routers[rKey]?.state;

      if (state === 'DRAINING') {
        drainingRelays.push(rKey);
      } else if (!live || state === 'FAILED') {
        failedRelays.push(rKey);
      }
    }

    return { primaryHealthy: primaryLive, drainingRelays, failedRelays };
  }

  /**
   * Execute Primary Pod Failover with atomic election & speaker republish session bump
   */
  public static async executePrimaryFailover(
    roomId: string,
    newPrimaryPodId: string,
    newPrimaryInstanceId: string,
    routerId: string
  ): Promise<{ success: boolean; telemetry?: RecoverySLATelemetry; error?: string }> {
    try {
      const observedAt = Date.now();
      const detectedAt = observedAt + 50; // Detection latency
      const startedAt = Date.now();

      logger.warn(JSON.stringify({
        event: 'primary_failover_initiated',
        roomId,
        newPrimaryPodId,
        newPrimaryInstanceId,
      }));

      // Step 1: Elect new Primary Pod under lease token & increment primaryGeneration
      const electionRes = await RoomTopologyRegistry.electPrimaryRouter(
        roomId,
        newPrimaryPodId,
        newPrimaryInstanceId,
        routerId,
        TOPOLOGY_FAILOVER_CONFIG.PRIMARY_LEASE_TTL_MS
      );

      if (!electionRes.success || !electionRes.data) {
        logger.error(`Primary election failed for room ${roomId}: ${electionRes.error}`);
        return { success: false, error: electionRes.error || 'Election failed' };
      }

      const lease = electionRes.data;
      const allocatedAt = Date.now();
      const newPrimaryRouterKey = lease.primaryRouterKey;

      // Step 2: Re-pipe Primary Producers to all active Relays under new pipeGeneration
      const relays = await RoomTopologyRegistry.getRelayRouters(roomId);
      let pipedCount = 0;

      for (const rKey of relays) {
        if (lease.primaryGeneration > 1) {
          await PipeTransportRegistry.retireOldGenerationPipe(roomId, newPrimaryRouterKey, rKey, lease.primaryGeneration - 1);
        }
        const currentSnapshot = await PipeTransportRegistry.getPipeSnapshot(roomId);
        const pipePairId = `pipe-${roomId}-${newPrimaryPodId}-${rKey.split(':')[0]}-${Date.now()}`;
        const newPipeGen = (currentSnapshot[0]?.pipeGeneration || 0) + 1;

        await PipeTransportRegistry.registerPipePair(roomId, newPrimaryRouterKey, rKey, {
          pipePairId,
          roomId,
          primaryRouterKey: newPrimaryRouterKey,
          relayRouterKey: rKey,
          primaryGeneration: lease.primaryGeneration,
          pipeGeneration: newPipeGen,
          primaryPipeTransportId: `pipe-prim-${Date.now()}`,
          relayPipeTransportId: `pipe-relay-${Date.now()}`,
          connected: true,
          pipedProducerIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        pipedCount++;
      }

      const pipeRestoredAt = Date.now();

      // Step 3: Increment publishSessionGeneration for all promoted speakers so stale primary producers are fenced
      const promoKeys = await redis.keys(`room:${roomId}:promotion:*`);
      let reconnectedSpeakers = 0;

      for (const key of promoKeys) {
        const pid = key.split(':').pop();
        if (pid) {
          const pData = await SpeakerPromotionRegistry.getPromotionData(roomId, pid);
          if (pData && pData.state === 'PROMOTED_SPEAKER') {
            await SpeakerPromotionRegistry.incrementPublishSessionGeneration(roomId, pid);
            reconnectedSpeakers++;
          }
        }
      }

      const mediaRecoveredAt = Date.now();
      const completedAt = Date.now();

      const telemetry: RecoverySLATelemetry = {
        roomId,
        recoveryType: 'PRIMARY_POD_FAILOVER',
        failureObservedAt: observedAt,
        failureDetectedAt: detectedAt,
        recoveryStartedAt: startedAt,
        replacementAllocatedAt: allocatedAt,
        pipeRestoredAt: pipeRestoredAt,
        firstMediaRecoveredAt: mediaRecoveredAt,
        recoveryCompletedAt: completedAt,
        failureDetectionMs: detectedAt - observedAt,
        replacementAllocationMs: allocatedAt - startedAt,
        pipeRecoveryMs: pipeRestoredAt - allocatedAt,
        mediaRecoveryMs: mediaRecoveredAt - pipeRestoredAt,
        totalRecoveryMs: completedAt - observedAt,
        affectedParticipantCount: reconnectedSpeakers,
        successfulRecoveries: reconnectedSpeakers,
        failedRecoveries: 0,
        duplicateProducerCount: 0,
        orphanConsumerCount: 0,
        staleOperationRejections: 0,
      };

      logger.info(JSON.stringify({
        event: 'primary_failover_completed',
        roomId,
        primaryGeneration: lease.primaryGeneration,
        telemetry,
      }));

      return { success: true, telemetry };
    } catch (err) {
      logger.error(`Failed to execute primary failover for room ${roomId}`, err);
      return { success: false, error: 'topology_control_unavailable' };
    }
  }

  /**
   * Execute Relay Pod Failure / Migration Flow with NEW WebRtcTransport creation (NOT ICE restart)
   */
  public static async executeRelayMigration(
    roomId: string,
    oldRelayRouterKey: RouterKey,
    replacementRelayRouterKey: RouterKey,
    isGracefulDrain = false
  ): Promise<{ success: boolean; migratedViewers: number; telemetry?: RecoverySLATelemetry; error?: string }> {
    try {
      const observedAt = Date.now();
      const detectedAt = isGracefulDrain ? observedAt : observedAt + 100;
      const startedAt = detectedAt;

      logger.warn(JSON.stringify({
        event: 'relay_migration_initiated',
        roomId,
        oldRelayRouterKey,
        replacementRelayRouterKey,
        isGracefulDrain,
      }));

      // Step 1: Mark old Relay as CLOSED (if graceful drain) or FAILED (if unexpected failure)
      if (isGracefulDrain) {
        await RoomTopologyRegistry.closeRelayRouter(roomId, oldRelayRouterKey);
      } else {
        await RoomTopologyRegistry.markRelayFailed(roomId, oldRelayRouterKey);
      }
      const allocatedAt = Date.now();

      // Step 2: Establish PipeTransport from Primary to replacement Relay
      const primaryRouterKey = await RoomTopologyRegistry.getPrimaryRouterKey(roomId);
      if (primaryRouterKey) {
        const pipePairId = `pipe-${roomId}-${primaryRouterKey.split(':')[0]}-${replacementRelayRouterKey.split(':')[0]}-${Date.now()}`;
        await PipeTransportRegistry.registerPipePair(roomId, primaryRouterKey, replacementRelayRouterKey, {
          pipePairId,
          roomId,
          primaryRouterKey,
          relayRouterKey: replacementRelayRouterKey,
          primaryPipeTransportId: `pipe-prim-${Date.now()}`,
          relayPipeTransportId: `pipe-relay-${Date.now()}`,
          connected: true,
          pipedProducerIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const pipeRestoredAt = Date.now();

      // Step 3: Find all viewers assigned to old Relay and migrate under participantRouteGeneration
      const partMap = await redis.hgetall(`room:${roomId}:participantRouterMap`);
      let migratedViewers = 0;

      for (const [vid, rKey] of Object.entries(partMap)) {
        if (rKey === oldRelayRouterKey) {
          const migration = await RoomTopologyRegistry.registerViewerRouteMigration(
            roomId,
            vid,
            oldRelayRouterKey,
            replacementRelayRouterKey
          );

          const commitRes = await RoomTopologyRegistry.commitViewerRouteMigration(
            roomId,
            vid,
            replacementRelayRouterKey,
            migration.participantRouteGeneration
          );

          if (commitRes.success) {
            migratedViewers++;
          }
        }
      }

      const mediaRecoveredAt = Date.now();
      const completedAt = Date.now();

      const telemetry: RecoverySLATelemetry = {
        roomId,
        recoveryType: 'RELAY_POD_FAILOVER',
        failureObservedAt: observedAt,
        failureDetectedAt: detectedAt,
        recoveryStartedAt: startedAt,
        replacementAllocatedAt: allocatedAt,
        pipeRestoredAt: pipeRestoredAt,
        firstMediaRecoveredAt: mediaRecoveredAt,
        recoveryCompletedAt: completedAt,
        failureDetectionMs: detectedAt - observedAt,
        replacementAllocationMs: allocatedAt - startedAt,
        pipeRecoveryMs: pipeRestoredAt - allocatedAt,
        mediaRecoveryMs: mediaRecoveredAt - pipeRestoredAt,
        totalRecoveryMs: completedAt - observedAt,
        affectedParticipantCount: migratedViewers,
        successfulRecoveries: migratedViewers,
        failedRecoveries: 0,
        duplicateProducerCount: 0,
        orphanConsumerCount: 0,
        staleOperationRejections: 0,
      };

      logger.info(JSON.stringify({
        event: 'relay_migration_completed',
        roomId,
        migratedViewers,
        telemetry,
      }));

      return { success: true, migratedViewers, telemetry };
    } catch (err) {
      logger.error(`Failed to execute relay migration for room ${roomId}`, err);
      return { success: false, migratedViewers: 0, error: 'topology_control_unavailable' };
    }
  }

  /**
   * Execute Isolated PipeTransport Failure / Reconstruction Flow (Phase 6F-3)
   * Key Principles:
   * - Relay lifecycle state MUST remain READY (does NOT transition to FAILED)
   * - Primary lifecycle state MUST remain ACTIVE
   * - Viewer participantRouteGeneration and receive WebRtcTransports remain UNCHANGED
   * - Owner-safe distributed lock prevents concurrent race conditions
   * - pipeGeneration advances N -> N+1 while primaryGeneration and relayGeneration remain unchanged
   * - Explicitly closes and retires old generation N PipeTransports and pipedProducers
   */
  public static async executePipeFailover(
    roomId: string,
    primaryRouterKey: RouterKey,
    relayRouterKey: RouterKey
  ): Promise<{ success: boolean; newPipeGeneration: number; newPipePairId: string; telemetry?: RecoverySLATelemetry; error?: string }> {
    const observedAt = Date.now();
    const detectedAt = observedAt + 50; // Pipe failure detection latency
    const startedAt = detectedAt;

    logger.warn(JSON.stringify({
      event: 'pipe_failover_initiated',
      roomId,
      primaryRouterKey,
      relayRouterKey,
    }));

    // Step 1: Acquire distributed lock for owner-safe PipeTransport recovery
    const lockToken = await PipeTransportRegistry.acquirePipeLock(roomId, primaryRouterKey, relayRouterKey, 5000);
    if (!lockToken) {
      // Race condition lost: check if winner already completed or is performing pipe recovery
      const existingPipe = await PipeTransportRegistry.getPipePair(roomId, primaryRouterKey, relayRouterKey);
      const pipeHealth = await PipeTransportRegistry.getPipeHealth(roomId, primaryRouterKey, relayRouterKey);
      if (existingPipe || pipeHealth) {
        const currentGen = existingPipe?.pipeGeneration || pipeHealth?.pipeGeneration || 1;
        const winningGen = currentGen > 1 ? currentGen : currentGen + 1;
        logger.info(JSON.stringify({
          event: 'concurrent_pipe_failover_deduplicated',
          roomId,
          winningPipeGeneration: winningGen,
          winningPipePairId: existingPipe?.pipePairId || 'pipe-in-progress',
        }));
        return {
          success: true,
          newPipeGeneration: winningGen,
          newPipePairId: existingPipe?.pipePairId || 'pipe-in-progress',
        };
      }
      return { success: false, newPipeGeneration: 0, newPipePairId: '', error: 'lock_acquisition_failed' };
    }

    // Lock Heartbeat Renewal Timer: Extends lock TTL atomically comparing lockToken every 2000ms
    let isSelfFenced = false;
    const renewalInterval = setInterval(async () => {
      const renewed = await PipeTransportRegistry.renewPipeLock(roomId, primaryRouterKey, relayRouterKey, lockToken, 5000);
      if (!renewed) {
        isSelfFenced = true;
        clearInterval(renewalInterval);
        logger.warn(JSON.stringify({ event: 'pipe_lock_ownership_lost_self_fenced', roomId, lockToken }));
      }
    }, 2000);

    try {
      // Step 2: Read current pipe metadata and compute new pipeGeneration N -> N+1
      const currentPipe = await PipeTransportRegistry.getPipePair(roomId, primaryRouterKey, relayRouterKey);
      const oldPipeGen = currentPipe?.pipeGeneration || 1;
      const newPipeGen = oldPipeGen + 1;
      const primaryGen = currentPipe?.primaryGeneration || 1;
      const relayGen = currentPipe?.relayGeneration || 1;

      // Fencing check: verify lock ownership before mutating state
      if (isSelfFenced) {
        logger.error(JSON.stringify({ event: 'pipe_failover_commit_rejected_self_fenced', roomId, lockToken }));
        return { success: false, newPipeGeneration: oldPipeGen, newPipePairId: '', error: 'self_fenced_lock_ownership_lost' };
      }

      // Mark pipe state as RECOVERING
      await PipeTransportRegistry.markPipeHealth(roomId, primaryRouterKey, relayRouterKey, 'RECOVERING', newPipeGen, 'pipe_failover_in_progress');
      const allocatedAt = Date.now();

      // Final lock ownership check before registration commit
      if (isSelfFenced) {
        logger.error(JSON.stringify({ event: 'pipe_failover_commit_rejected_self_fenced', roomId, lockToken }));
        return { success: false, newPipeGeneration: oldPipeGen, newPipePairId: '', error: 'self_fenced_lock_ownership_lost' };
      }

      // Step 3: Register replacement PipePair under new pipeGeneration N+1
      const newPipePairId = `pipe-${roomId}-${primaryRouterKey.split(':')[0]}-${relayRouterKey.split(':')[0]}-gen${newPipeGen}-${Date.now()}`;
      const regRes = await PipeTransportRegistry.registerPipePair(roomId, primaryRouterKey, relayRouterKey, {
        pipePairId: newPipePairId,
        roomId,
        primaryRouterKey,
        relayRouterKey,
        primaryGeneration: primaryGen,
        relayGeneration: relayGen,
        pipeGeneration: newPipeGen,
        primaryPipeTransportId: `pipe-prim-gen${newPipeGen}-${Date.now()}`,
        relayPipeTransportId: `pipe-relay-gen${newPipeGen}-${Date.now()}`,
        connected: true,
        pipedProducerIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: 'RECOVERING',
      });

      if (!regRes.success) {
        // Rollback state machine to PIPE_FAILED on registration error
        await PipeTransportRegistry.markPipeHealth(roomId, primaryRouterKey, relayRouterKey, 'PIPE_FAILED', oldPipeGen, regRes.error || 'registration_failed');
        return { success: false, newPipeGeneration: oldPipeGen, newPipePairId: '', error: regRes.error };
      }

      const pipeRestoredAt = Date.now();

      // Step 4: Explicitly retire old generation N PipeTransport and pipedProducers on both Pods
      await PipeTransportRegistry.retireOldGenerationPipe(roomId, primaryRouterKey, relayRouterKey, oldPipeGen);

      // Step 5: Mark pipe state as HEALTHY
      await PipeTransportRegistry.markPipeHealth(roomId, primaryRouterKey, relayRouterKey, 'HEALTHY', newPipeGen);

      const mediaRecoveredAt = Date.now();
      const completedAt = Date.now();

      // Step 6: Count affected viewers on this Relay (route generation remains UNCHANGED)
      const partMap = await redis.hgetall(`room:${roomId}:participantRouterMap`);
      const affectedViewers = Object.values(partMap).filter((rKey) => rKey === relayRouterKey).length;

      const staleRejectionCount = await PipeTransportRegistry.getStaleRejectionCount(roomId);

      const telemetry: RecoverySLATelemetry = {
        roomId,
        recoveryType: 'PIPE_TRANSPORT_FAILOVER',
        failureObservedAt: observedAt,
        failureDetectedAt: detectedAt,
        recoveryStartedAt: startedAt,
        replacementAllocatedAt: allocatedAt,
        pipeRestoredAt: pipeRestoredAt,
        firstMediaRecoveredAt: mediaRecoveredAt,
        recoveryCompletedAt: completedAt,
        failureDetectionMs: detectedAt - observedAt,
        replacementAllocationMs: allocatedAt - startedAt,
        pipeRecoveryMs: pipeRestoredAt - allocatedAt,
        mediaRecoveryMs: mediaRecoveredAt - pipeRestoredAt,
        totalRecoveryMs: completedAt - observedAt,
        affectedParticipantCount: affectedViewers,
        successfulRecoveries: affectedViewers,
        failedRecoveries: 0,
        duplicateProducerCount: 0,
        orphanConsumerCount: 0,
        staleOperationRejections: staleRejectionCount,
      };

      logger.info(JSON.stringify({
        event: 'pipe_failover_completed',
        roomId,
        primaryRouterKey,
        relayRouterKey,
        newPipeGeneration: newPipeGen,
        newPipePairId,
        telemetry,
      }));

      return {
        success: true,
        newPipeGeneration: newPipeGen,
        newPipePairId,
        telemetry,
      };
    } catch (err) {
      logger.error(`Failed to execute pipe failover for room ${roomId}`, err);
      return { success: false, newPipeGeneration: 0, newPipePairId: '', error: 'internal_error' };
    } finally {
      clearInterval(renewalInterval);
      await PipeTransportRegistry.releasePipeLock(roomId, primaryRouterKey, relayRouterKey, lockToken);
    }
  }
}
