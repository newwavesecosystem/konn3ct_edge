/**
 * useSettingsStore.ts
 *
 * Persisted user preferences for meeting behaviour.
 * Backed by AsyncStorage so values survive app restarts.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@konn3ct_settings';

interface SettingsState {
  /** Play a short chime when a new chat message is received. Default: true */
  chatNotificationSound: boolean;
  /** Show an in-app toast/banner for incoming chat messages. Default: true */
  chatToastEnabled: boolean;
  /** Whether settings have been loaded from disk */
  isHydrated: boolean;

  setChatNotificationSound: (enabled: boolean) => void;
  setChatToastEnabled: (enabled: boolean) => void;
  /** Load settings from AsyncStorage — call once at app start */
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  chatNotificationSound: true,
  chatToastEnabled: true,
  isHydrated: false,

  setChatNotificationSound: (enabled: boolean) => {
    set({ chatNotificationSound: enabled });
    _persist(get());
  },

  setChatToastEnabled: (enabled: boolean) => {
    set({ chatToastEnabled: enabled });
    _persist(get());
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({
          chatNotificationSound: parsed.chatNotificationSound ?? true,
          chatToastEnabled: parsed.chatToastEnabled ?? true,
          isHydrated: true,
        });
      } else {
        set({ isHydrated: true });
      }
    } catch (e) {
      console.warn('[SettingsStore] Failed to hydrate settings:', e);
      set({ isHydrated: true });
    }
  },
}));

/** Persist only the user-facing preferences (not isHydrated) */
function _persist(state: SettingsState) {
  const data = {
    chatNotificationSound: state.chatNotificationSound,
    chatToastEnabled: state.chatToastEnabled,
  };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((e) =>
    console.warn('[SettingsStore] Failed to persist settings:', e)
  );
}
