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

// Mock Mediasoup SFU layer for reliable cross-platform unit testing
vi.mock('../../src/media/sfu', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/media/sfu')>();
  const routerStore = new Map<string, any>();

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
        tuple: { localIp: '127.0.0.1', localPort: 40001 },
        srtpParameters: {},
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
      };
    }
    async pipeToRouter({ producerId }: { producerId: string }) {
      const pipedId = `piped-${producerId}`;
      return {
        pipeConsumer: { id: `pipe-c-${producerId}`, close: vi.fn() },
        pipeProducer: { id: pipedId, kind: 'audio', close: vi.fn() },
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
    createWebRtcTransport: vi.fn().mockImplementation(async (roomId: string) => ({
      id: `t-${crypto.randomUUID()}`,
      iceParameters: {},
      iceCandidates: [],
      dtlsParameters: {},
    })),
    createProducer: vi.fn().mockImplementation(async () => `prod-${crypto.randomUUID()}`),
    createConsumer: vi.fn().mockImplementation(async (tId: string, pId: string) => ({
      id: `cons-${crypto.randomUUID()}`,
      producerId: pId,
      kind: 'audio',
      rtpParameters: {},
    })),
  };
});

import { LARGE_ROOM_CONFIG } from '../../src/config/largeRoom';
import { RoomTopologyRegistry } from '../../src/services/RoomTopologyRegistry';
import { PipeTransportRegistry } from '../../src/services/PipeTransportRegistry';
import { createLocalPipeTransportPair, pipeLocalProducerToRelay, closeLocalPipePair } from '../../src/media/pipeTransport';
import * as sfu from '../../src/media/sfu';
import { redis } from '../../src/redis';

describe('Phase 6C-1: Local/Intra-Pod PipeTransport Harness', () => {
  const roomId = 'test-room-pipe-6c1';
  const podA = 'media-pod-1';
  const podB = 'media-pod-2';
  const primaryRouterId = 'primary-r1';
  const relayRouterId = 'relay-r2';

  beforeEach(async () => {
    await initializeWorkersAndRouters();
    await PipeTransportRegistry.clearRoomPipeTransports(roomId);
    await RoomTopologyRegistry.clearRoomTopology(roomId);
    await redis.set(`media:node:${podA}:heartbeat`, 'active');
    await redis.set(`media:node:${podB}:heartbeat`, 'active');
  });

  afterEach(async () => {
    await closeLocalPipePair(roomId, primaryRouterId, relayRouterId, podA, podB);
    await PipeTransportRegistry.clearRoomPipeTransports(roomId);
    await RoomTopologyRegistry.clearRoomTopology(roomId);
    await redis.del(`media:node:${podA}:heartbeat`);
    await redis.del(`media:node:${podB}:heartbeat`);
  });

  async function initializeWorkersAndRouters() {
    await sfu.initializeWorkers();
    await sfu.getOrCreateRouter(primaryRouterId);
    await sfu.getOrCreateRouter(relayRouterId);
  }

  // Test 1: Feature flag default
  it('confirms pipeTransportMvpEnabled defaults to false in config', () => {
    expect(LARGE_ROOM_CONFIG.pipeTransportMvpEnabled).toBe(false);
  });

  // Test 2: Standard meetings remain unaffected
  it('standard meetings remain unaffected when pipeTransportMvpEnabled is false', async () => {
    await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, primaryRouterId);
    const res = await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'p-std-user', 'attendee');
    expect(res.success).toBe(true);
    expect(res.data).toBe(`${podA}:${primaryRouterId}`);
  });

  // Test 3: Local PipeTransport pair creation
  it('creates local PipeTransport pair between Primary and Relay routers', async () => {
    const res = await createLocalPipeTransportPair(roomId, primaryRouterId, relayRouterId, podA, podB);
    expect(res.success).toBe(true);
    expect(res.pipePairId).toBeDefined();

    const primaryKey = `${podA}:${primaryRouterId}`;
    const relayKey = `${podB}:${relayRouterId}`;
    const pairMeta = await PipeTransportRegistry.getPipePair(roomId, primaryKey, relayKey);
    expect(pairMeta?.connected).toBe(true);
  });

  // Test 4: Local producer piping
  it('pipes producer from Primary Router to Relay Router locally', async () => {
    await createLocalPipeTransportPair(roomId, primaryRouterId, relayRouterId, podA, podB);

    const transport = await sfu.createWebRtcTransport(primaryRouterId);
    const mockRtpParams: any = {
      codecs: [{ mimeType: 'audio/opus', payloadType: 111, clockRate: 48000, channels: 2 }],
      headerExtensions: [],
      encodings: [{}],
    };

    const producerId = await sfu.createProducer(transport.id, 'audio', mockRtpParams, roomId);
    expect(producerId).toBeDefined();

    const pipeRes = await pipeLocalProducerToRelay(roomId, primaryRouterId, relayRouterId, producerId, podA, podB);
    expect(pipeRes.success).toBe(true);
    expect(pipeRes.data?.pipedProducerId).toBeDefined();
  });

  // Test 5: Relay viewer consumer creation
  it('relay viewer can consume piped producer in the local harness', async () => {
    await createLocalPipeTransportPair(roomId, primaryRouterId, relayRouterId, podA, podB);

    const transport = await sfu.createWebRtcTransport(primaryRouterId);
    const mockRtpParams: any = {
      codecs: [{ mimeType: 'audio/opus', payloadType: 111, clockRate: 48000, channels: 2 }],
      headerExtensions: [],
      encodings: [{}],
    };
    const producerId = await sfu.createProducer(transport.id, 'audio', mockRtpParams, roomId);

    const pipeRes = await pipeLocalProducerToRelay(roomId, primaryRouterId, relayRouterId, producerId, podA, podB);
    const pipedProducerId = pipeRes.data!.pipedProducerId;

    const relayViewerTransport = await sfu.createWebRtcTransport(relayRouterId);
    const relayRouter = sfu.getRouter(relayRouterId)!;
    const rtpCapabilities = relayRouter.rtpCapabilities;

    const consumer = await sfu.createConsumer(relayViewerTransport.id, pipedProducerId, rtpCapabilities, relayRouter);
    expect(consumer.id).toBeDefined();
    expect(consumer.producerId).toBe(pipedProducerId);
  });

  // Test 6: Duplicate pipe pair request returns existing pair (Idempotency)
  it('returns existing PipeTransport pair on duplicate creation request', async () => {
    const res1 = await createLocalPipeTransportPair(roomId, primaryRouterId, relayRouterId, podA, podB);
    expect(res1.success).toBe(true);

    const res2 = await createLocalPipeTransportPair(roomId, primaryRouterId, relayRouterId, podA, podB);
    expect(res2.success).toBe(true);
    expect(res2.pipePairId).toBe(res1.pipePairId);
  });

  // Test 7: Duplicate producer pipe request is prevented (Idempotency)
  it('prevents duplicate producer piping to the same relay', async () => {
    await createLocalPipeTransportPair(roomId, primaryRouterId, relayRouterId, podA, podB);

    const transport = await sfu.createWebRtcTransport(primaryRouterId);
    const mockRtpParams: any = {
      codecs: [{ mimeType: 'audio/opus', payloadType: 111, clockRate: 48000, channels: 2 }],
      headerExtensions: [],
      encodings: [{}],
    };
    const producerId = await sfu.createProducer(transport.id, 'audio', mockRtpParams, roomId);

    const res1 = await pipeLocalProducerToRelay(roomId, primaryRouterId, relayRouterId, producerId, podA, podB);
    const res2 = await pipeLocalProducerToRelay(roomId, primaryRouterId, relayRouterId, producerId, podA, podB);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res2.data?.pipedProducerId).toBe(res1.data?.pipedProducerId);
  });

  // Test 8: PipeTransport cleanup closes transports and removes registry state
  it('cleans up PipeTransport pair and deletes registry entries on teardown', async () => {
    await createLocalPipeTransportPair(roomId, primaryRouterId, relayRouterId, podA, podB);

    const primaryKey = `${podA}:${primaryRouterId}`;
    const relayKey = `${podB}:${relayRouterId}`;

    let pairMeta = await PipeTransportRegistry.getPipePair(roomId, primaryKey, relayKey);
    expect(pairMeta).not.toBeNull();

    await closeLocalPipePair(roomId, primaryRouterId, relayRouterId, podA, podB);

    pairMeta = await PipeTransportRegistry.getPipePair(roomId, primaryKey, relayKey);
    expect(pairMeta).toBeNull();
  });

  // Test 9: capacity_preparing fallback response
  it('returns capacity_preparing when pipeTransportMvpEnabled is true and relay capacity is unprovisioned', async () => {
    (LARGE_ROOM_CONFIG as any).pipeTransportMvpEnabled = true;

    try {
      await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, primaryRouterId);

      const res = await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'p-viewer-busy', 'attendee');
      expect(res.success).toBe(false);
      expect(res.error).toBe('capacity_preparing');
    } finally {
      (LARGE_ROOM_CONFIG as any).pipeTransportMvpEnabled = false;
    }
  });
});
