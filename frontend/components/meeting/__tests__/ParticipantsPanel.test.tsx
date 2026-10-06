import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParticipantsPanel } from '../ParticipantsPanel';
import * as meetingContext from '@/lib/meeting-context';

vi.mock('@/lib/meeting-context', () => ({
  useMeeting: vi.fn(),
}));

const mockUseMeeting = meetingContext.useMeeting as any;

describe('ParticipantsPanel Filters', () => {
  const mockParticipants = [
    {
      id: 'p_host',
      userId: 'user_host',
      name: 'Alice Host',
      role: 'host',
      isMuted: false,
      isCameraOn: true,
      isHandRaised: false,
      isScreenSharing: false,
    },
    {
      id: 'p_muted',
      userId: 'user_muted',
      name: 'Bob Muted',
      role: 'attendee',
      isMuted: true,
      isCameraOn: false,
      isHandRaised: true,
      isScreenSharing: false,
    },
    {
      id: 'p_presenter',
      userId: 'user_presenter',
      name: 'Charlie Presenter',
      role: 'presenter',
      isMuted: false,
      isCameraOn: true,
      isHandRaised: false,
      isScreenSharing: true,
    },
    {
      id: 'p_guest',
      userId: 'user_guest',
      name: 'David Guest',
      role: 'guest',
      isMuted: true,
      isCameraOn: false,
      isHandRaised: false,
      isScreenSharing: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMeeting.mockReturnValue({
      participants: mockParticipants,
      currentUser: { id: 'p_host', userId: 'user_host', role: 'host' },
      waitingUsers: [],
      admitUser: vi.fn(),
      denyUser: vi.fn(),
      admitAllUsers: vi.fn(),
      denyAllUsers: vi.fn(),
      forceMuteUser: vi.fn(),
      forceVideoOffUser: vi.fn(),
      kickUser: vi.fn(),
      changeUserRole: vi.fn(),
      roomSettings: { micLocked: false, videoLocked: false },
      askToUnmute: vi.fn(),
      participantScreenSharePermissions: {},
      setParticipantScreenSharePermission: vi.fn(),
      stopParticipantScreenShare: vi.fn(),
      pingParticipant: vi.fn(),
    });
  });

  it('renders all participants by default with filter pills and count badges', () => {
    render(<ParticipantsPanel />);

    expect(screen.getByText('Alice Host')).toBeInTheDocument();
    expect(screen.getByText('Bob Muted')).toBeInTheDocument();
    expect(screen.getByText('Charlie Presenter')).toBeInTheDocument();
    expect(screen.getByText('David Guest')).toBeInTheDocument();

    // Verify filter options exist
    expect(screen.getByRole('button', { name: /^all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^muted/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^unmuted/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^raised hands/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^screen-sharing/i })).toBeInTheDocument();
  });

  it('filters by Muted participants', () => {
    render(<ParticipantsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^muted/i }));

    expect(screen.getByText('Bob Muted')).toBeInTheDocument();
    expect(screen.getByText('David Guest')).toBeInTheDocument();
    expect(screen.queryByText('Alice Host')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Presenter')).not.toBeInTheDocument();
  });

  it('filters by Unmuted participants', () => {
    render(<ParticipantsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^unmuted/i }));

    expect(screen.getByText('Alice Host')).toBeInTheDocument();
    expect(screen.getByText('Charlie Presenter')).toBeInTheDocument();
    expect(screen.queryByText('Bob Muted')).not.toBeInTheDocument();
    expect(screen.queryByText('David Guest')).not.toBeInTheDocument();
  });

  it('filters by Raised hands', () => {
    render(<ParticipantsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^raised hands/i }));

    expect(screen.getByText('Bob Muted')).toBeInTheDocument();
    expect(screen.queryByText('Alice Host')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Presenter')).not.toBeInTheDocument();
    expect(screen.queryByText('David Guest')).not.toBeInTheDocument();
  });

  it('filters by Screen-sharing', () => {
    render(<ParticipantsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^screen-sharing/i }));

    expect(screen.getByText('Charlie Presenter')).toBeInTheDocument();
    expect(screen.queryByText('Alice Host')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Muted')).not.toBeInTheDocument();
    expect(screen.queryByText('David Guest')).not.toBeInTheDocument();
  });

  it('shows empty state when no participants match filter and allows clearing filter', () => {
    // Only 1 unmuted participant who isn't raising hand or sharing screen
    mockUseMeeting.mockReturnValue({
      participants: [
        {
          id: 'p_host',
          userId: 'user_host',
          name: 'Alice Host',
          role: 'host',
          isMuted: false,
          isCameraOn: true,
          isHandRaised: false,
          isScreenSharing: false,
        }
      ],
      currentUser: { id: 'p_host', userId: 'user_host', role: 'host' },
      waitingUsers: [],
      admitUser: vi.fn(),
      denyUser: vi.fn(),
      admitAllUsers: vi.fn(),
      denyAllUsers: vi.fn(),
      forceMuteUser: vi.fn(),
      forceVideoOffUser: vi.fn(),
      kickUser: vi.fn(),
      changeUserRole: vi.fn(),
      roomSettings: { micLocked: false, videoLocked: false },
      askToUnmute: vi.fn(),
      participantScreenSharePermissions: {},
      setParticipantScreenSharePermission: vi.fn(),
      stopParticipantScreenShare: vi.fn(),
      pingParticipant: vi.fn(),
    });

    render(<ParticipantsPanel />);

    // Click Raised hands when none exist
    fireEvent.click(screen.getByRole('button', { name: /^raised hands/i }));

    expect(screen.getByText('No participants found')).toBeInTheDocument();
    expect(screen.getByText(/no participants match the "raised hands" filter/i)).toBeInTheDocument();

    // Click "Show all participants"
    const clearBtn = screen.getByRole('button', { name: /show all participants/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText('Alice Host')).toBeInTheDocument();
  });

  it('combines text search with category filtering', () => {
    render(<ParticipantsPanel />);

    const searchInput = screen.getByPlaceholderText('Search participants...');
    fireEvent.change(searchInput, { target: { value: 'David' } });

    // Filter by Muted (David is muted)
    fireEvent.click(screen.getByRole('button', { name: /^muted/i }));
    expect(screen.getByText('David Guest')).toBeInTheDocument();

    // Filter by Unmuted (David is NOT unmuted)
    fireEvent.click(screen.getByRole('button', { name: /^unmuted/i }));
    expect(screen.queryByText('David Guest')).not.toBeInTheDocument();
    expect(screen.getByText('No participants found')).toBeInTheDocument();
  });
});
