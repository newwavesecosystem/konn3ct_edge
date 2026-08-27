import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StageView } from '../StageView';

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
  ZoomIn: () => <div data-testid="zoom-in-icon" />,
  ZoomOut: () => <div data-testid="zoom-out-icon" />,
  ArrowLeftRight: () => <div data-testid="swap-icon" />,
}));

const mockUseVideoHealth = vi.fn().mockReturnValue({ health: 'good', remountKey: 0 });
vi.mock('@/hooks/useVideoHealth', () => ({ useVideoHealth: () => mockUseVideoHealth() }));

const mocks = vi.hoisted(() => ({
  meetingState: {} as any
}));

vi.mock('@/lib/meeting-context', () => ({ useMeeting: () => mocks.meetingState }));

// Mock children components to avoid rendering deep tree
vi.mock('../ParticipantTile', () => ({
  ParticipantTile: ({ participant }: any) => <div data-testid={`participant-tile-${participant.id}`}>{participant.name}</div>
}));
vi.mock('../GridLayout', () => ({
  GridLayout: () => <div data-testid="grid-layout" />
}));
vi.mock('../SpeakerLayout', () => ({
  SpeakerLayout: () => <div data-testid="speaker-layout" />
}));
vi.mock('../SpotlightLayout', () => ({
  SpotlightLayout: () => <div data-testid="spotlight-layout" />
}));

// Mock ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock MediaStream for jsdom
global.MediaStream = class MediaStream {
  tracks: any[] = [];
  constructor(tracks: any[] = []) {
    this.tracks = tracks;
  }
  getVideoTracks() {
    return this.tracks;
  }
  getTracks() {
    return this.tracks;
  }
  addTrack(track: any) {
    this.tracks.push(track);
  }
  removeTrack(track: any) {
    this.tracks = this.tracks.filter(t => t !== track);
  }
} as any;

// Mock HTMLMediaElement.prototype.play
window.HTMLMediaElement.prototype.play = () => Promise.resolve();

describe('StageView - Mobile Rotation & Multi Screen Share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a single screen share with mobile rotate button and zoom controls', () => {
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
    
    expect(screen.getByTitle('Rotate screenshare (0°)')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom In')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom Out')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
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

  it('handles zoom in, zoom out, and reset to 100% across all devices', () => {
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

    const zoomInBtn = screen.getByTitle('Zoom In');
    const zoomOutBtn = screen.getByTitle('Zoom Out');
    const resetBtn = screen.getByTitle(/Click to reset zoom/i);

    // Initial state: 100%
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(zoomOutBtn).toBeDisabled();

    // Zoom in to 125%
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('125%')).toBeInTheDocument();
    expect(zoomOutBtn).not.toBeDisabled();

    // Zoom in to 150%
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('150%')).toBeInTheDocument();

    // Zoom out back to 125%
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('125%')).toBeInTheDocument();

    // Zoom in to 200%
    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('200%')).toBeInTheDocument();

    // Click Reset button to return to 100%
    fireEvent.click(resetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(zoomOutBtn).toBeDisabled();
  });

  it('swaps between large screenshare stage and large audience grid when clicking swap button', () => {
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

    const { container } = render(<StageView />);

    const swapBtn = screen.getByTitle('Focus audience (show participants large on the left)');
    expect(swapBtn).toBeInTheDocument();

    // Default: screenshare is primary flex-1; participant strip is in sidebar
    expect(container.querySelector('.lg\\:w-44')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:w-72')).not.toBeInTheDocument();

    // Click swap button -> participants become primary large stage
    fireEvent.click(swapBtn);

    // Now screenshare becomes compact sidebar on the right
    expect(screen.getByTitle('Focus screenshare (show screenshare large on the left)')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:w-72')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:w-44')).not.toBeInTheDocument();

    // Click swap button again -> restores screenshare to primary large stage
    fireEvent.click(screen.getByTitle('Focus screenshare (show screenshare large on the left)'));
    expect(screen.getByTitle('Focus audience (show participants large on the left)')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:w-44')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:w-72')).not.toBeInTheDocument();
  });
});
