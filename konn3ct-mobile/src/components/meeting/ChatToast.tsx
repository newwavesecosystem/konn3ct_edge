import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FileText, Image as ImageIcon, X } from 'lucide-react-native';
import { meetingThemeTokens, MeetingThemeType } from '../../theme/meetingTheme';

export interface ChatToastMessage {
  id: string;
  senderName: string;
  content: string;
  isFile: boolean;
  isImage: boolean;
  timestamp: number;
}

interface ChatToastProps {
  messages: ChatToastMessage[];
  onDismiss: () => void;
  onOpenChat: () => void;
  theme: MeetingThemeType;
}

export const ChatToast: React.FC<ChatToastProps> = ({
  messages,
  onDismiss,
  onOpenChat,
  theme,
}) => {
  const insets = useSafeAreaInsets();
  const tokens = meetingThemeTokens[theme];
  const styles = useMemo(() => getStyles(tokens, insets.top), [tokens, insets.top]);

  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const latestMessage = messages[0];
  const additionalCount = messages.length - 1;

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (callback) callback();
    });
  };

  const handleDismiss = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    animateOut(onDismiss);
  };

  const handlePress = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    handleDismiss();
    onOpenChat();
  };

  useEffect(() => {
    if (messages.length > 0) {
      animateIn();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, 4000);
    } else {
      animateOut();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [messages]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dy) > 10;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -20) {
            handleDismiss();
          }
        },
      }),
    []
  );

  if (!latestMessage) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const truncate = (text: string, length: number) => {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel={`New message from ${latestMessage.senderName}`}
    >
      <TouchableWithoutFeedback onPress={handlePress}>
        <View style={styles.content}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(latestMessage.senderName)}</Text>
          </View>
          <View style={styles.messageContainer}>
            <Text style={styles.senderName} numberOfLines={1}>
              {latestMessage.senderName}
            </Text>
            {latestMessage.isFile ? (
              <View style={styles.attachmentPreview}>
                <FileText size={14} color={tokens.textMuted} />
                <Text style={styles.attachmentText}>Shared a file</Text>
              </View>
            ) : latestMessage.isImage ? (
              <View style={styles.attachmentPreview}>
                <ImageIcon size={14} color={tokens.textMuted} />
                <Text style={styles.attachmentText}>Shared an image</Text>
              </View>
            ) : (
              <Text style={styles.messageText}>
                {truncate(latestMessage.content, 80)}
              </Text>
            )}
            {additionalCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>+{additionalCount} new messages</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
            accessibilityLabel="Dismiss notification"
          >
            <X size={20} color={tokens.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
};

const getStyles = (tokens: any, topInset: number) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: topInset + 16,
      left: '5%',
      width: '90%',
      backgroundColor: tokens.bgElevated,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: tokens.shadowOpacity || 0.1,
      shadowRadius: 12,
      elevation: 5,
      zIndex: 9999,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: tokens.avatarBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    avatarText: {
      color: tokens.textInverse,
      fontSize: 16,
      fontWeight: '600',
    },
    messageContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    senderName: {
      color: tokens.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2,
    },
    messageText: {
      color: tokens.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    attachmentPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    attachmentText: {
      color: tokens.textMuted,
      fontSize: 13,
      marginLeft: 4,
    },
    badge: {
      marginTop: 4,
      backgroundColor: tokens.bgActiveBadge || tokens.primary,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    badgeText: {
      color: tokens.primary,
      fontSize: 11,
      fontWeight: '600',
    },
    closeButton: {
      padding: 8,
      marginLeft: 8,
    },
  });
