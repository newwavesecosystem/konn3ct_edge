import { NativeModules, Platform } from 'react-native';

const { KonnMeetingService } = NativeModules;

/**
 * JS bridge for the Android MeetingForegroundService.
 *
 * When a meeting is active, starting this service shows a persistent
 * "Meeting in progress" notification and prevents Android from killing
 * the app's WebSocket / audio connections when minimized.
 */
const MeetingService = {
  /**
   * Start the foreground service with an ongoing notification.
   * Call this when entering a meeting.
   */
  start(meetingTitle?: string): void {
    if (Platform.OS === 'android' && KonnMeetingService) {
      KonnMeetingService.start(meetingTitle ?? 'Meeting in progress');
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
