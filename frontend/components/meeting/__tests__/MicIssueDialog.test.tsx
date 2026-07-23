import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { MicIssueDialog } from '../MicIssueDialog';
import * as meetingContext from '@/lib/meeting-context';

// Mock the module
vi.mock('@/lib/meeting-context', () => ({
  useMeeting: vi.fn(),
}));

// Mock lucide icons to avoid rendering SVG issues
vi.mock('lucide-react', () => ({
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  MicOff: () => <div data-testid="mic-off-icon" />,
  Lock: () => <div data-testid="lock-icon" />,
  Settings2: () => <div data-testid="settings2-icon" />,
  ShieldAlert: () => <div data-testid="shield-alert-icon" />,
  RefreshCw: () => <div data-testid="refresh-cw-icon" />,
  VideoOff: () => <div data-testid="video-off-icon" />,
  Info: () => <div data-testid="info-icon" />
}));

describe('MicIssueDialog', () => {
  test('does not render when there is no mic error', () => {
    vi.spyOn(meetingContext, 'useMeeting').mockReturnValue({
      micError: null,
      setMicError: vi.fn(),
      toggleMute: vi.fn(),
    } as any);

    const { container } = render(<MicIssueDialog />);
    expect(container.firstChild).toBeNull();
  });

  test('renders generic error and retry button for normal errors', () => {
    const setMicErrorMock = vi.fn();
    const toggleMuteMock = vi.fn();
    
    vi.spyOn(meetingContext, 'useMeeting').mockReturnValue({
      micError: { name: 'NotFoundError', message: 'No mic found' },
      setMicError: setMicErrorMock,
      toggleMute: toggleMuteMock,
    } as any);

    render(<MicIssueDialog />);
    
    expect(screen.getByText('Microphone Issue')).toBeDefined();
    expect(screen.getByText(/We couldn't access your microphone/)).toBeDefined();
    expect(screen.getByText(/No mic found/)).toBeDefined();
    
    const retryBtn = screen.getByText('Retry');
    fireEvent.click(retryBtn);
    expect(setMicErrorMock).toHaveBeenCalledWith(null);
    expect(toggleMuteMock).toHaveBeenCalled();
  });

  test('renders permission blocked state and allows viewing help steps', () => {
    vi.spyOn(meetingContext, 'useMeeting').mockReturnValue({
      micError: { name: 'NotAllowedError', message: 'Permission denied' },
      setMicError: vi.fn(),
      toggleMute: vi.fn(),
    } as any);

    render(<MicIssueDialog />);
    
    expect(screen.getByText('Microphone Blocked')).toBeDefined();
    expect(screen.getByText(/Your browser has blocked microphone access for this site/)).toBeDefined();
    
    const fixBtn = screen.getByText('How to fix this');
    fireEvent.click(fixBtn);
    
    // After clicking, it should render the permission help steps
    expect(screen.getByText(/Reload the page for the new permissions to take effect/)).toBeDefined();
    expect(screen.getByText('Reload Page')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
  });
});
