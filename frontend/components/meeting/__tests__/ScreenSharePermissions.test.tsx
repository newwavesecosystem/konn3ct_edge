import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScreenSharePermissionsDialog } from '../ScreenSharePermissionsDialog';
import { MeetingControls } from '../MeetingControls';
import * as meetingContext from '@/lib/meeting-context';

vi.mock('@/lib/meeting-context', () => ({
  useMeeting: vi.fn(),
}));

vi.mock('@/lib/meeting-theme-context', () => ({
  useMeetingTheme: () => ({
    theme: 'dark',
    themeClasses: 'theme-dark',
    activeThemeConfig: { id: 'dark' },
    setTheme: vi.fn(),
  }),
}));

const mockUseMeeting = meetingContext.useMeeting as any;

describe('Screen Share Permissions & Selected Participant Flow', () => {
  const setParticipantScreenSharePermissionMock = vi.fn();
  const setScreenSharePolicyMock = vi.fn();
  const toggleScreenShareMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders screen share policy options and triggers setScreenSharePolicy when host selects policy', () => {
    mockUseMeeting.mockReturnValue({
      participants: [
        { id: 'p_host', userId: 'user_host', name: 'Host Alice', role: 'host' },
        { id: 'p_bob', userId: 'user_bob', name: 'Bob Attendee', role: 'attendee' },
      ],
      currentUser: { id: 'p_host', userId: 'user_host', role: 'host' },
      screenSharePolicyMode: 'EVERYONE',
      participantScreenSharePermissions: {
        'p_bob': 'DEFAULT',
      },
      setScreenSharePolicy: setScreenSharePolicyMock,
      setParticipantScreenSharePermission: setParticipantScreenSharePermissionMock,
      stopAllParticipantScreenShares: vi.fn(),
    });

    render(<ScreenSharePermissionsDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Screen sharing permissions')).toBeInTheDocument();
    expect(screen.getByText('Everyone')).toBeInTheDocument();
    expect(screen.getByText('Host & co-hosts only')).toBeInTheDocument();

    const hostsOnlyRadio = screen.getByLabelText(/host & co-hosts only/i);
    fireEvent.click(hostsOnlyRadio);

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    expect(setScreenSharePolicyMock).toHaveBeenCalledWith('HOSTS_ONLY', false);
  });

  it('enables screen share button in MeetingControls when participant is selected by host', () => {
    // 1. Participant is NOT selected yet
    mockUseMeeting.mockReturnValue({
      currentUser: { id: 'p_bob', userId: 'user_bob', name: 'Bob', role: 'attendee', isMobile: false },
      isScreenSharing: false,
      toggleScreenShare: toggleScreenShareMock,
      effectiveScreenSharePermission: { allowed: false, reason: 'NOT_SELECTED_FOR_SCREEN_SHARING' },
      isMuted: true,
      toggleMute: vi.fn(),
      isCameraOn: true,
      toggleCamera: vi.fn(),
      isHandRaised: false,
      toggleHandRaise: vi.fn(),
      showReactionPicker: false,
      setShowReactionPicker: vi.fn(),
      roomSettings: { videoLocked: false, micLocked: false },
      roomFeatureFlags: { captionsEnabled: true, donationsEnabled: false },
      isRecording: false,
      recordingStatus: 'idle',
      toggleRecording: vi.fn(),
      activePanel: null,
      setActivePanel: vi.fn(),
      hasUnreadChat: false,
      hasUnreadQA: false,
      isMobilePanelOpen: false,
      setIsMobilePanelOpen: vi.fn(),
      layoutMode: 'grid',
      setLayoutMode: vi.fn(),
      meetingInfo: { roomName: 'Test Room', isWaitingRoomEnabled: false },
      waitingUsers: [],
      eCinemaLink: null,
      isCaptionsEnabled: false,
      toggleCaptions: vi.fn(),
      isDonationActive: false,
      toggleDonation: vi.fn(),
      setShowDonationModal: vi.fn(),
      webrtcStatus: 'connected',
    });

    const { rerender } = render(<MeetingControls />);

    // Screen share button should be disabled for unselected attendee
    const shareBtn = screen.getByTitle('Only selected participants can share their screen.');
    expect(shareBtn).toBeDisabled();

    fireEvent.click(shareBtn);
    expect(toggleScreenShareMock).not.toHaveBeenCalled();

    // 2. Host selects Bob -> effectiveScreenSharePermission becomes allowed: true
    mockUseMeeting.mockReturnValue({
      currentUser: { id: 'p_bob', userId: 'user_bob', name: 'Bob', role: 'attendee', isMobile: false },
      isScreenSharing: false,
      toggleScreenShare: toggleScreenShareMock,
      effectiveScreenSharePermission: { allowed: true, reason: 'ALLOWED' },
      isMuted: true,
      toggleMute: vi.fn(),
      isCameraOn: true,
      toggleCamera: vi.fn(),
      isHandRaised: false,
      toggleHandRaise: vi.fn(),
      showReactionPicker: false,
      setShowReactionPicker: vi.fn(),
      roomSettings: { videoLocked: false, micLocked: false },
      roomFeatureFlags: { captionsEnabled: true, donationsEnabled: false },
      isRecording: false,
      recordingStatus: 'idle',
      toggleRecording: vi.fn(),
      activePanel: null,
      setActivePanel: vi.fn(),
      hasUnreadChat: false,
      hasUnreadQA: false,
      isMobilePanelOpen: false,
      setIsMobilePanelOpen: vi.fn(),
      layoutMode: 'grid',
      setLayoutMode: vi.fn(),
      meetingInfo: { roomName: 'Test Room', isWaitingRoomEnabled: false },
      waitingUsers: [],
      eCinemaLink: null,
      isCaptionsEnabled: false,
      toggleCaptions: vi.fn(),
      isDonationActive: false,
      toggleDonation: vi.fn(),
      setShowDonationModal: vi.fn(),
      webrtcStatus: 'connected',
    });

    rerender(<MeetingControls />);

    const enabledShareBtn = screen.getByTitle('Share screen');
    expect(enabledShareBtn).not.toBeDisabled();

    fireEvent.click(enabledShareBtn);
    expect(toggleScreenShareMock).toHaveBeenCalledTimes(1);
  });
});
