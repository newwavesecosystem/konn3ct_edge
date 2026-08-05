import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import GuestJoinScreen from '../screens/GuestJoinScreen';
import LobbyScreen from '../screens/LobbyScreen';
import MeetingScreen from '../screens/MeetingScreen';

const Stack = createNativeStackNavigator();

export default function AuthStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false }}
    >
      {/* Landing screen shown when the user is not logged in */}
      <Stack.Screen name="Welcome"   component={WelcomeScreen} />

      {/* Auth screens */}
      <Stack.Screen name="Login"     component={LoginScreen} />
      <Stack.Screen name="Signup"    component={SignupScreen} />

      {/* Guest join flow — no login required */}
      <Stack.Screen name="GuestJoin" component={GuestJoinScreen} />

      {/* Guests navigate directly into Lobby → Meeting */}
      <Stack.Screen name="GuestLobby"   component={LobbyScreen}   />
      <Stack.Screen name="GuestMeeting" component={MeetingScreen} />
    </Stack.Navigator>
  );
}
