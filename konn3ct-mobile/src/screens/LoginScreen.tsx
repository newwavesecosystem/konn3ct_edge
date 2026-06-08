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
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { apiClient } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Fingerprint, Eye, EyeOff, Mail, Lock, Square, CheckSquare } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

// Brand colors
const COLORS = {
  pageBg: '#ffffff',
  brandBlue: '#012E89',
  brandBlueDark: '#001D5C',
  brandGreen: '#207450',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#a0a0a0',
  inputBorder: '#e6e6e6',
  inputFocus: '#207450', // Changed to brandGreen
  dangerBg: '#fef2f2',
  danger: '#cc505c',
  white: '#ffffff',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const { login } = useAuthStore();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('@konn3ct_email');
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }

        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricSupported(compatible && enrolled);

        const savedToken = await SecureStore.getItemAsync('konn3ct_token');
        if (savedToken) {
          setHasSavedCredentials(true);
        }
      } catch (e) {
        console.error('Init error:', e);
      }
    };
    initApp();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      
      if (response.data && response.data.token) {
        if (rememberMe) {
          await AsyncStorage.setItem('@konn3ct_email', email);
        } else {
          await AsyncStorage.removeItem('@konn3ct_email');
        }
        
        const userObj = response.data.user || {
          id: 'unknown-id',
          email: email,
          name: email.split('@')[0]
        };

        await SecureStore.setItemAsync('konn3ct_token', response.data.token);
        await SecureStore.setItemAsync('konn3ct_user', JSON.stringify(userObj));

        login(userObj, response.data.token);
      } else {
        setError('Login succeeded but API returned invalid format.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to Konn3ct',
        fallbackLabel: 'Use Password',
      });

      if (result.success) {
        const savedToken = await SecureStore.getItemAsync('konn3ct_token');
        const savedUserStr = await SecureStore.getItemAsync('konn3ct_user');
        
        if (savedToken && savedUserStr) {
          const userObj = JSON.parse(savedUserStr);
          login(userObj, savedToken);
        } else {
          Alert.alert('Error', 'No saved credentials found. Please login with password first.');
        }
      }
    } catch (error) {
      console.error('Biometric Auth Error:', error);
      Alert.alert('Error', 'Biometric authentication failed.');
    }
  };

  return (
    <View style={styles.pageContainer}>
      {/* Top Wavy Header SVG */}
      <View style={styles.svgContainer}>
        <Svg width={width} height={380} viewBox={`0 0 ${width} 380`}>
          <Path
            fill={COLORS.brandGreen}
            d={`M0,0 L${width},0 L${width},250 C${width * 0.75},380 ${width * 0.25},160 0,300 Z`}
          />
        </Svg>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo positioned over the wave transition */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/konn3ct_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Animated.View
          style={[
            styles.contentContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Sign In Title */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>Sign in</Text>
            <View style={styles.titleUnderline} />
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email</Text>
            <View
              style={[
                styles.inputWrapper,
                emailFocused && styles.inputWrapperFocused,
              ]}
            >
              <Mail
                color={emailFocused ? COLORS.inputFocus : COLORS.textMuted}
                size={18}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="demo@email.com"
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

          {/* Password Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused,
              ]}
            >
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
                {showPassword ? (
                  <EyeOff color={COLORS.textMuted} size={18} />
                ) : (
                  <Eye color={COLORS.textMuted} size={18} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Options Row (Remember Me & Forgot Password) */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberBtn}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              {rememberMe ? (
                <CheckSquare color={COLORS.brandGreen} size={18} />
              ) : (
                <Square color={COLORS.textMuted} size={18} />
              )}
              <Text style={styles.rememberText}>Remember Me</Text>
            </TouchableOpacity>
            
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} style={styles.spinner} />
            ) : null}
            <Text style={styles.loginButtonText}>
              {loading ? 'Signing in...' : 'Login'}
            </Text>
          </TouchableOpacity>

          {/* Biometrics Login Button (if available) */}
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

          {/* Footer Sign Up Link */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an Account ? </Text>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.signUpText}>Sign up</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: 380,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 180, // Increased to ensure all text starts below the blue wave
  },
  logo: {
    height: 45,
    width: 180,
    // Add white tint/glow if needed so it shows on dark blue
    tintColor: COLORS.white, 
  },
  contentContainer: {
    paddingHorizontal: 30,
    flex: 1,
  },
  titleSection: {
    marginBottom: 40,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  titleUnderline: {
    width: 35,
    height: 4,
    backgroundColor: COLORS.brandGreen,
    borderRadius: 2,
  },
  errorBox: {
    backgroundColor: COLORS.dangerBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 8,
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
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: 4, // Clean up vertical padding
  },
  eyeButton: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  rememberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    marginLeft: 8,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 13,
    color: COLORS.brandGreen,
    fontWeight: '700',
  },
  loginButton: {
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
    marginBottom: 16,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  spinner: {
    marginRight: 10,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  biometricButtonText: {
    color: COLORS.brandGreen,
    fontWeight: '700',
    fontSize: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 30,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  signUpText: {
    color: COLORS.brandGreen,
    fontWeight: '700',
    fontSize: 14,
  },
});
