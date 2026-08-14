import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MoreScreen from '../screens/MoreScreen';
import AddonsScreen from '../screens/AddonsScreen';
import EventsScreen from '../screens/EventsScreen';
import RoomsScreen from '../screens/RoomsScreen';
import CustomTabBar from '../components/CustomTabBar';
import { APP_CONFIG } from '../config/appConfig';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {APP_CONFIG.SHOW_ADDONS_TAB ? (
        <Tab.Screen 
          name="Addons" 
          component={AddonsScreen} 
          options={{ title: 'Add ons' }}
        />
      ) : (
        <Tab.Screen 
          name="Events" 
          component={EventsScreen} 
          options={{ title: 'Events' }}
        />
      )}
      <Tab.Screen 
        name="Rooms" 
        component={RoomsScreen} 
        options={{ 
          title: 'Rooms',
        }}
      />
      <Tab.Screen 
        name="Dashboard"  
        component={DashboardScreen} 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Schedule" 
        component={ScheduleScreen} 
        options={{ 
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ 
          title: 'Profile',
        }}
      />
      <Tab.Screen 
        name="More" 
        component={MoreScreen} 
        options={{ 
          title: 'More',
        }}
      />
    </Tab.Navigator>
  );
}

