// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/utils', () => ({ cn: (...args: any[]) => args.join(' ') }));
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="alert-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
}));

const mockUseVideoHealth = vi.fn().mockReturnValue({ health: 'good', remountKey: 0 });
vi.mock('../../frontend/hooks/useVideoHealth', () => ({ useVideoHealth: () => mockUseVideoHealth() }));
vi.mock('@/hooks/useVideoHealth', () => ({ useVideoHealth: () => mockUseVideoHealth() }));

const mocks = vi.hoisted(() => ({
  meetingState: {} as any
}));

vi.mock('../../frontend/lib/meeting-context', () => ({ useMeeting: () => mocks.meetingState }));
vi.mock('@/lib/meeting-context', () => ({ useMeeting: () => mocks.meetingState }));

// Mock children components to avoid rendering deep tree
vi.mock('../../frontend/components/meeting/ParticipantTile', () => ({
  ParticipantTile: ({ participant }: any) => <div data-testid={`participant-tile-${participant.id}`}>{participant.name}</div>
}));
vi.mock('../../frontend/components/meeting/GridLayout', () => ({
  GridLayout: () => <div data-testid="grid-layout" />
}));
vi.mock('../../frontend/components/meeting/SpeakerLayout', () => ({
  SpeakerLayout: () => <div data-testid="speaker-layout" />
}));
vi.mock('../../frontend/components/meeting/SpotlightLayout', () => ({
  SpotlightLayout: () => <div data-testid="spotlight-layout" />
}));

import { StageView } from '../../frontend/components/meeting/StageView';
import { Participant } from '../../frontend/lib/types/meeting';

describe('StageView - Multi Screen Share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a single screen share without selection pills', () => {
    mocks.meetingState = {
      participants: [
        { id: '1', name: 'Alice', isScreenSharing: true, screenTrack: {} as any },
        { id: '2', name: 'Bob', isScreenSharing: false }
      ],
      layoutMode: 'grid',
      isScreenSharing: false,
      toggleScreenShare: vi.fn(),
      currentUser: { id: '3', role: 'attendee' },
    };

    render(<StageView />);
    
    // Should render the ScreenShareLayout
    expect(screen.queryByText("Alice's Screen")).not.toBeInTheDocument();
  });

  it('renders selection pills when multiple participants share screen', () => {
    mocks.meetingState = {
      participants: [
        { id: '1', name: 'Alice', isScreenSharing: true, screenTrack: {} as any },
        { id: '2', name: 'Bob', isScreenSharing: true, screenTrack: {} as any }
      ],
      layoutMode: 'grid',
      isScreenSharing: false,
      toggleScreenShare: vi.fn(),
      currentUser: { id: '3', role: 'attendee' },
    };

    render(<StageView />);
    
    // Should render the pills
    const aliceBtn = screen.getByText("Alice's Screen");
    const bobBtn = screen.getByText("Bob's Screen");
    
    expect(aliceBtn).toBeInTheDocument();
    expect(bobBtn).toBeInTheDocument();
    
    // By default, the first one is active
    expect(aliceBtn.parentElement?.className).toContain('bg-[var(--color-brand-green)]');
    expect(bobBtn.parentElement?.className).toContain('bg-white/10');
  });

  it('allows clicking a pill to change active screen share', () => {
    mocks.meetingState = {
      participants: [
        { id: '1', name: 'Alice', isScreenSharing: true, screenTrack: {} as any },
        { id: '2', name: 'Bob', isScreenSharing: true, screenTrack: {} as any }
      ],
      layoutMode: 'grid',
      isScreenSharing: false,
      toggleScreenShare: vi.fn(),
      currentUser: { id: '3', role: 'attendee' },
    };

    render(<StageView />);
    
    const aliceBtn = screen.getByText("Alice's Screen");
    const bobBtn = screen.getByText("Bob's Screen");
    
    // Click Bob's pill
    fireEvent.click(bobBtn);
    
    // Now Bob's pill should be active
    expect(bobBtn.parentElement?.className).toContain('bg-[var(--color-brand-green)]');
    expect(aliceBtn.parentElement?.className).toContain('bg-white/10');
  });
});
