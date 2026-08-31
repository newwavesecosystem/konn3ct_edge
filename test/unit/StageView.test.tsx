// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/utils', () => ({ cn: (...args: any[]) => args.join(' ') }));
vi.mock('lucide-react', () => ({
  AlertTriangle: () => <div data-testid="alert-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  RotateCw: () => <div data-testid="rotate-icon" />,
  Maximize2: () => <div data-testid="maximize-icon" />,
  Minimize2: () => <div data-testid="minimize-icon" />,
  MonitorUp: () => <div data-testid="monitor-up-icon" />,
  MonitorOff: () => <div data-testid="monitor-off-icon" />,
  MousePointerClick: () => <div data-testid="mouse-icon" />,
  ChevronLeft: () => <div data-testid="chevron-left" />,
  ChevronRight: () => <div data-testid="chevron-right" />,
  Users: () => <div data-testid="users-icon" />,
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

  it('cycles rotation through 90, 180, 270, 0 when clicking mobile rotate button', () => {
    mocks.meetingState = {
      participants: [
        { id: '1', name: 'Alice', isScreenSharing: true, screenTrack: {} as any },
      ],
      layoutMode: 'grid',
      isScreenSharing: false,
      toggleScreenShare: vi.fn(),
      currentUser: { id: '3', role: 'attendee' },
    };

    render(<StageView />);

    const rotateBtn = screen.getByTitle(/Rotate screenshare/i);
    expect(rotateBtn).toBeInTheDocument();

    // Initial state: 0 deg
    expect(rotateBtn).toHaveAttribute('title', 'Rotate screenshare (0°)');

    // Click 1: 90 deg
    fireEvent.click(rotateBtn);
    expect(rotateBtn).toHaveAttribute('title', 'Rotate screenshare (90°)');
    expect(screen.getByText('90°')).toBeInTheDocument();

    // Click 2: 180 deg
    fireEvent.click(rotateBtn);
    expect(rotateBtn).toHaveAttribute('title', 'Rotate screenshare (180°)');
    expect(screen.getByText('180°')).toBeInTheDocument();

    // Click 3: 270 deg
    fireEvent.click(rotateBtn);
    expect(rotateBtn).toHaveAttribute('title', 'Rotate screenshare (270°)');
    expect(screen.getByText('270°')).toBeInTheDocument();

    // Click 4: 0 deg
    fireEvent.click(rotateBtn);
    expect(rotateBtn).toHaveAttribute('title', 'Rotate screenshare (0°)');
    expect(screen.queryByText('0°')).not.toBeInTheDocument();
  });
});
