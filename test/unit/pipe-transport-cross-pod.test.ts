import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

// In-Memory Redis Mock for fast sub-millisecond unit testing
vi.mock('ioredis', () => {
  const store = new Map<string, any>();
  const hashes = new Map<string, Map<string, string>>();
  const sets = new Map<string, Set<string>>();

  class MockRedis {
    on = vi.fn().mockReturnValue(this);
    get = vi.fn().mockImplementation(async (key: string) => store.get(key) ?? null);
    set = vi.fn().mockImplementation(async (key: string, val: any, ...args: any[]) => {
      if (args.includes('NX') && store.has(key)) {
        return null;
      }
      store.set(key, String(val));
      return 'OK';
    });
    del = vi.fn().mockImplementation(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys.flat()) {
        if (store.delete(k) || hashes.delete(k) || sets.delete(k)) count++;
      }
      return count;
    });
    sadd = vi.fn().mockImplementation(async (key: string, ...members: string[]) => {
      if (!sets.has(key)) sets.set(key, new Set());
      const s = sets.get(key)!;
      let added = 0;
      for (const m of members.flat()) {
        if (!s.has(m)) { s.add(m); added++; }
      }
      return added;
    });
    smembers = vi.fn().mockImplementation(async (key: string) => {
      return Array.from(sets.get(key) || []);
    });
    srem = vi.fn().mockImplementation(async (key: string, member: string) => {
      const s = sets.get(key);
      return (s && s.delete(member)) ? 1 : 0;
    });
    hset = vi.fn().mockImplementation(async (key: string, ...args: any[]) => {
      if (!hashes.has(key)) hashes.set(key, new Map());
      const h = hashes.get(key)!;
      if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        for (const [k, v] of Object.entries(args[0])) {
          h.set(k, String(v));
        }
      } else if (args.length >= 2) {
        h.set(String(args[0]), String(args[1]));
      }
      return 1;
    });
    hget = vi.fn().mockImplementation(async (key: string, field: string) => {
      const h = hashes.get(key);
      return h ? (h.get(field) ?? null) : null;
    });
    hgetall = vi.fn().mockImplementation(async (key: string) => {
      const h = hashes.get(key);
      if (!h) return {};
      const obj: Record<string, string> = {};
      for (const [k, v] of h.entries()) obj[k] = v;
      return obj;
    });
    hdel = vi.fn().mockImplementation(async (key: string, field: string) => {
      const h = hashes.get(key);
      return (h && h.delete(field)) ? 1 : 0;
    });
    hincrby = vi.fn().mockImplementation(async (key: string, field: string, incr: number) => {
      if (!hashes.has(key)) hashes.set(key, new Map());
      const h = hashes.get(key)!;
      const cur = parseInt(h.get(field) || '0', 10);
      const next = cur + incr;
      h.set(field, String(next));
      return next;
    });
    eval = vi.fn().mockImplementation(async (script: string, numkeys: number, ...args: any[]) => {
      const key = args[0];
      const token = args[1];
      if (store.get(key) === token) {
        store.delete(key);
        return 1;
      }
      return 0;
    });
    subscribe = vi.fn().mockResolvedValue(1);
    psubscribe = vi.fn().mockResolvedValue(1);
    unsubscribe = vi.fn().mockResolvedValue(1);
    punsubscribe = vi.fn().mockResolvedValue(1);
    ping = vi.fn().mockResolvedValue('PONG');
    publish = vi.fn().mockResolvedValue(1);
    xadd = vi.fn().mockResolvedValue('1-0');
    multi = vi.fn().mockImplementation(() => {
      const ops: Array<() => Promise<any>> = [];
      const m = {
        set: (k: string, v: any) => { ops.push(() => this.set(k, v)); return m; },
        hset: (k: string, ...a: any[]) => { ops.push(() => this.hset(k, ...a)); return m; },
        hdel: (k: string, f: string) => { ops.push(() => this.hdel(k, f)); return m; },
        hincrby: (k: string, f: string, i: number) => { ops.push(() => this.hincrby(k, f, i)); return m; },
        sadd: (k: string, m: string) => { ops.push(() => this.sadd(k, m)); return m; },
        srem: (k: string, m: string) => { ops.push(() => this.srem(k, m)); return m; },
        del: (...keys: string[]) => { ops.push(() => this.del(...keys)); return m; },
        exec: async () => {
          const res = [];
          for (const op of ops) res.push(await op());
          return res;
        }
      };
      return m;
    });
    duplicate = vi.fn().mockImplementation(() => this);
  }
  return { default: MockRedis };
});

// Mock Mediasoup SFU & RedisMediaController RPC layer
vi.mock('../../src/media/sfu', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/media/sfu')>();
  const routerStore = new Map<string, any>();
  const producerStore = new Map<string, any>();

  class MockRouter {
    id: string;
    rtpCapabilities = {
      codecs: [
        { mimeType: 'audio/opus', payloadType: 111, clockRate: 48000, channels: 2 },
        { mimeType: 'video/VP8', payloadType: 96, clockRate: 90000 },
      ],
    };
    constructor(id: string) {
      this.id = id;
    }
    async createPipeTransport() {
      return {
        id: `pipe-t-${crypto.randomUUID()}`,
        tuple: { localIp: '10.0.1.50', localPort: 40001 },
        srtpParameters: {},
        connect: vi.fn().mockResolvedValue(undefined),
        consume: vi.fn().mockImplementation(async ({ producerId }) => ({
          id: `pipe-cons-${producerId}`,
          kind: 'audio',
          rtpParameters: {},
          close: vi.fn(),
        })),
        produce: vi.fn().mockImplementation(async ({ id, kind, rtpParameters, appData }) => ({
          id: id || `piped-${crypto.randomUUID()}`,
          kind: kind || 'audio',
          rtpParameters: rtpParameters || {},
          appData: appData || {},
          pause: vi.fn(),
          resume: vi.fn(),
          close: vi.fn(),
        })),
        close: vi.fn(),
      };
    }
  }

  return {
    ...original,
    initializeWorkers: vi.fn().mockResolvedValue(undefined),
    getOrCreateRouter: vi.fn().mockImplementation(async (roomId: string) => {
      if (!routerStore.has(roomId)) {
        routerStore.set(roomId, new MockRouter(roomId));
      }
      return routerStore.get(roomId);
    }),
    getRouter: vi.fn().mockImplementation((id: string) => {
      if (!routerStore.has(id)) {
        routerStore.set(id, new MockRouter(id));
      }
      return routerStore.get(id);
    }),
    createWebRtcTransport: vi.fn().mockImplementation(async () => ({
      id: `t-${crypto.randomUUID()}`,
      iceParameters: {},
      iceCandidates: [],
      dtlsParameters: {},
    })),
    createProducer: vi.fn().mockImplementation(async (tId: string, kind: string) => {
      const pId = `prod-${crypto.randomUUID()}`;
      const mockP = { id: pId, kind, appData: {}, rtpParameters: {} };
      producerStore.set(pId, mockP);
      return pId;
    }),
    getProducer: vi.fn().mockImplementation((pId: string) => producerStore.get(pId) || { id: pId, kind: 'audio', appData: {}, rtpParameters: {} }),
    createConsumer: vi.fn().mockImplementation(async (tId: string, pId: string) => ({
      id: `cons-${crypto.randomUUID()}`,
      producerId: pId,
      kind: 'audio',
      rtpParameters: {},
    })),
  };
});

vi.mock('../../src/services/RedisMediaController', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/services/RedisMediaController')>();
  const { localMediaController } = await import('../../src/services/LocalMediaController');

  return {
    ...original,
    redisMediaController: {
      ...localMediaController,
      rpcCallToPod: vi.fn().mockImplementation(async (targetPodId: string, method: string, args: any[]) => {
        if (targetPodId === 'dead-pod') {
          throw new Error('RPC Timeout for method to dead-pod');
        }
        // @ts-ignore
        if (typeof localMediaController[method] === 'function') {
          // @ts-ignore
          return localMediaController[method](...args);
        }
        return { success: true };
      }),
    },
  };
});

import { LARGE_ROOM_CONFIG, getPipeTransportAnnouncedIp } from '../../src/config/largeRoom';
import { RoomTopologyRegistry } from '../../src/services/RoomTopologyRegistry';
import { PipeTransportRegistry } from '../../src/services/PipeTransportRegistry';
import { createCrossPodPipePair, pipeProducerCrossPod, propagateProducerStateChange, closeCrossPodPipePair } from '../../src/media/crossPodPipeTransport';
import * as sfu from '../../src/media/sfu';
import { redis } from '../../src/redis';

describe('Phase 6C-2: Cross-Pod Redis RPC PipeTransport MVP', () => {
  const roomId = 'test-room-pipe-6c2';
  const podA = 'media-pod-a';
  const podB = 'media-pod-b';
  const primaryRouterId = 'primary-r1';
  const relayRouterId = 'relay-r2';

  beforeEach(async () => {
    process.env.PIPE_TRANSPORT_ANNOUNCED_IP = '10.0.1.50';
    await sfu.initializeWorkers();
    await sfu.getOrCreateRouter(primaryRouterId);
    await sfu.getOrCreateRouter(relayRouterId);
    await PipeTransportRegistry.clearRoomPipeTransports(roomId);
    await RoomTopologyRegistry.clearRoomTopology(roomId);
    await redis.set(`media:node:${podA}:heartbeat`, 'active');
    await redis.set(`media:node:${podB}:heartbeat`, 'active');
  });

  afterEach(async () => {
    delete process.env.PIPE_TRANSPORT_ANNOUNCED_IP;
    await closeCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);
    await PipeTransportRegistry.clearRoomPipeTransports(roomId);
    await RoomTopologyRegistry.clearRoomTopology(roomId);
    await redis.del(`media:node:${podA}:heartbeat`);
    await redis.del(`media:node:${podB}:heartbeat`);
  });

  // Test 1: Feature flag default
  it('confirms pipeTransportMvpEnabled defaults to false in config', () => {
    expect(LARGE_ROOM_CONFIG.pipeTransportMvpEnabled).toBe(false);
  });

  // Test 2: Cross-pod Redis RPC handshake creates PipeTransport pair
  it('creates cross-pod PipeTransport pair between Media Pod A and Media Pod B over Redis RPC', async () => {
    const res = await createCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);
    expect(res.success).toBe(true);
    expect(res.pipePairId).toBeDefined();

    const primaryKey = `${podA}:${primaryRouterId}`;
    const relayKey = `${podB}:${relayRouterId}`;
    const pairMeta = await PipeTransportRegistry.getPipePair(roomId, primaryKey, relayKey);
    expect(pairMeta?.connected).toBe(true);
  });

  // Test 3: Dynamic internal VPC IP injection & fail-fast
  it('selects internal VPC IP and fails fast if internal IP is missing when flag is enabled', () => {
    expect(getPipeTransportAnnouncedIp()).toBe('10.0.1.50');

    delete process.env.PIPE_TRANSPORT_ANNOUNCED_IP;
    (LARGE_ROOM_CONFIG as any).pipeTransportMvpEnabled = true;

    try {
      expect(() => getPipeTransportAnnouncedIp()).toThrow('PIPE_TRANSPORT_ANNOUNCED_IP missing for PipeTransport');
    } finally {
      (LARGE_ROOM_CONFIG as any).pipeTransportMvpEnabled = false;
      process.env.PIPE_TRANSPORT_ANNOUNCED_IP = '10.0.1.50';
    }
  });

  // Test 4: Stale pod heartbeat rejection
  it('rejects cross-pod PipeTransport creation if target pod heartbeat is missing', async () => {
    await redis.del(`media:node:${podB}:heartbeat`);

    const res = await createCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Target media pod heartbeat is missing');
  });

  // Test 5: Idempotency reuses existing cross-pod pair
  it('returns existing cross-pod PipeTransport pair on duplicate creation request', async () => {
    const res1 = await createCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);
    expect(res1.success).toBe(true);

    const res2 = await createCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);
    expect(res2.success).toBe(true);
    expect(res2.pipePairId).toBe(res1.pipePairId);
  });

  // Test 6: Cross-pod producer piping
  it('pipes producer from Primary Pod A to Relay Pod B over Redis RPC', async () => {
    await createCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);

    const transport = await sfu.createWebRtcTransport(primaryRouterId);
    const producerId = await sfu.createProducer(transport.id, 'audio', {} as any, roomId);

    const pipeRes = await pipeProducerCrossPod(roomId, podA, primaryRouterId, podB, relayRouterId, producerId);
    expect(pipeRes.success).toBe(true);
    expect(pipeRes.data?.pipedProducerId).toBe(`piped-${producerId}`);
  });

  // Test 7: Duplicate producer piping prevention (Idempotency)
  it('prevents duplicate producer piping to the same relay router', async () => {
    await createCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);

    const transport = await sfu.createWebRtcTransport(primaryRouterId);
    const producerId = await sfu.createProducer(transport.id, 'audio', {} as any, roomId);

    const res1 = await pipeProducerCrossPod(roomId, podA, primaryRouterId, podB, relayRouterId, producerId);
    const res2 = await pipeProducerCrossPod(roomId, podA, primaryRouterId, podB, relayRouterId, producerId);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res2.data?.pipedProducerId).toBe(res1.data?.pipedProducerId);
  });

  // Test 8: Same producer can be piped to different relay keys in registry schema (${producerId}:${relayRouterKey})
  it('supports piping the same producer to multiple relay keys in multi-relay registry schema', async () => {
    const podC = 'media-pod-c';
    const relayRouterIdC = 'relay-r3';
    await redis.set(`media:node:${podC}:heartbeat`, 'active');

    await createCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);
    await createCrossPodPipePair(roomId, podA, primaryRouterId, podC, relayRouterIdC);

    const transport = await sfu.createWebRtcTransport(primaryRouterId);
    const producerId = await sfu.createProducer(transport.id, 'audio', {} as any, roomId);

    const resB = await pipeProducerCrossPod(roomId, podA, primaryRouterId, podB, relayRouterId, producerId);
    const resC = await pipeProducerCrossPod(roomId, podA, primaryRouterId, podC, relayRouterIdC, producerId);

    expect(resB.success).toBe(true);
    expect(resC.success).toBe(true);

    const relayKeyB = `${podB}:${relayRouterId}`;
    const relayKeyC = `${podC}:${relayRouterIdC}`;

    const metaB = await PipeTransportRegistry.getPipedProducer(roomId, producerId, relayKeyB);
    const metaC = await PipeTransportRegistry.getPipedProducer(roomId, producerId, relayKeyC);

    expect(metaB?.relayRouterKey).toBe(relayKeyB);
    expect(metaC?.relayRouterKey).toBe(relayKeyC);

    await closeCrossPodPipePair(roomId, podA, primaryRouterId, podC, relayRouterIdC);
    await redis.del(`media:node:${podC}:heartbeat`);
  });

  // Test 9: Producer lifecycle state change propagation (pause / resume / close)
  it('propagates producer pause, resume, and close to relay piped producer', async () => {
    await createCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);

    const transport = await sfu.createWebRtcTransport(primaryRouterId);
    const producerId = await sfu.createProducer(transport.id, 'audio', {} as any, roomId);
    await pipeProducerCrossPod(roomId, podA, primaryRouterId, podB, relayRouterId, producerId);

    const relayKey = `${podB}:${relayRouterId}`;
    let meta = await PipeTransportRegistry.getPipedProducer(roomId, producerId, relayKey);
    expect(meta).not.toBeNull();

    await propagateProducerStateChange(roomId, producerId, 'pause');
    await propagateProducerStateChange(roomId, producerId, 'resume');
    await propagateProducerStateChange(roomId, producerId, 'close');

    meta = await PipeTransportRegistry.getPipedProducer(roomId, producerId, relayKey);
    expect(meta).toBeNull();
  });

  // Test 10: RPC timeout triggers rollback
  it('triggers rollback when RPC to target pod times out', async () => {
    await redis.set('media:node:dead-pod:heartbeat', JSON.stringify({ status: 'healthy' }));
    const res = await createCrossPodPipePair(roomId, podA, primaryRouterId, 'dead-pod', relayRouterId);
    expect(res.success).toBe(false);
    expect(res.error).toContain('RPC Timeout');
  });

  // Test 11: Admin topology snapshot includes pipeTransports array
  it('exports pipeTransports snapshot array in admin topology snapshot', async () => {
    await createCrossPodPipePair(roomId, podA, primaryRouterId, podB, relayRouterId);

    const transport = await sfu.createWebRtcTransport(primaryRouterId);
    const producerId = await sfu.createProducer(transport.id, 'audio', {} as any, roomId);
    await pipeProducerCrossPod(roomId, podA, primaryRouterId, podB, relayRouterId, producerId);

    const pipeSnapshot = await PipeTransportRegistry.getPipeSnapshot(roomId);
    expect(pipeSnapshot.length).toBe(1);
    expect(pipeSnapshot[0].primaryRouterKey).toBe(`${podA}:${primaryRouterId}`);
    expect(pipeSnapshot[0].relayRouterKey).toBe(`${podB}:${relayRouterId}`);
    expect(pipeSnapshot[0].pipedProducers.length).toBe(1);
  });

  // Test 12: Controlled capacity_preparing fallback
  it('returns capacity_preparing when pipeTransportMvpEnabled is true and no relay is ready', async () => {
    (LARGE_ROOM_CONFIG as any).pipeTransportMvpEnabled = true;
    try {
      await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, primaryRouterId);

      const res = await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'viewer-unprovisioned', 'attendee');
      expect(res.success).toBe(false);
      expect(res.error).toBe('capacity_preparing');
    } finally {
      (LARGE_ROOM_CONFIG as any).pipeTransportMvpEnabled = false;
    }
  });
});
