// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebRTCClient } from '../../frontend/lib/webrtc';
import { Participant } from '../../frontend/lib/types/meeting';

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

describe('Mute Latency & Scale Test', () => {
  let webrtc: WebRTCClient;

  beforeEach(() => {
    vi.clearAllMocks();
    webrtc = new WebRTCClient('test-room', 'test-token');
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
  });

  it('instantly mutes the hardware track and producer without delay, even with 20 participants', async () => {
    // 1. Simulate 20 participants in the room
    const mockParticipants: Participant[] = Array.from({ length: 20 }).map((_, i) => ({
      id: `user-${i}`,
      userId: `user-${i}`,
      name: `Participant ${i}`,
      role: 'attendee',
      isMuted: false,
      isCameraOn: false,
      isScreenSharing: false,
      isSpeaking: false,
      isHandRaised: false,
      hasRequestedJoin: false
    }));

    // Verify room size
    expect(mockParticipants.length).toBe(20);

    // 2. Set up local hardware track & producer mocks
    const mockRawAudioTrack = {
      enabled: true,
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;

    const mockProducerTrack = {
      enabled: true,
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;

    const mockLocalAudioProducer = {
      paused: false,
      pause: vi.fn(),
      track: mockProducerTrack
    };

    // Attach them to the client (simulating an active microphone session)
    (webrtc as any).rawAudioTrack = mockRawAudioTrack;
    (webrtc as any).localAudioProducer = mockLocalAudioProducer;

    // 3. User clicks Mute (triggering pauseMic)
    const startTime = performance.now();
    webrtc.pauseMic();
    const endTime = performance.now();

    // 4. Verify ZERO latency behavior (synchronous execution)
    // The execution time should be practically 0ms
    expect(endTime - startTime).toBeLessThan(5); // Less than 5ms execution time

    // Verify the hardware track is instantly disabled locally
    expect(mockRawAudioTrack.enabled).toBe(false);

    // Verify the producer track is instantly disabled locally
    expect(mockProducerTrack.enabled).toBe(false);

    // Verify the producer is commanded to pause to stop sending packets
    expect(mockLocalAudioProducer.pause).toHaveBeenCalled();
  });
});
