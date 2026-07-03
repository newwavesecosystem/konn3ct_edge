import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Image,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuthStore } from '../store/useAuthStore';
import { apiClient, IS_DEV } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Fingerprint, Eye, EyeOff, Mail, Lock, Square, CheckSquare, Building2 } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { APP_CONFIG, APP_LOGO } from '../config/appConfig';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#ffffff',
  brandBlue: '#012E89',
  brandBlueDark: '#001D5C',
  brandGreen: '#207450',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#a0a0a0',
  inputBorder: '#e6e6e6',
  inputFocus: '#207450',
  dangerBg: '#fef2f2',
  danger: '#cc505c',
  successBg: '#f0fdf4',
  success: '#207450',
  white: '#ffffff',
};

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();

  // Standard fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mda, setMda] = useState(''); // MDA = tenantId (gov1 only)

  // 2FA state (gov1 only)
  const [twoFAPending, setTwoFAPending] = useState(false);
  const [twoFAMedium, setTwoFAMedium] = useState('EMAIL');
  const [otpCode, setOtpCode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [mdaFocused, setMdaFocused] = useState(false);

  const { login } = useAuthStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (route.params?.successMessage) {
      setError('');
      setSuccess(route.params.successMessage);
      navigation.setParams({ successMessage: undefined });
    }
  }, [route.params?.successMessage]);

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('@konn3ct_email');
        if (savedEmail) { setEmail(savedEmail); setRememberMe(true); }

        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricSupported(compatible && enrolled);

        const savedToken = await SecureStore.getItemAsync('konn3ct_token');
        if (savedToken) setHasSavedCredentials(true);
      } catch (e) {
        console.error('Init error:', e);
      }
    };
    initApp();
  }, []);

  // ── Finalise login after receiving token ─────────────────────────────────────
  const finaliseLogin = async (token: string, userData: any) => {
    const userObj = {
      id: userData?.id || 'unknown-id',
      email: userData?.email || email,
      name: userData?.firstname
        ? `${userData.firstname} ${userData.lastname || ''}`.trim()
        : email.split('@')[0],
      role: userData?.roles?.[0]?.name || userData?.role || undefined,
      ...userData,
    };

    if (rememberMe) {
      await AsyncStorage.setItem('@konn3ct_email', email);
    } else {
      await AsyncStorage.removeItem('@konn3ct_email');
    }

    await SecureStore.setItemAsync('konn3ct_token', token);
    await SecureStore.setItemAsync('konn3ct_user', JSON.stringify(userObj));
    login(userObj, token);
  };

  // ── Standard konn3ct login ───────────────────────────────────────────────────
  const handleKonn3ctLogin = async () => {
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const endpoint = IS_DEV ? '/login' : '/auth/login';
      const payload = IS_DEV ? { username: email, password } : { email, password };
      const response = await apiClient.post(endpoint, payload);
      const resData = response.data;
      const isSuccess = IS_DEV
        ? (resData?.success && resData?.token)
        : (resData?.token);

      if (isSuccess) {
        const userData = IS_DEV ? (resData.data || {}) : (resData.user || {});
        await finaliseLogin(resData.token, userData);
      } else {
        setError(resData?.message || 'Login failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── 1Gov login (step 1) ──────────────────────────────────────────────────────
  const handleGovLogin = async () => {
    if (!mda || !email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const response = await apiClient.post('/1gov/login', {
        tenantId: mda.trim(),
        username: email,
        password,
      });
      const resData = response.data;

      if (!resData?.success) {
        setError(resData?.message || 'Login failed. Please check your credentials.');
        return;
      }

      // 2FA required
      if (resData.twoFactorAuth) {
        setTwoFAMedium(resData.twoFactorMedium || 'EMAIL');
        setTwoFAPending(true);
        setSuccess(`A verification code has been sent to your ${resData.twoFactorMedium || 'email'}.`);
        return;
      }

      // No 2FA — login directly
      if (resData.token) {
        await finaliseLogin(resData.token, resData.data);
      } else {
        setError('Login failed. No token received.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── 1Gov 2FA verification (step 2) ──────────────────────────────────────────
  const handleGovTwoFactor = async () => {
    if (!otpCode || otpCode.length < 4) { setError('Please enter the verification code.'); return; }
    setTwoFALoading(true); setError(''); setSuccess('');
    try {
      const response = await apiClient.post('/1gov/login/2fa', {
        tenantId: mda.trim(),
        username: email,
        otpCode,
        authType: twoFAMedium,
      });
      const resData = response.data;
      if (resData?.success && resData?.token) {
        await finaliseLogin(resData.token, resData.data);
      } else {
        setError(resData?.message || 'Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Verification failed.');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleLogin = APP_CONFIG.GOV_LOGIN ? handleGovLogin : handleKonn3ctLogin;

  // ── Biometric ────────────────────────────────────────────────────────────────
  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Login to ${APP_CONFIG.APP_NAME}`,
        fallbackLabel: 'Use Password',
      });
      if (result.success) {
        const savedToken = await SecureStore.getItemAsync('konn3ct_token');
        const savedUserStr = await SecureStore.getItemAsync('konn3ct_user');
        if (savedToken && savedUserStr) {
          login(JSON.parse(savedUserStr), savedToken);
        } else {
          Alert.alert('Error', 'No saved credentials found. Please login with password first.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Biometric authentication failed.');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.pageContainer}>
      {/* Green Wave Header */}
      <View style={styles.svgContainer}>
        <Svg width={width} height={280} viewBox={`0 0 ${width} 280`}>
          <Path
            fill={COLORS.brandGreen}
            d={`M0,0 L${width},0 L${width},180 C${width * 0.75},280 ${width * 0.25},120 0,220 Z`}
          />
        </Svg>
      </View>

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.logoContainer}>
          <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Animated.View style={[styles.titleSection, { opacity: fadeAnim }]}>
          <Text style={[styles.title, { color: COLORS.white }]}>Sign in</Text>
          <View style={[styles.titleUnderline, { backgroundColor: COLORS.white }]} />
        </Animated.View>
      </View>

      <KeyboardAwareScrollView
        style={[styles.scrollView, { marginBottom: insets.bottom }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        scrollEnabled={true}
        extraScrollHeight={Platform.OS === 'ios' ? 60 : 80}
      >
        <Animated.View
          style={[styles.formCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Success */}
          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          {/* ── 2FA Pending (gov1 only) ── */}
          {twoFAPending ? (
            <>
              <Text style={styles.twoFAHint}>
                Enter the code sent to your {twoFAMedium.toLowerCase()}.
              </Text>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Verification Code</Text>
                <View style={[styles.inputWrapper, otpFocused && styles.inputWrapperFocused]}>
                  <TextInput
                    style={[styles.input, { textAlign: 'center', letterSpacing: 6, fontSize: 20 }]}
                    placeholder="------"
                    placeholderTextColor={COLORS.textMuted}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={8}
                    onFocus={() => setOtpFocused(true)}
                    onBlur={() => setOtpFocused(false)}
                    autoFocus
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, twoFALoading && styles.loginButtonDisabled]}
                onPress={handleGovTwoFactor}
                disabled={twoFALoading}
                activeOpacity={0.85}
              >
                {twoFALoading ? <ActivityIndicator color={COLORS.white} style={styles.spinner} /> : null}
                <Text style={styles.loginButtonText}>
                  {twoFALoading ? 'Verifying...' : 'Verify Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backToLoginBtn}
                onPress={() => { setTwoFAPending(false); setOtpCode(''); setError(''); setSuccess(''); }}
              >
                <Text style={styles.backToLoginText}>← Back to Login</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* ── MDA Field (gov1 only) ── */}
              {APP_CONFIG.GOV_LOGIN && (
                <View style={styles.fieldContainer}>
                  <Text style={styles.label}>MDA</Text>
                  <View style={[styles.inputWrapper, mdaFocused && styles.inputWrapperFocused]}>
                    <Building2
                      color={mdaFocused ? COLORS.inputFocus : COLORS.textMuted}
                      size={18}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your MDA"
                      placeholderTextColor={COLORS.textMuted}
                      value={mda}
                      onChangeText={setMda}
                      autoCapitalize="none"
                      onFocus={() => setMdaFocused(true)}
                      onBlur={() => setMdaFocused(false)}
                    />
                  </View>
                </View>
              )}

              {/* ── Email / Username Field ── */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>{APP_CONFIG.GOV_LOGIN ? 'Username / Email' : 'Email'}</Text>
                <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
                  <Mail
                    color={emailFocused ? COLORS.inputFocus : COLORS.textMuted}
                    size={18}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={APP_CONFIG.GOV_LOGIN ? 'your@email.com' : 'demo@email.com'}
                    placeholderTextColor={COLORS.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                  />
                </View>
              </View>

              {/* ── Password Field ── */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
                  <Lock
                    color={passwordFocused ? COLORS.inputFocus : COLORS.textMuted}
                    size={18}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="enter your password"
                    placeholderTextColor={COLORS.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    {showPassword
                      ? <EyeOff color={COLORS.textMuted} size={18} />
                      : <Eye color={COLORS.textMuted} size={18} />}
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Options Row (Remember Me + Forgot Password) ── */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberBtn}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  {rememberMe
                    ? <CheckSquare color={COLORS.brandGreen} size={18} />
                    : <Square color={COLORS.textMuted} size={18} />}
                  <Text style={styles.rememberText}>Remember Me</Text>
                </TouchableOpacity>

                {APP_CONFIG.SHOW_FORGOT_PASSWORD && (
                  <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Login Button ── */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color={COLORS.white} style={styles.spinner} /> : null}
                <Text style={styles.loginButtonText}>
                  {loading ? 'Signing in...' : 'Login'}
                </Text>
              </TouchableOpacity>

              {/* ── Biometric ── */}
              {isBiometricSupported && hasSavedCredentials && (
                <TouchableOpacity
                  style={styles.biometricButton}
                  onPress={handleBiometricLogin}
                  activeOpacity={0.8}
                >
                  <Fingerprint color={COLORS.brandGreen} size={20} style={{ marginRight: 8 }} />
                  <Text style={styles.biometricButtonText}>Login with Biometrics</Text>
                </TouchableOpacity>
              )}

              {/* ── Sign Up Link ── */}
              {APP_CONFIG.SHOW_SIGNUP_LINK && (
                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>Don't have an Account? </Text>
                  <TouchableOpacity
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => navigation.navigate('Signup')}
                  >
                    <Text style={styles.signUpText}>Sign up</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: { flex: 1, backgroundColor: COLORS.pageBg },
  svgContainer: { position: 'absolute', top: 0, width: '100%', height: 280 },
  scrollView: { flex: 1 },
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
  logo: { height: 50, width: 180 },
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
  titleSection: { marginBottom: 16, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  titleUnderline: { width: 35, height: 4, backgroundColor: COLORS.brandGreen, borderRadius: 2 },
  errorBox: {
    backgroundColor: COLORS.dangerBg,
    padding: 12, borderRadius: 8, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: COLORS.danger,
  },
  errorText: { color: COLORS.danger, fontSize: 13 },
  successBox: {
    backgroundColor: COLORS.successBg,
    padding: 12, borderRadius: 8, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: COLORS.success,
  },
  successText: { color: COLORS.success, fontSize: 13 },
  twoFAHint: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', marginBottom: 20, lineHeight: 20,
  },
  fieldContainer: { marginBottom: 24 },
  label: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 13, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1.5, borderBottomColor: COLORS.inputBorder,
    paddingVertical: 8,
  },
  inputWrapperFocused: { borderBottomColor: COLORS.inputFocus },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 4 },
  eyeButton: { padding: 4 },
  optionsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 25,
  },
  rememberBtn: { flexDirection: 'row', alignItems: 'center' },
  rememberText: { marginLeft: 8, fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  forgotText: { fontSize: 13, color: COLORS.brandGreen, fontWeight: '700' },
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
  loginButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  spinner: { marginRight: 10 },
  biometricButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 12, borderWidth: 1.5,
    borderColor: COLORS.inputBorder, backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  biometricButtonText: { color: COLORS.brandGreen, fontWeight: '700', fontSize: 15 },
  footerRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 8, paddingTop: 10, paddingBottom: 16,
  },
  footerText: { color: COLORS.textMuted, fontSize: 14 },
  signUpText: { color: COLORS.brandGreen, fontWeight: '700', fontSize: 14 },
  backToLoginBtn: { alignItems: 'center', paddingVertical: 12 },
  backToLoginText: { color: COLORS.brandGreen, fontWeight: '600', fontSize: 14 },
});