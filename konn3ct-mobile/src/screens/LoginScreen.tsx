import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { apiClient } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Fingerprint } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const { login } = useAuthStore();

  useEffect(() => {
    const initApp = async () => {
      try {
        // Load saved email
        const savedEmail = await AsyncStorage.getItem('@konn3ct_email');
        if (savedEmail) {
          setEmail(savedEmail);
        }

        // Check biometrics
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricSupported(compatible && enrolled);

        // Check if we have a saved token for biometrics
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
        // Save email for next time
        await AsyncStorage.setItem('@konn3ct_email', email);
        
        const userObj = response.data.user || {
          id: 'unknown-id',
          email: email,
          name: email.split('@')[0]
        };

        // Save token and user securely for biometric login
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
    <View style={styles.container}>
      <Text style={styles.title}>Konn3ct</Text>
      <Text style={styles.subtitle}>Log in to your account</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity 
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" style={styles.spinner} /> : null}
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
      
      {isBiometricSupported && hasSavedCredentials && (
        <TouchableOpacity 
          style={styles.biometricButton}
          onPress={handleBiometricLogin}
        >
          <Fingerprint color="#2563eb" size={24} style={{ marginRight: 8 }} />
          <Text style={styles.biometricButtonText}>Login with Biometrics</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.linkContainer}>
        <Text style={styles.linkText}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 32,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 40,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
  },
  label: {
    color: '#334155',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    color: '#0f172a',
  },
  button: {
    width: '100%',
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  biometricButton: {
    width: '100%',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  biometricButtonText: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: 16,
  },
  spinner: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  linkContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563eb',
    fontWeight: 'bold',
  },
});
