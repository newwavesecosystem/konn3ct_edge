import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Platform, Dimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LogIn, Users } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { APP_CONFIG, APP_LOGO } from '../config/appConfig';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#ffffff',
  brandGreen: '#207450',
  brandGreenLight: '#f0fdf4',
  brandGreenBorder: '#86efac',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#a0a0a0',
  white: '#ffffff',
  guestBg: '#f8fafc',
  guestBorder: '#e2e8f0',
};

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.pageContainer, { paddingBottom: insets.bottom }]}>
      {/* Green wave header — same as LoginScreen */}
      <View style={styles.svgContainer}>
        <Svg width={width} height={280} viewBox={`0 0 ${width} 280`}>
          <Path
            fill={COLORS.brandGreen}
            d={`M0,0 L${width},0 L${width},180 C${width * 0.75},280 ${width * 0.25},120 0,220 Z`}
          />
        </Svg>
      </View>

      {/* Fixed header — logo + welcome text */}
      <View style={[styles.fixedHeader, { paddingTop: Platform.OS === 'ios' ? insets.top + 10 : 30 }]}>
        <View style={styles.logoContainer}>
          <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.titleSection, { opacity: fadeAnim }]}>
          <Text style={styles.welcomeTitle}>Welcome</Text>
          <View style={styles.titleUnderline} />
          <Text style={styles.welcomeSubtitle}>
            Sign in to your account or join a meeting without one
          </Text>
        </Animated.View>
      </View>

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Sign In button */}
        <TouchableOpacity
          style={styles.signInBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Login')}
          testID="welcome-signin-button"
        >
          <View style={styles.btnIconCircle}>
            <LogIn size={20} color={COLORS.white} strokeWidth={2.5} />
          </View>
          <View style={styles.btnTextGroup}>
            <Text style={styles.signInBtnTitle}>Sign In</Text>
            <Text style={styles.signInBtnSub}>Access your account & rooms</Text>
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Join as Guest button */}
        <TouchableOpacity
          style={styles.guestBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('GuestJoin')}
          testID="welcome-guest-button"
        >
          <View style={[styles.btnIconCircle, styles.guestIconCircle]}>
            <Users size={20} color={COLORS.brandGreen} strokeWidth={2.5} />
          </View>
          <View style={styles.btnTextGroup}>
            <Text style={styles.guestBtnTitle}>Join as Guest</Text>
            <Text style={styles.guestBtnSub}>No account needed — just enter a room ID</Text>
          </View>
        </TouchableOpacity>

        {/* Footer note */}
        {APP_CONFIG.SHOW_SIGNUP_LINK && (
          <Text style={styles.footerNote}>
            New here?{' '}
            <Text
              style={styles.footerLink}
              onPress={() => navigation.navigate('Signup')}
            >
              Create an account
            </Text>
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
    justifyContent: 'center',
  },
  svgContainer: {
    position: 'absolute',
    top: 0, width: '100%', height: 280,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 30,
    zIndex: 10,
    alignItems: 'center',
  },
  logoContainer: { alignItems: 'center', marginTop: 10, marginBottom: 4 },
  logo: { height: 50, width: 180 },

  titleSection: { alignItems: 'center', marginBottom: 8 },
  welcomeTitle: {
    fontSize: 30, fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  titleUnderline: {
    width: 35, height: 4,
    backgroundColor: COLORS.white,
    borderRadius: 2,
    marginTop: 6, marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },

  card: {
    marginHorizontal: 20,
    marginTop: 240,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },

  // Sign In button
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brandGreen,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  btnIconCircle: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  btnTextGroup: { flex: 1 },
  signInBtnTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  signInBtnSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1, height: 1,
    backgroundColor: COLORS.guestBorder,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginHorizontal: 12,
    fontWeight: '500',
  },

  // Guest button
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.guestBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.guestBorder,
    marginBottom: 4,
  },
  guestIconCircle: {
    backgroundColor: COLORS.brandGreenLight,
  },
  guestBtnTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  guestBtnSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },

  // Footer
  footerNote: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 20,
    paddingBottom: 4,
  },
  footerLink: {
    color: COLORS.brandGreen,
    fontWeight: '700',
  },
});
