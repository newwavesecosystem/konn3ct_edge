import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WebRTCClient } from '../webrtc';
import * as mediasoupClient from 'mediasoup-client';

// Mock browser media elements for JSDOM
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.captureStream) {
  HTMLCanvasElement.prototype.captureStream = function() {
    return {
      getVideoTracks: () => [{ kind: 'video', id: 'processed-track', stop: () => {} }],
      getAudioTracks: () => [],
      addTrack: () => {},
      removeTrack: () => {}
    } as any;
  };
}
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = async () => {};
  HTMLMediaElement.prototype.pause = () => {};
}

// Mock mediasoup-client
vi.mock('mediasoup-client', () => ({
  Device: vi.fn().mockImplementation(function(this: any) {
    return {
      load: vi.fn(),
      createSendTransport: vi.fn().mockReturnValue({
        on: vi.fn(),
        close: vi.fn(),
        produce: vi.fn().mockResolvedValue({
          id: 'mock-producer-id',
          on: vi.fn(),
          pause: vi.fn().mockImplementation(function(this: any) { this.paused = true; }),
          resume: vi.fn().mockImplementation(function(this: any) { this.paused = false; }),
          replaceTrack: vi.fn(),
          closed: false,
          paused: false,
          track: { stop: vi.fn() }
        })
      }),
      createRecvTransport: vi.fn().mockReturnValue({
        on: vi.fn(),
        close: vi.fn(),
        consume: vi.fn().mockResolvedValue({})
      }),
      rtpCapabilities: {
        codecs: [
          { mimeType: 'audio/opus', kind: 'audio' },
          { mimeType: 'video/vp8', kind: 'video' }
        ]
      }
    };
  })
}));

describe('WebRTCClient - Audio Reconnect Regression Tests', () => {
  let client: any; // using any to access private methods for testing
  let mockTrack: any;
  let mockStream: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrack = {
      enabled: true,
      stop: vi.fn(),
      readyState: 'live',
      onended: null
    };

    mockStream = {
      getAudioTracks: () => [mockTrack],
      getVideoTracks: () => []
    };

    // Global mocks for browser APIs
    (global as any).navigator = {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      }
    };
    (global as any).MediaStream = vi.fn().mockImplementation(function(this: any) { return mockStream; });

    client = new WebRTCClient('test-room', 'test-token', 'test-participant-id');
    
    // Stub internal dependencies
    client.request = vi.fn().mockResolvedValue({ transportParams: {} });
    client.device = new mediasoupClient.Device();
    client.sendTransport = client.device.createSendTransport();
  });

  it('should initialize muted and pass startMuted properly to enableMic', async () => {
    // 1. Initial state: User is muted
    client.audioConnectionStatus = 'muted';

    // Call enableMic directly simulating the fix
    await client.enableMic(true, true);

    // Verify track is disabled before producing
    expect(mockTrack.enabled).toBe(false);

    // Verify producer was paused immediately upon creation
    expect(client.localAudioProducer.pause).toHaveBeenCalled();
    expect(client.audioConnectionStatus).toBe('muted');
  });

  it('should preserve unmuted state during enableMic', async () => {
    // User is unmuted
    client.audioConnectionStatus = 'connected';

    await client.enableMic(true, false);

    expect(mockTrack.enabled).toBe(true);
    // Producer shouldn't be paused
    expect(client.localAudioProducer.pause).not.toHaveBeenCalled();
    expect(client.audioConnectionStatus).toBe('connected');
  });

  it('republishMedia should pass wasMuted=true when reconnecting while muted', async () => {
    // Setup state
    client.audioConnectionStatus = 'muted';
    // Simulate dead track to trigger enableMic in republishMedia
    mockTrack.readyState = 'ended'; 
    client.localAudioProducer = {
      closed: true,
      track: mockTrack
    };

    // Spy on enableMic
    const enableMicSpy = vi.spyOn(client, 'enableMic');
    
    // Run republishMedia with our dead audio track
    await client.republishMedia(null, mockTrack, null);

    // Should call enableMic(true, true)
    expect(enableMicSpy).toHaveBeenCalledWith(true, true);
  });

  it('should preserve muted state when Android Chrome returns from background and triggers republishMedia', async () => {
    // 1. User joins meeting on Android Chrome
    client.audioConnectionStatus = 'connected';
    
    // 2. User mutes themselves
    client.audioConnectionStatus = 'muted';

    // 3. User minimizes Chrome. 
    // Android OS typically suspends the app, causing the hardware mic track to die
    mockTrack.readyState = 'ended'; 
    client.localAudioProducer = {
      closed: true,
      track: mockTrack
    };

    // 4. User brings Chrome back to foreground.
    // The WebRTC ICE disconnect logic fires and attempts auto-recovery
    const enableMicSpy = vi.spyOn(client, 'enableMic');
    await client.republishMedia(null, mockTrack, null);

    // 5. Verification: The recovery logic MUST remember the user was muted
    // and pass startMuted=true into enableMic to prevent audio leaks.
    expect(enableMicSpy).toHaveBeenCalledWith(true, true);
  });

  it('activeTrack.onended should pass wasMuted=true when mic is unplugged while muted', async () => {
    // Setup state
    client.audioConnectionStatus = 'muted';
    
    // Call enableMic to set up the local producer and onended handler
    await client.enableMic(true, true);
    
    // Spy on the NEXT enableMic call
    const enableMicSpy = vi.spyOn(client, 'enableMic');
    
    // Simulate the track ending unexpectedly (e.g. mic unplugged)
    await mockTrack.onended();

    // Verify it called enableMic with startMuted = true
    expect(enableMicSpy).toHaveBeenCalledWith(true, true);
  });
});

describe('WebRTCClient - Camera Resolution and Aspect Ratio Constraints', () => {
  let client: any;
  let mockStream: any;
  let mockTrack: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrack = {
      enabled: true,
      stop: vi.fn(),
      readyState: 'live'
    };

    mockStream = {
      getVideoTracks: () => [mockTrack],
      getAudioTracks: () => []
    };

    // Global mocks for browser APIs
    (global as any).navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', // Desktop
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      }
    };
    (global as any).MediaStream = vi.fn().mockImplementation(function(this: any) { return mockStream; });

    client = new WebRTCClient('test-room', 'test-token', 'test-participant-id');
    client.request = vi.fn().mockResolvedValue({ transportParams: {} });
    client.device = new mediasoupClient.Device();
    client.sendTransport = client.device.createSendTransport();
  });

  it('should request 1080p widescreen constraints on desktop by default (HD=true, Widescreen=true)', async () => {
    client.isHDVideo = true;
    client.isWidescreenEnabled = true;

    await client.enableCamera();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 16 / 9 } // 16:9
        })
      })
    );
  });

  it('should request 1280x960 4:3 standard constraints on desktop when HD=true and Widescreen=false', async () => {
    client.isHDVideo = true;
    client.isWidescreenEnabled = false;

    await client.enableCamera();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          width: { ideal: 1280 },
          height: { ideal: 960 },
          aspectRatio: { ideal: 4 / 3 } // 4:3
        })
      })
    );
  });

  it('should cap resolution to 720p widescreen on mobile even if HD is enabled', async () => {
    (global as any).navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)'; // iPhone mobile

    client.isHDVideo = true;
    client.isWidescreenEnabled = true;

    await client.enableCamera();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16 / 9 }
        })
      })
    );
  });

  it('should request 360p (640x360) constraints when HD is disabled and Widescreen=true', async () => {
    client.isHDVideo = false;
    client.isWidescreenEnabled = true;

    await client.enableCamera();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          width: { ideal: 640 },
          height: { ideal: 360 },
          aspectRatio: { ideal: 16 / 9 }
        })
      })
    );
  });
});

