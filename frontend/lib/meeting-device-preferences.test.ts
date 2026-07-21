import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getMeetingDevicePreferences, 
  setMeetingDevicePreferences,
  DEFAULT_MEETING_DEVICE_PREFERENCES
} from './meeting-device-preferences';

describe('meeting-device-preferences', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear any cached instances
    vi.clearAllMocks();
  });

  it('should return default preferences if nothing is stored', () => {
    const prefs = getMeetingDevicePreferences();
    expect(prefs).toEqual(DEFAULT_MEETING_DEVICE_PREFERENCES);
  });

  it('should set and merge preferences correctly', () => {
    setMeetingDevicePreferences({ selectedTheme: 'slate' });
    let prefs = getMeetingDevicePreferences();
    expect(prefs.selectedTheme).toBe('slate');
    expect(prefs.notifications.enableAllToasts).toBe(true);

    setMeetingDevicePreferences({ 
      notifications: { enableAllToasts: false, showChatToasts: false } 
    });
    prefs = getMeetingDevicePreferences();
    expect(prefs.selectedTheme).toBe('slate');
    expect(prefs.notifications.enableAllToasts).toBe(false);
    expect(prefs.notifications.showChatToasts).toBe(false);
    expect(prefs.notifications.showJoinLeaveToasts).toBe(true); // default maintained
  });

  it('should recover gracefully from corrupted localStorage', () => {
    localStorage.setItem('konn3ct_meeting_device_preferences_v1', '{ invalid json ');
    const prefs = getMeetingDevicePreferences();
    expect(prefs).toEqual(DEFAULT_MEETING_DEVICE_PREFERENCES);
    // It shouldn't crash, and subsequent sets will repair the storage
    setMeetingDevicePreferences({ selectedTheme: 'sage' });
    const repaired = JSON.parse(localStorage.getItem('konn3ct_meeting_device_preferences_v1') || '{}');
    expect(repaired.selectedTheme).toBe('sage');
  });

  it('should dispatch an event when preferences change', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    setMeetingDevicePreferences({ selectedTheme: 'soft' });
    expect(dispatchSpy).toHaveBeenCalled();
    const eventArg = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(eventArg.type).toBe('meeting_device_preferences_changed');
  });
});
