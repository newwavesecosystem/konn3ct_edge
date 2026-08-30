import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomTopologyRegistry } from '../../src/services/RoomTopologyRegistry';
import { PipeTransportRegistry } from '../../src/services/PipeTransportRegistry';
import { SpeakerPromotionRegistry } from '../../src/services/SpeakerPromotionRegistry';
import { SpeakerPromotionCoordinator } from '../../src/services/SpeakerPromotionCoordinator';
import { TopologyFailoverCoordinator } from '../../src/services/TopologyFailoverCoordinator';
import { ViewerSubscriptionManager, PipedCatalogueItem } from '../../src/services/ViewerSubscriptionManager';
import { redis } from '../../src/redis';

describe('Phase 6F — Failure & Topology Integration Suite', () => {
  const podA = 'conn3ct-media-75f88bf59d-qhnfg'; // Primary Pod
  const podB = 'conn3ct-media-75f88bf59d-9mtb4'; // Relay 1 Pod
  const podC = 'conn3ct-media-75f88bf59d-76qbl'; // Relay 2 Pod

  beforeEach(async () => {
    await redis.flushall();
    await redis.set(`media:node:${podA}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`media:node:${podB}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`media:node:${podC}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
  });

  afterEach(async () => {
    await redis.flushall();
  });

  it('1. End-to-End Primary Failover: Elects new Primary, increments generation, re-pipes producers & preserves viewer subscription bounds', async () => {
    const roomId = 'room-int-1';
    // 1. Setup Initial Topology: Primary on Pod A, Relay 1 on Pod B
    const primRes = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 5000);
    expect(primRes.success).toBe(true);

    const relay1Key = `${podB}:router-relay-1`;
    await RoomTopologyRegistry.registerRelayRouter(roomId, relay1Key, podB, { state: 'READY' });

    // 2. Add 2 Promoted Speakers on Primary & 1 Relay Viewer on Relay 1
    const spk1Invite = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, 'speaker-1', 'host-user', undefined, podA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, 'speaker-1', spk1Invite.data!.promotionId, spk1Invite.data!.promotionVersion);

    const spk2Invite = await SpeakerPromotionCoordinator.inviteViewerToSpeak(roomId, 'speaker-2', 'host-user', undefined, podA);
    await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, 'speaker-2', spk2Invite.data!.promotionId, spk2Invite.data!.promotionVersion);

    await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-1', 2);

    // 3. Simulate Primary Pod A Crash -> Failover to Pod C
    await redis.del(`media:node:${podA}:heartbeat`);

    const failoverRes = await TopologyFailoverCoordinator.executePrimaryFailover(roomId, podC, 'inst-c', 'router-primary');
    expect(failoverRes.success).toBe(true);

    // 4. Verify Generation Fencing & Pipe Reconstruction
    const lease = await RoomTopologyRegistry.getPrimaryLease(roomId);
    expect(lease?.primaryPodId).toBe(podC);
    expect(lease?.primaryGeneration).toBe(2);

    const spk1Data = await SpeakerPromotionRegistry.getPromotionData(roomId, 'speaker-1');
    const spk2Data = await SpeakerPromotionRegistry.getPromotionData(roomId, 'speaker-2');
    expect(spk1Data?.publishSessionGeneration).toBe(2);
    expect(spk2Data?.publishSessionGeneration).toBe(2);

    // 5. Verify Downstream Viewer Subscription Bounded Invariant (Consumers <= 5)
    const catalogue: PipedCatalogueItem[] = [
      { originalProducerId: 'spk1-audio', pipedProducerId: `piped-spk1-audio-on-${podB}`, kind: 'audio', speakerParticipantId: 'speaker-1' },
      { originalProducerId: 'spk1-video', pipedProducerId: `piped-spk1-video-on-${podB}`, kind: 'video', speakerParticipantId: 'speaker-1' },
      { originalProducerId: 'spk2-audio', pipedProducerId: `piped-spk2-audio-on-${podB}`, kind: 'audio', speakerParticipantId: 'speaker-2' },
      { originalProducerId: 'spk2-video', pipedProducerId: `piped-spk2-video-on-${podB}`, kind: 'video', speakerParticipantId: 'speaker-2' },
    ];

    const reconRes = await ViewerSubscriptionManager.reconcileViewerSubscriptions(roomId, 'viewer-1', catalogue);
    expect(reconRes.finalCount).toBeLessThanOrEqual(5);
    expect(reconRes.boundedInvariantVerified).toBe(true);
  }, 30000);

  it('2. End-to-End Relay Failover: Migrates viewers to replacement Relay under participantRouteGeneration via NEW WebRtcTransport', async () => {
    const roomId = 'room-int-2';
    const primRes = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-a', 'router-primary', 5000);
    expect(primRes.success).toBe(true);

    const relay1Key = `${podB}:router-relay-1`;
    const relay2Key = `${podC}:router-relay-2`;
    await RoomTopologyRegistry.registerRelayRouter(roomId, relay1Key, podB, { state: 'READY' });

    // Assign 3 viewers to Relay 1
    for (let i = 1; i <= 3; i++) {
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, `viewer-relay-${i}`, 2);
    }

    await RoomTopologyRegistry.registerRelayRouter(roomId, relay2Key, podC, { state: 'READY' });

    // Execute Relay 1 Failover -> Migrate to Relay 2
    const failoverRes = await TopologyFailoverCoordinator.executeRelayMigration(roomId, relay1Key, relay2Key);
    expect(failoverRes.success).toBe(true);
    expect(failoverRes.migratedViewers).toBe(3);

    // Verify all 3 viewers are now mapped to Relay 2
    const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
    for (let i = 1; i <= 3; i++) {
      expect(topology?.participantRouterMap[`viewer-relay-${i}`]).toBe(relay2Key);
    }

    // Verify Relay 1 is marked FAILED
    expect(topology?.routers[relay1Key]?.state).toBe('FAILED');
  }, 30000);
});
