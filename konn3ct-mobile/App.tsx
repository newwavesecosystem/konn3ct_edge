import { registerGlobals } from 'react-native-webrtc';
// Polyfill WebRTC globals for mediasoup-client
registerGlobals();
// @ts-ignore

import React, { useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { useAlertStore } from './src/store/useAlertStore';
import { CustomAlert } from './src/components/CustomAlert';

// Override React Native's default Alert.alert globally with modern custom modal dialogs
Alert.alert = (title, message, buttons) => {
  const formattedButtons = buttons?.map(btn => ({
    text: btn.text || 'OK',
    onPress: btn.onPress,
    style: btn.style,
  })) || [{ text: 'OK' }];

  useAlertStore.getState().showAlert(title || '', message || '', formattedButtons);
};
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabNavigator from './src/navigation/MainTabNavigator';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import MeetingScreen from './src/screens/MeetingScreen';
import LobbyScreen from './src/screens/LobbyScreen';
import { MeetingSummaryScreen } from './src/screens/MeetingSummaryScreen';
import StreamingScreen from './src/screens/StreamingScreen';
import RecordingsScreen from './src/screens/RecordingsScreen';
import EventsScreen from './src/screens/EventsScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import PaymentsScreen from './src/screens/PaymentsScreen';
import DonationsScreen from './src/screens/DonationsScreen';
import RefereesScreen from './src/screens/RefereesScreen';
import PastMeetingsScreen from './src/screens/PastMeetingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { useAuthStore, registerForPushNotificationsAsync } from './src/store/useAuthStore';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type RootStackParamList = {
  MainTabs: undefined;
  Lobby: { roomId: string; meetingToken?: string; micOn?: boolean; cameraOn?: boolean };
  Meeting: { roomId: string; meetingToken?: string; micOn?: boolean; cameraOn?: boolean };
  MeetingSummary: { roomId: string };
  Streaming: undefined;
  Recordings: undefined;
  Events: undefined;
  Attendance: undefined;
  Payments: undefined;
  Donations: undefined;
  Referees: undefined;
  PastMeetings: undefined;
  Notifications: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("FATAL ERROR:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: 'red', padding: 40, justifyContent: 'center' }}>
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>APP CRASHED!</Text>
          <ScrollView><Text style={{ color: 'white', marginTop: 20 }}>{String(this.state.error)}</Text></ScrollView>
        </View>
      );
    }
    return this.props.children as React.ReactNode;
  }
}

export default function App() {
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    // Hide the infinite white splash screen!
    SplashScreen.hideAsync().catch(console.warn);
  }, []);

  useEffect(() => {
    if (token) {
      registerForPushNotificationsAsync();
    }
  }, [token]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          {token ? (
            <Stack.Navigator initialRouteName="MainTabs">
              <Stack.Screen 
                name="MainTabs" 
                component={MainTabNavigator} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen
                name="Lobby"
                component={LobbyScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Meeting" 
                component={MeetingScreen} 
                options={{ title: 'Meeting Room', headerShown: false }} 
              />
              <Stack.Screen 
                name="MeetingSummary" 
                component={MeetingSummaryScreen} 
                options={{ title: 'AI Intelligence', headerShown: true, headerStyle: { backgroundColor: '#1e293b' }, headerTintColor: 'white' }} 
              />
              <Stack.Screen 
                name="Streaming" 
                component={StreamingScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="Recordings" 
                component={RecordingsScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="Events" 
                component={EventsScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="Attendance" 
                component={AttendanceScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="Payments" 
                component={PaymentsScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="Donations" 
                component={DonationsScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="Referees" 
                component={RefereesScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="PastMeetings" 
                component={PastMeetingsScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="Notifications" 
                component={NotificationsScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="History" 
                component={HistoryScreen} 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="Settings" 
                component={SettingsScreen} 
                options={{ headerShown: false }} 
              />
            </Stack.Navigator>
          ) : (
            <AuthStackNavigator />
          )}
        </NavigationContainer>
        <CustomAlert />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
