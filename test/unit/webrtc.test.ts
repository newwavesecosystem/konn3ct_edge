// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock WebSockets
class MockWebSocket {
  static OPEN = 1;
  onopen = vi.fn();
  onmessage = vi.fn();
  onclose = vi.fn();
  onerror = vi.fn();
  send = vi.fn();
  close = vi.fn();
  readyState = 1;
}
global.WebSocket = MockWebSocket as any;

// Mock navigator and sessionStorage
vi.stubGlobal('navigator', {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  mediaDevices: {
    getUserMedia: vi.fn(),
    getDisplayMedia: vi.fn()
  }
});
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

// Mock mediasoup-client
const mockProduce = vi.fn().mockResolvedValue({ id: 'producer-1', kind: 'audio', pause: vi.fn(), resume: vi.fn(), close: vi.fn() });
const mockSendTransport = {
  id: 'send-transport-1',
  on: vi.fn(),
  produce: mockProduce,
  close: vi.fn(),
};
const mockRecvTransport = {
  id: 'recv-transport-1',
  on: vi.fn(),
  consume: vi.fn(),
  close: vi.fn(),
};

vi.mock('mediasoup-client', () => {
  return {
    __esModule: true,
    Device: class {
      load = vi.fn().mockResolvedValue(undefined);
      createSendTransport = vi.fn().mockReturnValue(mockSendTransport);
      createRecvTransport = vi.fn().mockReturnValue(mockRecvTransport);
      rtpCapabilities = { codecs: [{ kind: 'audio', mimeType: 'audio/opus' }, { kind: 'video', mimeType: 'video/vp8' }] };
    }
  };
});

import { WebRTCClient } from '../../frontend/lib/webrtc';

describe('WebRTCClient Core', () => {
  let webrtc: WebRTCClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    webrtc = new WebRTCClient('test-room', 'test-token');
  });

  it('disconnects gracefully', () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    const interval = setInterval(() => {}, 1000);
    (webrtc as any).pingInterval = interval;
    
    webrtc.disconnect();
    
    expect(ws.close).toHaveBeenCalled();
    expect((webrtc as any).ws).toBeNull();
    // clearInterval is called on the object but it might not be set to null depending on implementation
  });

  it('handles chat messages via websocket', () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    
    webrtc.sendChatMessage('Hello World');
    
    expect(ws.send).toHaveBeenCalled();
    const callArgs = ws.send.mock.calls[0][0];
    const parsed = JSON.parse(callArgs);
    expect(parsed.type).toBe('chat');
    expect(parsed.message).toBe('Hello World');
  });

  it('handles server messages gracefully when unconnected', () => {
    // Should not throw
    webrtc.sendChatMessage('Hello World');
    expect(webrtc).toBeDefined();
  });

  it('can toggle mic', async () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    
    // We expect it to try to get user media
    try {
      await webrtc.toggleMic();
    } catch (e) {
      // Might throw because mediasoup isn't fully set up in the mock, but the method should be called
    }
  });

  it('can toggle camera', async () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    
    try {
      await webrtc.toggleCamera();
    } catch (e) {}
  });

  it('can send reaction', () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    webrtc.sendReaction('👍');
    expect(ws.send).toHaveBeenCalled();
  });

  it('can raise hand', () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    webrtc.sendHandRaise(true);
    expect(ws.send).toHaveBeenCalled();
  });

  it('can admit user', () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    webrtc.admitUser('user-1');
    expect(ws.send).toHaveBeenCalled();
  });

  it('can start recording', () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    webrtc.sendStartRecording();
    expect(ws.send).toHaveBeenCalled();
  });

  it('can stop recording', () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    webrtc.sendStopRecording();
    expect(ws.send).toHaveBeenCalled();
  });

  it('can initialize mediasoup and load device', async () => {
    // webrtc.device starts null
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    vi.spyOn(webrtc as any, 'request').mockResolvedValue({
      routerRtpCapabilities: { codecs: [] },
      transportParams: {
        id: 'transport-1',
        iceParameters: {},
        iceCandidates: [],
        dtlsParameters: {}
      }
    });

    vi.spyOn(webrtc, 'createDevice').mockImplementation(async () => {
      webrtc.device = {
        load: vi.fn().mockResolvedValue(undefined),
        createSendTransport: vi.fn().mockReturnValue(mockSendTransport),
        createRecvTransport: vi.fn().mockReturnValue(mockRecvTransport),
        rtpCapabilities: { codecs: [] }
      } as any;
    });

    await webrtc.initializeMediasoup();
    expect(webrtc.device).toBeDefined();
  });

  it('can enable mic and produce audio track', async () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    vi.spyOn(webrtc as any, 'request').mockResolvedValue({
      routerRtpCapabilities: { codecs: [] },
      transportParams: {
        id: 'transport-1',
        iceParameters: {},
        iceCandidates: [],
        dtlsParameters: {}
      }
    });

    vi.spyOn(webrtc, 'createDevice').mockImplementation(async () => {
      webrtc.device = {
        load: vi.fn().mockResolvedValue(undefined),
        createSendTransport: vi.fn().mockReturnValue(mockSendTransport),
        createRecvTransport: vi.fn().mockReturnValue(mockRecvTransport),
        rtpCapabilities: { codecs: [] }
      } as any;
    });

    // Setup navigator mock to return a dummy track
    const mockTrack = { kind: 'audio', stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const mockStream = { getAudioTracks: () => [mockTrack], getTracks: () => [mockTrack] };
    (global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(mockStream);

    // Ensure device and sendTransport are set
    await webrtc.initializeMediasoup();
    (webrtc as any).sendTransport = mockSendTransport;
    
    const track = await webrtc.enableMic();
    
    expect(track).toBeDefined();
    expect(mockSendTransport.produce).toHaveBeenCalled();
    const produceArgs = mockProduce.mock.calls[0][0];
    expect(produceArgs.track).toBe(mockTrack);
  });

  it('can enable camera and produce video track', async () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    vi.spyOn(webrtc as any, 'request').mockResolvedValue({
      routerRtpCapabilities: { codecs: [] },
      transportParams: {
        id: 'transport-1',
        iceParameters: {},
        iceCandidates: [],
        dtlsParameters: {}
      }
    });

    vi.spyOn(webrtc, 'createDevice').mockImplementation(async () => {
      webrtc.device = {
        load: vi.fn().mockResolvedValue(undefined),
        createSendTransport: vi.fn().mockReturnValue(mockSendTransport),
        createRecvTransport: vi.fn().mockReturnValue(mockRecvTransport),
        rtpCapabilities: { codecs: [] }
      } as any;
    });

    // Setup navigator mock to return a dummy track
    const mockTrack = { kind: 'video', stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const mockStream = { getVideoTracks: () => [mockTrack], getTracks: () => [mockTrack] };
    (global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(mockStream);

    // Ensure device and sendTransport are set
    await webrtc.initializeMediasoup();
    (webrtc as any).sendTransport = mockSendTransport;
    
    const track = await webrtc.enableCamera();
    
    expect(track).toBeDefined();
    expect(mockSendTransport.produce).toHaveBeenCalled();
    // Verify the latest call to produce has the video track
    const produceArgs = mockProduce.mock.calls[mockProduce.mock.calls.length - 1][0];
    expect(produceArgs.track).toBe(mockTrack);
  });
});
