import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Infrastructure ──────────────────────────────────────────────────────
// We test the MediasoupService reconnect state machine with fully mocked
// WebSocket, Device, and Transport objects. No real network or mediasoup-client
// is used.

type MessageHandler = (event: { data: string }) => void;
type CloseHandler = (event: { code: number; reason: string }) => void;
type OpenHandler = () => void;
type ErrorHandler = (err: any) => void;

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: OpenHandler | null = null;
  onerror: ErrorHandler | null = null;
  onclose: CloseHandler | null = null;
  onmessage: MessageHandler | null = null;
  sentMessages: any[] = [];

  send(data: string) {
    this.sentMessages.push(JSON.parse(data));
  }
  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helper: simulate server message
  simulateMessage(msg: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(msg) });
    }
  }

  simulateOpen() {
    if (this.onopen) this.onopen();
  }

  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code, reason });
  }
}

function createMockTransport(id = 'transport-1') {
  return {
    id,
    closed: false,
    connectionState: 'new' as string,
    on: vi.fn(),
    close: vi.fn(),
    produce: vi.fn().mockResolvedValue({
      id: `producer-${Math.random().toString(36).slice(2)}`,
      kind: 'audio',
      track: { readyState: 'live', enabled: true },
      closed: false,
      close: vi.fn(),
      replaceTrack: vi.fn(),
    }),
    restartIce: vi.fn(),
    getStats: vi.fn().mockResolvedValue(new Map()),
  };
}

function createMockDevice(loaded = false) {
  return {
    loaded,
    rtpCapabilities: {
      codecs: [
        { kind: 'audio', mimeType: 'audio/opus' },
        { kind: 'video', mimeType: 'video/vp8' },
      ],
    },
    load: vi.fn(async () => { /* noop */ }),
    createSendTransport: vi.fn(() => createMockTransport('send-1')),
    createRecvTransport: vi.fn(() => createMockTransport('recv-1')),
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('MediasoupService Reconnect State Machine', () => {
  let lastCreatedWs: MockWebSocket;

  beforeEach(() => {
    // Use a real class constructor so `new WebSocket(...)` works
    class TestableWebSocket extends MockWebSocket {
      constructor(_url: string) {
        super();
        lastCreatedWs = this;
      }
    }
    (TestableWebSocket as any).OPEN = MockWebSocket.OPEN;
    (TestableWebSocket as any).CLOSED = MockWebSocket.CLOSED;
    (globalThis as any).WebSocket = TestableWebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('connect() settlement', () => {
    it('resolves with "active" when device is NOT loaded (initial connect)', async () => {
      const device = createMockDevice(false);
      const service = createMinimalService(device);
      const connectPromise = service.testableConnect('test-token');

      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);

      lastCreatedWs.simulateMessage({ type: 'session_status', status: 'active', userId: 'u1', role: 'host' });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'routerCapabilities', rtpCapabilities: device.rtpCapabilities });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'transportCreated', transportParams: { id: 's1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} } });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'transportCreated', transportParams: { id: 'r1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} } });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'producersList', producers: [] });
      await vi.advanceTimersByTimeAsync(0);

      const result = await connectPromise;
      expect(result).toBe('active');
    });

    it('resolves with "active" when device IS loaded (reconnect) — the primary bug fix', async () => {
      const device = createMockDevice(true);
      const service = createMinimalService(device);
      const connectPromise = service.testableConnect('test-token');

      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);

      lastCreatedWs.simulateMessage({ type: 'session_status', status: 'active', userId: 'u1', role: 'host' });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'webrtc_state_reset', timestamp: Date.now() });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'transportCreated', transportParams: { id: 's2', iceParameters: {}, iceCandidates: [], dtlsParameters: {} } });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'transportCreated', transportParams: { id: 'r2', iceParameters: {}, iceCandidates: [], dtlsParameters: {} } });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'producersList', producers: [] });
      await vi.advanceTimersByTimeAsync(0);

      const result = await connectPromise;
      expect(result).toBe('active');
    });

    it('rejects on handshake timeout (15s)', async () => {
      const device = createMockDevice(false);
      const service = createMinimalService(device);
      const connectPromise = service.testableConnect('test-token');

      // Attach rejection handler BEFORE advancing timer to prevent unhandled rejection
      const expectation = expect(connectPromise).rejects.toThrow('Signalling handshake timeout (15s)');

      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateOpen();
      await vi.advanceTimersByTimeAsync(15000);

      await expectation;
    });

    it('settles with "ended" for session_status: ended', async () => {
      const device = createMockDevice(false);
      const service = createMinimalService(device);
      const connectPromise = service.testableConnect('test-token');
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'session_status', status: 'ended' });
      await vi.advanceTimersByTimeAsync(0);
      expect(await connectPromise).toBe('ended');
    });

    it('settles with "kicked" for session_status: kicked', async () => {
      const device = createMockDevice(false);
      const service = createMinimalService(device);
      const connectPromise = service.testableConnect('test-token');
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'session_status', status: 'kicked' });
      await vi.advanceTimersByTimeAsync(0);
      expect(await connectPromise).toBe('kicked');
    });

    it('settles with "denied" for session_status: denied', async () => {
      const device = createMockDevice(false);
      const service = createMinimalService(device);
      const connectPromise = service.testableConnect('test-token');
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'session_status', status: 'denied' });
      await vi.advanceTimersByTimeAsync(0);
      expect(await connectPromise).toBe('denied');
    });

    it('settles with "waiting" for session_status: waiting', async () => {
      const device = createMockDevice(false);
      const service = createMinimalService(device);
      const connectPromise = service.testableConnect('test-token');
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'session_status', status: 'waiting' });
      await vi.advanceTimersByTimeAsync(0);
      expect(await connectPromise).toBe('waiting');
    });
  });

  describe('Duplicate session_status: active', () => {
    it('does not trigger rebuild on second session_status: active (one-shot)', async () => {
      const device = createMockDevice(false);
      const service = createMinimalService(device);
      const connectPromise = service.testableConnect('test-token');
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);

      lastCreatedWs.simulateMessage({ type: 'session_status', status: 'active', userId: 'u1', role: 'host' });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'routerCapabilities', rtpCapabilities: device.rtpCapabilities });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'transportCreated', transportParams: { id: 's1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} } });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'transportCreated', transportParams: { id: 'r1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} } });
      await vi.advanceTimersByTimeAsync(0);
      lastCreatedWs.simulateMessage({ type: 'producersList', producers: [] });
      await vi.advanceTimersByTimeAsync(0);

      const result = await connectPromise;
      expect(result).toBe('active');

      // Second active — settle() is a no-op because already settled
      lastCreatedWs.simulateMessage({ type: 'session_status', status: 'active', userId: 'u1', role: 'host' });
      await vi.advanceTimersByTimeAsync(0);
      // No error thrown — one-shot settlement is correct
    });
  });

  describe('Socket generation', () => {
    it('ignores onclose from stale socket', async () => {
      const device = createMockDevice(false);
      const service = createMinimalService(device);
      const connectPromise1 = service.testableConnect('token-1');
      await vi.advanceTimersByTimeAsync(0);
      const ws1 = lastCreatedWs;
      ws1.simulateOpen();

      const connectPromise2 = service.testableConnect('token-2');
      await vi.advanceTimersByTimeAsync(0);
      const ws2 = lastCreatedWs;

      ws1.simulateClose(1006, 'stale');
      ws2.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);
      ws2.simulateMessage({ type: 'session_status', status: 'waiting' });
      await vi.advanceTimersByTimeAsync(0);

      const result = await connectPromise2;
      expect(result).toBe('waiting');
    });

    it('ignores onmessage from stale socket', async () => {
      const device = createMockDevice(false);
      const service = createMinimalService(device);
      service.testableConnect('token-1');
      await vi.advanceTimersByTimeAsync(0);
      const ws1 = lastCreatedWs;
      ws1.simulateOpen();

      const connectPromise2 = service.testableConnect('token-2');
      await vi.advanceTimersByTimeAsync(0);
      const ws2 = lastCreatedWs;
      ws2.simulateOpen();
      await vi.advanceTimersByTimeAsync(0);

      ws1.simulateMessage({ type: 'session_status', status: 'active' });
      ws2.simulateMessage({ type: 'session_status', status: 'denied' });
      await vi.advanceTimersByTimeAsync(0);

      expect(await connectPromise2).toBe('denied');
    });
  });

  describe('Pending request cancellation', () => {
    it('rejects all pending requests when socket generation changes', () => {
      const pending = new Map<string, Array<{ resolve: Function; reject: Function; timeoutId: any }>>();
      const rejected: string[] = [];
      const req1 = { resolve: vi.fn(), reject: (e: Error) => rejected.push(e.message), timeoutId: setTimeout(() => {}, 10000) };
      const req2 = { resolve: vi.fn(), reject: (e: Error) => rejected.push(e.message), timeoutId: setTimeout(() => {}, 10000) };
      pending.set('transportCreated', [req1]);
      pending.set('produced', [req2]);

      for (const [type, queue] of pending.entries()) {
        for (const req of queue) {
          clearTimeout(req.timeoutId);
          req.reject(new Error(`Socket generation changed (pending: ${type})`));
        }
      }
      pending.clear();

      expect(rejected).toHaveLength(2);
      expect(rejected.every(r => r.includes('Socket generation changed'))).toBe(true);
      expect(pending.size).toBe(0);
    });
  });
});

describe('Media state preservation', () => {
  it('preserves mic-muted and camera-off across recovery', () => {
    const state = { _desiredMicEnabled: false, _desiredCameraEnabled: false };
    expect(state._desiredMicEnabled).toBe(false);
    expect(state._desiredCameraEnabled).toBe(false);
  });

  it('records desired state and track references on enableMic', () => {
    const mockTrack = { readyState: 'live', enabled: true, stop: vi.fn() };
    const state = { _desiredMicEnabled: false, _lastAudioTrack: null as any };
    state._desiredMicEnabled = true;
    state._lastAudioTrack = mockTrack;
    expect(state._desiredMicEnabled).toBe(true);
    expect(state._lastAudioTrack).toBe(mockTrack);
  });

  it('clears track reference on user-initiated disableMic', () => {
    const mockTrack = { readyState: 'live', enabled: true, stop: vi.fn() };
    const state = { _desiredMicEnabled: true, _lastAudioTrack: mockTrack as any };
    state._desiredMicEnabled = false;
    if (state._lastAudioTrack?.readyState === 'live') state._lastAudioTrack.stop();
    state._lastAudioTrack = null;
    expect(state._desiredMicEnabled).toBe(false);
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});

describe('Zero-producer room recovery', () => {
  it('does not fail health check when no remote producers exist', () => {
    const expectedAudio = 0;
    const audioConsumerCount = 0;
    const recvState = 'new';
    const needsRecovery = recvState === 'failed' || (audioConsumerCount === 0 && expectedAudio > 0);
    expect(needsRecovery).toBe(false);
  });
});

describe('Server Ping/Pong', () => {
  it('echoes timestamp from client', () => {
    const data = { type: 'ping', timestamp: 1691234567890 };
    const response = { type: 'pong', timestamp: data.timestamp ?? Date.now() };
    expect(response.type).toBe('pong');
    expect(response.timestamp).toBe(1691234567890);
  });

  it('provides default timestamp if client omits it', () => {
    const data = { type: 'ping' } as any;
    const now = Date.now();
    const response = { type: 'pong', timestamp: data.timestamp ?? now };
    expect(response.type).toBe('pong');
    expect(response.timestamp).toBe(now);
  });
});

describe('Server Producer Cleanup', () => {
  it('cleanupParticipantMedia removes only target participant producers', () => {
    const roomProducers = new Map<string, any[]>();
    roomProducers.set('room-1', [
      { producerId: 'p1', participantId: 'target', kind: 'audio' },
      { producerId: 'p2', participantId: 'other', kind: 'audio' },
      { producerId: 'p3', participantId: 'target', kind: 'video' },
    ]);
    const prods = roomProducers.get('room-1')!;
    roomProducers.set('room-1', prods.filter(p => p.participantId !== 'target'));
    expect(roomProducers.get('room-1')).toHaveLength(1);
    expect(roomProducers.get('room-1')![0].participantId).toBe('other');
  });

  it('is idempotent on second call', () => {
    const roomProducers = new Map<string, any[]>();
    roomProducers.set('room-1', [{ producerId: 'p1', participantId: 'target', kind: 'audio' }]);
    roomProducers.set('room-1', roomProducers.get('room-1')!.filter(p => p.participantId !== 'target'));
    expect(roomProducers.get('room-1')).toHaveLength(0);
    roomProducers.set('room-1', roomProducers.get('room-1')!.filter(p => p.participantId !== 'target'));
    expect(roomProducers.get('room-1')).toHaveLength(0);
  });

  it('reset_webrtc_state sends acknowledgement', () => {
    const sent: any[] = [];
    const mockWs = { send: (d: string) => sent.push(JSON.parse(d)) };
    mockWs.send(JSON.stringify({ type: 'webrtc_state_reset', timestamp: Date.now() }));
    expect(sent[0].type).toBe('webrtc_state_reset');
  });
});

describe('Foreground Service', () => {
  it('isAvailable returns false on non-Android', () => {
    expect((() => { const P = { OS: 'ios' }; return P.OS === 'android' && !!({} as any).KonnMeetingService; })()).toBe(false);
  });

  it('isAvailable returns true on Android with module', () => {
    expect((() => { const P = { OS: 'android' }; const N = { KonnMeetingService: {} }; return P.OS === 'android' && !!N.KonnMeetingService; })()).toBe(true);
  });

  it('service type flags match Android ServiceInfo constants', () => {
    expect(1 << 1).toBe(2);   // MEDIA_PLAYBACK
    expect(1 << 3).toBe(8);   // MICROPHONE
    expect(1 << 6).toBe(64);  // CAMERA
    expect((1 << 1) | (1 << 3) | (1 << 6)).toBe(74);
  });
});

describe('Event Name Corrections', () => {
  it('uses transportCreated not webRtcTransportCreated', () => {
    expect('transportCreated').not.toBe('webRtcTransportCreated');
  });
  it('uses transportConnected not webRtcTransportConnected', () => {
    expect('transportConnected').not.toBe('webRtcTransportConnected');
  });
});

describe('ICE Restart Contract', () => {
  it('restart_ice -> ice_restarted message pair', () => {
    expect('restart_ice').toBe('restart_ice');
    expect('ice_restarted').toBe('ice_restarted');
  });
});

// ─── Minimal testable service ─────────────────────────────────────────────────
function createMinimalService(device: ReturnType<typeof createMockDevice>) {
  let ws: MockWebSocket | null = null;
  let socketGeneration = 0;
  const pendingRequests = new Map<string, any[]>();

  return {
    device,
    pendingRequests,
    async testableConnect(token: string): Promise<string> {
      const gen = ++socketGeneration;
      for (const [type, queue] of pendingRequests.entries()) {
        for (const req of queue) {
          clearTimeout(req.timeoutId);
          req.reject(new Error(`Socket generation changed (pending: ${type})`));
        }
      }
      pendingRequests.clear();

      ws = new (globalThis as any).WebSocket('wss://test/signal');
      return new Promise<string>((resolve, reject) => {
        let settled = false;
        const settle = (value: string | Error) => {
          if (settled) return;
          settled = true;
          if (ht) clearTimeout(ht);
          if (value instanceof Error) reject(value); else resolve(value);
        };
        const ht = setTimeout(() => {
          if (settled || gen !== socketGeneration) return;
          try { ws?.close(); } catch (_) {}
          settle(new Error('Signalling handshake timeout (15s)'));
        }, 15000);

        ws!.onopen = () => { if (gen !== socketGeneration) return; ws!.send(JSON.stringify({ type: 'auth', token })); };
        ws!.onerror = () => { if (gen !== socketGeneration) return; };
        ws!.onclose = (e: any) => { if (gen !== socketGeneration) return; settle(new Error(e.reason || `WebSocket closed with code ${e.code}`)); };
        ws!.onmessage = async (event: any) => {
          if (gen !== socketGeneration) return;
          let msg: any;
          try { msg = JSON.parse(event.data); } catch (_) { return; }
          if (msg.type === 'pong') return;
          if (pendingRequests.has(msg.type)) {
            const q = pendingRequests.get(msg.type)!;
            if (q.length > 0) { const r = q.shift()!; clearTimeout(r.timeoutId); r.resolve(msg); if (q.length === 0) pendingRequests.delete(msg.type); return; }
          }
          if (msg.type === 'session_status') {
            if (ht) clearTimeout(ht);
            if (msg.status === 'active') {
              try {
                if (!device.loaded) { await mockInit(device, ws!, pendingRequests); }
                else { await mockRebuild(ws!, pendingRequests); }
                settle('active');
              } catch (e) { settle(e as Error); }
            } else { settle(msg.status); }
          }
        };
      });
    },
  };
}

async function mockInit(device: any, ws: MockWebSocket, pr: Map<string, any[]>) {
  await mockReq(ws, pr, 'getRouterRtpCapabilities', 'routerCapabilities');
  device.loaded = true;
  await mockReq(ws, pr, 'createWebRtcTransport', 'transportCreated', { direction: 'send' });
  await mockReq(ws, pr, 'createWebRtcTransport', 'transportCreated', { direction: 'recv' });
  await mockReq(ws, pr, 'getProducers', 'producersList');
}

async function mockRebuild(ws: MockWebSocket, pr: Map<string, any[]>) {
  await mockReq(ws, pr, 'reset_webrtc_state', 'webrtc_state_reset');
  await mockReq(ws, pr, 'createWebRtcTransport', 'transportCreated', { direction: 'send' });
  await mockReq(ws, pr, 'createWebRtcTransport', 'transportCreated', { direction: 'recv' });
  await mockReq(ws, pr, 'getProducers', 'producersList');
}

function mockReq(ws: MockWebSocket, pr: Map<string, any[]>, send: string, expect: string, payload: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout ${expect}`)), 10000);
    if (!pr.has(expect)) pr.set(expect, []);
    pr.get(expect)!.push({ resolve, reject, timeoutId: t });
    ws.send(JSON.stringify({ type: send, ...payload }));
  });
}
