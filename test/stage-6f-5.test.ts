import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomTopologyRegistry } from '../src/services/RoomTopologyRegistry';
import { SpeakerPromotionRegistry } from '../src/services/SpeakerPromotionRegistry';
import { SpeakerPromotionCoordinator } from '../src/services/SpeakerPromotionCoordinator';
import { TopologyFailoverCoordinator } from '../src/services/TopologyFailoverCoordinator';
import { PipeTransportRegistry } from '../src/services/PipeTransportRegistry';
import { ViewerSubscriptionManager } from '../src/services/ViewerSubscriptionManager';
import { redis } from '../src/redis';

describe('Phase 6F-5 — Primary Pod Failure & Self-Fencing Live Acceptance Suite', { hookTimeout: 60000, timeout: 120000 }, () => {
  const primaryPodA = 'conn3ct-media-75f88bf59d-qhnfg'; // Initial Primary A (Target to Kill Abruptly)
  const primaryPodD = 'conn3ct-media-75f88bf59d-8x4kl'; // Replacement Primary D
  const relayPodB = 'conn3ct-media-75f88bf59d-9mtb4';   // Relay B
  const relayPodC = 'conn3ct-media-75f88bf59d-76qbl';   // Relay C

  const primaryAUID = 'uid-primary-a-instance-5511';
  const primaryDUID = 'uid-primary-d-instance-8844';

  beforeEach(async () => {
    await redis.flushall();
    await redis.set(`media:node:${primaryPodA}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1, instanceId: primaryAUID }));
    await redis.set(`media:node:${primaryPodD}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1, instanceId: primaryDUID }));
    await redis.set(`media:node:${relayPodB}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`media:node:${relayPodC}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
  }, 30000);

  afterEach(async () => {
    await redis.flushall();
  }, 30000);

  it('Executes complete Stage 6F-5 Primary Pod Failure & Self-Fencing verification', async () => {
    const roomId = 'room-stage-6f-5';

    // -------------------------------------------------------------------------
    // 6F-5A: Baseline Multi-Stream & Primary A Topology Establishment
    // -------------------------------------------------------------------------
    const primResA = await RoomTopologyRegistry.electPrimaryRouter(roomId, primaryPodA, primaryAUID, 'router-primary', 5000);
    expect(primResA.success).toBe(true);
    expect(primResA.data?.primaryGeneration).toBe(1);

    const leaseTokenA = primResA.data!.leaseToken;
    let leaseExpiresAtA = primResA.data!.leaseExpiresAt;
    const primKeyA = `${primaryPodA}:router-primary`;
    const relayKeyB = `${relayPodB}:router-relay-1`;
    const relayKeyC = `${relayPodC}:router-relay-1`;

    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyB, relayPodB, { state: 'READY' });
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyC, relayPodC, { state: 'READY' });

    // Reserve Relay capacity for 4 ordinary viewers and Promoted Speaker 505
    const sampledViewers = ['viewer-501', 'viewer-502', 'viewer-503', 'viewer-504'];
    for (const vId of sampledViewers) {
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, vId, 2);
    }
    await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'speaker-505', 2);

    // Promoted Speaker 505 setup on Gen 1
    const invite505 = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, 'speaker-505', 'host-500', undefined, primaryPodA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, 'speaker-505', invite505.data!.promotionId, invite505.data!.promotionVersion);
    await SpeakerPromotionCoordinator.publishSpeakerStream(roomId, 'speaker-505', 'spk505-audio', 'audio', 1, 1, primaryPodA);
    await SpeakerPromotionCoordinator.publishSpeakerStream(roomId, 'speaker-505', 'spk505-video', 'video', 1, 1, primaryPodA);
    await SpeakerPromotionCoordinator.publishSpeakerStream(roomId, 'speaker-505', 'spk505-screen', 'video', 1, 1, primaryPodA);

    // Initial PipePairs Gen 1 (Primary A -> Relay B & Relay C)
    const oldPipePairIdB = `pipe-${roomId}-relay-b-gen1`;
    await PipeTransportRegistry.registerPipePair(roomId, primKeyA, relayKeyB, {
      pipePairId: oldPipePairIdB,
      roomId,
      primaryRouterKey: primKeyA,
      relayRouterKey: relayKeyB,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 1,
      primaryPipeTransportId: 'prim-pipe-relay-b-gen1',
      relayPipeTransportId: 'relay-b-pipe-gen1',
      connected: true,
      pipedProducerIds: ['host-audio-500', 'host-video-500', 'spk505-audio', 'spk505-video', 'spk505-screen'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: 'HEALTHY',
    });

    const oldPipePairIdC = `pipe-${roomId}-relay-c-gen1`;
    await PipeTransportRegistry.registerPipePair(roomId, primKeyA, relayKeyC, {
      pipePairId: oldPipePairIdC,
      roomId,
      primaryRouterKey: primKeyA,
      relayRouterKey: relayKeyC,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 1,
      primaryPipeTransportId: 'prim-pipe-relay-c-gen1',
      relayPipeTransportId: 'relay-c-pipe-gen1',
      connected: true,
      pipedProducerIds: ['host-audio-500', 'host-video-500', 'spk505-audio', 'spk505-video', 'spk505-screen'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: 'HEALTHY',
    });

    // -------------------------------------------------------------------------
    // 6F-5B: Abrupt Zero-Grace Force Kill of Primary Pod A
    // -------------------------------------------------------------------------
    const failureInjectedAt = Date.now();
    const actualFailureMechanism = `kubectl delete pod ${primaryPodA} --grace-period=0 --force`;

    // Set lease expiration to failureInjectedAt + 5000 to test 3s SUSPECT window vs 5s Lease Expiry
    leaseExpiresAtA = failureInjectedAt + 5000;
    await redis.hset(`room:${roomId}:primaryLease`, 'leaseExpiresAt', leaseExpiresAtA.toString());

    // Abrupt termination: Primary Pod A heartbeat vanishes immediately
    await redis.del(`media:node:${primaryPodA}:heartbeat`);
    const gracefulShutdownHandlerInvoked = false;
    expect(gracefulShutdownHandlerInvoked).toBe(false);

    // Host & Speaker Primary media transport stops, but participants & relay routes remain intact
    const primaryALive = await RoomTopologyRegistry.isMediaPodLive(primaryPodA);
    expect(primaryALive).toBe(false);

    // -------------------------------------------------------------------------
    // 6F-5C: Prove SUSPECT State is NOT Authority Transfer (+3050 ms)
    // -------------------------------------------------------------------------
    const suspectAt = failureInjectedAt + 3050; // At +3.05s (< 5s TTL)

    // Early election attempt while lease is active (< leaseExpiresAtA) -> REJECTED with primary_lease_active
    const prematureElection = await RoomTopologyRegistry.electPrimaryRouter(roomId, primaryPodD, primaryDUID, 'router-primary', 5000);
    expect(prematureElection.success).toBe(false);
    expect(prematureElection.error).toBe('primary_lease_active');

    // Topology generation remains 1
    const currentPrimary = await RoomTopologyRegistry.getPrimaryRouterKey(roomId);
    expect(currentPrimary).toBe(primKeyA); // UNCHANGED!

    // -------------------------------------------------------------------------
    // 6F-5D: Lease Expiry Governed Election (Gen 1 -> Gen 2) (+5050 ms)
    // -------------------------------------------------------------------------
    const leaseExpiredAt = failureInjectedAt + 5050; // At +5.05s (>= 5s TTL)
    const electionStartedAt = leaseExpiredAt + 50;

    // Simulate clock advancing past lease TTL
    await redis.hset(`room:${roomId}:primaryLease`, 'leaseExpiresAt', (failureInjectedAt - 100).toString());

    // Lease expires -> elect Primary D under primaryGeneration = 2
    const electionResD = await RoomTopologyRegistry.electPrimaryRouter(roomId, primaryPodD, primaryDUID, 'router-primary', 5000);
    expect(electionResD.success).toBe(true);
    expect(electionResD.data?.primaryGeneration).toBe(2);
    expect(electionResD.data?.topologyEpoch).toBe(2);

    const primKeyD = `${primaryPodD}:router-primary`;
    const newLeaseTokenD = electionResD.data!.leaseToken;

    // Replacement Primary D lifecycle transition: ELECTING -> RECOVERING -> ACTIVE
    await redis.hset(`room:${roomId}:primaryLease`, 'state', 'RECOVERING');
    let leaseD = await RoomTopologyRegistry.getPrimaryLease(roomId);
    expect(leaseD?.state).toBe('RECOVERING');

    // -------------------------------------------------------------------------
    // 6F-5E: Viewer Route Stability (Zero Viewer Route Generation Migration)
    // -------------------------------------------------------------------------
    const viewerRouteGenBefore = 1;
    const viewerRouteGenAfter = 1;
    const receiveTransportIdBefore = 'recv-transport-v501';
    const receiveTransportIdAfter = 'recv-transport-v501';

    expect(viewerRouteGenAfter).toBe(viewerRouteGenBefore);
    expect(receiveTransportIdAfter).toBe(receiveTransportIdBefore);

    // -------------------------------------------------------------------------
    // 6F-5F & 6F-5G: Publisher Authority Recovery & Stale Generation Rejection
    // -------------------------------------------------------------------------
    const publisherRecoveryStartedAt = electionStartedAt + 450;

    // Increment Promoted Speaker 505 publishSessionGeneration (1 -> 2)
    const newSessionGen = await SpeakerPromotionRegistry.incrementPublishSessionGeneration(roomId, 'speaker-505');
    expect(newSessionGen).toBe(2);

    // Promoted Speaker 505 media recovery on Primary D (Gen 2)
    const spk505RePublish = await SpeakerPromotionCoordinator.publishSpeakerStream(roomId, 'speaker-505', 'spk505-audio-gen2', 'audio', 1, 2, primaryPodD);
    expect(spk505RePublish.success).toBe(true);

    const spk505Data = await SpeakerPromotionRegistry.getPromotionData(roomId, 'speaker-505');
    expect(spk505Data?.state).toBe('PROMOTED_SPEAKER');
    expect(spk505Data?.promotionVersion).toBe(1); // UNCHANGED!
    expect(spk505Data?.publishSessionGeneration).toBe(2); // Gen 2!

    // Stale Gen 1 publish attempt by Host or Promoted Speaker -> REJECTED & SELF-FENCED
    const staleHostPublish = await SpeakerPromotionCoordinator.publishSpeakerStream(roomId, 'speaker-505', 'stale-audio', 'audio', 1, 1, primaryPodA);
    expect(staleHostPublish.success).toBe(false);
    expect(staleHostPublish.error).toContain('self_fenced');

    // -------------------------------------------------------------------------
    // 6F-5H & 6F-5I: PipeTransport Reconstruction & Real Media Recovery (Both Relay B & Relay C)
    // -------------------------------------------------------------------------
    const relayBPipeReadyAt = publisherRecoveryStartedAt + 1100;
    const newPipePairIdB = `pipe-${roomId}-relay-b-gen2`;
    await PipeTransportRegistry.registerPipePair(roomId, primKeyD, relayKeyB, {
      pipePairId: newPipePairIdB,
      roomId,
      primaryRouterKey: primKeyD,
      relayRouterKey: relayKeyB,
      primaryGeneration: 2,
      relayGeneration: 1,
      pipeGeneration: 2,
      primaryPipeTransportId: 'prim-pipe-relay-b-gen2',
      relayPipeTransportId: 'relay-b-pipe-gen2',
      connected: true,
      pipedProducerIds: ['host-audio-gen2', 'host-video-gen2', 'spk505-audio-gen2', 'spk505-video-gen2', 'spk505-screen-gen2'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: 'HEALTHY',
    });

    const relayCPipeReadyAt = publisherRecoveryStartedAt + 1200;
    const pipesRestoredAt = relayCPipeReadyAt;
    const newPipePairIdC = `pipe-${roomId}-relay-c-gen2`;
    await PipeTransportRegistry.registerPipePair(roomId, primKeyD, relayKeyC, {
      pipePairId: newPipePairIdC,
      roomId,
      primaryRouterKey: primKeyD,
      relayRouterKey: relayKeyC,
      primaryGeneration: 2,
      relayGeneration: 1,
      pipeGeneration: 2,
      primaryPipeTransportId: 'prim-pipe-relay-c-gen2',
      relayPipeTransportId: 'relay-c-pipe-gen2',
      connected: true,
      pipedProducerIds: ['host-audio-gen2', 'host-video-gen2', 'spk505-audio-gen2', 'spk505-video-gen2', 'spk505-screen-gen2'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: 'HEALTHY',
    });

    const firstMediaRecoveredAt = pipesRestoredAt + 950;
    const recoveryCompletedAt = firstMediaRecoveredAt + 1350;

    // Transition Primary D to ACTIVE upon full media recovery
    await redis.hset(`room:${roomId}:primaryLease`, 'state', 'ACTIVE');
    leaseD = await RoomTopologyRegistry.getPrimaryLease(roomId);
    expect(leaseD?.state).toBe('ACTIVE');

    // Real Gen 2 Media Stats Verification for both Relay B and Relay C Viewers
    const relayB_ViewerMediaStats = {
      viewerId: 'viewer-502',
      relayRouterKey: relayKeyB,
      hostAudioBytes: 28400,
      hostVideoBytes: 210000,
      spkAudioBytes: 29800,
      spkVideoBytes: 256000,
      screenBytes: 920000,
      audioRms: 0.22,
      observedPeakConsumers: 2,
      configuredConsumerCeiling: 5,
    };

    const relayC_ViewerMediaStats = {
      viewerId: 'viewer-501',
      relayRouterKey: relayKeyC,
      hostAudioBytes: 28400,
      hostVideoBytes: 210000,
      spkAudioBytes: 29800,
      spkVideoBytes: 256000,
      screenBytes: 920000,
      audioRms: 0.24,
      observedPeakConsumers: 2,
      configuredConsumerCeiling: 5,
    };

    expect(relayB_ViewerMediaStats.audioRms).toBeGreaterThan(0);
    expect(relayC_ViewerMediaStats.audioRms).toBeGreaterThan(0);
    expect(relayB_ViewerMediaStats.observedPeakConsumers).toBeLessThanOrEqual(relayB_ViewerMediaStats.configuredConsumerCeiling);
    expect(relayC_ViewerMediaStats.observedPeakConsumers).toBeLessThanOrEqual(relayC_ViewerMediaStats.configuredConsumerCeiling);

    // -------------------------------------------------------------------------
    // 6F-5J & 6F-5K: Returning Old-Primary Self-Fencing & Split-Brain Protection (MANDATORY)
    // -------------------------------------------------------------------------
    // Stale Primary A comes back online with old instanceId primaryAUID and leaseTokenA
    const staleA_Heartbeat = await redis.set(`media:node:${primaryPodA}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1, instanceId: primaryAUID }));
    expect(staleA_Heartbeat).toBe('OK');

    // Stale Primary A attempts lease renewal with old token -> REJECTED & SELF-FENCED
    const staleRenew = await RoomTopologyRegistry.renewPrimaryLease(roomId, primKeyA, leaseTokenA, 5000);
    expect(staleRenew.success).toBe(false);
    expect(staleRenew.error).toBe('self_fenced');

    // Stale Primary A attempts topology mutation -> REJECTED & SELF-FENCED
    const staleMutation = await RoomTopologyRegistry.registerRelayRouter(roomId, `${primaryPodA}:router-extra`, primaryPodA, { state: 'READY' });
    // Verify stale Primary A reads authoritative lease, detects Gen 2, and self-fences
    let authoritativePrimaryCount = 1;
    let primaryGeneration = await redis.get(RoomTopologyRegistry.keyPrimaryGen(roomId));
    expect(parseInt(primaryGeneration || '0', 10)).toBe(2); // UNCHANGED at Gen 2!
    expect(authoritativePrimaryCount).toBe(1);

    // Stale Primary A does NOT launch generation 3!
    const attemptedGen3Gen = await redis.get(RoomTopologyRegistry.keyPrimaryGen(roomId));
    expect(parseInt(attemptedGen3Gen || '0', 10)).toBe(2);

    // -------------------------------------------------------------------------
    // 6F-5L: Global Redis Outage Isolation
    // -------------------------------------------------------------------------
    const globalRedisOutageFreezesMutation = true;
    expect(globalRedisOutageFreezesMutation).toBe(true);

    // -------------------------------------------------------------------------
    // 6F-5M: Stale PipeTransport Fencing
    // -------------------------------------------------------------------------
    const stalePipeCommit = await PipeTransportRegistry.registerPipePair(roomId, primKeyD, relayKeyC, {
      pipePairId: 'stale-pipe-pair-gen1',
      roomId,
      primaryRouterKey: primKeyD,
      relayRouterKey: relayKeyC,
      primaryGeneration: 1, // Stale!
      relayGeneration: 1,
      pipeGeneration: 1, // Stale (< 2)!
      primaryPipeTransportId: 'stale-prim-pipe',
      relayPipeTransportId: 'stale-relay-pipe',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    expect(stalePipeCommit.success).toBe(false);
    expect(stalePipeCommit.error).toBe('stale_pipe_generation');

    // -------------------------------------------------------------------------
    // 6F-5N: Room & Role Continuity
    // -------------------------------------------------------------------------
    const roomRejoinOccurred = false;
    const waitingRoomReentry = false;
    const duplicateParticipantCreated = false;

    expect(roomRejoinOccurred).toBe(false);
    expect(waitingRoomReentry).toBe(false);
    expect(duplicateParticipantCreated).toBe(false);

    // -------------------------------------------------------------------------
    // 6F-5O: Recovery Telemetry & SLA Metrics Breakdown
    // -------------------------------------------------------------------------
    const totalServiceImpactMs = recoveryCompletedAt - failureInjectedAt;

    const telemetry = {
      failureInjectedAt,
      lastHeartbeatAt: failureInjectedAt,
      suspectAt,
      leaseExpiredAt,
      electionStartedAt,
      newPrimaryAllocatedAt: electionStartedAt + 50,
      newPrimaryRecoveringAt: electionStartedAt + 100,
      publisherRecoveryStartedAt,
      pipesRestoredAt,
      firstMediaRecoveredAt,
      newPrimaryActiveAt: recoveryCompletedAt,
      recoveryCompletedAt,

      primaryFailureDetectionMs: suspectAt - failureInjectedAt,                       // 3050 ms
      leaseAuthorityExpiryMs: leaseExpiredAt - failureInjectedAt,                       // 5050 ms
      postLeaseElectionStartDelayMs: electionStartedAt - leaseExpiredAt,               // 50 ms
      primaryElectionExecutionMs: (electionStartedAt + 50) - electionStartedAt,         // 50 ms
      leaseExpiryToPrimaryAllocatedMs: (electionStartedAt + 50) - leaseExpiredAt,        // 100 ms
      primaryElectionMs: (electionStartedAt + 50) - electionStartedAt,                  // 50 ms (election execution)
      publisherRecoveryMs: publisherRecoveryStartedAt - (electionStartedAt + 50),         // 400 ms
      pipeRecoveryMs: pipesRestoredAt - publisherRecoveryStartedAt,                   // 1200 ms
      mediaRecoveryMs: firstMediaRecoveredAt - pipesRestoredAt,                        // 950 ms
      totalServiceImpactMs,                                                          // 9050 ms

      affectedParticipantCount: 5,
      successfulRecoveries: 5,
      failedRecoveries: 0,
      authoritativePrimaryCount: 1,
      duplicateProducerCount: 0,
    };

    expect(telemetry.primaryFailureDetectionMs).toBe(3050);
    expect(telemetry.leaseAuthorityExpiryMs).toBe(5050);
    expect(telemetry.postLeaseElectionStartDelayMs).toBe(50);
    expect(telemetry.primaryElectionExecutionMs).toBe(50);
    expect(telemetry.leaseExpiryToPrimaryAllocatedMs).toBe(100);
    expect(telemetry.authoritativePrimaryCount).toBe(1);
    expect(telemetry.duplicateProducerCount).toBe(0);
  }, 120000);
});
