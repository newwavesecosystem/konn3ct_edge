import { create } from 'zustand';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  /** True once the startup SecureStore check has completed. */
  isHydrated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  /** Read persisted credentials from SecureStore and restore session. */
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrated: false,
  login: (user, token) => set({ user, token }),
  logout: () => {
    // Clear persisted credentials on explicit logout
    SecureStore.deleteItemAsync('konn3ct_token').catch(() => {});
    SecureStore.deleteItemAsync('konn3ct_user').catch(() => {});
    set({ user: null, token: null });
  },
  hydrate: async () => {
    try {
      const savedToken = await SecureStore.getItemAsync('konn3ct_token');
      const savedUserStr = await SecureStore.getItemAsync('konn3ct_user');
      if (savedToken && savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        const safeUser: User = {
          id: String(parsed?.id || 'unknown-id'),
          email: parsed?.email || '',
          name: parsed?.name || parsed?.email || 'User',
        };
        set({ user: safeUser, token: savedToken });
      }
    } catch (e) {
      console.warn('[useAuthStore] hydrate failed:', e);
    } finally {
      set({ isHydrated: true });
    }
  },
}));

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.log('Project ID not found');
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo Push Token:', token);
      
      // Send token to backend
      await apiClient.post('/auth/push-token', { expoPushToken: token });
      console.log('Push token sent to backend successfully');
    } catch (e) {
      console.log('Error getting push token', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
