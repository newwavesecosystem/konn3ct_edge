import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated,
  Platform, Dimensions, Image,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { User, Hash, Mic, MicOff, Video, VideoOff } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { validateMeetingKv4 } from '../api/rooms';
import { getAttendeeToken } from '../api/edgeApi';
import { APP_CONFIG, APP_LOGO } from '../config/appConfig';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#ffffff',
  brandGreen: '#207450',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#a0a0a0',
  inputBorder: '#e6e6e6',
  inputFocus: '#207450',
  dangerBg: '#fef2f2',
  danger: '#cc505c',
  offBg: '#fff4f4',
  onBg: '#f0fdf4',
  white: '#ffffff',
};

export default function GuestJoinScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [guestName, setGuestName] = useState('');
  const [roomId, setRoomId]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [micOn, setMicOn]         = useState(true);
  const [cameraOn, setCameraOn]   = useState(true);

  const [nameFocused, setNameFocused] = useState(false);
  const [roomFocused, setRoomFocused] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleJoin = async () => {
    setError('');
    const name = guestName.trim();
    const room = roomId.trim();

    if (!name) { setError('Please enter your display name.'); return; }
    if (!room)  { setError('Please enter the Room ID.');       return; }

    setLoading(true);
    try {
      // 1. Validate the room exists
      const validation = await validateMeetingKv4(room);
      if (!validation?.success) {
        setError('Room not found. Please check the Room ID and try again.');
        setLoading(false);
        return;
      }

      // 2. Obtain a WebSocket meeting token via the guest pre-join flow
      const meetingToken = await getAttendeeToken(
        room,
        name,
        `guest-${Date.now()}@konn3ct.guest`,
      );

      // 3. Navigate with the user's chosen mic/camera preferences
      navigation.navigate('GuestMeeting', {
        roomId: room,
        meetingToken,
        guestName: name,
        micOn,
        cameraOn,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to join. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.pageContainer}>
      {/* Green wave header — identical to LoginScreen */}
      <View style={styles.svgContainer}>
        <Svg width={width} height={280} viewBox={`0 0 ${width} 280`}>
          <Path
            fill={COLORS.brandGreen}
            d={`M0,0 L${width},0 L${width},180 C${width * 0.75},280 ${width * 0.25},120 0,220 Z`}
          />
        </Svg>
      </View>

      {/* Fixed top header with logo + title */}
      <View style={styles.fixedHeader}>
        <View style={styles.logoContainer}>
          <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.titleSection, { opacity: fadeAnim }]}>
          <Text style={[styles.title, { color: COLORS.white }]}>Join as Guest</Text>
          <View style={[styles.titleUnderline, { backgroundColor: COLORS.white }]} />
        </Animated.View>
      </View>

      <KeyboardAwareScrollView
        style={[styles.scrollView, { marginBottom: insets.bottom }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        scrollEnabled
        extraScrollHeight={Platform.OS === 'ios' ? 60 : 80}
      >
        <Animated.View
          style={[styles.formCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Error banner */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* ── Name field ── */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Your Name</Text>
            <View style={[styles.inputWrapper, nameFocused && styles.inputWrapperFocused]}>
              <User
                color={nameFocused ? COLORS.inputFocus : COLORS.textMuted}
                size={18}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. John Doe"
                placeholderTextColor={COLORS.textMuted}
                value={guestName}
                onChangeText={setGuestName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                returnKeyType="next"
                autoCorrect={false}
                testID="guest-name-input"
              />
            </View>
          </View>

          {/* ── Room ID field ── */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Room ID</Text>
            <View style={[styles.inputWrapper, roomFocused && styles.inputWrapperFocused]}>
              <Hash
                color={roomFocused ? COLORS.inputFocus : COLORS.textMuted}
                size={18}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. OdeS032a9"
                placeholderTextColor={COLORS.textMuted}
                value={roomId}
                onChangeText={setRoomId}
                onFocus={() => setRoomFocused(true)}
                onBlur={() => setRoomFocused(false)}
                returnKeyType="go"
                onSubmitEditing={handleJoin}
                autoCapitalize="none"
                autoCorrect={false}
                testID="room-id-input"
              />
            </View>
          </View>

          {/* ── Media preferences ── */}
          <Text style={styles.label}>Before you join</Text>
          <View style={styles.mediaRow}>
            {/* Mic toggle */}
            <TouchableOpacity
              style={[styles.mediaToggle, micOn ? styles.mediaToggleOn : styles.mediaToggleOff]}
              onPress={() => setMicOn(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.mediaIconCircle, micOn ? styles.mediaIconOn : styles.mediaIconOff]}>
                {micOn
                  ? <Mic size={20} color={COLORS.brandGreen} strokeWidth={2.2} />
                  : <MicOff size={20} color={COLORS.danger} strokeWidth={2.2} />}
              </View>
              <Text style={[styles.mediaToggleLabel, micOn ? styles.mediaToggleLabelOn : styles.mediaToggleLabelOff]}>
                {micOn ? 'Mic On' : 'Mic Off'}
              </Text>
              <Text style={styles.mediaToggleHint}>
                {micOn ? 'Tap to mute' : 'Tap to unmute'}
              </Text>
            </TouchableOpacity>

            {/* Camera toggle */}
            <TouchableOpacity
              style={[styles.mediaToggle, cameraOn ? styles.mediaToggleOn : styles.mediaToggleOff]}
              onPress={() => setCameraOn(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.mediaIconCircle, cameraOn ? styles.mediaIconOn : styles.mediaIconOff]}>
                {cameraOn
                  ? <Video size={20} color={COLORS.brandGreen} strokeWidth={2.2} />
                  : <VideoOff size={20} color={COLORS.danger} strokeWidth={2.2} />}
              </View>
              <Text style={[styles.mediaToggleLabel, cameraOn ? styles.mediaToggleLabelOn : styles.mediaToggleLabelOff]}>
                {cameraOn ? 'Camera On' : 'Camera Off'}
              </Text>
              <Text style={styles.mediaToggleHint}>
                {cameraOn ? 'Tap to turn off' : 'Tap to turn on'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Join button ── */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleJoin}
            disabled={loading}
            activeOpacity={0.85}
            testID="guest-join-button"
          >
            {loading ? <ActivityIndicator color={COLORS.white} style={styles.spinner} /> : null}
            <Text style={styles.loginButtonText}>
              {loading ? 'Joining...' : 'Join Meeting'}
            </Text>
          </TouchableOpacity>

          {/* ── Sign in link ── */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Have an account? </Text>
            <TouchableOpacity
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => navigation.navigate('Welcome')}
            >
              <Text style={styles.signUpText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer:  { flex: 1, backgroundColor: COLORS.pageBg },
  svgContainer:   { position: 'absolute', top: 0, width: '100%', height: 280 },
  scrollView:     { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 200,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 30,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    zIndex: 10,
  },
  logoContainer: { alignItems: 'center', marginTop: 10, marginBottom: 12 },
  logo:          { height: 50, width: 180 },
  titleSection:  { marginBottom: 16, alignItems: 'center' },
  title:         { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  titleUnderline:{ width: 35, height: 4, backgroundColor: COLORS.brandGreen, borderRadius: 2 },

  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },

  errorBox: {
    backgroundColor: COLORS.dangerBg,
    padding: 12, borderRadius: 8, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: COLORS.danger,
  },
  errorText: { color: COLORS.danger, fontSize: 13 },

  fieldContainer:      { marginBottom: 24 },
  label:               { color: COLORS.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1.5, borderBottomColor: COLORS.inputBorder,
    paddingVertical: 8,
  },
  inputWrapperFocused: { borderBottomColor: COLORS.inputFocus },
  inputIcon:           { marginRight: 12 },
  input:               { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 4 },

  // Media toggles
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    marginTop: 4,
  },
  mediaToggle: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  mediaToggleOn: {
    backgroundColor: COLORS.onBg,
    borderColor: '#86efac',
  },
  mediaToggleOff: {
    backgroundColor: COLORS.offBg,
    borderColor: '#fca5a5',
  },
  mediaIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  mediaIconOn:  { backgroundColor: 'rgba(32,116,80,0.1)' },
  mediaIconOff: { backgroundColor: 'rgba(204,80,92,0.1)' },
  mediaToggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  mediaToggleLabelOn:  { color: COLORS.brandGreen },
  mediaToggleLabelOff: { color: COLORS.danger },
  mediaToggleHint: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  loginButton: {
    backgroundColor: COLORS.brandGreen,
    borderRadius: 12, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 5, marginBottom: 16,
  },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText:     { color: COLORS.white, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  spinner:             { marginRight: 10 },

  footerRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 8, paddingTop: 10, paddingBottom: 16,
  },
  footerText: { color: COLORS.textMuted, fontSize: 14 },
  signUpText: { color: COLORS.brandGreen, fontWeight: '700', fontSize: 14 },
});
