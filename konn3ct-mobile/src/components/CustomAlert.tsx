import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useAlertStore } from '../store/useAlertStore';
import { useMeetingStore } from '../store/useMeetingStore';
import { meetingThemeTokens } from '../theme/meetingTheme';

export function CustomAlert() {
  const { visible, title, message, buttons, hideAlert } = useAlertStore();
  const { theme } = useMeetingStore();
  const tokens = meetingThemeTokens[theme || 'sage'];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  if (!visible) return null;

  const handleButtonPress = (onPress?: () => void) => {
    hideAlert();
    if (onPress) {
      setTimeout(() => {
        onPress();
      }, 100);
    }
  };

  const isDarkMode = theme === 'midnight';

  // Styles dynamically adjusted to theme tokens
  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    alertBox: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: tokens.bgElevated,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: tokens.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDarkMode ? 0.4 : 0.12,
      shadowRadius: 24,
      elevation: 10,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: tokens.textPrimary,
      marginBottom: 10,
      textAlign: 'center',
      fontFamily: 'Inter',
    },
    message: {
      fontSize: 14,
      color: tokens.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
      fontFamily: 'Inter',
    },
    buttonContainer: {
      flexDirection: buttons.length === 2 ? 'row' : 'column',
      justifyContent: 'center',
      gap: 10,
    },
    button: {
      flex: buttons.length === 2 ? 1 : 0,
      paddingVertical: 12,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    buttonDefault: {
      backgroundColor: tokens.primary,
    },
    buttonCancel: {
      backgroundColor: 'transparent',
      borderColor: tokens.border,
    },
    buttonDestructive: {
      backgroundColor: tokens.danger,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: 'Inter',
    },
    buttonTextDefault: {
      color: tokens.textInverse,
    },
    buttonTextCancel: {
      color: tokens.textSecondary,
    },
    buttonTextDestructive: {
      color: tokens.textInverse,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.alertBox, { transform: [{ scale: scaleAnim }] }]}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttonContainer}>
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              
              let btnStyle = styles.buttonDefault;
              let txtStyle = styles.buttonTextDefault;
              
              if (isCancel) {
                btnStyle = styles.buttonCancel;
                txtStyle = styles.buttonTextCancel;
              } else if (isDestructive) {
                btnStyle = styles.buttonDestructive;
                txtStyle = styles.buttonTextDestructive;
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.button, btnStyle]}
                  activeOpacity={0.8}
                  onPress={() => handleButtonPress(btn.onPress)}
                >
                  <Text style={[styles.buttonText, txtStyle]}>{btn.text || 'OK'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
