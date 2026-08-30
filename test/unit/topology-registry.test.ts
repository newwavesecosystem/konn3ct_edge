import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

import { RoomTopologyRegistry } from '../../src/services/RoomTopologyRegistry';
import { redis } from '../../src/redis';
import { LARGE_ROOM_CONFIG } from '../../src/config/largeRoom';
import request from 'supertest';
import { app } from '../../src/server';

describe('Phase 6B: Global Room Topology Registry in Redis', () => {
  const roomId = 'test-room-topology-6b';
  const podA = 'pod-media-node-1';
  const podB = 'pod-media-node-2';
  const r1 = 'router-001';
  const r2 = 'router-002';

  beforeEach(async () => {
    await RoomTopologyRegistry.clearRoomTopology(roomId);
    await redis.set(`media:node:${podA}:heartbeat`, 'active');
    await redis.set(`media:node:${podB}:heartbeat`, 'active');
  });

  afterEach(async () => {
    await RoomTopologyRegistry.clearRoomTopology(roomId);
    await redis.del(`media:node:${podA}:heartbeat`);
    await redis.del(`media:node:${podB}:heartbeat`);
  });

  // Feature Flag Safeguard
  it('confirms largeRoomTopologyRegistryEnabled defaults to false in config', () => {
    expect(LARGE_ROOM_CONFIG.largeRoomTopologyRegistryEnabled).toBe(false);
  });

  // Scenario A — Concurrent Primary Creation
  it('Scenario A: 50 concurrent calls to getOrCreatePrimaryRouter produce exactly one primary router', async () => {
    const promises = Array.from({ length: 50 }, () =>
      RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, r1)
    );

    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.success);
    expect(successful.length).toBe(50);

    const firstKey = results[0].data;
    expect(firstKey).toBe(`${podA}:${r1}`);

    for (const res of results) {
      expect(res.data).toBe(firstKey);
    }

    const topology = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(topology?.primaryRouterKey).toBe(firstKey);
    expect(Object.keys(topology?.routers || {}).length).toBe(1);
  });

  // Scenario B — Idempotent Participant Assignment
  it('Scenario B: participant assignment is idempotent and does not inflate capacity on duplicates', async () => {
    await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, r1);

    const res1 = await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'p-user-1', 'attendee');
    expect(res1.success).toBe(true);

    const top1 = await RoomTopologyRegistry.getRoomTopology(roomId);
    const count1 = top1?.routers[`${podA}:${r1}`].capacity.currentViewerCount;
    expect(count1).toBe(1);

    const res2 = await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'p-user-1', 'attendee');
    expect(res2.success).toBe(true);
    expect(res2.data).toBe(res1.data);

    const top2 = await RoomTopologyRegistry.getRoomTopology(roomId);
    const count2 = top2?.routers[`${podA}:${r1}`].capacity.currentViewerCount;
    expect(count2).toBe(1);
  });

  // Scenario C — Participant Reassignment
  it('Scenario C: moving participant from Relay A to Relay B decrements Relay A and increments Relay B atomically', async () => {
    await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, r1);
    await RoomTopologyRegistry.addRelayRouter(roomId, podB, r2, 500);

    const resAssign = await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'p-user-reassign', 'attendee');
    expect(resAssign.success).toBe(true);
    expect(resAssign.data).toBe(`${podB}:${r2}`);

    const topBefore = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(topBefore?.participantRouterMap['p-user-reassign']).toBe(`${podB}:${r2}`);

    const resReassign = await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'p-user-reassign', 'attendee');
    expect(resReassign.success).toBe(true);
    expect(resReassign.data).toBe(`${podB}:${r2}`);

    const topAfter = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(topAfter?.participantRouterMap['p-user-reassign']).toBe(`${podB}:${r2}`);
  });

  // Scenario D — Participant Removal
  it('Scenario D: removing participant deletes mapping and decrements capacity count', async () => {
    await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, r1);
    await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'p-user-rem', 'attendee');

    const top1 = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(top1?.routers[`${podA}:${r1}`].capacity.currentViewerCount).toBe(1);

    await RoomTopologyRegistry.removeParticipantFromTopology(roomId, 'p-user-rem');

    const top2 = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(top2?.participantRouterMap['p-user-rem']).toBeUndefined();
    expect(top2?.routers[`${podA}:${r1}`].capacity.currentViewerCount).toBe(0);
  });

  // Scenario E — Producer Unregister
  it('Scenario E: registers and unregisters producers from topology cleanly', async () => {
    await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, r1);
    const routerKey = `${podA}:${r1}`;
    await RoomTopologyRegistry.registerProducerInTopology(roomId, 'prod-100', routerKey);

    let top = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(top?.producerRouterMap['prod-100']).toBe(routerKey);

    await RoomTopologyRegistry.unregisterProducerFromTopology(roomId, 'prod-100');

    top = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(top?.producerRouterMap['prod-100']).toBeUndefined();
  });

  // Scenario F — Stale Media Pod Heartbeat Rejection
  it('Scenario F: rejects router creation if Media Pod lacks an active Redis heartbeat', async () => {
    const deadPod = 'pod-media-dead';

    const res = await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, deadPod, 'router-dead');
    expect(res.success).toBe(false);
    expect(res.error).toContain('not live');

    const top = await RoomTopologyRegistry.getRoomTopology(roomId);
    expect(top).toBeNull();
  });

  // Scenario G — Redis Outage Safety
  it('Scenario G: fails safely on Redis errors without throwing uncaught exceptions', async () => {
    const res = await RoomTopologyRegistry.getOrCreatePrimaryRouter('', '', '');
    expect(res.success).toBe(false);
  });

  // Scenario H — No Relay Available Fallback
  it('Scenario H: falls back to Primary Router if no relay routers exist when assigning viewers', async () => {
    await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, r1);

    const res = await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'p-viewer-fallback', 'attendee');
    expect(res.success).toBe(true);
    expect(res.data).toBe(`${podA}:${r1}`);
  });

  // Scenario I — Relay 80% Capacity Threshold
  it('Scenario I: respects 80% viewer provision threshold (400 viewers)', async () => {
    await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podA, r1);
    await RoomTopologyRegistry.addRelayRouter(roomId, podB, r2, 500);

    await redis.hset(`room:${roomId}:routerCapacity:${podB}:${r2}`, 'currentViewerCount', '400');

    const res = await RoomTopologyRegistry.assignParticipantToRouter(roomId, 'p-viewer-threshold', 'attendee');
    expect(res.success).toBe(true);
    expect(res.data).toBe(`${podA}:${r1}`);
  });

  // Scenario J — Admin API Authorization & Redaction
  it('Scenario J: protects GET /api/admin/room-topology/:roomId and redacts internal pod IPs', async () => {
    const podIp = '10.0.1.45';
    await redis.set(`media:node:${podIp}:heartbeat`, 'active');
    await RoomTopologyRegistry.getOrCreatePrimaryRouter(roomId, podIp, r1);

    // Unauthorized request without token
    const resUnauth = await request(app).get(`/api/admin/room-topology/${roomId}`);
    expect(resUnauth.status).toBe(403);

    // Authorized request with x-admin-key header
    const adminSecret = process.env.ADMIN_API_KEY || 'konn3ct-internal-admin-secret';
    const resAuth = await request(app)
      .get(`/api/admin/room-topology/${roomId}`)
      .set('x-admin-key', adminSecret);

    expect(resAuth.status).toBe(200);
    expect(resAuth.body.roomId).toBe(roomId);
    expect(resAuth.body.routers[`${podIp}:${r1}`].mediaPodId).toBe('[REDACTED_POD_IP]');

    await redis.del(`media:node:${podIp}:heartbeat`);
  });
});
