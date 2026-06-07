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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import {
  Video,
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
  Headset,
  Bell,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
};

// Skeleton loading placeholder
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
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [pastRooms, setPastRooms] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Animations
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(20)).current;
  const cardsFade = useRef(new Animated.Value(0)).current;
  const cardsSlide = useRef(new Animated.Value(30)).current;
  const sectionFade = useRef(new Animated.Value(0)).current;
  const sectionSlide = useRef(new Animated.Value(30)).current;

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

  useEffect(() => {
    Promise.all([
      apiClient.get('/ai/summaries').catch(() => ({ data: [] })),
      apiClient.get('/scheduling').catch(() => ({ data: [] }))
    ]).then(([summariesRes, schedRes]) => {
      setPastRooms(summariesRes.data.slice(0, 3));
      setUpcoming(schedRes.data.slice(0, 3));
      setIsLoadingRooms(false);
    });
  }, []);

  const handleJoin = () => {
    if (!showJoinInput) {
      setShowJoinInput(true);
      return;
    }

    if (joinRoomId.trim()) {
      navigation.navigate('Meeting', { roomId: joinRoomId.trim() });
      setShowJoinInput(false);
      setJoinRoomId('');
    } else {
      Alert.alert("Error", "Please enter a valid Room ID.");
    }
  };

  const handleAvatarPress = () => {
    Alert.alert(
      "Account",
      "What would you like to do?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "View Profile", onPress: () => navigation.navigate('Profile') },
        { text: "Log Out", onPress: logout, style: "destructive" }
      ]
    );
  };

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
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
      const room = res.data;
      
      navigation.navigate('Meeting', { roomId: room.slug || room.id });
    } catch (e: any) {
      console.error('Failed to create room:', e.response?.data || e.message);
      Alert.alert('Error', 'Failed to create room on the backend.');
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
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Headset color={COLORS.textPrimary} size={24} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Bell color={COLORS.textPrimary} size={24} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>20</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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

        {/* ===== INSTANT MEETING CARD (Gradient) ===== */}
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
                  onPress={handleJoin}
                  activeOpacity={0.85}
                >
                  <View style={styles.joinIconBox} />
                  <Text style={styles.joinButtonText}>
                    {showJoinInput ? 'Go' : 'Join'}
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
                onPress={() => navigation.navigate('Schedule')}
                activeOpacity={0.85}
              >
                <Calendar color={COLORS.white} size={18} />
                <Text style={styles.scheduleButtonText}>Schedule for later</Text>
              </TouchableOpacity>

              <View style={styles.pmiSection}>
                <Text style={styles.pmiLabel}>PERSONAL MEETING ID</Text>
                <View style={styles.pmiBox}>
                  <Text style={styles.pmiText}>8846</Text>
                  <TouchableOpacity onPress={() => { /* Handle copy */ }}>
                    <Text style={{color: 'rgba(255,255,255,0.7)'}}>📋</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ===== JOIN INPUT (Expandable) ===== */}
        {showJoinInput && (
          <View style={styles.joinInputContainer}>
            <View style={styles.joinInputWrapper}>
              <TextInput
                style={styles.joinInput}
                placeholder="Enter Room ID (Slug)"
                placeholderTextColor={COLORS.textMuted}
                value={joinRoomId}
                onChangeText={setJoinRoomId}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <TouchableOpacity
                style={styles.cancelJoinButton}
                onPress={() => {
                  setShowJoinInput(false);
                  setJoinRoomId('');
                }}
              >
                <X color={COLORS.textMuted} size={18} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===== PREMIUM PLANS PROMO ===== */}
        <Animated.View
          style={{
            opacity: sectionFade,
            transform: [{ translateY: sectionSlide }],
            marginTop: 24,
            marginBottom: 20,
          }}
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

        {/* ===== UPCOMING MEETINGS ===== */}
        <Animated.View
          style={{
            opacity: sectionFade,
            transform: [{ translateY: sectionSlide }],
          }}
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
              const date = new Date(meeting.startTime);
              const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
              const accent = ACCENT_COLORS[i % 3];

              return (
                <TouchableOpacity
                  key={i}
                  style={styles.meetingCard}
                  onPress={() =>
                    navigation.navigate('Meeting', {
                      roomId: meeting.room?.slug || meeting.roomId,
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
                        Room: {meeting.room?.name || 'Unknown'}
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
        <Animated.View
          style={{
            opacity: sectionFade,
            transform: [{ translateY: sectionSlide }],
            marginTop: 8,
          }}
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
  pmiText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },

  // Join Input
  joinInputContainer: {
    marginBottom: 20,
  },
  joinInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.brandBlue,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  joinInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  cancelJoinButton: {
    padding: 6,
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
