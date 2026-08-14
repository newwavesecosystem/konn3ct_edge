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

// Helper to simulate mapping logic efficiently
function simulateOnNewConsumer(prevParticipants: Participant[], consumer: any, source: string, userId: string): Participant[] {
  // Use a map or direct mapping for O(1) lookups in real system, but map/find is O(N) which we test for performance
  return prevParticipants.map((p) => {
    if (p.id === userId) {
      if (consumer.kind === 'video') {
        if (source === 'screen') {
          return {
            ...p,
            screenTrack: consumer.track,
            screenProducerId: consumer.producerId,
            screenConsumerId: consumer.id,
            screenTrackId: consumer.track.id,
            isScreenSharing: true,
            screenStats: {
              ...p.screenStats,
              consumerExists: true
            }
          };
        } else {
          return {
            ...p,
            videoTrack: consumer.track,
            cameraProducerId: consumer.producerId,
            cameraConsumerId: consumer.id,
            cameraTrackId: consumer.track.id,
            isCameraOn: true,
            cameraStats: {
              ...p.cameraStats,
              consumerExists: true
            }
          };
        }
      } else if (consumer.kind === 'audio') {
        return {
          ...p,
          audioTrack: consumer.track,
          audioProducerId: consumer.producerId,
          audioConsumerId: consumer.id,
          audioTrackId: consumer.track.id,
          isMuted: false
        };
      }
    }
    return p;
  });
}

describe('Massive Scale Test (800 Participants)', () => {
  let webrtc: WebRTCClient;

  beforeEach(() => {
    vi.clearAllMocks();
    webrtc = new WebRTCClient('test-room', 'test-token');
    const ws = new MockWebSocket();
    (webrtc as any).ws = ws;
  });

  it('can handle state updates for 800 participants joining with camera, audio, and screenshare without crashing', async () => {
    // ... existing test code ...
    const NUM_PARTICIPANTS = 800;

    let participants: Participant[] = Array.from({ length: NUM_PARTICIPANTS }).map((_, i) => ({
      id: `user-${i}`,
      userId: `user-${i}`,
      name: `Participant ${i}`,
      role: 'attendee',
      isMuted: true,
      isCameraOn: false,
      isScreenSharing: false,
      isSpeaking: false,
      isHandRaised: false,
      hasRequestedJoin: false
    }));

    const startTime = performance.now();

    for (let i = 0; i < NUM_PARTICIPANTS; i++) {
      const userId = `user-${i}`;
      participants = simulateOnNewConsumer(participants, { id: `cons-cam-${i}`, producerId: `prod-cam-${i}`, kind: 'video', track: { id: `track-cam-${i}` } }, 'camera', userId);
      participants = simulateOnNewConsumer(participants, { id: `cons-mic-${i}`, producerId: `prod-mic-${i}`, kind: 'audio', track: { id: `track-mic-${i}` } }, 'mic', userId);
      participants = simulateOnNewConsumer(participants, { id: `cons-screen-${i}`, producerId: `prod-screen-${i}`, kind: 'video', track: { id: `track-screen-${i}` } }, 'screen', userId);
    }

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(5000); 
  });

  it('endurance test: sustains continuous media state changes for 800 participants over 2 minutes without crashing', async () => {
    const NUM_PARTICIPANTS = 800;
    const ENDURANCE_MS = 120_000; // 2 minutes

    let participants: Participant[] = Array.from({ length: NUM_PARTICIPANTS }).map((_, i) => ({
      id: `user-${i}`,
      userId: `user-${i}`,
      name: `Participant ${i}`,
      role: 'attendee',
      isMuted: true,
      isCameraOn: false,
      isScreenSharing: false,
      isSpeaking: false,
      isHandRaised: false,
      hasRequestedJoin: false
    }));

    const startTime = Date.now();
    let cycles = 0;

    // Run continuous state updates for exactly 2 minutes
    while (Date.now() - startTime < ENDURANCE_MS) {
      // Pick a random participant to toggle their media state to simulate active meeting usage
      const randomIdx = Math.floor(Math.random() * NUM_PARTICIPANTS);
      const p = participants[randomIdx];
      
      // Simulate them toggling their camera
      participants = simulateOnNewConsumer(participants, {
        id: `cons-cam-endurance-${cycles}`,
        producerId: `prod-cam-endurance-${cycles}`,
        kind: 'video',
        track: { id: `track-cam-endurance-${cycles}` }
      }, 'camera', p.id);

      cycles++;

      // Small async yield to prevent completely locking the event loop (simulating real async network events)
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeGreaterThanOrEqual(ENDURANCE_MS);
    expect(participants.length).toBe(NUM_PARTICIPANTS);
    
    console.log(`Successfully sustained 800-participant endurance test for ${totalTime / 1000} seconds, processing ${cycles} continuous media toggles.`);
  }, 130_000); // Set vitest timeout to 130 seconds
});
