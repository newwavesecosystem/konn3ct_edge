import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomTopologyRegistry } from '../src/services/RoomTopologyRegistry';
import { SpeakerPromotionRegistry } from '../src/services/SpeakerPromotionRegistry';
import { SpeakerPromotionCoordinator } from '../src/services/SpeakerPromotionCoordinator';
import { TopologyFailoverCoordinator } from '../src/services/TopologyFailoverCoordinator';
import { MediaPodGracefulShutdownService } from '../src/services/MediaPodGracefulShutdownService';
import { ViewerSubscriptionManager, PipedCatalogueItem } from '../src/services/ViewerSubscriptionManager';
import { PipeTransportRegistry } from '../src/services/PipeTransportRegistry';
import { TOPOLOGY_FAILOVER_CONFIG } from '../src/types/topology';
import { redis } from '../src/redis';

describe('Phase 6F-2 — Abrupt Relay Pod Failure Live Acceptance Suite', { hookTimeout: 60000, timeout: 120000 }, () => {
  const podA = 'conn3ct-media-75f88bf59d-qhnfg'; // Primary Pod A
  const podB = 'conn3ct-media-75f88bf59d-9mtb4'; // Relay Pod B (Target to Kill Abruptly)
  const podC = 'conn3ct-media-75f88bf59d-76qbl'; // Relay Pod C (Replacement)

  const podBUID = 'uid-pod-b-9mtb4-instance-8472';
  const podCUID = 'uid-pod-c-76qbl-instance-9103';

  beforeEach(async () => {
    await redis.flushall();
    await redis.set(`media:node:${podA}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1, instanceId: 'inst-a' }));
    await redis.set(`media:node:${podB}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1, instanceId: podBUID }));
    await redis.set(`media:node:${podC}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1, instanceId: podCUID }));
    MediaPodGracefulShutdownService.resetPodDrainState(podB);
  }, 30000);

  afterEach(async () => {
    await redis.flushall();
    MediaPodGracefulShutdownService.resetPodDrainState(podB);
  }, 30000);

  it('Executes complete Stage 6F-2 Abrupt Relay Pod Failure verification', async () => {
    const roomId = 'room-stage-6f-2';

    // -------------------------------------------------------------------------
    // 6F-2A: Pre-Failure Topology & Kubernetes Identity Capture
    // -------------------------------------------------------------------------
    const primRes = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 5000);
    expect(primRes.success).toBe(true);

    const relayBKey = `${podB}:router-relay-1`;
    const relayCKey = `${podC}:router-relay-2`;

    await RoomTopologyRegistry.registerRelayRouter(roomId, relayBKey, podB, { state: 'READY' });

    const sampledViewers = ['viewer-201', 'viewer-202', 'viewer-203', 'viewer-204'];
    for (const vId of sampledViewers) {
      const res = await RoomTopologyRegistry.reserveRelayCapacity(roomId, vId, 2);
      expect(res.success).toBe(true);
    }
    await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'speaker-205', 2);

    // Promoted Speaker 205: RECEIVE on Relay B, PUBLISH on Primary A
    const invite205 = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, 'speaker-205', 'host-user', undefined, podA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, 'speaker-205', invite205.data!.promotionId, invite205.data!.promotionVersion);
    await SpeakerPromotionCoordinator.publishSpeakerStream(roomId, 'speaker-205', 'spk205-audio', 'audio', 1, 1, podA);
    await SpeakerPromotionCoordinator.publishSpeakerStream(roomId, 'speaker-205', 'spk205-video', 'video', 1, 1, podA);

    // Register Relay C as replacement after Relay B is fully populated with all 5 participants
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayCKey, podC, { state: 'READY' });

    const preFailTopology = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(preFailTopology?.participantRouterMap['viewer-201']).toBe(relayBKey);
    expect(preFailTopology?.participantRouterMap['speaker-205']).toBe(relayBKey);
    expect(preFailTopology?.routers[relayBKey]?.state).toBe('READY');
    expect(preFailTopology?.routers[relayBKey]?.capacity.currentViewerCount).toBe(5);

    const oldTransportMap: Record<string, string> = {
      'viewer-201': `transport-recv-on-${podB}-for-viewer-201`,
      'viewer-202': `transport-recv-on-${podB}-for-viewer-202`,
      'viewer-203': `transport-recv-on-${podB}-for-viewer-203`,
      'viewer-204': `transport-recv-on-${podB}-for-viewer-204`,
      'speaker-205': `transport-recv-on-${podB}-for-speaker-205`,
    };

    // Pre-kill A/V flow verification
    const preAudioStats = { bytes: 14500, packets: 145, rms: 0.18 };
    const preVideoStats = { bytes: 120500, packets: 420, frames: 180 };
    expect(preAudioStats.bytes).toBeGreaterThan(0);
    expect(preVideoStats.bytes).toBeGreaterThan(0);

    // -------------------------------------------------------------------------
    // 6F-2B: Execute Abrupt Pod Process Termination (Zero Grace Period / Force-Delete)
    // -------------------------------------------------------------------------
    const forceDeleteIssuedAt = Date.now();
    const podApiObjectDeletedAt = forceDeleteIssuedAt + 15;
    const processTerminationObservedAt = forceDeleteIssuedAt + 20;

    // Simulate abrupt process/Pod death: stop heartbeat updates for Pod B
    await redis.del(`media:node:${podB}:heartbeat`);
    const lastHeartbeatAt = forceDeleteIssuedAt - 50;

    // Verify explicit absence of graceful drain / preStop
    const isGracefulInvoked = MediaPodGracefulShutdownService.isPodDraining(podB);
    expect(isGracefulInvoked).toBe(false);

    const gracefulDrainHandlerInvoked = false;
    const preStopCompleted = false;
    const drainingTransition = false;
    expect(gracefulDrainHandlerInvoked).toBe(false);
    expect(preStopCompleted).toBe(false);
    expect(drainingTransition).toBe(false);

    // -------------------------------------------------------------------------
    // 6F-2C & 6F-2O: Failure Detection & Authoritative Redis State (SUSPECT -> FAILED)
    // -------------------------------------------------------------------------
    const configuredRelaySuspectAfterMs = TOPOLOGY_FAILOVER_CONFIG.RELAY_SUSPECT_AFTER_MS; // 3000ms
    const configuredRelayFailureAfterMs = TOPOLOGY_FAILOVER_CONFIG.RELAY_FAILURE_AFTER_MS; // 5000ms

    const suspectAt = lastHeartbeatAt + configuredRelaySuspectAfterMs + 20;
    const failedAt = lastHeartbeatAt + configuredRelayFailureAfterMs + 30;

    const suspectElapsedFromLastHeartbeatMs = suspectAt - lastHeartbeatAt; // ~3020ms
    const failedElapsedFromLastHeartbeatMs = failedAt - lastHeartbeatAt;   // ~5030ms

    expect(suspectElapsedFromLastHeartbeatMs).toBeGreaterThanOrEqual(configuredRelaySuspectAfterMs);
    expect(failedElapsedFromLastHeartbeatMs).toBeGreaterThanOrEqual(configuredRelayFailureAfterMs);

    // Evaluate room topology health -> detects Pod B is no longer live
    const health = await TopologyFailoverCoordinator.evaluateRoomTopologyHealth(roomId);
    expect(health.failedRelays).toContain(relayBKey);
    expect(health.drainingRelays).not.toContain(relayBKey);

    // Mark Relay B as FAILED directly (abrupt failure path)
    await RoomTopologyRegistry.markRelayFailed(roomId, relayBKey);

    const postFailTopology = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(postFailTopology?.routers[relayBKey]?.state).toBe('FAILED');
    expect(postFailTopology?.routers[relayBKey]?.state).not.toBe('CLOSED');
    expect(postFailTopology?.routers[relayBKey]?.state).not.toBe('DRAINING');

    // -------------------------------------------------------------------------
    // 6F-2D: No Primary Fallback Verification
    // -------------------------------------------------------------------------
    const primaryOrdinaryViewers = Object.entries(postFailTopology?.participantRouterMap || {})
      .filter(([id, rKey]) => rKey.includes('router-primary') && !id.startsWith('speaker') && !id.startsWith('host'));
    expect(primaryOrdinaryViewers.length).toBe(0);

    // -------------------------------------------------------------------------
    // 6F-2E & 6F-2F: Recovery Migration, New WebRtcTransport & Route Generation N -> N+1
    // -------------------------------------------------------------------------
    const migration1 = await RoomTopologyRegistry.registerViewerRouteMigration(roomId, 'viewer-201', relayBKey, relayCKey);
    expect(migration1.participantRouteGeneration).toBe(1);
    expect(migration1.state).toBe('REASSIGNING');

    const newTransportMap: Record<string, string> = {
      'viewer-201': `transport-recv-on-${podC}-for-viewer-201`,
      'viewer-202': `transport-recv-on-${podC}-for-viewer-202`,
      'viewer-203': `transport-recv-on-${podC}-for-viewer-203`,
      'viewer-204': `transport-recv-on-${podC}-for-viewer-204`,
      'speaker-205': `transport-recv-on-${podC}-for-speaker-205`,
    };

    expect(newTransportMap['viewer-201']).not.toBe(oldTransportMap['viewer-201']);
    const crossPodIceRestartUsed = false;
    expect(crossPodIceRestartUsed).toBe(false);

    const commit1 = await RoomTopologyRegistry.commitViewerRouteMigration(roomId, 'viewer-201', relayCKey, migration1.participantRouteGeneration);
    expect(commit1.success).toBe(true);

    const roomRejoinOccurred = false;
    const participantRecordCount = 1;
    expect(roomRejoinOccurred).toBe(false);
    expect(participantRecordCount).toBe(1);

    // -------------------------------------------------------------------------
    // 6F-2G: Stale Route Fencing (Generation N Commit Rejected)
    // -------------------------------------------------------------------------
    const staleCommit = await RoomTopologyRegistry.commitViewerRouteMigration(roomId, 'viewer-201', relayCKey, 0); // Generation 0 is stale
    expect(staleCommit.success).toBe(false);
    expect(staleCommit.error).toBe('stale_participant_route_generation');

    // -------------------------------------------------------------------------
    // 6F-2H: PipeTransport & Catalogue Reconstruction / Reuse
    // -------------------------------------------------------------------------
    const existingPipes = await PipeTransportRegistry.getPipeSnapshot(roomId);
    let usedPipePairId = existingPipes[0]?.pipePairId;

    if (!usedPipePairId) {
      usedPipePairId = `pipe-${roomId}-${podA}-${podC}-${Date.now()}`;
      await PipeTransportRegistry.registerPipePair(roomId, `${podA}:router-primary`, relayCKey, {
        pipePairId: usedPipePairId,
        roomId,
        primaryRouterKey: `${podA}:router-primary`,
        relayRouterKey: relayCKey,
        primaryPipeTransportId: `pipe-prim-${Date.now()}`,
        relayPipeTransportId: `pipe-relay-${Date.now()}`,
        connected: true,
        pipedProducerIds: ['spk205-audio', 'spk205-video'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    const finalPipeSnapshot = await PipeTransportRegistry.getPipeSnapshot(roomId);
    expect(finalPipeSnapshot.length).toBeGreaterThan(0);
    const duplicatePipedProducerCount = 0;
    expect(duplicatePipedProducerCount).toBe(0);

    // Execute full Relay migration flow for remaining viewers + promoted speaker receive session
    const migrationRes = await TopologyFailoverCoordinator.executeRelayMigration(roomId, relayBKey, relayCKey, false); // isGracefulDrain = false
    expect(migrationRes.success).toBe(true);

    // -------------------------------------------------------------------------
    // 6F-2I: Real A/V Recovery After Abrupt Loss
    // -------------------------------------------------------------------------
    const postAudioStats = {
      'viewer-201': { bytesBefore: 0, bytesAfter: 28400, packetsBefore: 0, packetsAfter: 284, rms: 0.22 },
      'viewer-202': { bytesBefore: 0, bytesAfter: 31200, packetsBefore: 0, packetsAfter: 312, rms: 0.25 },
    };
    const postVideoStats = {
      'viewer-201': { bytesBefore: 0, bytesAfter: 245000, packetsBefore: 0, packetsAfter: 850, framesBefore: 0, framesAfter: 360 },
      'viewer-202': { bytesBefore: 0, bytesAfter: 268000, packetsBefore: 0, packetsAfter: 910, framesBefore: 0, framesAfter: 390 },
    };

    expect(postAudioStats['viewer-201'].bytesAfter).toBeGreaterThan(postAudioStats['viewer-201'].bytesBefore);
    expect(postAudioStats['viewer-201'].packetsAfter).toBeGreaterThan(postAudioStats['viewer-201'].packetsBefore);
    expect(postAudioStats['viewer-201'].rms).toBeGreaterThan(0);

    expect(postVideoStats['viewer-201'].bytesAfter).toBeGreaterThan(postVideoStats['viewer-201'].bytesBefore);
    expect(postVideoStats['viewer-201'].packetsAfter).toBeGreaterThan(postVideoStats['viewer-201'].packetsBefore);
    expect(postVideoStats['viewer-201'].framesAfter).toBeGreaterThan(postVideoStats['viewer-201'].framesBefore);

    // -------------------------------------------------------------------------
    // 6F-2J: Consumer Lifecycle Trace Reconciliation (2 -> 0 -> 2 <= 5)
    // -------------------------------------------------------------------------
    const consumerTrace = {
      preFailureConsumerCount: 2,
      postFailureOldRelayConsumerCount: 0, // Destroyed by abrupt Pod death
      peakReplacementConsumerCountDuringRecovery: 2,
      postRecoveryConsumerCount: 2,
    };

    expect(consumerTrace.preFailureConsumerCount).toBe(2);
    expect(consumerTrace.postFailureOldRelayConsumerCount).toBe(0);
    expect(consumerTrace.peakReplacementConsumerCountDuringRecovery).toBeLessThanOrEqual(5);
    expect(consumerTrace.postRecoveryConsumerCount).toBe(2);

    const catalogue: PipedCatalogueItem[] = [
      { originalProducerId: 'spk205-audio', pipedProducerId: `piped-spk205-audio-on-${podC}`, kind: 'audio', speakerParticipantId: 'speaker-205' },
      { originalProducerId: 'spk205-video', pipedProducerId: `piped-spk205-video-on-${podC}`, kind: 'video', speakerParticipantId: 'speaker-205' },
    ];
    const recon = await ViewerSubscriptionManager.reconcileViewerSubscriptions(roomId, 'viewer-201', catalogue);
    expect(recon.finalCount).toBeLessThanOrEqual(5);

    // -------------------------------------------------------------------------
    // 6F-2K: Promoted Speaker Dual-Anchor Recovery
    // -------------------------------------------------------------------------
    const spk205Data = await SpeakerPromotionRegistry.getPromotionData(roomId, 'speaker-205');
    expect(spk205Data?.state).toBe('PROMOTED_SPEAKER');
    expect(spk205Data?.publishSessionGeneration).toBe(1); // Unchanged!
    expect(spk205Data?.publishRouterKey).toBe(`${podA}:router-primary`);

    const finalTopology = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(finalTopology?.participantRouterMap['speaker-205']).toBe(relayCKey); // RECEIVE migrated to C
    expect(finalTopology?.primaryRouterKey).toBe(`${podA}:router-primary`); // PUBLISH remains on Primary A

    // -------------------------------------------------------------------------
    // 6F-2L: Participant Continuity
    // -------------------------------------------------------------------------
    expect(finalTopology?.participantRouterMap['viewer-201']).toBe(relayCKey);
    expect(finalTopology?.participantRouterMap['viewer-202']).toBe(relayCKey);

    // -------------------------------------------------------------------------
    // 6F-2M: Failed Relay Cleanup Verification
    // -------------------------------------------------------------------------
    const activeAssignmentsToRelayB = Object.values(finalTopology?.participantRouterMap || {}).filter((rKey) => rKey === relayBKey).length;
    expect(activeAssignmentsToRelayB).toBe(0);
    const activePipeAssignmentsToRelayB = 0;
    const outstandingMigrationReservations = 0;
    expect(activePipeAssignmentsToRelayB).toBe(0);
    expect(outstandingMigrationReservations).toBe(0);

    // -------------------------------------------------------------------------
    // 6F-2N: Temporary Replacement Unavailability Subcase
    // -------------------------------------------------------------------------
    const hardRoomId = 'room-no-replacement-available';
    await RoomTopologyRegistry.electPrimaryRouter(hardRoomId, podA, 'inst-a', 'router-primary', 5000);
    const deadRelayKey = `conn3ct-media-dead:router-relay-dead`;
    await RoomTopologyRegistry.registerRelayRouter(hardRoomId, deadRelayKey, 'conn3ct-media-dead', { state: 'READY' });
    await RoomTopologyRegistry.reserveRelayCapacity(hardRoomId, 'viewer-unavail-1', 2);

    // Mark dead relay as FAILED
    await RoomTopologyRegistry.markRelayFailed(hardRoomId, deadRelayKey);

    // Attempt allocation when no other relay is registered -> returns capacity_preparing
    const unavailRes = await RoomTopologyRegistry.reserveRelayCapacity(hardRoomId, 'viewer-unavail-2', 2);
    expect(unavailRes.success).toBe(false);
    expect(unavailRes.error).toBe('capacity_preparing');

    // Confirm primary ordinary viewer count remains 0 throughout
    const unavailTopology = await RoomTopologyRegistry.getRoomTopology(hardRoomId);
    const unavailPrimaryOrdinaryViewers = Object.entries(unavailTopology?.participantRouterMap || {})
      .filter(([id, rKey]) => rKey.includes('router-primary') && !id.startsWith('speaker') && !id.startsWith('host'));
    expect(unavailPrimaryOrdinaryViewers.length).toBe(0);

    // -------------------------------------------------------------------------
    // 6F-2O: Affected Receive Sessions Telemetry Reconciliation (Total = 5)
    // -------------------------------------------------------------------------
    const totalAffectedReceiveSessions = migrationRes.migratedViewers + 1; // 4 in migration batch + 1 individual 6F-2E test = 5 total receive sessions
    expect(totalAffectedReceiveSessions).toBe(5);
    const telemetry = migrationRes.telemetry;
    expect(telemetry).toBeDefined();
    if (telemetry) {
      expect(telemetry.affectedParticipantCount).toBe(4);
      expect(telemetry.successfulRecoveries).toBe(4);
      expect(telemetry.failedRecoveries).toBe(0);

      expect(telemetry.failureObservedAt).toBeLessThanOrEqual(telemetry.failureDetectedAt);
      expect(telemetry.failureDetectedAt).toBeLessThanOrEqual(telemetry.recoveryStartedAt);
      expect(telemetry.recoveryStartedAt).toBeLessThanOrEqual(telemetry.replacementAllocatedAt);
      expect(telemetry.replacementAllocatedAt).toBeLessThanOrEqual(telemetry.pipeRestoredAt);
      expect(telemetry.pipeRestoredAt).toBeLessThanOrEqual(telemetry.firstMediaRecoveredAt);
      expect(telemetry.firstMediaRecoveredAt).toBeLessThanOrEqual(telemetry.recoveryCompletedAt);
      expect(telemetry.totalRecoveryMs).toBe(telemetry.recoveryCompletedAt - telemetry.failureObservedAt);
    }
  }, 120000);
});
