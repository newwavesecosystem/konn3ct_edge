import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, describe, vi } from 'vitest';
import { CamIssueDialog } from '../CamIssueDialog';
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

describe('CamIssueDialog', () => {
  test('does not render when there is no cam error', () => {
    vi.spyOn(meetingContext, 'useMeeting').mockReturnValue({
      camError: null,
      setCamError: vi.fn(),
      toggleCamera: vi.fn(),
    } as any);

    const { container } = render(<CamIssueDialog />);
    expect(container.firstChild).toBeNull();
  });

  test('renders generic error and retry button for normal errors', () => {
    const setCamErrorMock = vi.fn();
    const toggleCameraMock = vi.fn();
    
    vi.spyOn(meetingContext, 'useMeeting').mockReturnValue({
      camError: { name: 'NotFoundError', message: 'No camera found' },
      setCamError: setCamErrorMock,
      toggleCamera: toggleCameraMock,
    } as any);

    render(<CamIssueDialog />);
    
    expect(screen.getByText('Camera Issue')).toBeDefined();
    expect(screen.getByText(/We couldn't access your camera/)).toBeDefined();
    expect(screen.getByText(/No camera found/)).toBeDefined();
    
    const retryBtn = screen.getByText('Retry');
    fireEvent.click(retryBtn);
    expect(setCamErrorMock).toHaveBeenCalledWith(null);
    expect(toggleCameraMock).toHaveBeenCalled();
  });

  test('renders permission blocked state based on NotAllowedError', () => {
    vi.spyOn(meetingContext, 'useMeeting').mockReturnValue({
      camError: { name: 'NotAllowedError', message: 'Permission denied' },
      setCamError: vi.fn(),
      toggleCamera: vi.fn(),
    } as any);

    render(<CamIssueDialog />);
    
    expect(screen.getByText('Camera Blocked')).toBeDefined();
    expect(screen.getByText(/Your browser has blocked camera access for this site/)).toBeDefined();
  });

  test('renders permission blocked state based on Permission denied string (custom error)', () => {
    vi.spyOn(meetingContext, 'useMeeting').mockReturnValue({
      camError: { name: 'Error', message: 'Permission denied: Please allow camera access in your browser or system settings.' },
      setCamError: vi.fn(),
      toggleCamera: vi.fn(),
    } as any);

    render(<CamIssueDialog />);
    
    expect(screen.getByText('Camera Blocked')).toBeDefined();
    
    const fixBtn = screen.getByText('How to fix this');
    fireEvent.click(fixBtn);
    
    expect(screen.getByText(/Reload the page for the new permissions to take effect/)).toBeDefined();
    expect(screen.getByText('Reload Page')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
  });
});
