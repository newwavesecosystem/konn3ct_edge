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
    getDisplayMedia: vi.fn().mockResolvedValue({
      getVideoTracks: () => [{
        onended: vi.fn(),
        stop: vi.fn()
      }]
    })
  }
});
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

// Mock mediasoup-client
vi.mock('mediasoup-client', () => ({
  Device: class {
    load = vi.fn();
    createSendTransport = vi.fn();
    createRecvTransport = vi.fn();
    rtpCapabilities = { codecs: [{ kind: 'video', mimeType: 'video/vp8' }] };
  }
}));

// Mock video processor
vi.mock('../../frontend/lib/video-processor', () => ({
  VideoProcessor: class {
    startProcessing = vi.fn().mockReturnValue({ getVideoTracks: () => [{}] });
    stopProcessing = vi.fn();
    getMode = vi.fn().mockReturnValue('none');
    setMode = vi.fn();
  }
}));

// Mock simple-peer
vi.mock('simple-peer', () => ({
  default: class {}
}));

// Mock deepgram and react stuff
vi.mock('@deepgram/sdk', () => ({}));
vi.mock('react', () => ({}));

import { WebRTCClient } from '../../frontend/lib/webrtc';

describe('WebRTCClient Camera Fallback', () => {
  let webrtc: WebRTCClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    webrtc = new WebRTCClient('test-room', 'test-token');
    
    // Setup minimal device / transport to avoid null throws
    webrtc.device = {
      load: vi.fn(),
      createSendTransport: vi.fn(),
      createRecvTransport: vi.fn(),
      rtpCapabilities: { codecs: [{ kind: 'video', mimeType: 'video/vp8' }] }
    } as any;
    webrtc.sendTransport = {
      produce: vi.fn().mockResolvedValue({
        id: 'prod-id',
        track: { stop: vi.fn() },
        replaceTrack: vi.fn().mockResolvedValue(undefined),
        close: vi.fn(),
        closed: false
      })
    } as any;
  });

  it('tries fallback constraints progressively on OverconstrainedError', async () => {
    const getUserMedia = global.navigator.mediaDevices.getUserMedia as any;
    
    // Attempt A fails with OverconstrainedError
    // Attempt B fails with OverconstrainedError
    // Attempt C succeeds
    
    let callCount = 0;
    getUserMedia.mockImplementation(async () => {
      callCount++;
      if (callCount === 1 || callCount === 2) {
        const err = new Error('Constraints not supported');
        err.name = 'OverconstrainedError';
        throw err;
      }
      return { getVideoTracks: () => [{ stop: vi.fn() }] } as any;
    });

    await webrtc.enableCamera();
    
    expect(getUserMedia).toHaveBeenCalledTimes(3);
    
    // First call: attempt A (Ideal)
    const call1 = getUserMedia.mock.calls[0][0];
    expect(call1.video.width).toBeDefined();
    
    // Third call: attempt C
    const call3 = getUserMedia.mock.calls[2][0];
    expect(call3.video.width.ideal).toBe(640);
    
    const diagnostics = webrtc.getDiagnostics();
    expect(diagnostics.camera?.lastErrorName).toBe('OverconstrainedError');
    expect(diagnostics.camera?.lastConstraintAttempt).toBe('C (Safe)');
  });

  it('preserves existing working track if new camera acquisition fails during switch', async () => {
    const getUserMedia = global.navigator.mediaDevices.getUserMedia as any;
    
    // First enable camera succeeds
    getUserMedia.mockResolvedValueOnce({ getVideoTracks: () => [{ stop: vi.fn() }] } as any);
    await webrtc.enableCamera();
    
    expect(webrtc.localVideoProducer).toBeDefined();
    const oldProducer = webrtc.localVideoProducer;
    const oldReplaceTrack = oldProducer!.replaceTrack;
    
    // Switch camera fails entirely
    getUserMedia.mockImplementation(async () => {
      throw new Error('Terminal camera crash');
    });
    
    await expect(webrtc.switchDevice('video', 'new-device')).rejects.toThrow('Camera could not start');
    
    // Old track was NOT stopped and replaceTrack was NOT called with a failed track
    expect(oldReplaceTrack).not.toHaveBeenCalled();
    expect(webrtc.cameraSwitchInProgress).toBe(false);
  });

  it('sets audioOnlyMode and pauses video producers', async () => {
    webrtc.consumers = new Map([
      ['c1', { id: 'c1', kind: 'video', appData: { source: 'camera' }, pause: vi.fn(), resume: vi.fn() } as any],
      ['c2', { id: 'c2', kind: 'video', appData: { source: 'screen' }, pause: vi.fn(), resume: vi.fn() } as any]
    ]);
    webrtc.request = vi.fn().mockResolvedValue(undefined);
    webrtc.ws = new (global as any).WebSocket();
    webrtc.ws!.readyState = 1;
    webrtc.ws!.send = vi.fn();
    
    webrtc.enableAudioOnlyMode();
    
    expect(webrtc.isAudioOnlyMode).toBe(true);
    expect(webrtc.consumers.get('c1')?.pause).toHaveBeenCalled();
    expect(webrtc.consumers.get('c2')?.pause).not.toHaveBeenCalled(); // Screen share is exempt
    
    // Test sendCameraState
    webrtc.sendCameraState(false, true, 'network');
    expect(webrtc.ws?.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"camera_state","isCameraOn":false,"audioOnlyMode":true,"videoSuspendedReason":"network"')
    );
  });

  it('network recovery clears audio-only state but leaves camera off', async () => {
    webrtc.ws = new (global as any).WebSocket();
    webrtc.ws!.readyState = 1;
    webrtc.ws!.send = vi.fn();
    
    // Simulate being in audio-only mode
    webrtc.isAudioOnlyMode = true;
    
    webrtc.disableAudioOnlyMode();
    expect(webrtc.isAudioOnlyMode).toBe(false);
    
    webrtc.sendCameraState(false, false);
    
    // Should NOT send videoSuspendedReason, thus clearing it implicitly
    expect(webrtc.ws?.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"camera_state","isCameraOn":false,"audioOnlyMode":false')
    );
  });

  it('disableCamera clears stale camera refs and raw streams', async () => {
    webrtc.ws = new (global as any).WebSocket();
    webrtc.ws!.readyState = 1;
    webrtc.ws!.send = vi.fn();

    webrtc.rawCameraStream = { getTracks: () => [{ stop: vi.fn() }] } as any;
    webrtc.localVideoProducer = { id: 'prod1', close: vi.fn(), closed: false } as any;
    webrtc.videoProcessor = { stopProcessing: vi.fn() } as any;

    webrtc.disableCamera();

    expect(webrtc.rawCameraStream).toBeNull();
    expect(webrtc.localVideoProducer).toBeNull();
    expect(webrtc.ws?.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'stop_producer', producerId: 'prod1', appData: { source: 'camera' } })
    );
  });

  it('translates NotAllowedError to actionable message', async () => {
    const getUserMedia = global.navigator.mediaDevices.getUserMedia as any;
    getUserMedia.mockImplementation(async () => {
      const err = new Error('Permission denied');
      err.name = 'NotAllowedError';
      throw err;
    });

    await expect(webrtc.enableCamera()).rejects.toThrow("Permission denied: Please allow camera access in your browser or system settings.");
  });

  it('translates NotFoundError to actionable message', async () => {
    const getUserMedia = global.navigator.mediaDevices.getUserMedia as any;
    getUserMedia.mockImplementation(async () => {
      const err = new Error('Not found');
      err.name = 'NotFoundError';
      throw err;
    });

    await expect(webrtc.enableCamera()).rejects.toThrow("No camera found: Please connect a camera or continue audio-only.");
  });

  it('translates NotReadableError to actionable message', async () => {
    const getUserMedia = global.navigator.mediaDevices.getUserMedia as any;
    getUserMedia.mockImplementation(async () => {
      const err = new Error('Not readable');
      err.name = 'NotReadableError';
      throw err;
    });

    await expect(webrtc.enableCamera()).rejects.toThrow("Camera busy: Another app may be using the camera, or the OS blocked it.");
  });
});

describe('WebRTCClient Screen Share Codec Selection', () => {
  let client: WebRTCClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new WebRTCClient('test-room', 'test-user', 'Test User', 'attendee');
  });

  it('should prefer VP8, then H.264 Baseline if available in device capabilities', async () => {
    // Mock navigator.mediaDevices.getDisplayMedia
    const mockTrack = { stop: vi.fn(), kind: 'video' };
    (global.navigator as any).mediaDevices = {
      getDisplayMedia: vi.fn().mockResolvedValue({
        getVideoTracks: () => [mockTrack],
        getTracks: () => [mockTrack]
      })
    };

    const mockProduce = vi.fn().mockResolvedValue({
      id: 'screen-1',
      close: vi.fn(),
      paused: false,
      closed: false,
      rtpParameters: { codecs: [{ mimeType: 'video/VP8' }] }
    });

    const mockVP8Codec = { mimeType: 'video/vp8' };
    const mockH264Codec = {
      mimeType: 'video/h264',
      parameters: { 'packetization-mode': 1, 'profile-level-id': '42e01f' }
    };

    (client as any).sendTransport = { produce: mockProduce };
    (client as any).device = {
      rtpCapabilities: {
        codecs: [
          mockVP8Codec,
          { mimeType: 'video/vp9' },
          mockH264Codec
        ]
      }
    };

    await client.enableScreenShare();

    expect(mockProduce).toHaveBeenCalledWith(
      expect.objectContaining({
        codec: mockVP8Codec,
        appData: { source: 'screen' }
      })
    );
  });
});
