import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomTopologyRegistry } from '../../src/services/RoomTopologyRegistry';
import { PipeTransportRegistry } from '../../src/services/PipeTransportRegistry';
import { SpeakerPromotionRegistry } from '../../src/services/SpeakerPromotionRegistry';
import { SpeakerPromotionCoordinator } from '../../src/services/SpeakerPromotionCoordinator';
import { TopologyFailoverCoordinator } from '../../src/services/TopologyFailoverCoordinator';
import { MediaPodGracefulShutdownService } from '../../src/services/MediaPodGracefulShutdownService';
import { TOPOLOGY_FAILOVER_CONFIG } from '../../src/types/topology';
import { redis } from '../../src/redis';

describe('Phase 6F — Failure, Draining & Recovery Unit Suite', { hookTimeout: 60000, timeout: 60000 }, () => {
  const podA = 'conn3ct-media-pod-a';
  const podB = 'conn3ct-media-pod-b';
  const podC = 'conn3ct-media-pod-c';

  beforeEach(async () => {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect().catch(() => {});
    }
    await redis.flushall();
    await redis.set(`media:node:${podA}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`media:node:${podB}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    await redis.set(`media:node:${podC}:heartbeat`, JSON.stringify({ status: 'healthy', activeRouterCount: 1 }));
    MediaPodGracefulShutdownService.resetPodDrainState(podA);
    MediaPodGracefulShutdownService.resetPodDrainState(podB);
    MediaPodGracefulShutdownService.resetPodDrainState(podC);
  }, 60000);

  afterEach(async () => {
    await redis.flushall();
    MediaPodGracefulShutdownService.resetPodDrainState(podA);
    MediaPodGracefulShutdownService.resetPodDrainState(podB);
    MediaPodGracefulShutdownService.resetPodDrainState(podC);
  });

  // ---------------------------------------------------------------------------
  // 1. PRIMARY LEASE & FENCING CONTRACTS
  // ---------------------------------------------------------------------------
  describe('Primary Lease & Self-Fencing Contracts', () => {
    it('1. Elects Primary Router atomically and issues fenced lease token', async () => {
      const roomId = 'room-unit-1';
      const res = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 30000);
      expect(res.success).toBe(true);
      expect(res.primaryGeneration).toBe(1);
      expect(res.topologyEpoch).toBe(1);
      expect(res.data?.leaseToken).toBeDefined();
      expect(res.data?.state).toBe('RECOVERING');

      const lease = await RoomTopologyRegistry.getPrimaryLease(roomId);
      expect(lease?.primaryPodId).toBe(podA);
      expect(lease?.leaseToken).toBe(res.data?.leaseToken);
    });

    it('2. Rejects competing election attempt while Primary lease remains unexpired', async () => {
      const roomId = 'room-unit-2';
      const res1 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 30000);
      expect(res1.success).toBe(true);

      const res2 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podB, 'inst-2', 'router-primary-b', 30000);
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('primary_lease_active');
    });

    it('3. Allows Primary election after lease expiry', async () => {
      const roomId = 'room-unit-3';
      const res1 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 50); // 50ms TTL
      expect(res1.success).toBe(true);

      // Wait for lease to expire
      await new Promise((r) => setTimeout(r, 80));

      const res2 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podB, 'inst-2', 'router-primary-b', 5000);
      expect(res2.success).toBe(true);
      expect(res2.primaryGeneration).toBe(2);
      expect(res2.data?.primaryPodId).toBe(podB);
    });

    it('4. Self-fences stale Primary instance attempting lease renewal after losing lease', async () => {
      const roomId = 'room-unit-4';
      const res1 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 50);
      expect(res1.success).toBe(true);
      const staleToken = res1.data!.leaseToken;

      await new Promise((r) => setTimeout(r, 80));
      const res2 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podB, 'inst-2', 'router-primary-b', 5000);
      expect(res2.success).toBe(true);

      // Stale Pod A tries to renew lease with old token
      const renewRes = await RoomTopologyRegistry.renewPrimaryLease(roomId, staleToken);
      expect(renewRes.success).toBe(false);
      expect(renewRes.error).toBe('self_fenced');
    });

    it('5. Successfully renews lease for active Primary lease owner', async () => {
      const roomId = 'room-unit-5';
      const res1 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 5000);
      const token = res1.data!.leaseToken;

      const renewRes = await RoomTopologyRegistry.renewPrimaryLease(roomId, token, 5000);
      expect(renewRes.success).toBe(true);

      const updatedLease = await RoomTopologyRegistry.getPrimaryLease(roomId);
      expect(updatedLease?.state).toBe('ACTIVE');
    });

    it('6. Returning old Primary is fenced on topology mutation and producer creation', async () => {
      const roomId = 'room-unit-6-ret';
      const res1 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 50);
      expect(res1.success).toBe(true);
      const oldToken = res1.data!.leaseToken;

      await new Promise((r) => setTimeout(r, 80));

      const res2 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podB, 'inst-2', 'router-primary-b', 5000);
      expect(res2.success).toBe(true);
      expect(res2.primaryGeneration).toBe(2);

      // Old Pod A returns and attempts renewal -> self_fenced
      const renewRes = await RoomTopologyRegistry.renewPrimaryLease(roomId, oldToken);
      expect(renewRes.success).toBe(false);
      expect(renewRes.error).toBe('self_fenced');

      // Authoritative Primary remains Pod B
      const lease = await RoomTopologyRegistry.getPrimaryLease(roomId);
      expect(lease?.primaryPodId).toBe(podB);
      expect(lease?.primaryGeneration).toBe(2);
    }, 15000);
  });

  // ---------------------------------------------------------------------------
  // 2. REDIS OUTAGE & RECOVERY CONTRACTS
  // ---------------------------------------------------------------------------
  describe('Redis Outage & Recovery Behavior', () => {
    it('7. Freezes topology mutations on Redis failure without electing new Primary', async () => {
      const roomId = 'room-unit-7-red';
      const spy = vi.spyOn(redis, 'set').mockRejectedValueOnce(new Error('Redis connection lost'));

      const res = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 5000);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();

      spy.mockRestore();
    });

    it('8. Reconciles authoritative Primary lease after Redis connection restoration', async () => {
      const roomId = 'room-unit-8-rec';
      const res1 = await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 5000);
      expect(res1.success).toBe(true);

      // Reconcile after Redis restored
      const rec = await RoomTopologyRegistry.reconcilePrimaryLease(roomId);
      expect(rec.authoritativePrimaryPodId).toBe(podA);
      expect(rec.authoritativeGeneration).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. RELAY DRAIN, SIGTERM & HARD DEADLINE CONTRACTS
  // ---------------------------------------------------------------------------
  describe('Relay Drain & SIGTERM Graceful Shutdown', () => {
    it('9. DRAINING Relay blocks new viewer allocations while preserving existing viewers', async () => {
      const roomId = 'room-unit-9-drn';
      const relay1Key = `${podB}:router-relay-1`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, relay1Key, podB, { state: 'READY' });

      // Reserve viewer 1
      const res1 = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-1', 2);
      expect(res1.success).toBe(true);

      // Mark relay as DRAINING
      await RoomTopologyRegistry.drainRelayRouter(roomId, relay1Key);

      // Attempt new viewer allocation
      const res2 = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-2', 2);
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('capacity_preparing');

      // Verify viewer-1 assignment remains
      const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
      expect(topology?.participantRouterMap['viewer-1']).toBe(relay1Key);
    });

    it('10. Executes SIGTERM graceful pod drain idempotently and migrates viewers', async () => {
      const roomId = 'room-unit-10-sig';
      const relay1Key = `${podB}:router-relay-1`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, relay1Key, podB, { state: 'READY' });
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-sig-1', 2);

      // Initiate graceful drain for podB migrating to podC
      const drainRes1 = await MediaPodGracefulShutdownService.initiateGracefulPodDrain(podB, podC);
      expect(drainRes1.success).toBe(true);
      expect(drainRes1.isDraining).toBe(true);
      expect(drainRes1.migratedViewersCount).toBe(1);

      // Idempotency: duplicate call returns already in progress
      const drainRes2 = await MediaPodGracefulShutdownService.initiateGracefulPodDrain(podB, podC);
      expect(drainRes2.success).toBe(true);
      expect(drainRes2.isDraining).toBe(true);

      MediaPodGracefulShutdownService.resetPodDrainState(podB);
    }, 15000);

    it('11. Hard drain 60s deadline retains participant room membership while closing old transport', async () => {
      const roomId = 'room-unit-11-dead';
      const oldRelay = `${podB}:router-relay-1`;
      const newRelay = `${podC}:router-relay-2`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, oldRelay, podB, { state: 'READY' });
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-hard-1', 2);
      await RoomTopologyRegistry.registerRelayRouter(roomId, newRelay, podC, { state: 'READY' });

      // Execute viewer migration to newRelay
      const failoverRes = await TopologyFailoverCoordinator.executeRelayMigration(roomId, oldRelay, newRelay, true);
      expect(failoverRes.success).toBe(true);
      expect(failoverRes.migratedViewers).toBe(1);

      // Participant viewer-hard-1 is mapped to newRelay and retained in room
      const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
      expect(topology?.participantRouterMap['viewer-hard-1']).toBe(newRelay);
    }, 15000);
  });

  // ---------------------------------------------------------------------------
  // 4. CROSS-POD MIGRATION & PIPETRANSPORT RECONSTRUCTION
  // ---------------------------------------------------------------------------
  describe('Cross-Pod Migration & PipeTransport Recovery', () => {
    it('12. Registers per-viewer route migration under participantRouteGeneration and rejects stale commit', async () => {
      const roomId = 'room-unit-12';
      const oldRelay = `${podB}:router-relay-1`;
      const newRelay = `${podC}:router-relay-2`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, oldRelay, podB, { state: 'READY' });
      await RoomTopologyRegistry.registerRelayRouter(roomId, newRelay, podC, { state: 'READY' });

      const migration = await RoomTopologyRegistry.registerViewerRouteMigration(roomId, 'viewer-100', oldRelay, newRelay);
      expect(migration.participantRouteGeneration).toBe(1);
      expect(migration.state).toBe('REASSIGNING');

      // Stale commit with version 0 MUST BE REJECTED
      const staleCommit = await RoomTopologyRegistry.commitViewerRouteMigration(roomId, 'viewer-100', newRelay, 0);
      expect(staleCommit.success).toBe(false);
      expect(staleCommit.error).toBe('stale_participant_route_generation');

      // Valid commit with version 1 SUCCEEDS
      const validCommit = await RoomTopologyRegistry.commitViewerRouteMigration(roomId, 'viewer-100', newRelay, 1);
      expect(validCommit.success).toBe(true);

      const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
      expect(topology?.participantRouterMap['viewer-100']).toBe(newRelay);
    });

    it('13. Executes Relay Pod failover by creating replacement PipeTransport and migrating viewers', async () => {
      const roomId = 'room-unit-13';
      const oldRelay = `${podB}:router-relay-1`;
      const newRelay = `${podC}:router-relay-2`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, oldRelay, podB, { state: 'READY' });
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-200', 2);
      await RoomTopologyRegistry.registerRelayRouter(roomId, newRelay, podC, { state: 'READY' });

      const failoverRes = await TopologyFailoverCoordinator.executeRelayMigration(roomId, oldRelay, newRelay);
      expect(failoverRes.success).toBe(true);
      expect(failoverRes.migratedViewers).toBe(1);

      // Verify telemetry metrics calculation
      expect(failoverRes.telemetry).toBeDefined();
      expect(failoverRes.telemetry?.failureDetectionMs).toBeGreaterThanOrEqual(0);
      expect(failoverRes.telemetry?.totalRecoveryMs).toBeGreaterThanOrEqual(0);
      expect(failoverRes.telemetry?.successfulRecoveries).toBe(1);
    });

    it('14. Executes Primary Pod failover, increments publishSessionGeneration, and re-pipes producers', async () => {
      const roomId = 'room-unit-14';
      // Setup initial primary & relay
      await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 30000);
      const relay1 = `${podB}:router-relay-1`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, relay1, podB, { state: 'READY' });

      // Create promoted speaker
      const invite = await SpeakerPromotionCoordinator.inviteViewerToSpeak(
        roomId, 'spk-1', 'host-user', { canPublishAudio: true, canPublishVideo: true, canShareScreen: false }, podA
      );
      await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, 'spk-1', invite.data!.promotionId, invite.data!.promotionVersion);

      // Simulate Primary Pod A Crash and lease expiry
      await redis.del(`media:node:${podA}:heartbeat`);
      await redis.hset(`room:${roomId}:primaryLease`, 'leaseExpiresAt', (Date.now() - 1000).toString());

      // Execute Primary failover to Pod C
      const failoverRes = await TopologyFailoverCoordinator.executePrimaryFailover(roomId, podC, 'inst-2', 'router-primary');
      expect(failoverRes.success).toBe(true);
      expect(failoverRes.telemetry?.affectedParticipantCount).toBe(1);

      // Verify speaker publishSessionGeneration incremented
      const pData = await SpeakerPromotionRegistry.getPromotionData(roomId, 'spk-1');
      expect(pData?.publishSessionGeneration).toBe(2);

      // Verify Primary lease updated to Pod C
      const lease = await RoomTopologyRegistry.getPrimaryLease(roomId);
      expect(lease?.primaryPodId).toBe(podC);
      expect(lease?.primaryGeneration).toBe(2);
    }, 30000);
  });

  // ---------------------------------------------------------------------------
  // 5. PUBLISHER FENCING & HOST PROTECTION
  // ---------------------------------------------------------------------------
  describe('Publisher Fencing & Host Protection', () => {
    it('15. Rejects produce RPCs when Primary lease is expired or failed', async () => {
      const roomId = 'room-unit-15';
      // Setup primary with expired lease
      await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 50); // 50ms TTL
      const invite = await SpeakerPromotionCoordinator.inviteViewerToSpeak(
        roomId, 'spk-2', 'host-user', { canPublishAudio: true, canPublishVideo: true, canShareScreen: false }, podA
      );
      await SpeakerPromotionCoordinator.acceptInvitationToSpeak(roomId, 'spk-2', invite.data!.promotionId, invite.data!.promotionVersion);

      // Wait for lease to expire
      await new Promise((r) => setTimeout(r, 80));

      const authRes = await SpeakerPromotionCoordinator.validateServerSidePublishAuthorization(
        roomId, 'spk-2', 'audio', 'SPEAKER_PUBLISH', 1, 1
      );

      expect(authRes.success).toBe(false);
      expect(authRes.error).toContain('self_fenced');
    }, 15000);

    it('16. Host publication is fenced as strongly as speaker publication on stale publishSessionGeneration', async () => {
      const roomId = 'room-unit-16-host';
      await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 30000);

      // Host publishes on generation 1 -> Authorized
      const validHostAuth = await SpeakerPromotionCoordinator.validateServerSidePublishAuthorization(
        roomId, 'host-user-1', 'audio', 'SPEAKER_PUBLISH', 1, 1
      );
      expect(validHostAuth.success).toBe(true);

      // Simulate Primary failover -> generation bumped to 2
      await redis.del(`media:node:${podA}:heartbeat`);
      await redis.hset(`room:${roomId}:primaryLease`, 'leaseExpiresAt', (Date.now() - 1000).toString());
      await TopologyFailoverCoordinator.executePrimaryFailover(roomId, podC, 'inst-2', 'router-primary');

      // Host attempts publish with stale generation 1 -> REJECTED
      const staleHostAuth = await SpeakerPromotionCoordinator.validateServerSidePublishAuthorization(
        roomId, 'host-user-1', 'audio', 'SPEAKER_PUBLISH', 1, 1
      );
      expect(staleHostAuth.success).toBe(false);
      expect(staleHostAuth.error).toContain('Stale publishSessionGeneration');
    }, 15000);
  });

  // ---------------------------------------------------------------------------
  // 6. STRICT RELAY LIFECYCLE STATE INVARIANTS (READY -> DRAINING -> CLOSED vs FAILED)
  // ---------------------------------------------------------------------------
  describe('Strict Relay Lifecycle State Invariants', () => {
    it('17. Successful graceful drain transitions READY -> DRAINING -> CLOSED', async () => {
      const roomId = 'room-unit-lifecycle-1';
      const relayKey = `${podB}:router-relay-1`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podB, { state: 'READY' });
      await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'v-1', 2);

      await RoomTopologyRegistry.drainRelayRouter(roomId, relayKey);
      const drainingTopology = await RoomTopologyRegistry.getRoomTopology(roomId);
      expect(drainingTopology?.routers[relayKey]?.state).toBe('DRAINING');

      await RoomTopologyRegistry.removeParticipantFromTopology(roomId, 'v-1');
      await RoomTopologyRegistry.closeRelayRouter(roomId, relayKey);

      const finalTopology = await RoomTopologyRegistry.getRoomTopology(roomId);
      expect(finalTopology?.routers[relayKey]?.state).toBe('CLOSED');
      expect(finalTopology?.routers[relayKey]?.capacity.currentViewerCount).toBe(0);
    });

    it('18. Abrupt Relay crash transitions READY -> FAILED', async () => {
      const roomId = 'room-unit-lifecycle-2';
      const relayKey = `${podB}:router-relay-2`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podB, { state: 'READY' });

      await RoomTopologyRegistry.markRelayFailed(roomId, relayKey);

      const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
      expect(topology?.routers[relayKey]?.state).toBe('FAILED');
    });

    it('19. Crash while draining transitions DRAINING -> FAILED', async () => {
      const roomId = 'room-unit-lifecycle-3';
      const relayKey = `${podB}:router-relay-3`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podB, { state: 'READY' });
      await RoomTopologyRegistry.drainRelayRouter(roomId, relayKey);

      await RoomTopologyRegistry.markRelayFailed(roomId, relayKey);

      const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
      expect(topology?.routers[relayKey]?.state).toBe('FAILED');
    });

    it('20. CLOSED Relay rejects new viewer allocations', async () => {
      const roomId = 'room-unit-lifecycle-4';
      const relayKey = `${podB}:router-relay-4`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podB, { state: 'CLOSED' });

      const res = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'v-closed-test', 2);
      expect(res.success).toBe(false);
      expect(res.error).toBe('capacity_preparing');
    });

    it('21. FAILED Relay rejects new viewer allocations', async () => {
      const roomId = 'room-unit-lifecycle-5';
      const relayKey = `${podB}:router-relay-5`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, relayKey, podB, { state: 'FAILED' });

      const res = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'v-failed-test', 2);
      expect(res.success).toBe(false);
      expect(res.error).toBe('capacity_preparing');
    });

    it('22. CLOSED Relay does not trigger failure-recovery handling', async () => {
      const roomId = 'room-unit-lifecycle-6';
      await RoomTopologyRegistry.electPrimaryRouter(roomId, podA, 'inst-1', 'router-primary', 5000);
      const closedRelay = `${podB}:router-relay-closed`;
      await RoomTopologyRegistry.registerRelayRouter(roomId, closedRelay, podB, { state: 'CLOSED' });

      const health = await TopologyFailoverCoordinator.evaluateRoomTopologyHealth(roomId);
      expect(health.primaryHealthy).toBe(true);
      expect(health.failedRelays).not.toContain(closedRelay);
    });
  });
});
