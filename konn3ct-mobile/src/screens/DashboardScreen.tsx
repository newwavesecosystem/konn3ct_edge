import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { apiClient } from '../api/client';
import { fetchDashboardStats, fetchTodayMeetings, DashboardStats, TodayMeeting } from '../api/dashboard';
import { fetchSchedules } from '../api/schedule';
import { createRoom, fetchMyRooms, fetchMyRoomsData, startRoom, joinRoomKv4, validateMeetingKv4 } from '../api/rooms';
import { getAttendeeToken } from '../api/edgeApi';
import { SIGNAL_SERVER_DOMAIN as SIGNAL_DOMAIN } from '../webrtc/MediasoupService';
import { useAuthStore } from '../store/useAuthStore';
import * as Clipboard from 'expo-clipboard';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Plus,
  ArrowRight,
  Calendar,
  Clock,
  Users,
  Sparkles,
  ChevronRight,
  X,
  CreditCard,
  Crown,
  Bell,
  Copy,
  Film,
  Radio,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { APP_CONFIG } from '../config/appConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const IS_DEV = (process.env.EXPO_PUBLIC_API_URL || 'https://dev.konn3ct.ng/api/app').includes('dev.konn3ct.ng');

// Brand colors matching dashboard design system
const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandBlueDark: '#001D5C',
  brandGreen: '#207450',
  brandGreenSoft: '#3c8464',
  textPrimary: '#0A2540',
  textSecondary: '#343030',
  textMuted: '#8896AB',
  border: '#E8ECF2',
  borderLight: '#F0F3F7',
  danger: '#CC505C',
  amber: '#E59F0B',
  white: '#ffffff',
  skeleton: '#E8ECF2',
  inputBorder: '#E8ECF2',
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
};

// Skeleton loading placeholder
const formatNameOrder = (name: string) => {
  if (!name || name === 'Unknown Host') return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
  }
  return name;
};

function SkeletonBlock({ width: w, height: h, style }: { width: number | string; height: number; style?: any }) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: w as any,
          height: h,
          backgroundColor: COLORS.skeleton,
          borderRadius: 12,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinStatus, setJoinStatus] = useState('Join Room');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinMicOn, setJoinMicOn] = useState(true);
  const [joinCameraOn, setJoinCameraOn] = useState(true);
  const [pastRooms, setPastRooms] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [personalRoomUrl, setPersonalRoomUrl] = useState<string | null>(null);
  
  // New Dashboard States
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [todayMeetings, setTodayMeetings] = useState<TodayMeeting[]>([]);
  
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const cardsFade = useRef(new Animated.Value(0)).current;
  const cardsSlide = useRef(new Animated.Value(30)).current;
  const sectionFade = useRef(new Animated.Value(0)).current;
  const sectionSlide = useRef(new Animated.Value(30)).current;
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  // Custom keyboard listener to avoid Modal layout bugs on Android
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(cardsFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(cardsSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(sectionFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(sectionSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const loadData = async () => {
    try {
      const [summariesRes, schedRes, statsRes, todayRes, roomsRes] = await Promise.all([
        // === PRODUCTION ENDPOINTS (PRESERVED) ===
        apiClient.get('/ai/summaries').catch(() => ({ data: [] })),
        fetchSchedules().catch(() => []),
        
        // === DEV ENDPOINTS (NEW) ===
        fetchDashboardStats(),
        fetchTodayMeetings(),
        fetchMyRoomsData().catch(() => ({ rooms: [], total_rooms: 0, max_rooms: 0 })),
      ]);
      setPastRooms(summariesRes.data.slice(0, 3));
      const schedulesArray = Array.isArray(schedRes) ? schedRes : schedRes?.data || [];
      const now = new Date().getTime();
      const futureSchedules = schedulesArray.filter((m: any) => {
        const meetingTime = new Date(m.time || m.start_time || m.startTime || m.date).getTime();
        // Keep it if it's in the future, or if parsing failed
        return isNaN(meetingTime) || meetingTime >= now;
      });
      setUpcoming(futureSchedules);
      
      const adjustedStats = statsRes ? { ...statsRes } : { rooms: 0, upcoming_meetings: 0, streaming: 0, recordings: 0 };
      if (roomsRes && typeof roomsRes === 'object' && 'total_rooms' in roomsRes) {
        adjustedStats.rooms = roomsRes.total_rooms || 0;
      }
      setDashboardStats(adjustedStats as DashboardStats);
      
      setTodayMeetings(todayRes);

      // Set personal room URL from user's default room (or first room)
      const roomsArray = roomsRes?.rooms || [];
      if (Array.isArray(roomsArray) && roomsArray.length > 0) {
        const defaultRoom = roomsArray.find((r: any) => r.default_room === 'yes') || roomsArray[0];
        setPersonalRoomUrl(defaultRoom.url || null);
      }
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setIsLoadingRooms(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleCopyPmi = async () => {
    const pmi = personalRoomUrl || '';
    if (!pmi) return;
    await Clipboard.setStringAsync(pmi);
    Alert.alert("Copied!", `Room ID "${pmi}" copied to clipboard.`);
  };

  const handleJoin = async () => {
    const roomId = joinRoomId.trim();
    if (!roomId) {
      Alert.alert("Error", "Please enter a valid Room ID.");
      return;
    }

    Keyboard.dismiss();
    setIsJoining(true);

    try {
      // Step 1: Validate the room exists (case-insensitive on REST API)
      setJoinStatus('Validating room...');
      const validation = await validateMeetingKv4(roomId);
      console.log('[JOIN] validateMeetingKv4 response:', JSON.stringify(validation, null, 2));
      if (!validation.success) {
        console.warn('[JOIN] Room not found. Full response:', validation);
        Alert.alert('Room Not Found', 'No room found with that ID. Please check and try again.');
        setIsJoining(false);
        setJoinStatus('Join Room');
        return;
      }

      // Step 2: Get an ATTENDEE token via the Edge frontend API
      // This calls /api/prejoin → /api/join which force-locks role to "attendee",
      // ensuring the signal server puts the user in the waiting room.
      setJoinStatus('Connecting...');
      const meetingToken = await getAttendeeToken(
        roomId,
        user?.name || 'Guest',
        user?.email || 'guest@conn3ct.com'
      );

      // Step 3: Navigate to lobby — LobbyScreen handles the WebSocket
      // connection and waiting room UI, including error states (404, host not ready).
      setShowJoinInput(false);
      setJoinRoomId('');
      setJoinStatus('Join Room');
      setIsJoining(false);
      navigation.navigate('Lobby', { roomId, meetingToken, micOn: joinMicOn, cameraOn: joinCameraOn });
      return;
    } catch (e: any) {
      console.error('Join failed:', e.response?.data || e.message);
      Alert.alert('Join Failed', e.response?.data?.message || 'Could not connect. Check the Room ID and try again.');
    }

    setIsJoining(false);
    setJoinStatus('Join Room');
  };


  const handleAvatarPress = () => {
    Alert.alert(
      "Account",
      "What would you like to do?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "View Profile", onPress: () => (navigation.navigate as any)('Profile') },
        { text: "Log Out", onPress: logout, style: "destructive" }
      ]
    );
  };

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const rooms = await fetchMyRooms();
      if (rooms && rooms.length > 0) {
        // Use the first available room
        const room = rooms[0];
        // Start the room on backend first
        const startRes = await startRoom(room.id);
        console.log('--- DASHBOARD: START ROOM 1 RESPONSE ---');
        console.log(JSON.stringify(startRes, null, 2));
        const meetingToken = startRes?.sessionToken || startRes?.url?.match(/[?&]t=([^&]+)/)?.[1];
        console.log('DASHBOARD EXTRACTED TOKEN:', meetingToken ? 'YES (Length: ' + meetingToken.length + ')' : 'NO TOKEN FOUND');
        
        const roomId = room.url || room.slug || String(room.id);
        navigation.navigate('Meeting', { roomId, meetingToken, micOn: false, cameraOn: false });
      } else {
        // Fallback if user has absolutely no rooms — create one and start it
        if (IS_DEV) {
          const randomSlug = 'mob' + Math.floor(Math.random() * 100000);
          await createRoom({
            name: 'Mobile Meeting ' + Math.floor(Math.random() * 1000),
            url: randomSlug,
            mode: 'meeting',
            privacy: 0,
          });
          
          const newRooms = await fetchMyRooms();
          const newRoom = newRooms.find((r: any) => r.url === randomSlug);
          if (newRoom) {
            const startRes = await startRoom(newRoom.id);
            console.log('--- DASHBOARD: START ROOM 2 RESPONSE ---');
            console.log(JSON.stringify(startRes, null, 2));
            const meetingToken = startRes?.sessionToken || startRes?.url?.match(/[?&]t=([^&]+)/)?.[1];
            console.log('DASHBOARD EXTRACTED TOKEN:', meetingToken ? 'YES' : 'NO');
            navigation.navigate('Meeting', { roomId: randomSlug, meetingToken, micOn: false, cameraOn: false });
          } else {
            Alert.alert('Error', 'Room was created but could not be found. Please try again.');
          }
        } else {
          const payload = {
            name: 'Mobile Meeting ' + Math.floor(Math.random() * 1000),
            mode: 'meeting',
            recordingSetting: 'off',
            guestJoinAllowed: true,
            maxParticipants: 100,
            maxWebinarAudience: 1000,
            maxActiveCameras: 15
          };
          
          const res = await apiClient.post('/rooms', payload);
          const newRoom = res.data;
          const roomId = newRoom.slug || newRoom.url || String(newRoom.id);
          const startRes = await startRoom(newRoom.id);
          console.log('--- DASHBOARD: START ROOM 3 RESPONSE ---');
          console.log(JSON.stringify(startRes, null, 2));
          const meetingToken = startRes?.sessionToken || startRes?.url?.match(/[?&]t=([^&]+)/)?.[1];
          console.log('DASHBOARD EXTRACTED TOKEN:', meetingToken ? 'YES' : 'NO');
          navigation.navigate('Meeting', { roomId, meetingToken, micOn: false, cameraOn: false });
        }
      }
    } catch (e: any) {
      console.error('Failed to host room:', e.response?.data || e.message);
      Alert.alert('Error', 'Failed to host room.');
    } finally {
      setIsCreating(false);
    }
  };


  const firstName = user?.name?.split(' ')[0] || 'User';

  const ACCENT_COLORS = [
    { bg: 'rgba(1, 46, 137, 0.08)', text: COLORS.brandBlue, border: 'rgba(1, 46, 137, 0.15)' },
    { bg: 'rgba(32, 116, 80, 0.08)', text: COLORS.brandGreen, border: 'rgba(32, 116, 80, 0.15)' },
    { bg: 'rgba(229, 159, 11, 0.08)', text: COLORS.amber, border: 'rgba(229, 159, 11, 0.15)' },
  ];

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* ===== STICKY HEADER ===== */}
      <View style={[styles.stickyHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.stickyHeaderLeft}>
          <TouchableOpacity style={styles.avatarLogoContainer} onPress={handleAvatarPress} activeOpacity={0.8}>
            <View style={styles.avatarRing}>
              <Text style={styles.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>2</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.stickyHeaderName}>Hi, {firstName.toUpperCase()}</Text>
        </View>

        <View style={styles.stickyHeaderRight}>
          {APP_CONFIG.SHOW_NOTIFICATIONS && (
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => (navigation.navigate as any)('Notifications')}>
              <Bell color={COLORS.textPrimary} size={24} />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>20</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {/* We can keep a subtitle here or just remove the old header */}
        <Animated.View
          style={[
            styles.headerContainer,
            { opacity: headerFade, transform: [{ translateY: headerSlide }] },
          ]}
        >
          <Text style={styles.headerSubtitle}>
            Here's what's happening with your meetings today.
          </Text>
        </Animated.View>

        {/* ===== STATS GRID (NEW) ===== */}
        <Animated.View
          style={[{
            opacity: cardsFade,
            transform: [{ translateY: cardsSlide }],
            marginBottom: 20,
          }]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 10 }}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH * 0.4 + 12}
          >
            {/* Total Rooms */}
            <View style={styles.dashboardStatCard}>
              <View style={[styles.dashboardStatIcon, { backgroundColor: 'rgba(32, 116, 80, 0.1)' }]}>
                <Video color={COLORS.brandGreen} size={20} />
              </View>
              <Text style={styles.dashboardStatValue}>{dashboardStats?.rooms || 0}</Text>
              <Text style={styles.dashboardStatLabel}>Total Rooms</Text>
            </View>

            {/* Upcoming */}
            <View style={styles.dashboardStatCard}>
              <View style={[styles.dashboardStatIcon, { backgroundColor: 'rgba(229, 159, 11, 0.1)' }]}>
                <Calendar color={COLORS.amber} size={20} />
              </View>
              <Text style={styles.dashboardStatValue}>{dashboardStats?.upcoming_meetings || 0}</Text>
              <Text style={styles.dashboardStatLabel}>Upcoming</Text>
            </View>

            {/* Streaming */}
            <View style={styles.dashboardStatCard}>
              <View style={[styles.dashboardStatIcon, { backgroundColor: 'rgba(1, 46, 137, 0.1)' }]}>
                <Radio color={COLORS.brandBlue} size={20} />
              </View>
              <Text style={styles.dashboardStatValue}>{dashboardStats?.streaming || 0}</Text>
              <Text style={styles.dashboardStatLabel}>Streaming</Text>
            </View>

            {/* Recordings */}
            <View style={styles.dashboardStatCard}>
              <View style={[styles.dashboardStatIcon, { backgroundColor: 'rgba(204, 80, 92, 0.1)' }]}>
                <Film color={COLORS.danger} size={20} />
              </View>
              <Text style={styles.dashboardStatValue}>{dashboardStats?.recordings || 0}</Text>
              <Text style={styles.dashboardStatLabel}>Recordings</Text>
            </View>
          </ScrollView>
        </Animated.View>

        {/* ===== QUICK ACTIONS (HERO CARD) ===== */}
        <Animated.View
          style={[
            styles.instantMeetingCard,
            { opacity: cardsFade, transform: [{ translateY: cardsSlide }] },
          ]}
        >
          <LinearGradient
            colors={[COLORS.brandBlue, COLORS.brandBlueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.instantMeetingGradient}
          >
            {/* Decorative blurs */}
            <View style={styles.decorativeBlur1} />
            <View style={styles.decorativeBlur2} />

            <View style={styles.instantMeetingContent}>
              <View style={styles.instantMeetingHeader}>
                <Video color={COLORS.white} size={22} />
                <Text style={styles.instantMeetingTitle}>Instant Meeting</Text>
              </View>
              <Text style={styles.instantMeetingSubtitle}>
                Connect and manage your meetings instantly.
              </Text>

              <View style={styles.meetingButtonRow}>
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={() => setShowJoinInput(true)}
                  activeOpacity={0.85}
                >
                  <View style={styles.joinIconBox} />
                  <Text style={styles.joinButtonText}>
                    Join
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.hostButton}
                  onPress={handleCreate}
                  disabled={isCreating}
                  activeOpacity={0.85}
                >
                  {isCreating ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <>
                      <Video color={COLORS.white} size={18} />
                      <Text style={styles.hostButtonText}>Host</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => (navigation.navigate as any)('Schedule')}
                activeOpacity={0.85}
              >
                <Calendar color={COLORS.white} size={18} />
                <Text style={styles.scheduleButtonText}>Schedule for later</Text>
              </TouchableOpacity>

              <View style={styles.pmiSection}>
                <Text style={styles.pmiLabel}>PERSONAL MEETING ID</Text>
                <View style={styles.pmiBox}>
                  <Text
                    style={styles.pmiText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {personalRoomUrl ?? '...'}
                  </Text>
                  {personalRoomUrl ? (
                    <TouchableOpacity onPress={handleCopyPmi} activeOpacity={0.7} style={styles.pmiCopyBtn}>
                      <Copy size={16} color="rgba(255, 255, 255, 0.8)" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ===== JOIN INPUT MODAL ===== */}
        <Modal
          visible={showJoinInput}
          animationType="slide"
          transparent={true}
          statusBarTranslucent={true}
          onRequestClose={() => {
            if (!isJoining) {
              Keyboard.dismiss();
              setShowJoinInput(false);
              setJoinRoomId('');
            }
          }}
        >
          {/*
           * Use an Animated.View with a custom keyboard listener instead of
           * KeyboardAvoidingView. This prevents the "keyboard covers modal"
           * bug AND the "ghost gap remains" bug on Android translucent modals.
           */}
          <Animated.View style={[styles.modalKAV, { paddingBottom: keyboardHeightAnim }]}>
            {/* Backdrop — tap to dismiss */}
            <TouchableWithoutFeedback onPress={() => {
              if (!isJoining) {
                Keyboard.dismiss();
                setShowJoinInput(false);
                setJoinRoomId('');
              }
            }}>
              <View style={RNStyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>

            {/* Sheet card — sits at the bottom, moves above keyboard */}
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Join Meeting</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (!isJoining) {
                        Keyboard.dismiss();
                        setShowJoinInput(false);
                        setJoinRoomId('');
                      }
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X color={COLORS.textMuted} size={24} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSubtitle}>
                  Enter the Room ID exactly as shown on the host's screen.{' '}
                  <Text style={{ fontStyle: 'italic' }}>Room IDs are case-sensitive.</Text>
                </Text>

                <TextInput
                  style={[styles.modalInput, isJoining && { opacity: 0.5 }]}
                  placeholder="e.g. general-meeting"
                  placeholderTextColor={COLORS.textMuted}
                  value={joinRoomId}
                  onChangeText={setJoinRoomId}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isJoining}
                  onSubmitEditing={handleJoin}
                  returnKeyType="go"
                />

                <View style={styles.togglesContainer}>
                  <TouchableOpacity
                    style={[styles.toggleButton, joinMicOn ? styles.toggleButtonActive : styles.toggleButtonInactive]}
                    onPress={() => setJoinMicOn(!joinMicOn)}
                    activeOpacity={0.7}
                  >
                    {joinMicOn ? <Mic color={COLORS.white} size={20} /> : <MicOff color={COLORS.textMuted} size={20} />}
                    <Text style={[styles.toggleButtonText, joinMicOn ? styles.toggleButtonTextActive : styles.toggleButtonTextInactive]}>
                      {joinMicOn ? 'Mic On' : 'Mic Off'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.toggleButton, joinCameraOn ? styles.toggleButtonActive : styles.toggleButtonInactive]}
                    onPress={() => setJoinCameraOn(!joinCameraOn)}
                    activeOpacity={0.7}
                  >
                    {joinCameraOn ? <Video color={COLORS.white} size={20} /> : <VideoOff color={COLORS.textMuted} size={20} />}
                    <Text style={[styles.toggleButtonText, joinCameraOn ? styles.toggleButtonTextActive : styles.toggleButtonTextInactive]}>
                      {joinCameraOn ? 'Camera On' : 'Camera Off'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.modalJoinBtn}
                  onPress={handleJoin}
                  activeOpacity={0.85}
                  disabled={isJoining}
                >
                  {isJoining ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[styles.modalJoinBtnText, { fontSize: 13 }]}>{joinStatus}</Text>
                    </View>
                  ) : (
                    <Text style={styles.modalJoinBtnText}>{joinStatus}</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.modalHint}>
                  💡 The host must tap Host and be in the meeting first.
                </Text>
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </Modal>


        {/* ===== PREMIUM PLANS PROMO ===== */}
        {APP_CONFIG.SHOW_PREMIUM_PROMO && (
        <Animated.View
          style={[{
            opacity: sectionFade,
            transform: [{ translateY: sectionSlide }],
            marginTop: 24,
            marginBottom: 20,
          }]}
        >
          <TouchableOpacity 
            style={styles.premiumCardContainer} 
            activeOpacity={0.9}
            onPress={() => { /* Handle Navigation to Plans/Billing */ }}
          >
            <LinearGradient
              colors={[COLORS.brandBlue, COLORS.brandBlueDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumGradient}
            >
              {/* Decorative Glow */}
              <View style={styles.premiumGlowLeft} />
              <View style={styles.premiumGlowRight} />

              <View style={styles.premiumContent}>
                <View style={styles.premiumHeader}>
                  <View style={styles.premiumIconWrapper}>
                    <Crown color={COLORS.amber} size={22} />
                  </View>
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>FREE PLAN</Text>
                  </View>
                </View>

                <Text style={styles.premiumTitle}>Ready to do more?</Text>
                <Text style={styles.premiumSubtitle}>
                  Upgrade to unlock unlimited durations, AI summaries, and up to 1,000 participants.
                </Text>

                <View style={styles.premiumFooter}>
                  <LinearGradient
                    colors={[COLORS.brandGreen, '#185B3E']}
                    start={{x:0,y:0}} end={{x:1,y:0}}
                    style={styles.premiumUpgradeBtn}
                  >
                    <Text style={styles.premiumUpgradeText}>Upgrade to Pro</Text>
                    <ArrowRight color="#fff" size={16} />
                  </LinearGradient>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        )}

        {/* ===== TODAY'S MEETINGS (NEW) ===== */}
        <Animated.View
          style={[{
            opacity: sectionFade,
            transform: [{ translateY: sectionSlide }],
            marginBottom: 24,
          }]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Clock color={COLORS.amber} size={20} />
              <Text style={styles.sectionTitle}>Today's Meetings</Text>
            </View>
          </View>

          {isLoadingRooms ? (
            <View style={styles.skeletonCard}>
              <SkeletonBlock width="60%" height={14} style={{ marginBottom: 10 }} />
              <SkeletonBlock width="90%" height={12} />
            </View>
          ) : todayMeetings.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Clock color={COLORS.textMuted} size={32} />
              <Text style={styles.emptyStateTitle}>No meetings today</Text>
              <Text style={styles.emptyStateText}>
                Your schedule is clear for the rest of the day.
              </Text>
            </View>
          ) : (
            todayMeetings.map((meeting, i) => {
              const accent = ACCENT_COLORS[i % 3];
              const title = meeting.topic || meeting.title || 'Untitled Meeting';
              const rawHost = meeting.host_name || meeting.hostname || meeting.host || meeting.name || 'Unknown Host';
              const host = formatNameOrder(rawHost);
              const duration = meeting.duration ? `${meeting.duration} mins` : 'Flexible duration';
              
              let timeStr = meeting.start_time || meeting.startTime || 'Pending Time';
              if (timeStr && timeStr.includes('T')) {
                const dateObj = new Date(timeStr);
                if (!isNaN(dateObj.getTime())) {
                  timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
              }

              return (
                <TouchableOpacity
                  key={meeting.id || i}
                  style={styles.meetingCard}
                  onPress={() =>
                    navigation.navigate('Lobby', {
                      roomId: String(meeting.room_id || meeting.roomId || meeting.id),
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={[styles.meetingAccentBar, { backgroundColor: accent.text }]} />
                  <View style={styles.meetingCardContent}>
                    <View style={styles.meetingCardTop}>
                      <View style={styles.meetingInfo}>
                        <Text style={styles.meetingTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        <View style={styles.meetingMeta}>
                          <Clock color={COLORS.textMuted} size={13} />
                          <Text style={styles.meetingMetaText}>
                            {timeStr} • {duration}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.meetingTimeBadge, { backgroundColor: accent.bg, borderColor: accent.border }]}>
                        <Text style={[styles.meetingTimeBadgeText, { color: accent.text }]}>
                          Today
                        </Text>
                      </View>
                    </View>
                    <View style={styles.meetingCardBottom}>
                      <Text style={styles.meetingRoom} numberOfLines={1}>
                        Host: {host}
                      </Text>
                      <ChevronRight color={COLORS.textMuted} size={16} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </Animated.View>

        {/* ===== UPCOMING MEETINGS (PRESERVED) ===== */}
        <Animated.View
          style={[{
            opacity: sectionFade,
            transform: [{ translateY: sectionSlide }],
          }]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Calendar color={COLORS.brandGreen} size={20} />
              <Text style={styles.sectionTitle}>Upcoming Meetings</Text>
            </View>
          </View>

          {isLoadingRooms ? (
            <View style={styles.skeletonCard}>
              <SkeletonBlock width="60%" height={14} style={{ marginBottom: 10 }} />
              <SkeletonBlock width="90%" height={12} style={{ marginBottom: 8 }} />
              <SkeletonBlock width="40%" height={12} />
            </View>
          ) : upcoming.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Calendar color={COLORS.textMuted} size={32} />
              <Text style={styles.emptyStateTitle}>No upcoming meetings</Text>
              <Text style={styles.emptyStateText}>
                Schedule a meeting or join one to get started.
              </Text>
            </View>
          ) : (
            upcoming.map((meeting, i) => {
              const rawTime = meeting.start_time || meeting.startTime || meeting.date || new Date().toISOString();
              const date = new Date(rawTime);
              let timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              if (meeting.time || meeting.fromtime) {
                timeStr = meeting.time || meeting.fromtime;
              }
              const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              const accent = ACCENT_COLORS[i % 3];
              const roomSlug = meeting.roomlink ? meeting.roomlink.split('/').pop() : (meeting.room?.slug || meeting.roomId || meeting.room_id);

              return (
                <TouchableOpacity
                  key={i}
                  style={styles.meetingCard}
                  onPress={() =>
                    navigation.navigate('Lobby', {
                      roomId: roomSlug,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={[styles.meetingAccentBar, { backgroundColor: accent.text }]} />
                  <View style={styles.meetingCardContent}>
                    <View style={styles.meetingCardTop}>
                      <View style={styles.meetingInfo}>
                        <Text style={styles.meetingTitle} numberOfLines={1}>
                          {meeting.title}
                        </Text>
                        <View style={styles.meetingMeta}>
                          <Clock color={COLORS.textMuted} size={13} />
                          <Text style={styles.meetingMetaText}>
                            {dateStr} • {timeStr}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.meetingTimeBadge, { backgroundColor: accent.bg, borderColor: accent.border }]}>
                        <Text style={[styles.meetingTimeBadgeText, { color: accent.text }]}>
                          {timeStr}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.meetingCardBottom}>
                      <Text style={styles.meetingRoom} numberOfLines={1}>
                        Room: {meeting.roomname || meeting.room?.name || 'Unknown'}
                      </Text>
                      <ChevronRight color={COLORS.textMuted} size={16} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </Animated.View>

        {/* ===== PAST MEETINGS INTELLIGENCE ===== */}
        {APP_CONFIG.SHOW_AI_INTELLIGENCE && (
        <Animated.View
          style={[{
            opacity: sectionFade,
            transform: [{ translateY: sectionSlide }],
            marginTop: 8,
          }]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Sparkles color={COLORS.brandGreen} size={20} />
              <Text style={styles.sectionTitle}>AI Intelligence</Text>
            </View>
          </View>

          {isLoadingRooms ? (
            <View style={styles.skeletonCard}>
              <SkeletonBlock width="50%" height={14} style={{ marginBottom: 10 }} />
              <SkeletonBlock width="70%" height={12} />
            </View>
          ) : pastRooms.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Sparkles color={COLORS.textMuted} size={32} />
              <Text style={styles.emptyStateTitle}>No AI summaries yet</Text>
              <Text style={styles.emptyStateText}>
                Complete a meeting to see AI-generated insights.
              </Text>
            </View>
          ) : (
            pastRooms.map((room, i) => (
              <TouchableOpacity
                key={i}
                style={styles.aiCard}
                onPress={() => navigation.navigate('MeetingSummary', { roomId: room.roomId })}
                activeOpacity={0.7}
              >
                <View style={styles.aiCardLeft}>
                  <View style={styles.aiIconContainer}>
                    <Sparkles color={COLORS.brandGreen} size={18} />
                  </View>
                  <View style={styles.aiCardInfo}>
                    <Text style={styles.aiCardTitle} numberOfLines={1}>
                      {room.roomName}
                    </Text>
                    <Text style={styles.aiCardSubtitle} numberOfLines={1}>
                      {room.roomSlug}
                    </Text>
                  </View>
                </View>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI</Text>
                  <ArrowRight color={COLORS.brandGreen} size={12} style={{ marginLeft: 4 }} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 140, // Increased to allow scrolling past the custom tab bar
  },

  // Sticky Header
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    zIndex: 10,
  },
  stickyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarLogoContainer: {
    position: 'relative',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#10B981', // green ring
    backgroundColor: 'rgba(16, 185, 129, 0.15)', // light green bg
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -6,
    right: -8,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.pageBg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  avatarBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  stickyHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: -0.3,
  },
  stickyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F43F5E', // rose/red
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },

  // Old Header Section (now just for subtitle)
  headerContainer: {
    marginBottom: 20,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
  },

  // Instant Meeting Card
  instantMeetingCard: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  instantMeetingGradient: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  decorativeBlur1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  decorativeBlur2: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(32, 116, 80, 0.2)',
  },
  instantMeetingContent: {
    padding: 24,
    position: 'relative',
    zIndex: 10,
  },
  instantMeetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  instantMeetingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 10,
  },
  instantMeetingSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
    lineHeight: 20,
  },
  meetingButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  hostButton: {
    flex: 1,
    backgroundColor: COLORS.brandGreen,
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hostButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  joinButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  joinIconBox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: COLORS.brandBlue,
  },
  joinButtonText: {
    color: COLORS.brandBlue,
    fontWeight: '700',
    fontSize: 15,
  },
  scheduleButton: {
    marginTop: 12,
    backgroundColor: 'rgba(0, 29, 92, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scheduleButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  pmiSection: {
    marginTop: 20,
  },
  pmiLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  pmiBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 29, 92, 0.8)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pmiText: { fontSize: 24, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  pmiCopyBtn: { padding: 4 },

  // Stats Grid (New)
  dashboardStatCard: {
    width: SCREEN_WIDTH * 0.4,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  dashboardStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dashboardStatValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  dashboardStatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  // Modal Styles
  modalKAV: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.inputBorder,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    minHeight: 450, // Added to increase the card's height
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: COLORS.pageBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 24,
  },
  modalJoinBtn: {
    backgroundColor: COLORS.brandGreen,
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalJoinBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  modalHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  // Modal Toggles
  togglesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.brandGreen,
    borderColor: COLORS.brandGreen,
  },
  toggleButtonInactive: {
    backgroundColor: 'transparent',
    borderColor: COLORS.inputBorder,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: COLORS.white,
  },
  toggleButtonTextInactive: {
    color: COLORS.textMuted,
  },
  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // Premium Plans Card
  premiumCardContainer: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginHorizontal: 4,
  },
  premiumGradient: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  premiumGlowLeft: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(245, 158, 11, 0.15)', // Amber glow
    opacity: 0.8,
  },
  premiumGlowRight: {
    position: 'absolute',
    bottom: -60,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(32, 116, 80, 0.25)', // Green glow
    opacity: 0.8,
  },
  premiumContent: {
    position: 'relative',
    zIndex: 2,
  },
  premiumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  premiumIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  premiumBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  premiumBadgeText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  premiumTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  premiumSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  premiumFooter: {
    flexDirection: 'row',
  },
  premiumUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  premiumUpgradeText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },

  // Meeting Cards
  meetingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  meetingAccentBar: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  meetingCardContent: {
    flex: 1,
    padding: 16,
  },
  meetingCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  meetingInfo: {
    flex: 1,
    marginRight: 12,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meetingMetaText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  meetingTimeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  meetingTimeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  meetingCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
  },
  meetingRoom: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
    flex: 1,
  },

  // AI Cards
  aiCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  aiCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  aiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(32, 116, 80, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  aiCardInfo: {
    flex: 1,
  },
  aiCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  aiCardSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(32, 116, 80, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(32, 116, 80, 0.15)',
  },
  aiBadgeText: {
    color: COLORS.brandGreen,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },

  // Empty State
  emptyStateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderStyle: 'dashed',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
});
