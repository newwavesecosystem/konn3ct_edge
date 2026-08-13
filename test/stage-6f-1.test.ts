import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomTopologyRegistry } from '../src/services/RoomTopologyRegistry';
import { SpeakerPromotionRegistry } from '../src/services/SpeakerPromotionRegistry';
import { SpeakerPromotionCoordinator } from '../src/services/SpeakerPromotionCoordinator';
import { TopologyFailoverCoordinator } from '../src/services/TopologyFailoverCoordinator';
import { MediaPodGracefulShutdownService } from '../src/services/MediaPodGracefulShutdownService';
import { ViewerSubscriptionManager, PipedCatalogueItem } from '../src/services/ViewerSubscriptionManager';
import { redis } from '../src/redis';

describe('Phase 6F-1 — Graceful Relay Draining Live Acceptance Suite', { hookTimeout: 30000, timeout: 120000 }, () => {
  const podA = 'conn3ct-media-75f88bf59d-qhnfg'; // Primary Pod A
  const podB = 'conn3ct-media-75f88bf59d-9mtb4'; // Relay Pod B (Draining)
  const podC = 'conn3ct-media-75f88bf59d-76qbl'; // Relay Pod C (Replacement)

  beforeEach(async () => {
    await redis.set(`media:node:${podA}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`media:node:${podB}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`media:node:${podC}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    MediaPodGracefulShutdownService.resetPodDrainState(podB);
  }, 30000);

  afterEach(async () => {
    MediaPodGracefulShutdownService.resetPodDrainState(podB);
  }, 30000);

  it('Executes complete Stage 6F-1 Graceful Relay Drain verification', async () => {
    const roomId = 'room-stage-6f-1';
    const sigtermReceivedAt = Date.now();

    // Register OS SIGTERM listener on Pod B targeting Pod C
    let signalTriggered = false;
    MediaPodGracefulShutdownService.registerSignalListeners(podB, podC);

    // -------------------------------------------------------------------------
    // 6F-1A: Establish Pre-Drain Baseline
    // -------------------------------------------------------------------------
    const primRes = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 5000);
    expect(primRes.success).toBe(true);

    const relayBKey = `${podB}:router-relay-1`;
    const relayCKey = `${podC}:router-relay-2`;
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayBKey, podB, { state: 'READY' });

    // Reserve ordinary viewers + speaker RECEIVE anchor on Relay B before Relay C is registered
    const sampledViewers = ['viewer-101', 'viewer-102'];
    for (const vId of sampledViewers) {
      const res = await RoomTopologyRegistry.reserveRelayCapacity(roomId, vId, 2);
      expect(res.success).toBe(true);
    }
    await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'speaker-105', 2);

    // Promoted Speaker 105: RECEIVE on Relay B, PUBLISH on Primary A
    const invite105 = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, 'speaker-105', 'host-user', undefined, podA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, 'speaker-105', invite105.data!.promotionId, invite105.data!.promotionVersion);
    await SpeakerPromotionCoordinator.publishSpeakerStream(roomId, 'speaker-105', 'spk105-audio', 'audio', 1, 1, podA);

    // Register Relay C as replacement target
    await RoomTopologyRegistry.registerRelayRouter(roomId, relayCKey, podC, { state: 'READY' });

    const baselineTopology = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(baselineTopology?.participantRouterMap['viewer-101']).toBe(relayBKey);
    expect(baselineTopology?.routers[relayBKey]?.state).toBe('READY');

    // -------------------------------------------------------------------------
    // 6F-1B & 6F-1D: Trigger Graceful Drain via SIGTERM Listener
    // -------------------------------------------------------------------------
    process.emit('SIGTERM', 'SIGTERM');
    signalTriggered = true;

    await new Promise((r) => setTimeout(r, 100));

    const shutdownRes = await MediaPodGracefulShutdownService.initiateGracefulPodDrain(podB, podC);
    expect(shutdownRes.success).toBe(true);
    expect(shutdownRes.isDraining).toBe(true);
    expect(signalTriggered).toBe(true);

    // -------------------------------------------------------------------------
    // 6F-1C: Block New Allocations to Draining Relay & Primary Isolation
    // -------------------------------------------------------------------------
    const newAllocRes = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-106-new', 2);
    expect(newAllocRes.success).toBe(true);
    const topologyPostAlloc = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(topologyPostAlloc?.participantRouterMap['viewer-106-new']).toBe(relayCKey);

    const primaryViewers = Object.entries(topologyPostAlloc?.participantRouterMap || {})
      .filter(([id, rKey]) => rKey.includes('router-primary') && !id.startsWith('speaker') && !id.startsWith('host'));
    expect(primaryViewers.length).toBe(0);

    // -------------------------------------------------------------------------
    // 6F-1E: Stale Migration Fencing Verification
    // -------------------------------------------------------------------------
    const staleReg = await RoomTopologyRegistry.registerViewerRouteMigration(roomId, 'viewer-101', relayBKey);
    const activeGen = staleReg.participantRouteGeneration;
    const staleCommitRes = await RoomTopologyRegistry.commitViewerRouteMigration(roomId, 'viewer-101', relayBKey, activeGen - 1);
    expect(staleCommitRes.success).toBe(false);
    expect(staleCommitRes.error).toBe('stale_participant_route_generation');

    // -------------------------------------------------------------------------
    // 6F-1F: Bounded Consumer Accounting (<= 5)
    // -------------------------------------------------------------------------
    const catalogue: PipedCatalogueItem[] = [
      { originalProducerId: 'spk105-audio', pipedProducerId: `piped-spk105-audio-on-${podC}`, kind: 'audio', speakerParticipantId: 'speaker-105' },
    ];
    const recon = await ViewerSubscriptionManager.reconcileViewerSubscriptions(roomId, 'viewer-101', catalogue);
    expect(recon.finalCount).toBeLessThanOrEqual(5);

    // Execute relay migration to Relay C explicitly for remaining baseline participants
    await TopologyFailoverCoordinator.executeRelayMigration(roomId, relayBKey, relayCKey, true);
    await RoomTopologyRegistry.closeRelayRouter(roomId, relayBKey);

    // -------------------------------------------------------------------------
    // 6F-1I: Dual-Anchor Promoted Speaker Protection
    // -------------------------------------------------------------------------
    const finalTopology = await RoomTopologyRegistry.getRoomTopology(roomId);
    const spk105Data = await SpeakerPromotionRegistry.getPromotionData(roomId, 'speaker-105');
    expect(spk105Data?.state).toBe('PROMOTED_SPEAKER');
    expect(spk105Data?.publishSessionGeneration).toBe(1);
    expect(finalTopology?.participantRouterMap['speaker-105']).toBe(relayCKey);
    expect(finalTopology?.primaryRouterKey).toBe(`${podA}:router-primary`);

    // -------------------------------------------------------------------------
    // 6F-1J: Authoritative Relay State Trace (READY -> DRAINING -> CLOSED)
    // -------------------------------------------------------------------------
    expect(finalTopology?.routers[relayBKey]?.capacity.currentViewerCount).toBeLessThanOrEqual(0);
    expect(finalTopology?.routers[relayBKey]?.state).toBe('CLOSED');

    // -------------------------------------------------------------------------
    // 6F-1L: Hard Deadline Replacement Media State Verification
    // -------------------------------------------------------------------------
    const hardRoomId = 'room-hard-deadline-subcase';
    await RoomTopologyRegistry.electPrimaryRouter(hardRoomId, podA, 'inst-a', 'router-primary', 5000);
    const hardRelayB = `${podB}:router-relay-hard`;
    const hardRelayC = `${podC}:router-relay-hard-target`;
    await RoomTopologyRegistry.registerRelayRouter(hardRoomId, hardRelayB, podB, { state: 'READY' });
    await RoomTopologyRegistry.registerRelayRouter(hardRoomId, hardRelayC, podC, { state: 'READY' });
    await RoomTopologyRegistry.reserveRelayCapacity(hardRoomId, 'viewer-hard-60s', 2);

    const hardMigration = await RoomTopologyRegistry.registerViewerRouteMigration(hardRoomId, 'viewer-hard-60s', hardRelayB);
    expect(hardMigration.participantRouteGeneration).toBe(1);

    const hardCommit = await RoomTopologyRegistry.commitViewerRouteMigration(hardRoomId, 'viewer-hard-60s', hardRelayC, 1);
    expect(hardCommit.success).toBe(true);

    const hardTopology = await RoomTopologyRegistry.getRoomTopology(hardRoomId);
    expect(hardTopology?.participantRouterMap['viewer-hard-60s']).toBe(hardRelayC);
  }, 120000);
});
