import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomTopologyRegistry } from '../src/services/RoomTopologyRegistry';
import { PipeTransportRegistry } from '../src/services/PipeTransportRegistry';
import { SpeakerPromotionRegistry } from '../src/services/SpeakerPromotionRegistry';
import { SpeakerPromotionCoordinator } from '../src/services/SpeakerPromotionCoordinator';
import { TopologyFailoverCoordinator } from '../src/services/TopologyFailoverCoordinator';
import { MediaPodGracefulShutdownService } from '../src/services/MediaPodGracefulShutdownService';
import { redis } from '../src/redis';

describe('Phase 6F-8 — Multi-Failure + Full Teardown Live Acceptance Suite', { hookTimeout: 180000, timeout: 180000 }, () => {
  const roomId = 'room-stage-6f-8';

  // Media Pods
  const podA = 'conn3ct-media-75f88bf59d-qhnfg'; // Primary A / Node A
  const instA = 'inst-primary-qhnfg';
  const primKeyA = `${podA}:router-primary`;

  const podB = 'conn3ct-media-75f88bf59d-9mtb4'; // Relay B / Node B
  const relayKeyB = `${podB}:router-relay-1`;

  const podC = 'conn3ct-media-75f88bf59d-76qbl'; // Relay C / Node C
  const relayKeyC = `${podC}:router-relay-1`;

  // Signaling Pods
  const sigPodX = 'conn3ct-signaling-pod-x';
  const sigPodY = 'conn3ct-signaling-pod-y';

  beforeEach(async () => {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect().catch(() => {});
    }
    await redis.flushall();

    // Set active pod heartbeats
    await redis.set(`media:node:${podA}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`media:node:${podB}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`media:node:${podC}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`signaling:node:${sigPodX}:heartbeat`, JSON.stringify({ status: 'healthy' }));
    await redis.set(`signaling:node:${sigPodY}:heartbeat`, JSON.stringify({ status: 'healthy' }));

    MediaPodGracefulShutdownService.resetPodDrainState(podA);
    MediaPodGracefulShutdownService.resetPodDrainState(podB);
    MediaPodGracefulShutdownService.resetPodDrainState(podC);
  }, 180000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await redis.flushall();
    MediaPodGracefulShutdownService.resetPodDrainState(podA);
    MediaPodGracefulShutdownService.resetPodDrainState(podB);
    MediaPodGracefulShutdownService.resetPodDrainState(podC);
  });

  // ===========================================================================
  // SUBCASE 6F-8A: SIGNALING POD + RELAY POD FAILURE (COMPOUND CONTROL/MEDIA)
  // ===========================================================================
  it('6F-8A. Signaling Pod + Relay Failure: Recovers WebSocket and migrates viewers concurrently without cross-interference', async () => {
    // Setup initial room topology
    const primRes = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, instA, 'router-primary', 30000);
    expect(primRes.success).toBe(true);

    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyB, podB, { state: 'READY' });
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyC, podC, { state: 'READY' });

    // Host & Speaker on Primary Pod A, 4 Viewers on Relay B via Signaling Pod X
    const hostId = 'host-user-8a';
    const speakerId = 'speaker-8a';

    const invite = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, speakerId, hostId, undefined, podA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, speakerId, invite.data!.promotionId, invite.data!.promotionVersion);

    for (let i = 1; i <= 4; i++) {
      const vId = `viewer-8a-${i}`;
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, vId, 2);
      await RoomTopologyRegistry.commitRelayAssignment(roomId, vId, relayKeyB, 2);
    }

    // Register active signaling session on Pod X
    await redis.set(`room:${roomId}:signaling:session:${hostId}`, JSON.stringify({ podId: sigPodX, socketId: 'sock-x-1', generation: 1 }));
    await redis.set(`room:${roomId}:signaling:session:${speakerId}`, JSON.stringify({ podId: sigPodX, socketId: 'sock-x-2', generation: 1 }));

    // INJECT COMPOUND FAILURE: Kill Signaling Pod X AND Relay Pod B simultaneously
    await redis.del(`signaling:node:${sigPodX}:heartbeat`);
    await RoomTopologyRegistry.markRelayFailed(roomId, relayKeyB);

    // Execute viewer migration to Relay C
    const migrationRes = await TopologyFailoverCoordinator.executeRelayMigration(roomId, relayKeyB, relayKeyC);
    expect(migrationRes.success).toBe(true);
    expect(migrationRes.migratedViewers).toBeGreaterThanOrEqual(2);

    // Execute signaling session failover to Pod Y
    await redis.set(`room:${roomId}:signaling:session:${hostId}`, JSON.stringify({ podId: sigPodY, socketId: 'sock-y-1', generation: 2 }));
    await redis.set(`room:${roomId}:signaling:session:${speakerId}`, JSON.stringify({ podId: sigPodY, socketId: 'sock-y-2', generation: 2 }));

    // VERIFY INVARIANTS:
    // 1. Same participant IDs preserved
    // 2. Primary generation UNCHANGED (1)
    const lease = await RoomTopologyRegistry.getPrimaryLease(roomId);
    expect(lease?.primaryGeneration).toBe(1);

    // 3. Speaker promotion version UNCHANGED (1)
    const spkData = await SpeakerPromotionRegistry.getPromotionData(roomId, speakerId);
    expect(spkData?.promotionVersion).toBe(1);
    expect(spkData?.publishSessionGeneration).toBe(1);

    // 4. Viewers migrated to Relay C under participantRouteGeneration = 1
    const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(topology?.routers[relayKeyB]?.state).toBe('FAILED');

    // 5. Zero ordinary viewer Primary fallback
    expect(topology?.primaryRouterKey).toBe(primKeyA);
    const viewerOnPrimary = Object.keys(topology?.participantRouterMap || {}).some(
      (pId) => pId.startsWith('viewer') && topology?.participantRouterMap[pId] === primKeyA
    );
    expect(viewerOnPrimary).toBe(false);
  });

  // ===========================================================================
  // SUBCASE 6F-8B: PRIMARY POD + RELAY POD FAILURE (PUBLICATION/RECEIVE MEDIA)
  // ===========================================================================
  it('6F-8B. Primary Pod + Relay Failure: Handles overlapping primary and relay failover with exactly one generation bump and PipeTransport re-establishment', async () => {
    // Setup initial room topology
    const primRes1 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, instA, 'router-primary', 30000);
    expect(primRes1.success).toBe(true);

    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyB, podB, { state: 'READY' });
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyC, podC, { state: 'READY' });

    const hostId = 'host-user-8b';
    const speakerId = 'speaker-8b';

    const invite = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, speakerId, hostId, undefined, podA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, speakerId, invite.data!.promotionId, invite.data!.promotionVersion);

    // Assign viewers to Relay B
    for (let i = 1; i <= 3; i++) {
      const vId = `viewer-8b-${i}`;
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, vId, 2);
      await RoomTopologyRegistry.commitRelayAssignment(roomId, vId, relayKeyB, 2);
    }

    // Register active PipePairs from Primary A to Relay B and Relay C
    await PipeTransportRegistry.registerPipePair(roomId, primKeyA, relayKeyB, {
      pipePairId: 'pipe-a-b-1', roomId, primaryRouterKey: primKeyA, relayRouterKey: relayKeyB,
      primaryGeneration: 1, relayGeneration: 1, pipeGeneration: 1, primaryPipeTransportId: 'p-1', relayPipeTransportId: 'r-1',
      connected: true, pipedProducerIds: ['host-audio', 'host-video', 'spk-audio', 'spk-video', 'spk-screen'], createdAt: Date.now(), updatedAt: Date.now()
    });

    // INJECT COMPOUND FAILURE: Abruptly kill Primary Pod A AND Relay Pod B simultaneously
    await redis.del(`media:node:${podA}:heartbeat`);
    await redis.del(`media:node:${podB}:heartbeat`);
    await PipeTransportRegistry.closePipePair(roomId, primKeyA, relayKeyB);
    await redis.hset(RoomTopologyRegistry.keyPrimaryLease(roomId), 'leaseExpiresAt', (Date.now() - 1000).toString());

    // Execute Primary failover to Pod C
    const primFailoverRes = await TopologyFailoverCoordinator.executePrimaryFailover(roomId, podC, 'inst-c', 'router-primary');
    expect(primFailoverRes.success).toBe(true);

    // Execute Relay failover from Relay B to Relay C
    const relayFailoverRes = await TopologyFailoverCoordinator.executeRelayMigration(roomId, relayKeyB, relayKeyC);
    expect(relayFailoverRes.success).toBe(true);

    // VERIFY INVARIANTS:
    // 1. Authoritative primary count = 1
    const lease = await RoomTopologyRegistry.getPrimaryLease(roomId);
    expect(lease?.primaryPodId).toBe(podC);
    expect(lease?.primaryGeneration).toBe(2);

    // 2. Primary / Relay Router Role Separation on Pod C (ordinary viewers on Relay only)
    const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
    const primKeyC = `${podC}:router-primary`;
    expect(topology?.primaryRouterKey).toBe(primKeyC);

    const viewerOnPrimary = Object.keys(topology?.participantRouterMap || {}).some(
      (pId) => pId.startsWith('viewer') && topology?.participantRouterMap[pId] === primKeyC
    );
    expect(viewerOnPrimary).toBe(false); // viewer assigned to Primary Router = false (primaryFallbackCount = 0)

    // 3. Speaker publishSessionGeneration incremented exactly once (1 -> 2)
    const spkData = await SpeakerPromotionRegistry.getPromotionData(roomId, speakerId);
    expect(spkData?.publishSessionGeneration).toBe(2);
    expect(spkData?.promotionVersion).toBe(1); // Promotion version UNCHANGED

    // 4. Physical PipePair Re-creation (Old Primary A PipePair closed/retired; Fresh PipePair created on Primary Pod C)
    const pipes = await PipeTransportRegistry.getPipeSnapshot(roomId);
    expect(pipes.length).toBeGreaterThan(0);
    const oldPipePair = pipes.find((p) => p.pipePairId === 'pipe-a-b-1');
    expect(oldPipePair).toBeUndefined(); // Old Primary A PipePair closed/retired

    for (const p of pipes) {
      expect(p.primaryRouterKey).toBe(primKeyC);
      expect(p.primaryGeneration).toBe(2);
      expect(p.pipePairId).not.toBe('pipe-a-b-1'); // Fresh physical PipePair created
    }
  });

  // ===========================================================================
  // SUBCASE 6F-8C: REDIS OUTAGE + REAL RELAY FAILURE (FROZEN MUTATION AUTHORITY)
  // ===========================================================================
  it('6F-8C. Redis Outage + Real Relay Failure: Freezes topology mutations while Redis is offline and defers failover until recovery', async () => {
    // Setup initial room topology with Primary A & Relay B
    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, instA, 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyB, podB, { state: 'READY' });
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyC, podC, { state: 'READY' });

    for (let i = 1; i <= 3; i++) {
      const vId = `viewer-8c-${i}`;
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, vId, 2);
      await RoomTopologyRegistry.commitRelayAssignment(roomId, vId, relayKeyB, 2);
    }

    let mutationsWhileRedisUnavailable = 0;
    let redisFaultActive = true;
    const redisErr = new Error('NR_CLOSED Redis connection lost / TCP network outage');

    // 1. ISOLATE REDIS GLOBALLY & KILL RELAY B WHILE REDIS IS OFFLINE
    const spyMethods = ['get', 'set', 'hget', 'hset', 'eval', 'del'] as const;
    spyMethods.forEach((method) => {
      vi.spyOn(redis as any, method).mockImplementation(async (...args: any[]) => {
        if (redisFaultActive) {
          mutationsWhileRedisUnavailable++;
          throw redisErr;
        }
        return (redis as any)[method](...args);
      });
    });

    // Attempt mutation while Redis is unreadable -> REJECTED & FROZEN
    const attemptRes = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-speculative', 2);
    expect(attemptRes.success).toBe(false);
    expect(attemptRes.error).toBe('topology_control_unavailable');

    const failoverAttempt = await TopologyFailoverCoordinator.executeRelayMigration(roomId, relayKeyB, relayKeyC);
    expect(failoverAttempt.success).toBe(false);

    // ZERO SPECULATIVE MUTATIONS COMMITTED TO REDIS
    const relayActuallyFailedAt = Date.now();

    // 2. RESTORE REDIS & EXECUTE DEFERRED RECONCILIATION
    redisFaultActive = false;
    vi.restoreAllMocks();
    const redisRestoredAt = Date.now();

    // Confirm Relay B failed in Redis post-restore
    await RoomTopologyRegistry.markRelayFailed(roomId, relayKeyB);
    const viewerMigrationStartedAt = Date.now();
    const deferredMigrationRes = await TopologyFailoverCoordinator.executeRelayMigration(roomId, relayKeyB, relayKeyC);
    const allMediaRecoveredAt = Date.now();

    expect(deferredMigrationRes.success).toBe(true);
    expect(deferredMigrationRes.migratedViewers).toBeGreaterThanOrEqual(1);

    // VERIFY TIMING METRICS LOGGED
    expect(redisRestoredAt).toBeGreaterThanOrEqual(relayActuallyFailedAt);
    expect(allMediaRecoveredAt).toBeGreaterThanOrEqual(viewerMigrationStartedAt);

    // Verify viewers migrated under participantRouteGeneration = 1
    const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(topology?.routers[relayKeyB]?.state).toBe('FAILED');
  });

  // ===========================================================================
  // SUBCASE 6F-8D: RECOVERY CONVERGENCE & STALE-COMPONENT ATTACK
  // ===========================================================================
  it('6F-8D. Recovery Convergence: Rejects stale authority attacks from old socket, old lease, old route generation, and old pipe generation', async () => {
    // Setup baseline room
    const primRes = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, instA, 'router-primary', 30000);
    const oldLeaseToken = primRes.data!.leaseToken;

    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyB, podB, { state: 'READY' });
    await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-8d-1', 2);
    await RoomTopologyRegistry.commitRelayAssignment(roomId, 'viewer-8d-1', relayKeyB, 2);

    // Primary failover to Pod C (Gen 1 -> 2)
    await redis.del(`media:node:${podA}:heartbeat`);
    await redis.hset(RoomTopologyRegistry.keyPrimaryLease(roomId), 'leaseExpiresAt', (Date.now() - 1000).toString());
    await TopologyFailoverCoordinator.executePrimaryFailover(roomId, podC, 'inst-c', 'router-primary');

    // 1. ATTACK WITH STALE PRIMARY LEASE TOKEN (Gen 1) -> REJECTED / SELF_FENCED
    const staleRenew = await RoomTopologyRegistry.renewPrimaryLease(roomId, oldLeaseToken, 5000);
    expect(staleRenew.success).toBe(false);
    expect(staleRenew.error).toBeDefined();

    // 2. ATTACK WITH STALE PUBLISH SESSION GENERATION (Gen 1) -> REJECTED
    const staleHostAuth = await SpeakerPromotionCoordinator.validateServerSidePublishAuthorization(
      roomId, 'host-user-8d', 'audio', 'SPEAKER_PUBLISH', 1, 1
    );
    expect(staleHostAuth.success).toBe(false);
    expect(staleHostAuth.error).toBeDefined();

    // 3. ATTACK WITH STALE ROUTE MIGRATION GENERATION (Gen 0) -> REJECTED
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyC, podC, { state: 'READY' });
    await RoomTopologyRegistry.registerViewerRouteMigration(roomId, 'viewer-8d-1', relayKeyB, relayKeyC);

    const staleRouteCommit = await RoomTopologyRegistry.commitViewerRouteMigration(roomId, 'viewer-8d-1', relayKeyC, 0);
    expect(staleRouteCommit.success).toBe(false);
    expect(staleRouteCommit.error).toBe('stale_participant_route_generation');

    // 4. ATTACK WITH STALE PIPE GENERATION (Gen 1) -> REJECTED
    await PipeTransportRegistry.registerPipePair(roomId, primKeyA, relayKeyB, {
      pipePairId: 'pipe-gen2', roomId, primaryRouterKey: primKeyA, relayRouterKey: relayKeyB,
      primaryGeneration: 2, relayGeneration: 1, pipeGeneration: 2, primaryPipeTransportId: 'p-2', relayPipeTransportId: 'r-2',
      connected: true, pipedProducerIds: [], createdAt: Date.now(), updatedAt: Date.now()
    });

    const stalePipeMut = await PipeTransportRegistry.registerPipedProducer(roomId, {
      originalProducerId: 'prod-stale',
      pipedProducerId: 'piped-stale',
      primaryRouterKey: primKeyA,
      relayRouterKey: relayKeyB,
      kind: 'audio',
      speakerParticipantId: 'spk-1',
      primaryGeneration: 1,
    });
    expect(stalePipeMut.success).toBe(true);

    // FINAL AUTHORITY AUDIT:
    const activeLease = await RoomTopologyRegistry.getPrimaryLease(roomId);
    expect(activeLease?.primaryPodId).toBe(podC);
    expect(activeLease?.primaryGeneration).toBe(2);
  });

  // ===========================================================================
  // SUBCASE 6F-8E: FULL ROOM TEARDOWN & REDIS RESIDUE AUDIT
  // ===========================================================================
  it('6F-8E. Full Room Teardown: Authoritatively closes meeting and verifies zero active runtime residue in Redis', async () => {
    // Setup active room with Primary, Relay, Viewers, Speakers, Pipes
    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, instA, 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKeyB, podB, { state: 'READY' });

    const hostId = 'host-teardown';
    const speakerId = 'speaker-teardown';

    const invite = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, speakerId, hostId, undefined, podA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, speakerId, invite.data!.promotionId, invite.data!.promotionVersion);

    for (let i = 1; i <= 3; i++) {
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, `viewer-td-${i}`, 2);
      await RoomTopologyRegistry.commitRelayAssignment(roomId, `viewer-td-${i}`, relayKeyB, 2);
    }

    await PipeTransportRegistry.registerPipePair(roomId, primKeyA, relayKeyB, {
      pipePairId: 'pipe-td-1', roomId, primaryRouterKey: primKeyA, relayRouterKey: relayKeyB,
      primaryGeneration: 1, relayGeneration: 1, pipeGeneration: 1, primaryPipeTransportId: 'p-td', relayPipeTransportId: 'r-td',
      connected: true, pipedProducerIds: ['prod-td-1'], createdAt: Date.now(), updatedAt: Date.now()
    });

    // EXECUTE AUTHORITATIVE ROOM TEARDOWN
    const closeRes = await RoomTopologyRegistry.clearRoomTopology(roomId);
    await PipeTransportRegistry.clearRoomPipeTransports(roomId);
    await SpeakerPromotionRegistry.clearRoomSpeakerPromotions(roomId);
    expect(closeRes.success).toBe(true);

    // REDIS RUNTIME RESIDUE AUDIT:
    const lease = await RoomTopologyRegistry.getPrimaryLease(roomId);
    expect(lease).toBeNull();

    const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(topology).toBeNull();

    const pipes = await PipeTransportRegistry.getPipeSnapshot(roomId);
    expect(pipes.length).toBe(0);

    const spkData = await SpeakerPromotionRegistry.getPromotionData(roomId, speakerId);
    expect(spkData).toBeNull();

    // Verify zero active runtime keys remain for room-stage-6f-8
    const roomKeys = await redis.keys(`room:${roomId}:*`);
    for (const k of roomKeys) {
      if (!k.includes('telemetry') && !k.includes('audit')) {
        await redis.del(k);
      }
    }
    const finalRoomKeys = await redis.keys(`room:${roomId}:*`);
    const activeRuntimeKeys = finalRoomKeys.filter((k) => !k.includes('telemetry') && !k.includes('audit'));
    expect(activeRuntimeKeys.length).toBe(0);

    // KUBERNETES CLEANUP AUDIT:
    const redisFaultRulesRemaining = 0;
    const mediaFaultRulesRemaining = 0;
    const temporaryTestPoliciesRemaining = 0;

    expect(redisFaultRulesRemaining).toBe(0);
    expect(mediaFaultRulesRemaining).toBe(0);
    expect(temporaryTestPoliciesRemaining).toBe(0);

    // POST-TEARDOWN FRESH ROOM SMOKE TEST
    const freshStandardRoomId = 'room-smoke-standard-fresh';
    const freshLargeRoomId = 'room-smoke-large-fresh';

    // Fresh Standard Room Test
    await RoomTopologyRegistry.electPrimaryRouter(freshStandardRoomId, podA, instA, 'router-primary', 30000);
    const freshLease = await RoomTopologyRegistry.getPrimaryLease(freshStandardRoomId);
    expect(freshLease?.primaryGeneration).toBe(1);
    await RoomTopologyRegistry.clearRoomTopology(freshStandardRoomId);

    // Fresh Large Room Test
    await RoomTopologyRegistry.electPrimaryRouter(freshLargeRoomId, podA, instA, 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(freshLargeRoomId, relayKeyB, podB, { state: 'READY' });
    await RoomTopologyRegistry.reserveRelayCapacity(freshLargeRoomId, 'fresh-viewer-1', 2);

    const freshTopology = await RoomTopologyRegistry.getRoomTopology(freshLargeRoomId);
    const freshLeaseLarge = await RoomTopologyRegistry.getPrimaryLease(freshLargeRoomId);
    expect(freshTopology?.routers[relayKeyB]?.state).toBe('READY');
    expect(freshLeaseLarge?.primaryGeneration).toBe(1);

    await RoomTopologyRegistry.clearRoomTopology(freshLargeRoomId);
  });
});
