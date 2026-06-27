import { describe, it, expect } from 'vitest';
import { Participant } from '../../frontend/lib/types/meeting';

// Pure helper function simulating the onNewConsumer logic from meeting-context
function simulateOnNewConsumer(prevParticipants: Participant[], consumer: any, source: string): Participant[] {
  const userId = 'peer-1';
  const exists = prevParticipants.find((p) => p.id === userId);
  
  if (exists) {
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
        }
      }
      return p;
    });
  }
  return prevParticipants;
}

// Pure helper function simulating onConsumerClosed
function simulateOnConsumerClosed(prevParticipants: Participant[], producerId: string, source: string): Participant[] {
  if (source === 'screen') {
    return prevParticipants.map(p => {
      if (p.screenProducerId === producerId) {
        return {
          ...p,
          isScreenSharing: false,
          screenTrack: undefined,
          screenProducerId: undefined,
          screenConsumerId: undefined,
          screenTrackId: undefined,
          screenStats: { ...p.screenStats, consumerClosed: true }
        };
      }
      return p;
    });
  } else {
    return prevParticipants.map(p => {
      if (p.cameraProducerId === producerId) {
        return {
          ...p,
          videoTrack: undefined,
          cameraProducerId: undefined,
          cameraConsumerId: undefined,
          cameraTrackId: undefined,
          cameraStats: { ...p.cameraStats, consumerClosed: true }
        };
      }
      return p;
    });
  }
}

describe('Source-based Consumer Handling', () => {
  const initialParticipant: Participant = {
    id: 'peer-1',
    name: 'Peer 1',
    role: 'attendee',
    isMuted: true,
    isCameraOn: false,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: false,
    joinedAt: new Date().toISOString()
  };

  it('camera consumer updates camera track without altering screen track', () => {
    const p1 = simulateOnNewConsumer([initialParticipant], {
      id: 'cons-cam-1',
      producerId: 'prod-cam-1',
      kind: 'video',
      track: { id: 'track-cam-1' }
    }, 'camera')[0];

    expect(p1.isCameraOn).toBe(true);
    expect(p1.videoTrack?.id).toBe('track-cam-1');
    expect(p1.cameraProducerId).toBe('prod-cam-1');
    expect(p1.cameraConsumerId).toBe('cons-cam-1');
    expect(p1.cameraStats?.consumerExists).toBe(true);

    // Screen should remain untouched
    expect(p1.isScreenSharing).toBe(false);
    expect(p1.screenTrack).toBeUndefined();
    expect(p1.screenProducerId).toBeUndefined();
  });

  it('screen consumer updates screen track without altering camera track', () => {
    // Start with a camera already on
    let p1 = simulateOnNewConsumer([initialParticipant], {
      id: 'cons-cam-1',
      producerId: 'prod-cam-1',
      kind: 'video',
      track: { id: 'track-cam-1' }
    }, 'camera')[0];

    // Now start screen share
    p1 = simulateOnNewConsumer([p1], {
      id: 'cons-screen-1',
      producerId: 'prod-screen-1',
      kind: 'video',
      track: { id: 'track-screen-1' }
    }, 'screen')[0];

    expect(p1.isScreenSharing).toBe(true);
    expect(p1.screenTrack?.id).toBe('track-screen-1');
    expect(p1.screenProducerId).toBe('prod-screen-1');
    expect(p1.screenStats?.consumerExists).toBe(true);

    // Camera should remain untouched
    expect(p1.isCameraOn).toBe(true);
    expect(p1.videoTrack?.id).toBe('track-cam-1');
    expect(p1.cameraProducerId).toBe('prod-cam-1');
  });

  it('closing screen consumer does not clear camera track', () => {
    let state = simulateOnNewConsumer([initialParticipant], { id: 'c1', producerId: 'p1', kind: 'video', track: { id: 't1' } }, 'camera');
    state = simulateOnNewConsumer(state, { id: 'c2', producerId: 'p2', kind: 'video', track: { id: 't2' } }, 'screen');

    // Close screen
    state = simulateOnConsumerClosed(state, 'p2', 'screen');
    const p1 = state[0];

    expect(p1.isScreenSharing).toBe(false);
    expect(p1.screenTrack).toBeUndefined();
    expect(p1.screenProducerId).toBeUndefined();

    // Camera remains
    expect(p1.isCameraOn).toBe(true);
    expect(p1.videoTrack?.id).toBe('t1');
    expect(p1.cameraProducerId).toBe('p1');
  });

  it('closing camera consumer does not clear screen track', () => {
    let state = simulateOnNewConsumer([initialParticipant], { id: 'c1', producerId: 'p1', kind: 'video', track: { id: 't1' } }, 'camera');
    state = simulateOnNewConsumer(state, { id: 'c2', producerId: 'p2', kind: 'video', track: { id: 't2' } }, 'screen');

    // Close camera
    state = simulateOnConsumerClosed(state, 'p1', 'camera');
    const p1 = state[0];

    // Camera cleared
    expect(p1.videoTrack).toBeUndefined();
    expect(p1.cameraProducerId).toBeUndefined();
    expect(p1.cameraStats?.consumerClosed).toBe(true);

    // Screen remains
    expect(p1.isScreenSharing).toBe(true);
    expect(p1.screenTrack?.id).toBe('t2');
    expect(p1.screenProducerId).toBe('p2');
  });
});
