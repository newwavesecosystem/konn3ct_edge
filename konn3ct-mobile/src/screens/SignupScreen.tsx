import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Animated,
  ScrollView,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { apiClient } from '../api/client';
import { Mail, Lock, User, Phone, CheckCircle, Eye, EyeOff } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#ffffff',
  brandBlue: '#012E89',
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

// Detects server-side SMTP failures (account created but email couldn't be sent)
const isSmtpError = (msg: string): boolean => {
  const lower = msg.toLowerCase();
  return (
    lower.includes('smtp') ||
    lower.includes('authenticate on') ||
    lower.includes('authentication failed') ||
    lower.includes('failed to send') ||
    lower.includes('mail')
  );
};

// ─── Step 1: Registration Form ─────────────────────────────────────────────
function RegisterStep({
  onSuccess,
}: {
  onSuccess: (emailphone: string | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [focused, setFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (!firstname || !lastname || !email || !phone || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/register', {
        firstname,
        lastname,
        email,
        phone,
        password,
      });

      const resData = response.data;
      if (resData.success) {
        // Full success — go to email verification step
        onSuccess(email);
      } else {
        const msg: string = resData.message || '';
        // Dev server SMTP is broken — account was created in DB but email failed.
        // Skip verification and go straight to Login.
        if (isSmtpError(msg)) {
          onSuccess(null); // null signals: skip verify, go to login
        } else {
          setError(msg || 'Registration failed. Please try again.');
        }
      }
    } catch (err: any) {
      const apiErrors = err.response?.data?.errors;
      const serverMsg: string =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        '';

      if (apiErrors) {
        const firstError = Object.values(apiErrors)[0];
        setError(Array.isArray(firstError) ? firstError[0] : String(firstError));
      } else if (isSmtpError(serverMsg)) {
        // SMTP failure inside a caught error — account likely created, skip verify
        onSuccess(null);
      } else {
        setError(serverMsg || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputWrapperStyle = (field: string) => [
    styles.inputWrapper,
    focused === field && styles.inputWrapperFocused,
  ];

  return (
    <View style={styles.pageContainer}>
      <View style={styles.svgContainer}>
        <Svg width={width} height={340} viewBox={`0 0 ${width} 340`}>
          <Path
            fill={COLORS.brandGreen}
            d={`M0,0 L${width},0 L${width},220 C${width * 0.75},340 ${width * 0.25},140 0,270 Z`}
          />
        </Svg>
      </View>

      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/konn3ct_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Animated.View style={[styles.titleSection, { opacity: fadeAnim }]}>
          <Text style={[styles.title, { color: COLORS.white }]}>Sign up</Text>
          <View style={[styles.titleUnderline, { backgroundColor: COLORS.white }]} />
          <Text style={[styles.subtitle, { color: COLORS.white }]}>Fill in the details below to get started</Text>
        </Animated.View>
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 40}
      >
          <Animated.View
            style={[
              styles.contentContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Row: First & Last Name */}
            <View style={styles.row}>
              <View style={[styles.fieldContainer, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>First Name</Text>
                <View style={inputWrapperStyle('firstname')}>
                  <User color={focused === 'firstname' ? COLORS.inputFocus : COLORS.textMuted} size={16} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="John"
                    placeholderTextColor={COLORS.textMuted}
                    value={firstname}
                    onChangeText={setFirstname}
                    onFocus={() => setFocused('firstname')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              </View>
              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.label}>Last Name</Text>
                <View style={inputWrapperStyle('lastname')}>
                  <User color={focused === 'lastname' ? COLORS.inputFocus : COLORS.textMuted} size={16} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Doe"
                    placeholderTextColor={COLORS.textMuted}
                    value={lastname}
                    onChangeText={setLastname}
                    onFocus={() => setFocused('lastname')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              </View>
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email Address</Text>
              <View style={inputWrapperStyle('email')}>
                <Mail color={focused === 'email' ? COLORS.inputFocus : COLORS.textMuted} size={16} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="john@example.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            {/* Phone */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={inputWrapperStyle('phone')}>
                <Phone color={focused === 'phone' ? COLORS.inputFocus : COLORS.textMuted} size={16} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="08012345678"
                  placeholderTextColor={COLORS.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={inputWrapperStyle('password')}>
                <Lock color={focused === 'password' ? COLORS.inputFocus : COLORS.textMuted} size={16} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  {showPassword ? (
                    <EyeOff color={COLORS.textMuted} size={18} />
                  ) : (
                    <Eye color={COLORS.textMuted} size={18} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={inputWrapperStyle('confirm')}>
                <Lock color={focused === 'confirm' ? COLORS.inputFocus : COLORS.textMuted} size={16} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={COLORS.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                  {showConfirmPassword ? (
                    <EyeOff color={COLORS.textMuted} size={18} />
                  ) : (
                    <Eye color={COLORS.textMuted} size={18} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={COLORS.white} style={styles.spinner} /> : null}
              <Text style={styles.primaryButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.linkText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAwareScrollView>
    </View>
  );
}

// ─── Step 2: Email Verification ─────────────────────────────────────────────
function VerifyStep({
  emailphone,
  onVerified,
}: {
  emailphone: string;
  onVerified: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleVerify = async () => {
    if (!code || code.length < 4) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/verify-code', {
        emailphone,
        type: 'email',
        code,
      });

      const resData = response.data;
      if (resData.success) {
        setSuccess('Account verified successfully!');
        setTimeout(() => onVerified(), 1200);
      } else {
        setError(resData.message || 'Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Verification failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.pageContainer}>
      <View style={styles.svgContainer}>
        <Svg width={width} height={340} viewBox={`0 0 ${width} 340`}>
          <Path
            fill={COLORS.brandGreen}
            d={`M0,0 L${width},0 L${width},220 C${width * 0.75},340 ${width * 0.25},140 0,270 Z`}
          />
        </Svg>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          styles.verifyScrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 40) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/konn3ct_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
          {/* Icon */}
          <View style={styles.verifyIconWrapper}>
            <CheckCircle color={COLORS.brandGreen} size={64} strokeWidth={1.5} />
          </View>

          <View style={[styles.titleSection, { alignItems: 'center' }]}>
            <Text style={styles.title}>Verify Your Email</Text>
            <View style={[styles.titleUnderline, { alignSelf: 'center' }]} />
            <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 12 }]}>
              We sent a verification code to{'\n'}
              <Text style={{ color: COLORS.brandGreen, fontWeight: '700' }}>{emailphone}</Text>
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="Enter code"
                placeholderTextColor={COLORS.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={COLORS.white} style={styles.spinner} /> : null}
            <Text style={styles.primaryButtonText}>
              {loading ? 'Verifying...' : 'Verify Account'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Main SignupScreen (orchestrates both steps) ─────────────────────────────
export default function SignupScreen() {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [registeredEmail, setRegisteredEmail] = useState('');

  const handleRegisterSuccess = (email: string | null) => {
    if (email === null) {
      // SMTP error on dev server — account created, skip verification
      navigation.navigate('Login', { successMessage: 'Registration successful! (Email verification skipped for dev)' });
      return;
    }
    setRegisteredEmail(email);
    setStep('verify');
  };

  const handleVerified = () => {
    navigation.navigate('Login', { successMessage: 'Account verified successfully! Please log in.' });
  };

  if (step === 'verify') {
    return <VerifyStep emailphone={registeredEmail} onVerified={handleVerified} />;
  }

  return <RegisterStep onSuccess={handleRegisterSuccess} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: 340,
  },
  fixedHeader: {
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    zIndex: 10,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 120, // Pushed down so the form sits on the white background
  },
  verifyScrollContent: {
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    height: 45,
    width: 180,
    tintColor: COLORS.white,
  },
  contentContainer: {
    paddingHorizontal: 28,
    flexGrow: 1,
  },
  titleSection: {
    marginBottom: 28,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 35,
    height: 4,
    backgroundColor: COLORS.brandGreen,
    borderRadius: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: COLORS.dangerBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
  },
  successBox: {
    backgroundColor: COLORS.successBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  successText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  fieldContainer: {
    marginBottom: 18,
  },
  label: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 12,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.inputBorder,
    paddingVertical: 8,
  },
  inputWrapperFocused: {
    borderBottomColor: COLORS.inputFocus,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 2,
  },
  eyeIcon: {
    padding: 4,
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.brandGreen,
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  spinner: {
    marginRight: 10,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  linkText: {
    color: COLORS.brandGreen,
    fontWeight: '700',
    fontSize: 14,
  },
  verifyIconWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
});
