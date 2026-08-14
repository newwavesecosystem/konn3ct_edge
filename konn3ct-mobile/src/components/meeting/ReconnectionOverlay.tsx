import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { WifiOff, CheckCircle, XCircle, RefreshCw, Volume2 } from 'lucide-react-native';
import { useMeetingStore, ConnectionState } from '../../store/useMeetingStore';
import { meetingThemeTokens } from '../../theme/meetingTheme';

export interface ReconnectionOverlayProps {
  onRejoin?: () => void;
  onRestoreAudio?: () => void;
  onLeave?: () => void;
  /**
   * When true, suppresses banner presentation during PiP mode.
   * The service continues monitoring and repairing connections silently.
   * After PiP exit the banner re-evaluates normally.
   */
  isInPipMode?: boolean;
}

export const ReconnectionOverlay: React.FC<ReconnectionOverlayProps> = ({
  onRejoin,
  onRestoreAudio,
  onLeave,
  isInPipMode = false,
}) => {
  const { connectionState, theme } = useMeetingStore();
  const tokens = meetingThemeTokens[theme];

  const barTranslateY = useRef(new Animated.Value(-120)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Track 'reconnected' state to display success banner briefly before hiding
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (connectionState === 'reconnected') {
      setShowReconnected(true);
      Animated.sequence([
        Animated.timing(barTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.delay(2000),
        Animated.timing(barTranslateY, {
          toValue: -120,
          duration: 300,
          useNativeDriver: true
        })
      ]).start(() => {
        setShowReconnected(false);
      });
    } else if (
      connectionState === 'temporarily_disconnected' ||
      connectionState === 'reconnecting' ||
      connectionState === 'recovering_media' ||
      connectionState === 'failed'
    ) {
      Animated.timing(barTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();

      if (connectionState === 'temporarily_disconnected' || connectionState === 'reconnecting') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 0.5,
              duration: 800,
              useNativeDriver: true
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true
            })
          ])
        ).start();
      } else {
        pulseAnim.setValue(1);
        pulseAnim.stopAnimation();
      }
    } else {
      Animated.timing(barTranslateY, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true
      }).start();
      pulseAnim.setValue(1);
      pulseAnim.stopAnimation();
    }
  }, [connectionState, barTranslateY, pulseAnim]);

  // While in PiP mode: suppress all banner UI.
  // The service continues monitoring connections silently during PiP.
  // On PiP exit, the service evaluates health and updates connectionState,
  // at which point this component will render the appropriate banner.
  if (isInPipMode) {
    return null;
  }

  if (connectionState === 'connected' && !showReconnected) {
    return null;
  }

  const styles = getStyles(tokens);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* 1. Temporarily Disconnected */}
      {connectionState === 'temporarily_disconnected' && (
        <Animated.View
          style={[styles.banner, styles.warningBanner, { transform: [{ translateY: barTranslateY }] }]}
          accessibilityRole="alert"
          accessibilityLabel="Connection interrupted"
        >
          <SafeAreaView>
            <View style={styles.bannerContent}>
              <Animated.View style={{ opacity: pulseAnim }}>
                <WifiOff color="#FFFFFF" size={18} />
              </Animated.View>
              <Text style={styles.bannerText}>Connection interrupted...</Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* 2. Reconnecting Banner */}
      {connectionState === 'reconnecting' && (
        <Animated.View
          style={[styles.banner, styles.reconnectingBanner, { transform: [{ translateY: barTranslateY }] }]}
          accessibilityRole="alert"
          accessibilityLabel="Reconnecting to meeting"
        >
          <SafeAreaView>
            <View style={styles.bannerContent}>
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
              <Text style={styles.bannerText}>Reconnecting...</Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* 3. Recovering Media / Restoring Audio Banner */}
      {connectionState === 'recovering_media' && (
        <Animated.View
          style={[styles.banner, styles.mediaBanner, { transform: [{ translateY: barTranslateY }] }]}
          accessibilityRole="alert"
          accessibilityLabel="Restoring meeting audio"
        >
          <SafeAreaView>
            <View style={styles.bannerContent}>
              <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
              <Text style={styles.bannerText}>Restoring meeting audio...</Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* 4. Reconnected Banner */}
      {showReconnected && (
        <Animated.View
          style={[styles.banner, styles.successBanner, { transform: [{ translateY: barTranslateY }] }]}
          accessibilityRole="alert"
        >
          <SafeAreaView>
            <View style={styles.bannerContent}>
              <CheckCircle color="#FFFFFF" size={18} />
              <Text style={styles.bannerText}>Reconnected</Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* 5. Failed Banner (Compact, Non-Blocking with Action Buttons) */}
      {connectionState === 'failed' && (
        <Animated.View
          style={[styles.banner, styles.failedBanner, { transform: [{ translateY: barTranslateY }] }]}
          accessibilityRole="alert"
        >
          <SafeAreaView>
            <View style={styles.failedBannerContent}>
              <View style={styles.failedHeader}>
                <XCircle color="#FFFFFF" size={18} />
                <Text style={styles.failedBannerText}>Connection Lost</Text>
              </View>

              <View style={styles.actionGroup}>
                {onRestoreAudio && (
                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={onRestoreAudio}
                    accessibilityLabel="Restore Audio"
                  >
                    <Volume2 color="#FFFFFF" size={14} style={{ marginRight: 4 }} />
                    <Text style={styles.actionBtnText}>Restore Audio</Text>
                  </TouchableOpacity>
                )}

                {onRejoin && (
                  <TouchableOpacity
                    style={styles.actionBtnPrimary}
                    onPress={onRejoin}
                    accessibilityLabel="Retry Connection"
                  >
                    <RefreshCw color="#FFFFFF" size={14} style={{ marginRight: 4 }} />
                    <Text style={styles.actionBtnText}>Retry</Text>
                  </TouchableOpacity>
                )}

                {onLeave && (
                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={onLeave}
                    accessibilityLabel="Leave Meeting"
                  >
                    <Text style={styles.actionBtnText}>Leave</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
};

const getStyles = (tokens: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  banner: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  bannerText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  spinner: {
    marginRight: 4,
  },
  warningBanner: {
    backgroundColor: '#D97706', // Amber
  },
  reconnectingBanner: {
    backgroundColor: '#B45309', // Dark Amber
  },
  mediaBanner: {
    backgroundColor: '#2563EB', // Blue
  },
  successBanner: {
    backgroundColor: '#10B981', // Green
  },
  failedBanner: {
    backgroundColor: '#DC2626', // Red
    paddingVertical: 4,
  },
  failedBannerContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  failedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  failedBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
