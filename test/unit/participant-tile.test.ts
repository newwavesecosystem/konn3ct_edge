import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/utils', () => ({ cn: (...args: any[]) => args.join(' ') }));
vi.mock('lucide-react', () => ({ MicOff: () => null, VideoOff: () => null, MonitorUp: () => null, Hand: () => null, Crown: () => null, Shield: () => null, SignalHigh: () => null, SignalMedium: () => null, SignalLow: () => null }));
vi.mock('../../frontend/hooks/useVideoHealth', () => ({ useVideoHealth: () => ({ health: 'good', remountKey: 0 }) }));
vi.mock('../../frontend/lib/meeting-context', () => ({ useMeeting: () => ({}) }));
vi.mock('@/lib/meeting-context', () => ({ useMeeting: () => ({}) }));
vi.mock('@/lib/types/meeting', () => ({}));

import { getEffectiveVideoState } from '../../frontend/components/meeting/ParticipantTile';
import { Participant } from '../../frontend/lib/types/meeting';

describe('getEffectiveVideoState', () => {
  it('returns audio-only if audioOnlyMode is true', () => {
    const participant = { audioOnlyMode: true, videoTrack: {} as any, isCameraOn: true } as Participant;
    expect(getEffectiveVideoState(participant)).toBe('audio-only');
  });

  it('returns camera-off if isCameraOn is false', () => {
    const participant = { isCameraOn: false, videoTrack: {} as any } as Participant;
    expect(getEffectiveVideoState(participant)).toBe('camera-off');
  });

  it('returns video-active if isCameraOn is true and videoTrack exists', () => {
    const participant = { isCameraOn: true, videoTrack: {} as any } as Participant;
    expect(getEffectiveVideoState(participant)).toBe('video-active');
  });

  it('returns stalled if isCameraOn is true but videoTrack is missing', () => {
    const participant = { isCameraOn: true, videoTrack: undefined } as Participant;
    expect(getEffectiveVideoState(participant)).toBe('stalled');
  });
});
