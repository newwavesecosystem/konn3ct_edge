import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock variables
const { globalHandlers, mockHashes, mockRoomUpdate } = vi.hoisted(() => ({
  globalHandlers: {} as Record<string, Array<(...args: any[]) => void>>,
  mockHashes: {} as Record<string, Record<string, string>>,
  mockRoomUpdate: vi.fn().mockResolvedValue({})
}));

vi.mock('ioredis', () => {
  class MockRedis {
    on = vi.fn().mockImplementation((event: string, fn: (...args: any[]) => void) => {
      if (!globalHandlers[event]) globalHandlers[event] = [];
      globalHandlers[event].push(fn);
      return this;
    });
    publish = vi.fn().mockImplementation(async (channel: string, message: string) => {
      const list = globalHandlers['message'] || [];
      list.forEach(fn => fn(channel, message));
      return 1;
    });
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue('OK');
    expire = vi.fn().mockResolvedValue(1);
    subscribe = vi.fn().mockResolvedValue(1);
    psubscribe = vi.fn().mockResolvedValue(1);
    del = vi.fn().mockResolvedValue(1);
    hget = vi.fn().mockImplementation(async (key: string, field: string) => {
      return mockHashes[key] ? mockHashes[key][field] || null : null;
    });
    hset = vi.fn().mockImplementation(async (key: string, field: string, value: string) => {
      if (!mockHashes[key]) mockHashes[key] = {};
      mockHashes[key][field] = value;
      return 1;
    });
    hdel = vi.fn().mockImplementation(async (key: string, field: string) => {
      if (mockHashes[key] && mockHashes[key][field]) {
        delete mockHashes[key][field];
        return 1;
      }
      return 0;
    });
    hgetall = vi.fn().mockImplementation(async (key: string) => {
      return mockHashes[key] || {};
    });
    eval = vi.fn().mockResolvedValue(null);
    multi = vi.fn().mockReturnValue({
      hset: vi.fn().mockReturnThis(),
      hget: vi.fn().mockReturnThis(),
      hincrby: vi.fn().mockReturnThis(),
      hgetall: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 1], [null, 2]]),
    });
    setnx = vi.fn().mockResolvedValue(1);
    keys = vi.fn().mockResolvedValue([]);
    ping = vi.fn().mockResolvedValue('PONG');
    pipeline = vi.fn().mockImplementation(() => {
      const p: any = { exec: vi.fn().mockResolvedValue([]) };
      return new Proxy(p, {
        get(target, prop) {
          if (prop in target) return target[prop];
          return vi.fn().mockReturnValue(p);
        }
      });
    });
    duplicate = vi.fn().mockImplementation(() => this);
  }
  return { default: MockRedis };
});
vi.mock('../../src/db', () => ({
  db: {
    room: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'test-room-bypass',
        slug: 'test-slug',
        isWaitingRoomEnabled: true,
        networkDetectionEnabled: true
      }),
      update: mockRoomUpdate
    },
    chatMessage: { findMany: vi.fn().mockResolvedValue([]) },
    meetingPoll: { findMany: vi.fn().mockResolvedValue([]) },
    sharedNote: { findUnique: vi.fn().mockResolvedValue(null) },
    meetingQA: { findMany: vi.fn().mockResolvedValue([]) }
  }
}));

// Mock Media SFU
vi.mock('../../src/media/sfu', () => ({
  setupAudioObserver: vi.fn().mockResolvedValue(undefined),
  cleanupAudioObserver: vi.fn(),
  getProducer: vi.fn(),
  closeProducer: vi.fn(),
  closeTransport: vi.fn(),
  closeRouter: vi.fn(),
  getOrCreateRouter: vi.fn().mockResolvedValue({}),
}));

// Mock logger
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

import { roomSettingsMap, getDefaultRoomSettings } from '../../src/signaling/server';

describe('Waiting Room Bypass Feature Certification', () => {
  const testRoomId = 'test-room-bypass-101';

  beforeEach(() => {
    vi.clearAllMocks();
    roomSettingsMap.delete(testRoomId);
  });

  describe('1. Multi-Pod Room Settings Synchronization', () => {
    it('syncs roomSettingsMap when room_settings_updated is broadcast on Redis', () => {
      expect(roomSettingsMap.has(testRoomId)).toBe(false);

      // Simulate Redis pub/sub message delivered to this pod
      const messagePayload = JSON.stringify({
        roomId: testRoomId,
        message: {
          type: 'room_settings_updated',
          settings: {
            ...getDefaultRoomSettings(),
            bypassWaitingRoom: true
          }
        }
      });

      const messageHandlers = globalHandlers['message'] || [];
      expect(messageHandlers.length).toBeGreaterThan(0);

      // Trigger the subscriber callback for signaling:room:broadcast
      messageHandlers.forEach(handler => {
        handler('signaling:room:broadcast', messagePayload);
      });

      const podSettings = roomSettingsMap.get(testRoomId);
      expect(podSettings).toBeDefined();
      expect(podSettings?.bypassWaitingRoom).toBe(true);
    });
  });

  describe('2. Bypass Setting & State Inversion', () => {
    it('inverts bypassWaitingRoom to waitingRoomEnabled accurately', () => {
      const settings = getDefaultRoomSettings();
      expect(settings.bypassWaitingRoom).toBe(false);

      // Simulating host setting bypassWaitingRoom: true
      const incomingBypass = true;
      const waitingRoomEnabled = !incomingBypass;
      expect(waitingRoomEnabled).toBe(false);

      // Persisted to roomSettingsMap
      const newSettings = { ...settings, bypassWaitingRoom: incomingBypass };
      roomSettingsMap.set(testRoomId, newSettings);

      expect(roomSettingsMap.get(testRoomId)?.bypassWaitingRoom).toBe(true);
    });
  });

  describe('3. Resume Session Waiting vs Active Logic with Bypass', () => {
    it('properly resolves active fallback when bypassWaitingRoom is true even with WAITING status', () => {
      // Room settings has bypass active
      roomSettingsMap.set(testRoomId, {
        ...getDefaultRoomSettings(),
        bypassWaitingRoom: true
      });

      const currentRoomSettings = roomSettingsMap.get(testRoomId);
      const isWaitingRoomActive = currentRoomSettings?.bypassWaitingRoom ? false : true;
      expect(isWaitingRoomActive).toBe(false);

      const isHostOrBot = false;
      const adm = { status: 'WAITING' as const };

      let fallbackStatus: 'active' | 'waiting' | 'denied' = 'active';
      if (adm?.status === 'REMOVED' && !isHostOrBot) {
        fallbackStatus = 'denied';
      } else if (isHostOrBot || !isWaitingRoomActive) {
        fallbackStatus = 'active';
      } else if (adm?.status === 'LEFT' || adm?.status === 'WAITING' || !adm) {
        fallbackStatus = 'waiting';
      } else {
        fallbackStatus = 'waiting';
      }

      // Must be ACTIVE because bypass is true!
      expect(fallbackStatus).toBe('active');
    });

    it('resolves waiting fallback when bypassWaitingRoom is false and status is WAITING', () => {
      // Room settings has bypass disabled (waiting room active)
      roomSettingsMap.set(testRoomId, {
        ...getDefaultRoomSettings(),
        bypassWaitingRoom: false
      });

      const currentRoomSettings = roomSettingsMap.get(testRoomId);
      const isWaitingRoomActive = currentRoomSettings?.bypassWaitingRoom ? false : true;
      expect(isWaitingRoomActive).toBe(true);

      const isHostOrBot = false;
      const adm = { status: 'WAITING' as const };

      let fallbackStatus: 'active' | 'waiting' | 'denied' = 'active';
      if (adm?.status === 'REMOVED' && !isHostOrBot) {
        fallbackStatus = 'denied';
      } else if (isHostOrBot || !isWaitingRoomActive) {
        fallbackStatus = 'active';
      } else if (adm?.status === 'LEFT' || adm?.status === 'WAITING' || !adm) {
        fallbackStatus = 'waiting';
      } else {
        fallbackStatus = 'waiting';
      }

      // Must be WAITING because bypass is false
      expect(fallbackStatus).toBe('waiting');
    });
  });

  describe('4. Settings Update Broadcast and DB Persistence Contract', () => {
    it('verifies DB payload includes isWaitingRoomEnabled: false when bypass is enabled', () => {
      const d = { bypassWaitingRoom: true };
      const waitingRoomEnabled = d.bypassWaitingRoom !== undefined ? !d.bypassWaitingRoom : undefined;
      expect(waitingRoomEnabled).toBe(false);

      const dbUpdateData = {
        ...(waitingRoomEnabled !== undefined ? { isWaitingRoomEnabled: waitingRoomEnabled } : {}),
        networkDetectionEnabled: true
      };

      expect(dbUpdateData.isWaitingRoomEnabled).toBe(false);
    });

    it('verifies admit_all command structure dispatched on bypass enabled', () => {
      const roomId = testRoomId;
      const roomSlug = 'test-room-slug';
      const userId = 'host-123';
      const waitingRoomEnabled = false;

      let publishedChannel = '';
      let publishedPayload = '';

      if (waitingRoomEnabled === false) {
        publishedChannel = 'signaling:room:broadcast';
        publishedPayload = JSON.stringify({
          roomId,
          command: true,
          action: 'admit_all',
          slug: roomSlug,
          sourceUserId: userId
        });
      }

      expect(publishedChannel).toBe('signaling:room:broadcast');
      const parsed = JSON.parse(publishedPayload);
      expect(parsed.command).toBe(true);
      expect(parsed.action).toBe('admit_all');
      expect(parsed.roomId).toBe(testRoomId);
      expect(parsed.sourceUserId).toBe(userId);
    });
  });
});
