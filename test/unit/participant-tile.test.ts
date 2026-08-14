// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/utils', () => ({ cn: (...args: any[]) => args.join(' ') }));
vi.mock('lucide-react', () => ({ 
  MicOff: () => React.createElement('div', { 'data-testid': 'mic-off-icon' }), 
  VideoOff: () => React.createElement('div', { 'data-testid': 'video-off-icon' }), 
  MonitorUp: () => React.createElement('div', { 'data-testid': 'screen-share-icon' }), 
  Hand: () => React.createElement('div', { 'data-testid': 'hand-icon' }), 
  Crown: () => React.createElement('div', { 'data-testid': 'crown-icon' }), 
  Shield: () => React.createElement('div', { 'data-testid': 'shield-icon' }), 
  SignalHigh: () => React.createElement('div', { 'data-testid': 'signal-high-icon' }), 
  SignalMedium: () => React.createElement('div', { 'data-testid': 'signal-medium-icon' }), 
  SignalLow: () => React.createElement('div', { 'data-testid': 'signal-low-icon' }) 
}));

const mockUseVideoHealth = vi.fn().mockReturnValue({ health: 'good', remountKey: 0 });
vi.mock('../../frontend/hooks/useVideoHealth', () => ({ useVideoHealth: () => mockUseVideoHealth() }));

const mockUseMeeting = vi.fn().mockReturnValue({ isRecording: false, isAIProcessing: false, localUserId: '1', forceMuteUser: vi.fn(), changeUserRole: vi.fn(), kickUser: vi.fn() });
vi.mock('../../frontend/lib/meeting-context', () => ({ useMeeting: () => mockUseMeeting() }));
vi.mock('@/lib/meeting-context', () => ({ useMeeting: () => mockUseMeeting() }));
vi.mock('@/lib/types/meeting', () => ({}));

import { ParticipantTile, getEffectiveVideoState } from '../../frontend/components/meeting/ParticipantTile';
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

