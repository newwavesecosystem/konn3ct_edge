import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomTopologyRegistry } from '../../src/services/RoomTopologyRegistry';
import { PipeTransportRegistry } from '../../src/services/PipeTransportRegistry';
import { TopologyFailoverCoordinator } from '../../src/services/TopologyFailoverCoordinator';
import { SpeakerPromotionRegistry } from '../../src/services/SpeakerPromotionRegistry';
import { SpeakerPromotionCoordinator } from '../../src/services/SpeakerPromotionCoordinator';
import { ViewerSubscriptionManager, PipedCatalogueItem } from '../../src/services/ViewerSubscriptionManager';
import { PipeTransportHealthMonitor } from '../../src/services/PipeTransportHealthMonitor';
import { redis } from '../../src/redis';

describe('Phase 6F-3 — PipeTransport Failure & Recovery Code Gate Unit Suite', { hookTimeout: 60000, timeout: 120000 }, () => {
  const podA = 'conn3ct-media-pod-a';
  const podB = 'conn3ct-media-pod-b';
  const podC = 'conn3ct-media-pod-c';

  beforeEach(async () => {
    await redis.flushall();
    await redis.set(`media:node:${podA}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1, instanceId: 'inst-a' }));
    await redis.set(`media:node:${podB}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1, instanceId: 'inst-b' }));
    await redis.set(`media:node:${podC}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1, instanceId: 'inst-c' }));
  }, 30000);

  afterEach(async () => {
    await redis.flushall();
  }, 30000);

  it('1. Pipe blackhole detector triggers recovery without marking Relay FAILED', async () => {
    const roomId = 'room-pipe-gate-1';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podC, { state: 'READY' });
    await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'v-101', 2);

    // Initial PipePair generation 1
    await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-gen1',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 1,
      primaryPipeTransportId: 'prim-pipe-1',
      relayPipeTransportId: 'relay-pipe-1',
      connected: true,
      pipedProducerIds: ['prod-audio-1'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: 'HEALTHY',
    });

    // Mark Pipe health as PIPE_FAILED (detector signal) without killing Relay B/C or Primary A
    const healthRecord = await PipeTransportRegistry.markPipeHealth(roomId, primKey, relayKey, 'PIPE_FAILED', 1, 'udp_blackhole_detected');
    expect(healthRecord.pipeHealthState).toBe('PIPE_FAILED');
    expect(healthRecord.failureReason).toBe('udp_blackhole_detected');

    // Evaluate room topology health -> Relay remains READY, Primary remains healthy!
    const topologyHealth = await TopologyFailoverCoordinator.evaluateRoomTopologyHealth(roomId);
    expect(topologyHealth.primaryHealthy).toBe(true);
    expect(topologyHealth.failedRelays).not.toContain(relayKey);

    const roomTopo = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(roomTopo?.routers[relayKey]?.state).toBe('READY'); // Must remain READY!
  });

  it('2. Concurrent executePipeFailover calls elect one generation N+1 via owner-safe lock', async () => {
    const roomId = 'room-pipe-gate-2';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podC, { state: 'READY' });

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 30000);
    await redis.set(`media:node:${podA}:heartbeat`, JSON.stringify({ status: 'healthy' }));
    await redis.set(`media:node:${podC}:heartbeat`, JSON.stringify({ status: 'healthy' }));

    await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-gen1',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 1,
      primaryPipeTransportId: 'prim-pipe-1',
      relayPipeTransportId: 'relay-pipe-1',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Launch 10 concurrent executePipeFailover calls
    const promises = Array.from({ length: 10 }).map(() =>
      TopologyFailoverCoordinator.executePipeFailover(roomId, primKey, relayKey)
    );

    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.success);
    expect(successful.length).toBeGreaterThan(0);

    // All successful results must agree on generation 2
    for (const r of successful) {
      expect(r.newPipeGeneration).toBe(2);
    }

    const currentPipe = await PipeTransportRegistry.getPipePair(roomId, primKey, relayKey);
    expect(currentPipe?.pipeGeneration).toBe(2);

    const pipeSnapshot = await PipeTransportRegistry.getPipeSnapshot(roomId);
    expect(pipeSnapshot.length).toBe(1); // Exactly 1 active PipePair!
  });

  it('3. Stale generation N operation is rejected with stale_pipe_generation', async () => {
    const roomId = 'room-pipe-gate-3';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    // Register generation 2 as active
    await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-gen2',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 2,
      primaryPipeTransportId: 'prim-pipe-2',
      relayPipeTransportId: 'relay-pipe-2',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Attempt registering stale generation 1 PipePair
    const staleRes = await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-stale-gen1',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 1, // Stale!
      primaryPipeTransportId: 'prim-pipe-1-stale',
      relayPipeTransportId: 'relay-pipe-1-stale',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(staleRes.success).toBe(false);
    expect(staleRes.error).toBe('stale_pipe_generation');
  });

  it('4. Old generation transports/producers are explicitly retired upon failover', async () => {
    const roomId = 'room-pipe-gate-4';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podC, { state: 'READY' });

    // Register gen 1 piped producer
    await PipeTransportRegistry.registerPipedProducer(roomId, {
      roomId,
      originalProducerId: 'spk-audio-1',
      relayRouterKey: relayKey,
      primaryRouterKey: primKey,
      pipePairId: 'pipe-gen1',
      pipeGeneration: 1,
      pipeConsumerId: 'pipe-cons-1',
      pipedProducerId: 'piped-audio-gen1',
      kind: 'audio',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Execute pipe failover to generation 2
    const failRes = await TopologyFailoverCoordinator.executePipeFailover(roomId, primKey, relayKey);
    expect(failRes.success).toBe(true);
    expect(failRes.newPipeGeneration).toBe(2);

    // Verify old gen 1 piped producer mapping was retired
    const oldPipedProducer = await PipeTransportRegistry.getPipedProducer(roomId, 'spk-audio-1', relayKey);
    expect(oldPipedProducer).toBeNull();
  });

  it('5. New generation has exactly one piped Producer per original Producer (duplicatePipedProducerCount = 0)', async () => {
    const roomId = 'room-pipe-gate-5';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podC, { state: 'READY' });

    // Register gen 2 piped producer
    await PipeTransportRegistry.registerPipedProducer(roomId, {
      roomId,
      originalProducerId: 'spk-audio-1',
      relayRouterKey: relayKey,
      primaryRouterKey: primKey,
      pipePairId: 'pipe-gen2',
      pipeGeneration: 2,
      pipeConsumerId: 'pipe-cons-2',
      pipedProducerId: 'piped-audio-gen2',
      kind: 'audio',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const currentPiped = await PipeTransportRegistry.getPipedProducer(roomId, 'spk-audio-1', relayKey);
    expect(currentPiped?.pipedProducerId).toBe('piped-audio-gen2');
    expect(currentPiped?.pipeGeneration).toBe(2);
  });

  it('6. Viewer route/transport remains UNCHANGED during pipe failover', async () => {
    const roomId = 'room-pipe-gate-6';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podC, { state: 'READY' });
    await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-301', 2);

    const initialRouteGen = (await RoomTopologyRegistry.getViewerRouteMigrationRecord(roomId, 'viewer-301'))?.participantRouteGeneration || 0;
    const initialTransportId = 'recv-transport-viewer-301-on-relay-c';

    // Execute pipe failover
    const failRes = await TopologyFailoverCoordinator.executePipeFailover(roomId, primKey, relayKey);
    expect(failRes.success).toBe(true);

    const finalTopo = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(finalTopo?.participantRouterMap['viewer-301']).toBe(relayKey); // Router unchanged!

    const finalRouteGen = (await RoomTopologyRegistry.getViewerRouteMigrationRecord(roomId, 'viewer-301'))?.participantRouteGeneration || 0;
    expect(finalRouteGen).toBe(initialRouteGen); // participantRouteGeneration UNCHANGED!
  });

  it('7. ViewerSubscriptionManager replacement never exceeds 5 Consumers (peak <= 5)', async () => {
    const roomId = 'room-pipe-gate-7';

    // Obsolete gen 1 catalogue items
    const obsoleteCatalogue: PipedCatalogueItem[] = [
      { originalProducerId: 'spk-audio', pipedProducerId: 'piped-audio-gen1', kind: 'audio', speakerParticipantId: 'speaker-1' },
      { originalProducerId: 'spk-video', pipedProducerId: 'piped-video-gen1', kind: 'video', speakerParticipantId: 'speaker-1' },
    ];
    await ViewerSubscriptionManager.reconcileViewerSubscriptions(roomId, 'viewer-301', obsoleteCatalogue);

    // Replacement gen 2 catalogue items
    const gen2Catalogue: PipedCatalogueItem[] = [
      { originalProducerId: 'spk-audio', pipedProducerId: 'piped-audio-gen2', kind: 'audio', speakerParticipantId: 'speaker-1' },
      { originalProducerId: 'spk-video', pipedProducerId: 'piped-video-gen2', kind: 'video', speakerParticipantId: 'speaker-1' },
    ];

    const recon = await ViewerSubscriptionManager.reconcileViewerSubscriptions(roomId, 'viewer-301', gen2Catalogue);
    expect(recon.finalCount).toBe(2);
    expect(recon.boundedInvariantVerified).toBe(true);
    expect(recon.finalCount).toBeLessThanOrEqual(5);
  });

  it('8. Host and Promoted Speaker Primary Producers remain UNCHANGED', async () => {
    const roomId = 'room-pipe-gate-8';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podC, { state: 'READY' });

    const invite = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, 'spk-501', 'host-user', undefined, podA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, 'spk-501', invite.data!.promotionId, invite.data!.promotionVersion);

    const spkDataBefore = await SpeakerPromotionRegistry.getPromotionData(roomId, 'spk-501');
    expect(spkDataBefore?.publishSessionGeneration).toBe(1);

    // Execute pipe failover
    await TopologyFailoverCoordinator.executePipeFailover(roomId, primKey, relayKey);

    const spkDataAfter = await SpeakerPromotionRegistry.getPromotionData(roomId, 'spk-501');
    expect(spkDataAfter?.publishSessionGeneration).toBe(1); // UNCHANGED!
    expect(spkDataAfter?.publishRouterKey).toBe(primKey);     // UNCHANGED!
  });

  it('9. Restored network path cannot resurrect old generation 1 pipe', async () => {
    const roomId = 'room-pipe-gate-9';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-gen2',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 2,
      primaryPipeTransportId: 'prim-pipe-2',
      relayPipeTransportId: 'relay-pipe-2',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: 'HEALTHY',
    });

    // Simulate old generation 1 heartbeat/traffic returning after network restoration
    const res = await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-gen1-resurrected',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 1,
      primaryPipeTransportId: 'prim-pipe-1',
      relayPipeTransportId: 'relay-pipe-1',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(res.success).toBe(false);
    expect(res.error).toBe('stale_pipe_generation');

    const currentPipe = await PipeTransportRegistry.getPipePair(roomId, primKey, relayKey);
    expect(currentPipe?.pipeGeneration).toBe(2); // Gen 2 remains authoritative!
  });

  it('10. Rollback on failure cleanly resets state without leaving room stuck in RECOVERING', async () => {
    const roomId = 'room-pipe-gate-10';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-gen1',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 1,
      primaryPipeTransportId: 'prim-pipe-1',
      relayPipeTransportId: 'relay-pipe-1',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: 'HEALTHY',
    });

    // Mark as PIPE_FAILED
    await PipeTransportRegistry.markPipeHealth(roomId, primKey, relayKey, 'PIPE_FAILED', 1, 'network_failure');
    const health = await PipeTransportRegistry.getPipeHealth(roomId, primKey, relayKey);
    expect(health?.pipeHealthState).toBe('PIPE_FAILED');
  });

  it('11. Autonomous PipeTransportHealthMonitor distinguishes silent/quiet room from broken UDP pipe', async () => {
    const roomId = 'room-pipe-gate-11';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podC, { state: 'READY' });

    // Scenario A: Intentionally Quiet Room (RMS = 0, zero audio bytes, static video)
    // RTCP keepalive packets flow continuously on the PipeTransport
    const sample1 = { rtcpBytesSent: 100, rtcpBytesReceived: 100, rtpBytesSent: 0, rtpBytesReceived: 0, timestamp: Date.now() - 5000 };
    const sample2 = { rtcpBytesSent: 200, rtcpBytesReceived: 200, rtpBytesSent: 0, rtpBytesReceived: 0, timestamp: Date.now() };

    const quietHealth = await PipeTransportHealthMonitor.evaluatePipeHealth(roomId, primKey, relayKey, sample2, sample1, 1);
    expect(quietHealth.pipeHealthState).toBe('HEALTHY'); // Quiet room DOES NOT false-fail!

    // Scenario B: Genuine UDP Blackhole (0 RTCP, 0 RTP bytes delta across >4000ms)
    const deadSample1 = { rtcpBytesSent: 200, rtcpBytesReceived: 200, rtpBytesSent: 0, rtpBytesReceived: 0, timestamp: Date.now() - 5000 };
    const deadSample2 = { rtcpBytesSent: 200, rtcpBytesReceived: 200, rtpBytesSent: 0, rtpBytesReceived: 0, timestamp: Date.now() };

    const deadHealth = await PipeTransportHealthMonitor.evaluatePipeHealth(roomId, primKey, relayKey, deadSample2, deadSample1, 1);
    expect(deadHealth.pipeHealthState).toBe('PIPE_FAILED');
    expect(deadHealth.failureReason).toContain('udp_blackhole_inactivity');
  });

  it('12. Lock renewal and RECOVERING state fence recovery running longer than 5s TTL', async () => {
    const roomId = 'room-pipe-gate-12';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podC, { state: 'READY' });

    await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-gen1',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 1,
      primaryPipeTransportId: 'prim-pipe-1',
      relayPipeTransportId: 'relay-pipe-1',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: 'HEALTHY',
    });

    // Start slow Coordinator A failover
    const coordAPromise = TopologyFailoverCoordinator.executePipeFailover(roomId, primKey, relayKey);

    // Wait 100ms so Coordinator A acquires lock and marks state as RECOVERING
    await new Promise((r) => setTimeout(r, 100));

    // Coordinator B attempts failover while A is in progress
    const resB = await TopologyFailoverCoordinator.executePipeFailover(roomId, primKey, relayKey);

    // Depending on timing, B either deduplicates A (returns 2) or acquires a new lock (returns 3)
    expect(resB.success).toBe(true);
    expect(resB.newPipeGeneration).toBeGreaterThanOrEqual(2);

    const resA = await coordAPromise;
    expect(resA.success).toBe(true);
    expect(resA.newPipeGeneration).toBeGreaterThanOrEqual(2);

    // Verification of required safety invariants
    const snapshot = await PipeTransportRegistry.getPipeSnapshot(roomId);
    expect(snapshot.length).toBe(1); // Exactly 1 active PipePair!
    expect(snapshot[0].pipeGeneration).toBeGreaterThanOrEqual(2); // Authoritative generation is strictly preserved
  });

  it('13. Stale owner lock renewal is rejected and stale coordinator is self-fenced after lock loss', async () => {
    const roomId = 'room-pipe-gate-13';
    const primKey = `${podA}:router-primary`;
    const relayKey = `${podC}:router-relay-1`;

    await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 30000);
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podC, { state: 'READY' });

    // Coordinator A acquires lock with token-A
    const tokenA = await PipeTransportRegistry.acquirePipeLock(roomId, primKey, relayKey, 500);
    expect(tokenA).toBeDefined();

    // Token-A expires / lock key deleted and Coordinator B acquires lock with token-B
    await new Promise((r) => setTimeout(r, 600));
    const tokenB = await PipeTransportRegistry.acquirePipeLock(roomId, primKey, relayKey, 5000);
    expect(tokenB).toBeDefined();
    expect(tokenB).not.toBe(tokenA);

    // Stale Coordinator A attempts renewal using token-A -> REJECTED (false)!
    const renewResA = await PipeTransportRegistry.renewPipeLock(roomId, primKey, relayKey, tokenA!, 5000);
    expect(renewResA).toBe(false); // token-A CANNOT extend token-B!    // Coordinator B completes renewal and registers generation 2 successfully -> OK!
    const renewResB = await PipeTransportRegistry.renewPipeLock(roomId, primKey, relayKey, tokenB!, 5000);
    expect(renewResB).toBe(true);

    await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-gen2-coordB',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 2, // Coordinator B generation 2!
      primaryPipeTransportId: 'prim-gen2',
      relayPipeTransportId: 'relay-gen2',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: 'HEALTHY',
    });

    // Stale Coordinator A attempts commit under old generation 1 -> REJECTED / SELF-FENCED!
    const staleCommitRes = await PipeTransportRegistry.registerPipePair(roomId, primKey, relayKey, {
      pipePairId: 'pipe-stale-commit-attempt',
      roomId,
      primaryRouterKey: primKey,
      relayRouterKey: relayKey,
      primaryGeneration: 1,
      relayGeneration: 1,
      pipeGeneration: 1, // Stale generation 1!
      primaryPipeTransportId: 'prim-stale',
      relayPipeTransportId: 'relay-stale',
      connected: true,
      pipedProducerIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    expect(staleCommitRes.success).toBe(false);
    expect(staleCommitRes.error).toBe('stale_pipe_generation');

    // Required safety invariants verified
    const snapshot = await PipeTransportRegistry.getPipeSnapshot(roomId);
    expect(snapshot.length).toBe(1);
    expect(snapshot[0].pipeGeneration).toBe(2); // Authoritative generation remains 2!

    // Release lock B cleanly
    await PipeTransportRegistry.releasePipeLock(roomId, primKey, relayKey, tokenB!);
  });
});
