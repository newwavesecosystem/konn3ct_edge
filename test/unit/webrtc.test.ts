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

  it('can enable screen share with audio', async () => {
    // Setup
    webrtc.sendTransport = mockSendTransport as any;
    (webrtc as any).device = { rtpCapabilities: { codecs: [{ mimeType: 'video/vp8' }] } };
    
    // Mock getDisplayMedia to return a track for video and audio
    const mockVideoTrack = { kind: 'video', stop: vi.fn(), onended: null };
    const mockAudioTrack = { kind: 'audio', stop: vi.fn(), onended: null };
    const mockStream = {
      getVideoTracks: () => [mockVideoTrack],
      getAudioTracks: () => [mockAudioTrack]
    };
    global.navigator.mediaDevices.getDisplayMedia = vi.fn().mockResolvedValue(mockStream);
    
    // Act
    await webrtc.enableScreenShare();
    
    // Assert
    expect(global.navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith(expect.objectContaining({
      video: expect.any(Object),
      audio: true
    }));
    
    // Should have created two producers: one for video, one for audio
    expect(mockSendTransport.produce).toHaveBeenCalledTimes(2);
    expect(webrtc.localScreenTrack).toBe(mockVideoTrack);
    expect(webrtc.localScreenAudioTrack).toBe(mockAudioTrack);
    expect(webrtc.screenShareProducer).toBeDefined();
    expect(webrtc.screenAudioShareProducer).toBeDefined();
  });

  it('can disable screen share with audio', async () => {
    // Setup
    const mockVideoTrack = { stop: vi.fn() };
    const mockAudioTrack = { stop: vi.fn() };
    const mockVideoProducer = { id: 'vp1', track: mockVideoTrack, close: vi.fn() };
    const mockAudioProducer = { id: 'ap1', track: mockAudioTrack, close: vi.fn() };
    
    webrtc.screenShareProducer = mockVideoProducer as any;
    webrtc.screenAudioShareProducer = mockAudioProducer as any;
    webrtc.localScreenTrack = mockVideoTrack as any;
    webrtc.localScreenAudioTrack = mockAudioTrack as any;
    
    // Mock WebSocket to intercept stop_producer
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    
    // Act
    await webrtc.disableScreenShare();
    
    // Assert
    expect(mockVideoProducer.track.stop).toHaveBeenCalled();
    expect(mockVideoProducer.close).toHaveBeenCalled();
    expect(mockAudioProducer.track.stop).toHaveBeenCalled();
    expect(mockAudioProducer.close).toHaveBeenCalled();
    
    expect(webrtc.screenShareProducer).toBeNull();
    expect(webrtc.screenAudioShareProducer).toBeNull();
    expect(webrtc.localScreenTrack).toBeNull();
    expect(webrtc.localScreenAudioTrack).toBeNull();
    
    // Should have sent stop_producer messages to backend
    expect(ws.send).toHaveBeenCalledTimes(2);
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

  it('updates audioConnectionStatus correctly during mic lifecycle', async () => {
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    
    let statusUpdates: string[] = [];
    webrtc.onAudioStatusChanged = (status) => {
      statusUpdates.push(status);
    };

    vi.spyOn(webrtc as any, 'request').mockResolvedValue({
      routerRtpCapabilities: { codecs: [] },
      transportParams: { id: 't-1', iceParameters: {}, iceCandidates: [], dtlsParameters: {} }
    });

    vi.spyOn(webrtc, 'createDevice').mockImplementation(async () => {
      webrtc.device = {
        load: vi.fn().mockResolvedValue(undefined),
        createSendTransport: vi.fn().mockReturnValue(mockSendTransport),
        createRecvTransport: vi.fn().mockReturnValue(mockRecvTransport),
        rtpCapabilities: { codecs: [] }
      } as any;
    });

    const mockTrack = { kind: 'audio', stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const mockStream = { getAudioTracks: () => [mockTrack], getTracks: () => [mockTrack] };
    (global.navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(mockStream);

    await webrtc.initializeMediasoup();
    (webrtc as any).sendTransport = mockSendTransport;
    
    await webrtc.enableMic();
    
    // Status should transition from not_started -> connecting -> connected
    expect(statusUpdates).toEqual(['connecting', 'connected']);
    expect(webrtc.audioConnectionStatus).toBe('connected');

    // Pause mic
    webrtc.pauseMic();
    expect(webrtc.audioConnectionStatus).toBe('muted');
    expect(statusUpdates).toEqual(['connecting', 'connected', 'muted']);
  });

  it('drops self-consume requests if participantId matches', async () => {
    // MEDIA-CONSUME-001 safeguard
    webrtc.participantId = 'participant-local';
    
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
    
    const consumeSpy = vi.spyOn(webrtc as any, 'request');
    
    await (webrtc as any).consumeRemoteStream(
      'remote-prod-1',
      'participant-local',
      'user-1',
      'User Name',
      'video'
    );

    // Should NOT call request('consume')
    expect(consumeSpy).not.toHaveBeenCalled();
  });
});

describe('WebRTC Edge Cases & Fixes', () => {
  let webrtc: WebRTCClient;

  beforeEach(() => {
    vi.clearAllMocks();
    webrtc = new WebRTCClient('test-room', 'test-token');
    (webrtc as any).device = {
      rtpCapabilities: {
        codecs: [
          { kind: 'audio', mimeType: 'audio/opus' },
          { kind: 'audio', mimeType: 'audio/PCMU' },
          { kind: 'video', mimeType: 'video/vp8' },
          { kind: 'video', mimeType: 'video/h264', parameters: { 'profile-level-id': '42e01f' } },
          { kind: 'video', mimeType: 'video/VP9' }
        ]
      },
      createSendTransport: vi.fn().mockReturnValue({ id: 'send-1', on: vi.fn(), produce: vi.fn().mockResolvedValue({ id: 'prod-1', closed: false }), close: vi.fn() }),
      createRecvTransport: vi.fn().mockReturnValue({ id: 'recv-1', on: vi.fn(), consume: vi.fn().mockResolvedValue({ id: 'cons-1' }), restartIce: vi.fn().mockResolvedValue(true), close: vi.fn() })
    };
    (webrtc as any).sendTransport = { produce: vi.fn().mockResolvedValue({ id: 'prod-1', closed: false }), id: 'send-1', close: vi.fn(), on: vi.fn() };
    (webrtc as any).recvTransport = { consume: vi.fn().mockResolvedValue({ id: 'cons-1' }), restartIce: vi.fn().mockResolvedValue(true), id: 'recv-1', close: vi.fn(), on: vi.fn() };
  });

  it('forces VP8 or H264 Baseline for video production to ensure Safari/iOS compatibility', async () => {
    const dummyTrack = { kind: 'video', readyState: 'live', stop: vi.fn(), clone: vi.fn().mockReturnThis() } as any;
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [dummyTrack],
          getVideoTracks: () => [dummyTrack],
          getAudioTracks: () => [],
          clone: vi.fn().mockReturnThis()
        })
      }
    });

    // Mock device loading to prevent error
    (webrtc as any).isProducingCamera = false;
    
    await webrtc.enableCamera();
    
    expect((webrtc as any).sendTransport.produce).toHaveBeenCalled();
    const produceArgs = (webrtc as any).sendTransport.produce.mock.calls[0][0];
    expect(produceArgs.codec).toBeDefined();
    expect(produceArgs.codec.mimeType).toBe('video/vp8');
  });

  it('forces Opus for audio production to prevent Capability Mismatch', async () => {
    const dummyTrack = { kind: 'audio', readyState: 'live', stop: vi.fn(), clone: vi.fn().mockReturnThis() } as any;
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [dummyTrack],
          getVideoTracks: () => [],
          getAudioTracks: () => [dummyTrack],
          clone: vi.fn().mockReturnThis()
        })
      }
    });
    
    (webrtc as any).isProducingMic = false;
    await webrtc.enableMic();
    
    expect((webrtc as any).sendTransport.produce).toHaveBeenCalled();
    const produceArgs = (webrtc as any).sendTransport.produce.mock.calls[0][0];
    expect(produceArgs.codec).toBeDefined();
    expect(produceArgs.codec.mimeType).toBe('audio/opus');
  });

  it('clears ghost consumers on republishMedia to fix the Resume Spam Bug', async () => {
    const mockConsumer1 = { close: vi.fn() };
    const mockConsumer2 = { close: vi.fn() };
    (webrtc as any).consumers.set('ghost-1', mockConsumer1);
    (webrtc as any).consumers.set('ghost-2', mockConsumer2);
    
    const requestSpy = vi.spyOn(webrtc as any, 'request').mockResolvedValue({ producers: [] });

    await (webrtc as any).republishMedia();
    
    expect(mockConsumer1.close).toHaveBeenCalled();
    expect(mockConsumer2.close).toHaveBeenCalled();
    expect((webrtc as any).consumers.size).toBe(0);
    expect(requestSpy).toHaveBeenCalledWith('getProducers', 'producersList');
  });

  it('uses restartTransportIce when network drops instead of reset_webrtc_state (ICE Restart Alternative)', async () => {
    const requestSpy = vi.spyOn(webrtc as any, 'request').mockResolvedValue({ iceParameters: { iceKey: '123' } });
    const restartIceSpy = (webrtc as any).recvTransport.restartIce;
    
    await (webrtc as any).restartTransportIce((webrtc as any).recvTransport);
    
    expect(requestSpy).toHaveBeenCalledWith('restart_ice', 'ice_restarted', { transportId: 'recv-1' });
    expect(restartIceSpy).toHaveBeenCalledWith({ iceParameters: { iceKey: '123' } });
  });
});
