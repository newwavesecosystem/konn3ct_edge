import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  Shield,
} from 'lucide-react-native';
import { MediasoupService } from '../webrtc/MediasoupService';
import { setActiveMeetingService } from '../webrtc/activeMeetingService';
import { useAuthStore } from '../store/useAuthStore';
import { getAttendeeToken } from '../api/edgeApi';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

type LobbyStatus = 'connecting' | 'waiting' | 'active' | 'denied' | 'ended' | 'failed';

// ─── Colours — matches app design system ─────────────────────────────────────
const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandBlueDark: '#001D5C',
  brandGreen: '#207450',
  brandGreenLight: 'rgba(32,116,80,0.10)',
  brandGreenBorder: 'rgba(32,116,80,0.20)',
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  danger: '#ef4444',
  dangerLight: 'rgba(239,68,68,0.08)',
  dangerBorder: 'rgba(239,68,68,0.20)',
  amber: '#d97706',
  amberLight: 'rgba(217,119,6,0.08)',
  shadow: '#000',
};

// ─── Bouncing Dot ─────────────────────────────────────────────────────────────
function BounceDot({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -8, duration: 380, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(anim, { toValue: 0, duration: 380, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.delay(500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, transform: [{ translateY: anim }] }}
    />
  );
}

// ─── Elapsed Timer ─────────────────────────────────────────────────────────────
function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (active) {
      setSeconds(0);
      ref.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active]);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function LobbyScreen({ route, navigation }: Props) {
  const { roomId, meetingToken, micOn = true, cameraOn = true } = route.params;
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
    : 'ME';
  const displayName = user?.name || 'You';

  const [status, setStatus] = useState<LobbyStatus>('connecting');
  const [roomName, setRoomName] = useState<string>(roomId);
  const [errorMsg, setErrorMsg] = useState('');

  const serviceRef = useRef<MediasoupService | null>(null);
  // Flag: if true the service was handed off and cleanup must NOT disconnect it
  const handedOffRef = useRef(false);
  const isMountedRef = useRef(true);

  const elapsed = useElapsed(status === 'waiting');

  // Card entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // Detect guest vs authenticated user to pick the right route names.
  // The AuthStackNavigator uses GuestMeeting / GuestLobby / GuestJoin,
  // while the main stack uses Meeting / Lobby / MainTabs.
  const isGuest = !useAuthStore(s => s.token);
  const meetingRoute = isGuest ? 'GuestMeeting' : 'Meeting';
  const lobbyRoute   = isGuest ? 'GuestLobby'   : 'Lobby';
  const homeRoute    = isGuest ? 'GuestJoin'     : 'MainTabs';

  // ── Connection ─────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    handedOffRef.current = false;

    const service = new MediasoupService(roomId);
    serviceRef.current = service;

    service.onSessionStatusChange = async (newStatus: string) => {
      if (!isMountedRef.current) return;

      if (newStatus === 'waiting') {
        // Stay in the lobby — user has NOT been admitted yet
        setStatus('waiting');
      } else if (newStatus === 'active') {
        // Host admitted the user — hand off service and go to meeting
        handedOffRef.current = true;
        setActiveMeetingService(service);
        setStatus('active');
        setTimeout(() => {
          if (isMountedRef.current) {
            navigation.replace(meetingRoute as any, { roomId, meetingToken, micOn, cameraOn });
          }
        }, 400);
      } else if (newStatus === 'denied') {
        setStatus('denied');
        setErrorMsg('The host has declined your request to join this meeting.');
      } else if (newStatus === 'ended') {
        setStatus('ended');
        setErrorMsg('The host has ended this meeting.');
      } else if (newStatus === 'kicked') {
        setStatus('denied');
        setErrorMsg('You have been removed from this meeting.');
      }
    };

    (async () => {
      try {
        // If no meetingToken was passed, obtain one via the Edge frontend API.
        // This covers navigations (e.g. meeting cards, schedules) that don't
        // pre-fetch a token.
        let tokenToUse = meetingToken;
        if (!tokenToUse) {
          const authUser = useAuthStore.getState().user;
          tokenToUse = await getAttendeeToken(
            roomId,
            authUser?.name || 'Guest',
            authUser?.email || 'guest@conn3ct.com'
          );
        }
        const initialStatus = await service.connect(tokenToUse);
        if (!isMountedRef.current) return;

        // Try to get room name from the service after connect
        if ((service as any).roomName) setRoomName((service as any).roomName);

        if (initialStatus === 'active') {
          // Bypass lobby — user is host or waiting room is disabled
          handedOffRef.current = true;
          setActiveMeetingService(service);
          navigation.replace(meetingRoute as any, { roomId, meetingToken, micOn, cameraOn });
        } else if (initialStatus === 'waiting') {
          // Show lobby — wait for host to admit
          setStatus('waiting');
        }
      } catch (err: any) {
        if (!isMountedRef.current) return;
        const msg: string = err?.message || '';
        console.error('[LobbyScreen] Connection failed:', msg, err);
        const is404 = msg.includes('404');
        setErrorMsg(
          is404
            ? `Room "${roomId}" was not found.\n\nRoom IDs are case-sensitive — double-check the capitalisation.`
            : `Could not connect to the meeting. Check your internet connection and try again.\n\nDetails: ${msg || 'Unknown error'}`
        );
        setStatus('failed');
      }
    })();

    return () => {
      isMountedRef.current = false;
      // Only disconnect if we never handed the service off
      if (!handedOffRef.current && serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    };
  }, []);

  const handleLeave = useCallback(() => {
    if (!handedOffRef.current && serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace(homeRoute as any);
    }
  }, [navigation, homeRoute]);

  const handleRetry = useCallback(() => {
    navigation.replace(lobbyRoute as any, { roomId, meetingToken, micOn, cameraOn });
  }, [navigation, lobbyRoute, roomId, meetingToken, micOn, cameraOn]);

  // ── Status label helpers ────────────────────────────────────────────────────
  const isError = status === 'denied' || status === 'ended' || status === 'failed';
  const isWaiting = status === 'waiting';
  const isConnecting = status === 'connecting';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.pageBg} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerLeft}>
          <View style={styles.brandMark}>
            <Text style={styles.brandLetter}>K</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Meeting Lobby</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{roomName}</Text>
          </View>
        </View>
        {/* Status badge */}
        <View style={[
          styles.statusPill,
          isWaiting && styles.statusPillWaiting,
          isError && styles.statusPillError,
          status === 'active' && styles.statusPillActive,
        ]}>
          {isConnecting && <Wifi size={11} color={COLORS.textMuted} />}
          {isWaiting && <Clock size={11} color={COLORS.amber} />}
          {status === 'active' && <Wifi size={11} color={COLORS.brandGreen} />}
          {isError && <WifiOff size={11} color={COLORS.danger} />}
          <Text style={[
            styles.statusPillText,
            isWaiting && styles.statusPillTextWaiting,
            isError && styles.statusPillTextError,
            status === 'active' && styles.statusPillTextActive,
          ]}>
            {isConnecting ? 'Connecting…' : isWaiting ? 'Waiting' : status === 'active' ? 'Admitted' : 'Error'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 32, 48) }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Avatar card ── */}
          <View style={styles.avatarCard}>
            <LinearGradient
              colors={[COLORS.brandBlue, COLORS.brandBlueDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradientBg}
            >
              {/* Decorative blobs */}
              <View style={styles.blobTL} />
              <View style={styles.blobBR} />
            </LinearGradient>

            {/* Avatar circle */}
            <View style={styles.avatarCircleOuter}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            </View>

            <Text style={styles.avatarName}>{displayName}</Text>
            <Text style={styles.avatarSub}>You</Text>

            {/* Mic / Camera pills */}
            <View style={styles.mediaPills}>
              <View style={[styles.mediaPill, micOn ? styles.mediaPillOn : styles.mediaPillOff]}>
                {micOn
                  ? <Mic size={13} color={COLORS.brandGreen} />
                  : <MicOff size={13} color={COLORS.danger} />}
                <Text style={[styles.mediaPillText, micOn ? styles.mediaPillTextOn : styles.mediaPillTextOff]}>
                  {micOn ? 'Mic On' : 'Muted'}
                </Text>
              </View>
              <View style={[styles.mediaPill, cameraOn ? styles.mediaPillOn : styles.mediaPillOff]}>
                {cameraOn
                  ? <Video size={13} color={COLORS.brandGreen} />
                  : <VideoOff size={13} color={COLORS.danger} />}
                <Text style={[styles.mediaPillText, cameraOn ? styles.mediaPillTextOn : styles.mediaPillTextOff]}>
                  {cameraOn ? 'Camera On' : 'Camera Off'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Status card ── */}
          <View style={styles.statusCard}>
            {/* Connecting */}
            {isConnecting && (
              <View style={styles.statusInner}>
                <View style={[styles.statusIconBox, { backgroundColor: COLORS.borderLight }]}>
                  <Wifi size={24} color={COLORS.textMuted} />
                </View>
                <Text style={styles.statusTitle}>Connecting to lobby…</Text>
                <Text style={styles.statusDesc}>Please wait while we connect you to the meeting.</Text>
                <View style={styles.dotsRow}>
                  <BounceDot delay={0} color={COLORS.brandBlue} />
                  <BounceDot delay={160} color={COLORS.brandBlue} />
                  <BounceDot delay={320} color={COLORS.brandBlue} />
                </View>
              </View>
            )}

            {/* Waiting */}
            {isWaiting && (
              <View style={styles.statusInner}>
                <View style={[styles.statusIconBox, { backgroundColor: COLORS.amberLight }]}>
                  <Shield size={24} color={COLORS.amber} />
                </View>
                <Text style={styles.statusTitle}>Waiting for the host</Text>
                <Text style={styles.statusDesc}>
                  You'll join automatically as soon as the host admits you.
                </Text>

                {/* Elapsed timer */}
                <View style={styles.timerRow}>
                  <Clock size={14} color={COLORS.textMuted} />
                  <Text style={styles.timerLabel}>Waiting</Text>
                  <Text style={styles.timerValue}>{elapsed}</Text>
                </View>

                {/* Dots */}
                <View style={styles.dotsRow}>
                  <BounceDot delay={0} color={COLORS.brandGreen} />
                  <BounceDot delay={160} color={COLORS.brandGreen} />
                  <BounceDot delay={320} color={COLORS.brandGreen} />
                </View>
              </View>
            )}

            {/* Admitted */}
            {status === 'active' && (
              <View style={styles.statusInner}>
                <View style={[styles.statusIconBox, { backgroundColor: COLORS.brandGreenLight }]}>
                  <Users size={24} color={COLORS.brandGreen} />
                </View>
                <Text style={[styles.statusTitle, { color: COLORS.brandGreen }]}>Admitted!</Text>
                <Text style={styles.statusDesc}>Joining the meeting now…</Text>
                <View style={styles.dotsRow}>
                  <BounceDot delay={0} color={COLORS.brandGreen} />
                  <BounceDot delay={160} color={COLORS.brandGreen} />
                  <BounceDot delay={320} color={COLORS.brandGreen} />
                </View>
              </View>
            )}

            {/* Error / Denied / Ended */}
            {isError && (
              <View style={styles.statusInner}>
                <View style={[styles.statusIconBox, { backgroundColor: COLORS.dangerLight }]}>
                  <WifiOff size={24} color={COLORS.danger} />
                </View>
                <Text style={[styles.statusTitle, { color: COLORS.danger }]}>
                  {status === 'denied' ? 'Entry Denied' : status === 'ended' ? 'Meeting Ended' : 'Connection Failed'}
                </Text>
                <Text style={styles.statusDesc}>{errorMsg}</Text>

                {/* Actions */}
                {status === 'failed' && (
                  <View style={styles.errorBtnRow}>
                    <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
                      <RefreshCw size={15} color="#fff" />
                      <Text style={styles.retryBtnText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.backBtn} onPress={handleLeave} activeOpacity={0.85}>
                      <Text style={styles.backBtnText}>Go Back</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {(status === 'denied' || status === 'ended') && (
                  <TouchableOpacity style={styles.dashBtn} onPress={handleLeave} activeOpacity={0.85}>
                    <Text style={styles.dashBtnText}>Return to Dashboard</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* ── Info strip ── */}
          {(isConnecting || isWaiting) && (
            <View style={styles.infoStrip}>
              <Shield size={14} color={COLORS.textMuted} />
              <Text style={styles.infoStripText}>
                Your connection is secured. The host will be notified you're waiting.
              </Text>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* ── Bottom leave button ── */}
      {(isConnecting || isWaiting) && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity 
            style={styles.leaveBtn} 
            onPress={handleLeave} 
            activeOpacity={0.85}
            testID="leave-lobby-btn"
          >
            <PhoneOff size={16} color={COLORS.danger} />
            <Text style={styles.leaveBtnText}>Leave Lobby</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${COLORS.brandBlue}12`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.brandBlue}20`,
  },
  brandLetter: {
    color: COLORS.brandBlue,
    fontSize: 18,
    fontWeight: '900',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
    maxWidth: 180,
  },

  // Status pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusPillWaiting: {
    backgroundColor: COLORS.amberLight,
    borderColor: 'rgba(217,119,6,0.20)',
  },
  statusPillError: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.dangerBorder,
  },
  statusPillActive: {
    backgroundColor: COLORS.brandGreenLight,
    borderColor: COLORS.brandGreenBorder,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  statusPillTextWaiting: { color: COLORS.amber },
  statusPillTextError: { color: COLORS.danger },
  statusPillTextActive: { color: COLORS.brandGreen },

  // Scroll
  scrollContent: {
    padding: 20,
    gap: 16,
  },

  // Avatar card
  avatarCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'center',
    paddingBottom: 24,
  },
  avatarGradientBg: {
    width: '100%',
    height: 100,
    position: 'relative',
    overflow: 'hidden',
  },
  blobTL: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  blobBR: {
    position: 'absolute',
    bottom: -30,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(32,116,80,0.20)',
  },
  avatarCircleOuter: {
    marginTop: -36,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: COLORS.brandBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  avatarName: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  avatarSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 16,
    fontWeight: '500',
  },
  mediaPills: {
    flexDirection: 'row',
    gap: 8,
  },
  mediaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  mediaPillOn: {
    backgroundColor: COLORS.brandGreenLight,
    borderColor: COLORS.brandGreenBorder,
  },
  mediaPillOff: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.dangerBorder,
  },
  mediaPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaPillTextOn: { color: COLORS.brandGreen },
  mediaPillTextOff: { color: COLORS.danger },

  // Status card
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  statusInner: {
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  statusIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  statusDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    height: 24,
    alignItems: 'center',
  },

  // Timer
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  timerValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.brandGreen,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },

  // Error buttons
  errorBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  retryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.brandGreen,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  backBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  dashBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  dashBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  // Info strip
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  infoStripText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  leaveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
});
