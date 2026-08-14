import { NativeModules, Platform } from 'react-native';

const { NativeNotificationSound } = NativeModules;
let lastPlayTime = 0;

const NotificationSoundService = {
  async initialize(): Promise<void> {
    console.log('[NotificationSoundService] Initialized native sound module');
  },

  async playNotificationSound(): Promise<void> {
    const now = Date.now();
    if (now - lastPlayTime < 300) {
      return; // Debounce 300ms
    }
    lastPlayTime = now;

    if (Platform.OS === 'android' && NativeNotificationSound) {
      try {
        NativeNotificationSound.playNotificationSound();
      } catch (e) {
        console.warn('[NotificationSoundService] Native sound playback failed:', e);
      }
    }
  },

  async cleanup(): Promise<void> {
    // Cleanup if needed
  },
};

export default NotificationSoundService;
