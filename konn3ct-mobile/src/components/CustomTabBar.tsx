import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Text, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Path } from 'react-native-svg';
import { Home, Calendar, User, MoreHorizontal, Video, Layers } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_CONFIG } from '../config/appConfig';

const { width } = Dimensions.get('window');

// Brand Colors
const COLORS = {
  brandGreen: '#207450',
  inactive: '#94a3b8',
  surface: '#ffffff',
  background: '#f4f6f9',
};

const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const center = width / 2;
  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;
  
  // Base height of the nav bar before safe area
  const BASE_HEIGHT = 90;
  // Total height including the bottom safe area
  const barHeight = BASE_HEIGHT + safeBottom;

  // Dynamic path that creates a perfect cutout in the center regardless of device width
  const getPath = () => {
    return `
      M 0 20
      Q 0 0 20 0
      L ${center - 45} 0
      C ${center - 30} 0, ${center - 25} 10, ${center - 20} 15
      C ${center - 10} 30, ${center + 10} 30, ${center + 20} 15
      C ${center + 25} 10, ${center + 30} 0, ${center + 45} 0
      L ${width - 20} 0
      Q ${width} 0 ${width} 20
      L ${width} ${barHeight + 20}
      L 0 ${barHeight + 20}
      Z
    `;
  };

  // The 5 tabs: Home, Schedule, Center (FAB), Profile, More
  // In the navigator state, we only have Home, Schedule, Profile.
  // We'll map them explicitly to control layout.
  
  const handlePress = (routeName: string) => {
    navigation.navigate(routeName);
  };

  const getIcon = (routeName: string, isFocused: boolean) => {
    const color = isFocused ? COLORS.brandGreen : COLORS.inactive;
    switch(routeName) {
      case 'Addons': return <Layers color={color} size={24} />;
      case 'Events': return <Calendar color={color} size={24} />;
      case 'Rooms': return <Video color={color} size={24} />;
      case 'Profile': return <User color={color} size={24} />;
      case 'More': return <MoreHorizontal color={color} size={24} />;
      default: return <Home color={color} size={24} />;
    }
  };

  const getLabel = (routeName: string) => {
    switch(routeName) {
      case 'Addons': return 'Add ons';
      case 'Events': return 'Events';
      case 'Rooms': return 'Rooms';
      case 'Profile': return 'Profile';
      case 'More': return 'More';
      default: return routeName;
    }
  };

  const currentRouteName = state.routes[state.index].name;

  const renderTab = (routeName: string, isDummy = false) => {
    const isFocused = currentRouteName === routeName;
    return (
      <TouchableOpacity
        key={routeName}
        activeOpacity={0.7}
        onPress={() => !isDummy && handlePress(routeName)}
        style={styles.tabButton}
      >
        <View style={styles.iconContainer}>
          {getIcon(routeName, isFocused)}
        </View>
        <Text style={[styles.tabLabel, { color: isFocused ? COLORS.brandGreen : COLORS.inactive }]}>
          {getLabel(routeName)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { height: barHeight }]}>
      {/* SVG Background with Cutout */}
      <View style={[styles.svgContainer, { height: barHeight }]}>
        <Svg width={width} height={barHeight} viewBox={`0 0 ${width} ${barHeight}`}>
          <Path 
            d={getPath()} 
            fill={COLORS.surface}
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />
        </Svg>
      </View>

      <View style={[styles.contentContainer, { height: barHeight, paddingBottom: safeBottom + 10 }]}>
        {/* Left Side Tabs */}
        <View style={styles.sideContainer}>
          {renderTab(APP_CONFIG.SHOW_ADDONS_TAB ? 'Addons' : 'Events')}
          {renderTab('Rooms')}
        </View>

        {/* Center FAB space */}
        <View style={styles.centerContainer} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.8}
            onPress={() => handlePress('Dashboard')}
          >
            <Home color="#ffffff" size={28} />
          </TouchableOpacity>
        </View>

        {/* Right Side Tabs */}
        <View style={styles.sideContainer}>
          {renderTab('Profile')}
          {renderTab('More')}
        </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'transparent',
    // shadow for Android
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
  },
  svgContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // Add shadow drop specifically to the SVG shape on iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  contentContainer: {
    flexDirection: 'row',
  },
  sideContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  centerContainer: {
    width: 80, // Space for the cutout
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconContainer: {
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    top: -24,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
});

export default CustomTabBar;
