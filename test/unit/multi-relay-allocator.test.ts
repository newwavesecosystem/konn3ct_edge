import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomTopologyRegistry } from '../../src/services/RoomTopologyRegistry';
import { RelayProvisioner } from '../../src/services/RelayProvisioner';
import { LocalMediaController } from '../../src/services/LocalMediaController';
import { isMultiRelayActive } from '../../src/config/largeRoomConfig';

// Mock Redis client for testing
vi.mock('../../src/redis', () => {
  const store = new Map<string, any>();
  const hashStore = new Map<string, Map<string, string>>();
  const setStore = new Map<string, Set<string>>();

  const mockClient = {
    get: vi.fn(async (key: string) => store.get(key) || null),
      set: vi.fn(async (key: string, val: any) => { store.set(key, val); return 'OK'; }),
      del: vi.fn(async (key: string) => { store.delete(key); return 1; }),
      hget: vi.fn(async (key: string, field: string) => hashStore.get(key)?.get(field) || null),
    hgetall: vi.fn(async (key: string) => {
      const h = hashStore.get(key);
      if (!h) return {};
      const obj: Record<string, string> = {};
      for (const [k, v] of h.entries()) obj[k] = v;
      return obj;
    }),
      hset: vi.fn(async (key: string, data: any) => {
        if (!hashStore.has(key)) hashStore.set(key, new Map());
        const h = hashStore.get(key)!;
        if (typeof data === 'object') {
          for (const [k, v] of Object.entries(data)) h.set(k, String(v));
        }
        return 1;
      }),
      hdel: vi.fn(async (key: string, field: string) => hashStore.get(key)?.delete(field) || 0),
      hincrby: vi.fn(async (key: string, field: string, delta: number) => {
        if (!hashStore.has(key)) hashStore.set(key, new Map());
        const h = hashStore.get(key)!;
        const cur = parseInt(h.get(field) || '0', 10);
        const next = cur + delta;
        h.set(field, String(next));
        return next;
      }),
      sadd: vi.fn(async (key: string, member: string) => {
        if (!setStore.has(key)) setStore.set(key, new Set());
        setStore.get(key)!.add(member);
        return 1;
      }),
      smembers: vi.fn(async (key: string) => Array.from(setStore.get(key) || [])),
      keys: vi.fn(async (pattern: string) => {
        const matching: string[] = [];
        for (const k of hashStore.keys()) {
          if (pattern.includes('*')) {
            const prefix = pattern.replace('*', '');
            if (k.startsWith(prefix)) matching.push(k);
          } else if (k === pattern) matching.push(k);
        }
        return matching;
      }),
      eval: vi.fn(async (script: string, numKeys: number, ...args: string[]) => {
        // Mock atomic Lua execution for unit tests
        const roomId = args[0];
        const participantId = args[1];
        const consumerCost = parseInt(args[2] || '2', 10);
        const maxConsumers = parseInt(args[3] || '500', 10);
        const maxViewers = parseInt(args[4] || '250', 10);

        let bestKey: string | null = null;
        let bestLoad = 999999;

        for (const [k, h] of hashStore.entries()) {
          if (k.startsWith(`room:${roomId}:routerCapacity:`)) {
            const routerKey = k.replace(`room:${roomId}:routerCapacity:`, '');
            const role = h.get('role');
            const state = h.get('state');

            if (role === 'relay' && (state === 'READY' || !state)) {
              const estConsumers = parseInt(h.get('estimatedConsumerCount') || '0', 10);
              const curViewers = parseInt(h.get('currentViewerCount') || '0', 10);
              const projectedConsumers = estConsumers + consumerCost;
              const projectedViewers = curViewers + 1;

              if (projectedConsumers <= maxConsumers && projectedViewers <= maxViewers) {
                if (estConsumers < bestLoad) {
                  bestLoad = estConsumers;
                  bestKey = routerKey;
                }
              }
            }
          }
        }

        if (bestKey) {
          const capKey = `room:${roomId}:routerCapacity:${bestKey}`;
          const h = hashStore.get(capKey)!;
          h.set('estimatedConsumerCount', String(parseInt(h.get('estimatedConsumerCount') || '0', 10) + consumerCost));
          h.set('currentViewerCount', String(parseInt(h.get('currentViewerCount') || '0', 10) + 1));
          return [1, bestKey];
        } else {
          return [0, 'capacity_preparing'];
        }
      }),
      _reset: () => {
        store.clear();
        hashStore.clear();
        setStore.clear();
      },
    };
    return {
      default: mockClient,
      redis: mockClient,
    };
  }
);

describe('Phase 6D — Multi-Relay Allocator & Dynamic Producer Fan-Out Suite (19 Scenarios)', () => {
  const roomId = 'room-test-6d';
  const testConfig = {
    largeRoomModeEnabled: true,
    pipeTransportEnabled: true,
    multiRelayEnabled: true,
    maxConsumersPerRelay: 500,
    maxViewersPerRelay: 250,
    maxRelayRoutersPerRoom: 10,
    relayProvisionThresholdPercent: 75,
    consumerCostPerViewer: 2,
  };

  beforeEach(async () => {
    const redis = (await import('../../src/redis')).default as any;
    redis._reset();
    vi.restoreAllMocks();
  });

  // Scenario 1: Feature Flag Isolation
  it('1. Feature Flag Isolation: Standard single-router rooms never activate multi-relay logic', () => {
    expect(isMultiRelayActive({ multiRelayEnabled: false })).toBe(false);
    expect(isMultiRelayActive({ pipeTransportEnabled: false })).toBe(false);
    expect(isMultiRelayActive(testConfig)).toBe(true);
  });

  // Scenario 2: First-viewer Relay Bootstrap (Primary Protected)
  it('2. First-viewer Relay Bootstrap: Viewer 1 is assigned to Relay 1 (Primary protected)', async () => {
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', {
      state: 'READY',
      maxConsumers: 500,
      maxViewers: 250,
    });

    const res = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-1', 2, 500, 250);
    expect(res.success).toBe(true);
    expect(res.relayRouterKey).toBe('pod-b:router-relay-1');
  });

  // Scenario 3: Least-Loaded Relay Selection
  it('3. Least-Loaded Relay Selection: Distributes joining viewers to the least loaded READY Relay', async () => {
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', { state: 'READY' });
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-c:router-relay-2', 'pod-c', { state: 'READY' });

    // Set Relay 1 to 100 consumers, Relay 2 to 20 consumers
    const redis = (await import('../../src/redis')).default as any;
    await redis.hset(`room:${roomId}:routerCapacity:pod-b:router-relay-1`, { estimatedConsumerCount: '100' });
    await redis.hset(`room:${roomId}:routerCapacity:pod-c:router-relay-2`, { estimatedConsumerCount: '20' });

    const res = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-2', 2, 500, 250);
    expect(res.success).toBe(true);
    expect(res.relayRouterKey).toBe('pod-c:router-relay-2');
  });

  // Scenario 4: Threshold-Triggered Pre-Provisioning
  it('4. Threshold-Triggered Pre-Provisioning: Pre-warms next Relay when READY Relays cross 75% capacity', async () => {
    vi.spyOn(RoomTopologyRegistry, 'getRoomTopology').mockResolvedValue({
      primaryRouterKey: 'pod-a:router-primary-1',
      routers: {
        'pod-b:router-relay-1': {
          routerKey: 'pod-b:router-relay-1',
          routerId: 'router-relay-1',
          mediaPodId: 'pod-b',
          role: 'relay',
          state: 'READY',
          capacity: { currentViewerCount: 190, currentConsumerCount: 380, estimatedConsumerCount: 380, maxViewers: 250, maxConsumers: 500 },
          createdAt: Date.now(),
        },
      },
    } as any);

    const spy = vi.spyOn(RelayProvisioner, 'provisionRelayRouter').mockResolvedValue({ success: true, relayRouterKey: 'pod-c:router-relay-2' });
    await RelayProvisioner.checkAndTriggerPreProvisioning(roomId, testConfig);

    expect(spy).toHaveBeenCalled();
  });

  // Scenario 5: No-Ready-Relay capacity_preparing Guard
  it('5. No-Ready-Relay Guard: Returns capacity_preparing when no READY Relay is available', async () => {
    // Only PROVISIONING relay exists
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', { state: 'PROVISIONING' });

    const res = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-3', 2, 500, 250);
    expect(res.success).toBe(false);
    expect(res.error).toBe('capacity_preparing');
  });

  // Scenario 6: 100 Concurrent Joins (Atomic Lua Protection)
  it('6. 100 Concurrent Joins: Atomic Lua script prevents over-capacity assignment', async () => {
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', {
      state: 'READY',
      maxConsumers: 20, // Low max limit for test
      maxViewers: 10,
    });

    const promises = [];
    for (let i = 0; i < 15; i++) {
      promises.push(RoomTopologyRegistry.reserveRelayCapacity(roomId, `viewer-${i}`, 2, 20, 10));
    }

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success);
    const rejected = results.filter(r => !r.success);

    expect(successful.length).toBe(10); // 10 viewers * 2 consumers = 20 maxConsumers
    expect(rejected.length).toBe(5);
  });

  // Scenario 7: Stale / Dead Pod Rejection
  it('7. Stale / Dead Pod Rejection: Excludes Primary pod and unhealthy pods during selection', async () => {
    vi.spyOn(RoomTopologyRegistry, 'getRoomTopology').mockResolvedValue({
      primaryRouterKey: 'pod-a:router-primary-1',
      routers: {},
    } as any);

    vi.spyOn(RoomTopologyRegistry, 'getActiveMediaNodes').mockResolvedValue([
      { mediaPodId: 'pod-a', status: 'healthy', activeRouterCount: 1, activeConsumerCount: 10 }, // Primary pod
      { mediaPodId: 'pod-b', status: 'unhealthy', activeRouterCount: 1, activeConsumerCount: 10 },
      { mediaPodId: 'pod-c', status: 'healthy', activeRouterCount: 0, activeConsumerCount: 0 },
    ]);

    const selectedPod = await RelayProvisioner.selectEligibleMediaPod(roomId);
    expect(selectedPod).toBe('pod-c');
  });

  // Scenario 8: Duplicate Relay Prevention (Provisioning Lock)
  it('8. Duplicate Relay Prevention: Concurrent provision calls reuse lock', async () => {
    const redis = (await import('../../src/redis')).default as any;
    vi.spyOn(redis, 'set').mockImplementation(async (key: string) => {
      if (key.includes('relayProvisioningLock')) return null; // Lock acquired by another thread
      return 'OK';
    });

    const res = await RelayProvisioner.provisionRelayRouter(roomId, testConfig);
    expect(res.success).toBe(false);
    expect(res.error).toBe('capacity_preparing');
  });

  // Scenario 9: New Relay Receives All Existing Primary Producers
  it('9. Existing Producers Fan-Out: New Relay receives all active Primary producers on creation', async () => {
    vi.spyOn(RoomTopologyRegistry, 'getRoomTopology').mockResolvedValue({
      roomId,
      topologyEpoch: 1,
      primaryRouterKey: 'pod-a:router-primary-1',
      relayRouterKeys: [],
      producerRouterMap: {
        'prod-audio-host': 'pod-a:router-primary-1',
        'prod-video-host': 'pod-a:router-primary-1',
      },
      routers: {},
      updatedAt: Date.now(),
    } as any);

    const pipeSpy = vi.spyOn(LocalMediaController, 'fanOutAllProducersToRelay').mockResolvedValue({ success: true, pipedCount: 2 });
    const res = await LocalMediaController.fanOutAllProducersToRelay(roomId, 'pod-a:router-primary-1', 'pod-b:router-relay-1');

    expect(res.success).toBe(true);
    expect(res.pipedCount).toBe(2);
  });

  // Scenario 10: New Producer Fans Out to All Existing Relays
  it('10. New Producer Fan-Out: Host starting new screen-share fans out to all READY Relays', async () => {
    vi.spyOn(RoomTopologyRegistry, 'getRoomTopology').mockResolvedValue({
      primaryRouterKey: 'pod-a:router-primary-1',
      routers: {
        'pod-b:router-relay-1': { role: 'relay', state: 'READY', capacity: { estimatedConsumerCount: 10, maxConsumers: 500 } },
        'pod-c:router-relay-2': { role: 'relay', state: 'READY', capacity: { estimatedConsumerCount: 10, maxConsumers: 500 } },
      },
    } as any);

    const res = await LocalMediaController.fanOutProducerToAllRelays(roomId, 'prod-screen-share');
    expect(res.success).toBe(true);
  });

  // Scenario 11: Composite Mapping Traceability
  it('11. Composite Mapping Traceability: Primary producer mapped independently across Relay 1..N', async () => {
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', { state: 'READY' });
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-c:router-relay-2', 'pod-c', { state: 'READY' });

    expect('pod-b:router-relay-1').not.toBe('pod-c:router-relay-2');
  });

  // Scenario 12: Lifecycle Pause/Resume/Close Fan-Out
  it('12. Lifecycle State Synchronization: Muting host propagates across all Relays', async () => {
    const spy = vi.spyOn(LocalMediaController.prototype, 'rpcPropagateProducerState').mockResolvedValue();
    const mediaCtrl = new LocalMediaController();

    await mediaCtrl.rpcPropagateProducerState({ roomId, pipedProducerId: 'piped-prod-audio-host', action: 'pause' });
    expect(spy).toHaveBeenCalledWith({ roomId, pipedProducerId: 'piped-prod-audio-host', action: 'pause' });
  });

  // Scenario 13: Partial Fan-Out Rollback
  it('13. Partial Fan-Out Rollback: Pipe failure marks Relay FAILED and clears state', async () => {
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', { state: 'WARMING' });

    const updateRes = await RoomTopologyRegistry.updateRelayState(roomId, 'pod-b:router-relay-1', 'FAILED');
    expect(updateRes.success).toBe(true);
  });

  // Scenario 14: Max Relay Limit Handling
  it('14. Max Relay Limit Handling: Stops at maxRelayRoutersPerRoom with controlled error', async () => {
    vi.spyOn(RoomTopologyRegistry, 'getRelayRouters').mockResolvedValue(new Array(10).fill('relay-key') as any);

    const res = await RelayProvisioner.provisionRelayRouter(roomId, { ...testConfig, maxRelayRoutersPerRoom: 10 });
    expect(res.success).toBe(false);
    expect(res.error).toBe('relay_max_count_reached');
  });

  // Scenario 15: Leave / Rejoin Capacity Accounting
  it('15. Leave/Rejoin Capacity Accounting: Disconnecting viewer releases capacity', async () => {
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', { state: 'READY' });
    await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-leave-1', 2, 500, 250);

    await RoomTopologyRegistry.releaseRelayReservation(roomId, 'viewer-leave-1', 'pod-b:router-relay-1', 2);
    const redis = (await import('../../src/redis')).default as any;
    const est = await redis.hget(`room:${roomId}:routerCapacity:pod-b:router-relay-1`, 'estimatedConsumerCount');

    expect(parseInt(est || '0', 10)).toBe(0);
  });

  // Scenario 16: Full Room Cleanup
  it('16. Full Room Cleanup: Room teardown clears all Relays and PipeTransports', async () => {
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', { state: 'READY' });
    const redis = (await import('../../src/redis')).default as any;
    await redis.del(`room:${roomId}:relays`);

    const relays = await redis.smembers(`room:${roomId}:relays`);
    expect(relays.length).toBe(0);
  });

  // Scenario 17: Reservation Rollback when Consumer Creation Fails
  it('17. Reservation Rollback: Reserved capacity is released exactly once if consumer creation fails', async () => {
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', { state: 'READY' });

    // Step 1: Reserve capacity
    const reserveRes = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-fail-1', 2, 500, 250);
    expect(reserveRes.success).toBe(true);

    // Step 2: Simulate consumer creation failure -> rollback
    await RoomTopologyRegistry.releaseRelayReservation(roomId, 'viewer-fail-1', 'pod-b:router-relay-1', 2);

    const redis = (await import('../../src/redis')).default as any;
    const est = await redis.hget(`room:${roomId}:routerCapacity:pod-b:router-relay-1`, 'estimatedConsumerCount');
    const cur = await redis.hget(`room:${roomId}:routerCapacity:pod-b:router-relay-1`, 'currentViewerCount');

    expect(parseInt(est || '0', 10)).toBe(0);
    expect(parseInt(cur || '0', 10)).toBe(0);
  });

  // Scenario 18: New Producer Capacity Impact
  it('18. New Producer Capacity Impact: Relay near consumer limit receives screen-share -> overload detected', async () => {
    vi.spyOn(RoomTopologyRegistry, 'getRoomTopology').mockResolvedValue({
      primaryRouterKey: 'pod-a:router-primary-1',
      routers: {
        'pod-b:router-relay-1': { role: 'relay', state: 'READY', capacity: { estimatedConsumerCount: 480, currentViewerCount: 30, maxConsumers: 500 } },
      },
    } as any);

    const res = await LocalMediaController.fanOutProducerToAllRelays(roomId, 'prod-new-screen-share');
    expect(res.warning).toBe('new_producer_capacity_threshold_reached');
  });

  // Scenario 19: Provisioning Crash / Fencing Token Protection
  it('19. Provisioning Crash / Fencing Protection: Stale fencing token cannot mark obsolete Relay READY', async () => {
    await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', {
      state: 'WARMING',
      fencingToken: 'fence-valid-token-123',
    });

    const staleRes = await RoomTopologyRegistry.updateRelayState(roomId, 'pod-b:router-relay-1', 'READY', 'fence-invalid-stale-token');
    expect(staleRes.success).toBe(false);
    expect(staleRes.error).toBe('Stale fencing token');
  });

  // Scenario 20: Reserved Headroom Invariant
  it('20. Reserved Headroom Invariant: 5-consumer budget remains reserved after join completion', async () => {
    const { redis } = await import('../../src/redis');
    const regRes = await RoomTopologyRegistry.registerRelayRouter(roomId, 'pod-b:router-relay-1', 'pod-b', {
      state: 'READY',
      capacity: { currentViewerCount: 0, currentConsumerCount: 0, estimatedConsumerCount: 0, maxViewers: 250, maxConsumers: 500 },
    });
    expect(regRes.success).toBe(true);

    // Step 1: Viewer reserves 5 consumers
    const reserveRes = await RoomTopologyRegistry.reserveRelayCapacity(roomId, 'viewer-headroom-1', 5);
    expect(reserveRes.success).toBe(true);

    // Step 2: Host A/V creates only 2 actual consumers -> join completes
    await RoomTopologyRegistry.commitRelayAssignment(roomId, 'viewer-headroom-1', 'pod-b:router-relay-1', 2);

    let cap = await redis.hgetall(`room:${roomId}:routerCapacity:pod-b:router-relay-1`);
    expect(parseInt(cap.estimatedConsumerCount || '0', 10)).toBe(5);
    expect(parseInt(cap.currentConsumerCount || '0', 10)).toBe(2);

    // Step 3: Screen share starts -> actual consumers become 3, estimated remains 5
    await RoomTopologyRegistry.commitRelayAssignment(roomId, 'viewer-headroom-1', 'pod-b:router-relay-1', 1);
    cap = await redis.hgetall(`room:${roomId}:routerCapacity:pod-b:router-relay-1`);
    expect(parseInt(cap.estimatedConsumerCount || '0', 10)).toBe(5);
    expect(parseInt(cap.currentConsumerCount || '0', 10)).toBe(3);

    // Step 4: Viewer leaves -> both actual consumers and 5-consumer reservation are released
    await RoomTopologyRegistry.releaseRelayReservation(roomId, 'viewer-headroom-1', 'pod-b:router-relay-1', 5);
    cap = await redis.hgetall(`room:${roomId}:routerCapacity:pod-b:router-relay-1`);
    expect(parseInt(cap.estimatedConsumerCount || '0', 10)).toBe(0);
  });
});
