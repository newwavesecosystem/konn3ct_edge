import { registerGlobals } from 'react-native-webrtc';
// Polyfill WebRTC globals for mediasoup-client
registerGlobals();
// @ts-ignore

import React, { useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainTabNavigator from './src/navigation/MainTabNavigator';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import MeetingScreen from './src/screens/MeetingScreen';
import { MeetingSummaryScreen } from './src/screens/MeetingSummaryScreen';
import { useAuthStore } from './src/store/useAuthStore';

export type RootStackParamList = {
  MainTabs: undefined;
  Meeting: { roomId: string };
  MeetingSummary: { roomId: string };
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
                name="Meeting" 
                component={MeetingScreen} 
                options={{ title: 'Meeting Room', headerShown: false }} 
              />
              <Stack.Screen 
                name="MeetingSummary" 
                component={MeetingSummaryScreen} 
                options={{ title: 'AI Intelligence', headerShown: true, headerStyle: { backgroundColor: '#1e293b' }, headerTintColor: 'white' }} 
              />
            </Stack.Navigator>
          ) : (
            <AuthStackNavigator />
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
