export type MeetingDevicePreferences = {
  notifications: {
    enableAllToasts: boolean;
    enableAllSounds: boolean;

    showChatToasts: boolean;
    showJoinLeaveToasts: boolean;
    showMuteUnmuteToasts: boolean;
    showSystemToasts: boolean;

    playChatSound: boolean;
    playJoinLeaveSound: boolean;
    playMuteUnmuteSound: boolean;
    playSystemSound: boolean;
  };
  theme: {
    selectedTheme: string;
  };
};

export const DEFAULT_MEETING_DEVICE_PREFERENCES: MeetingDevicePreferences = {
  notifications: {
    enableAllToasts: true,
    enableAllSounds: true,

    showChatToasts: true,
    showJoinLeaveToasts: true,
    showMuteUnmuteToasts: true,
    showSystemToasts: true,

    playChatSound: true,
    playJoinLeaveSound: false,
    playMuteUnmuteSound: false,
    playSystemSound: false,
  },
  theme: {
    selectedTheme: "default",
  },
};

const MEETING_DEVICE_PREFERENCES_KEY = "konn3ct_meeting_device_preferences_v1";

// Deep merge helper
function deepMerge<T extends Record<string, any>>(target: T, source: Record<string, any>): T {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(target).forEach(key => {
      if (isObject(target[key]) && source[key] !== undefined) {
        if (isObject(source[key])) {
          output[key as keyof T] = deepMerge(target[key], source[key]) as any;
        } else {
          output[key as keyof T] = source[key] as any;
        }
      } else if (source[key] !== undefined) {
        output[key as keyof T] = source[key] as any;
      }
    });
  }
  return output;
}

function isObject(item: any): item is Record<string, any> {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

export function getMeetingDevicePreferences(): MeetingDevicePreferences {
  if (typeof window === "undefined") {
    return DEFAULT_MEETING_DEVICE_PREFERENCES;
  }

  const stored = localStorage.getItem(MEETING_DEVICE_PREFERENCES_KEY);
  if (!stored) {
    return DEFAULT_MEETING_DEVICE_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(stored);
    const merged = deepMerge(DEFAULT_MEETING_DEVICE_PREFERENCES, parsed);
    console.log("meeting_preferences_loaded", merged);
    return merged;
  } catch (error) {
    console.log("meeting_preferences_corrupt_reset", error);
    return DEFAULT_MEETING_DEVICE_PREFERENCES;
  }
}

export function setMeetingDevicePreferences(partial: DeepPartial<MeetingDevicePreferences>): MeetingDevicePreferences {
  if (typeof window === "undefined") {
    return DEFAULT_MEETING_DEVICE_PREFERENCES; // no-op on SSR
  }

  const current = getMeetingDevicePreferences();
  const next = deepMerge(current, partial as any);
  
  localStorage.setItem(MEETING_DEVICE_PREFERENCES_KEY, JSON.stringify(next));
  console.log("meeting_preferences_saved", next);
  
  // Dispatch custom event for cross-tab sync / reactive updates within the same window
  window.dispatchEvent(new CustomEvent('meeting_device_preferences_changed', { detail: next }));
  
  return next;
}

// Utility type
type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

import { useState, useEffect } from 'react';

export function useMeetingDevicePreferences() {
  const [preferences, setPreferences] = useState<MeetingDevicePreferences>(DEFAULT_MEETING_DEVICE_PREFERENCES);

  useEffect(() => {
    setPreferences(getMeetingDevicePreferences());

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === MEETING_DEVICE_PREFERENCES_KEY) {
        setPreferences(getMeetingDevicePreferences());
      }
    };
    
    const handleLocalChange = (e: CustomEvent) => {
      setPreferences(e.detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('meeting_device_preferences_changed', handleLocalChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('meeting_device_preferences_changed', handleLocalChange as EventListener);
    };
  }, []);

  return { preferences, setMeetingDevicePreferences };
}
