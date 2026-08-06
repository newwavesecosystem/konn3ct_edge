import { NativeModules, Platform } from 'react-native';

const { KonnMeetingService } = NativeModules;

// Foreground service type flags matching Android ServiceInfo constants
export const FG_TYPE_MEDIA_PLAYBACK = 1 << 1;  // 2
export const FG_TYPE_MICROPHONE = 1 << 3;       // 8
export const FG_TYPE_CAMERA = 1 << 6;            // 64

/**
 * JS bridge for the Android MeetingForegroundService.
 *
 * When a meeting is active, starting this service shows a persistent
 * "Meeting in progress" notification and prevents Android from killing
 * the app's WebSocket / audio connections when minimized.
 */
const MeetingService = {
  /**
   * Check whether the native module is available on this platform.
   */
  isAvailable(): boolean {
    if (Platform.OS !== 'android') return false;
    return !!NativeModules.KonnMeetingService;
  },

  /**
   * Start the foreground service with an ongoing notification.
   * Call this when entering a meeting.
   *
   * @param meetingTitle  - Notification title (defaults to 'Meeting in progress')
   * @param serviceTypeFlags - Bitmask of FOREGROUND_SERVICE_TYPE flags (defaults to MEDIA_PLAYBACK)
   */
  start(meetingTitle?: string, serviceTypeFlags?: number): void {
    if (Platform.OS === 'android' && KonnMeetingService) {
      const flags = serviceTypeFlags ?? FG_TYPE_MEDIA_PLAYBACK;
      KonnMeetingService.start(meetingTitle ?? 'Meeting in progress', flags);
    } else if (Platform.OS === 'android') {
      console.warn('[MeetingService] KonnMeetingService native module not available');
    }
  },

  /**
   * Stop the foreground service and dismiss the notification.
   * Call this when leaving a meeting.
   */
  stop(): void {
    if (Platform.OS === 'android' && KonnMeetingService) {
      KonnMeetingService.stop();
    }
  },
};

export default MeetingService;
