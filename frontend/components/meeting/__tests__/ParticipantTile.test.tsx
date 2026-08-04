import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { ParticipantTile } from '../ParticipantTile';
import * as meetingContext from '@/lib/meeting-context';

// Mock the context hook
vi.mock('@/lib/meeting-context', () => ({
  useMeeting: vi.fn(),
}));

const mockUseMeeting = meetingContext.useMeeting as any;

// Mock IntersectionObserver for jsdom
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

describe('ParticipantTile Network Detection', () => {
  const baseParticipant = {
    id: 'user-1',
    userId: 'user-1-db',
    name: 'Alice',
    role: 'attendee',
    isMuted: true,
    isCameraOn: true,
    isScreenSharing: false,
    isHandRaised: false,
    isSpeaking: false,
    audioLevel: 0,
    cameraStream: null,
    screenStream: null,
    audioOnlyMode: false,
  };

  const setupMockContext = (networkDetectionEnabled: boolean, currentUserId: string = 'local-user') => {
    mockUseMeeting.mockReturnValue({
      currentUser: { id: currentUserId },
      selectedDevices: {},
      isMirrorVideoEnabled: false,
      pauseRemoteVideo: vi.fn(),
      resumeRemoteVideo: vi.fn(),
      isRecorderMode: false,
      isOriginalRatioEnabled: false,
      roomSettings: {
        networkDetectionEnabled,
      }
    });
  };

  it('renders "Good Connection" signal bar when network detection is enabled and quality is good', () => {
    setupMockContext(true);
    render(<ParticipantTile participant={{ ...baseParticipant, networkQuality: 'good' }} />);
    expect(screen.getByTitle('Good Connection')).toBeInTheDocument();
  });

  it('hides the signal bar entirely when network detection is disabled, even if quality is good', () => {
    setupMockContext(false);
    render(<ParticipantTile participant={{ ...baseParticipant, networkQuality: 'good' }} />);
    expect(screen.queryByTitle('Good Connection')).not.toBeInTheDocument();
  });

  it('renders "Poor Network" signal bar when network detection is enabled and quality is poor', () => {
    setupMockContext(true);
    render(<ParticipantTile participant={{ ...baseParticipant, networkQuality: 'poor_network' }} />);
    expect(screen.getByTitle('Poor Network')).toBeInTheDocument();
  });

  it('hides the "Poor Network" signal bar when network detection is disabled', () => {
    setupMockContext(false);
    render(<ParticipantTile participant={{ ...baseParticipant, networkQuality: 'poor_network' }} />);
    expect(screen.queryByTitle('Poor Network')).not.toBeInTheDocument();
  });

  it('renders correctly for the current local user (isSelf = true) when enabled', () => {
    // Current user matches the participant ID (simulating the local user tile)
    setupMockContext(true, baseParticipant.id);
    render(<ParticipantTile participant={{ ...baseParticipant, networkQuality: 'unstable_network' }} />);
    
    expect(screen.getByText('(You)')).toBeInTheDocument();
    expect(screen.getByTitle('Unstable Network')).toBeInTheDocument();
  });

  it('hides the signal bar for the current local user when disabled', () => {
    setupMockContext(false, baseParticipant.id);
    render(<ParticipantTile participant={{ ...baseParticipant, networkQuality: 'unstable_network' }} />);
    
    expect(screen.getByText('(You)')).toBeInTheDocument();
    expect(screen.queryByTitle('Unstable Network')).not.toBeInTheDocument();
  });
});
