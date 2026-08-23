import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { Settings, Camera, Video, Mic, Smartphone, Volume2, X, MessageSquare } from 'lucide-react-native';
import { MediasoupService } from '../../webrtc/MediasoupService';
import { useMeetingStore } from '../../store/useMeetingStore';
import { meetingThemeTokens } from '../../theme/meetingTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useSettingsStore } from '../../store/useSettingsStore';

interface SettingsPanelProps {
  service: MediasoupService | null;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ service }) => {
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const theme = useMeetingStore(state => state.theme);
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);

  const chatNotificationSound = useSettingsStore(state => state.chatNotificationSound);
  const setChatNotificationSound = useSettingsStore(state => state.setChatNotificationSound);
  const chatToastEnabled = useSettingsStore(state => state.chatToastEnabled);
  const setChatToastEnabled = useSettingsStore(state => state.setChatToastEnabled);

  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;

  const handleSwitchCamera = () => {
    if (service) {
      service.switchCamera();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.dragIndicatorContainer}>
        <View style={styles.dragIndicator} />
      </View>
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrapper}>
            <Settings size={22} color={tokens.primary} />
          </View>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <X size={20} color={tokens.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={[styles.scrollInner, { paddingBottom: safeBottom + 40 }]}>
        
        {/* Notifications Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
          
          <View style={styles.cardGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.iconWrapper, { backgroundColor: tokens.border }]}>
                  <Volume2 size={20} color={tokens.textSecondary} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Notification Sound</Text>
                  <Text style={styles.settingDesc}>Play a chime when a new message arrives</Text>
                </View>
              </View>
              <Switch
                value={chatNotificationSound}
                onValueChange={setChatNotificationSound}
                trackColor={{ false: tokens.border, true: tokens.primary }}
                thumbColor="#fff"
                accessibilityLabel="Toggle chat notification sound"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.iconWrapper, { backgroundColor: tokens.border }]}>
                  <MessageSquare size={20} color={tokens.textSecondary} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Chat Toast</Text>
                  <Text style={styles.settingDesc}>Show a pop-up banner for new messages</Text>
                </View>
              </View>
              <Switch
                value={chatToastEnabled}
                onValueChange={setChatToastEnabled}
                trackColor={{ false: tokens.border, true: tokens.primary }}
                thumbColor="#fff"
                accessibilityLabel="Toggle chat toast notifications"
              />
            </View>
          </View>
        </View>

        {/* Device Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DEVICE</Text>
          
          <View style={styles.cardGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.iconWrapper, { backgroundColor: tokens.bgActiveBadge }]}>
                  <Camera size={20} color={tokens.primary} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Switch Camera</Text>
                  <Text style={styles.settingDesc}>Flip between front and rear</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.actionBtn} onPress={handleSwitchCamera}>
                <Text style={styles.actionBtnText}>Flip</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.iconWrapper, { backgroundColor: tokens.border }]}>
                  <Volume2 size={20} color={tokens.textSecondary} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>Audio Output</Text>
                  <Text style={styles.settingDesc}>System Default</Text>
                </View>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Auto</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Video Quality Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUALITY</Text>
          
          <View style={styles.cardGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.iconWrapper, { backgroundColor: tokens.border }]}>
                  <Video size={20} color={tokens.textSecondary} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.settingTitle}>HD Video</Text>
                  <Text style={styles.settingDesc}>Optimized for your network</Text>
                </View>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Auto</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const getStyles = (t: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '65%',
    backgroundColor: t.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: t.shadowOpacity, shadowRadius: 15, elevation: 10,
    zIndex: 100,
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragIndicator: {
    width: 48,
    height: 5,
    backgroundColor: t.border,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: t.bgActiveBadge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: t.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: t.textMuted,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 8,
  },
  cardGroup: {
    backgroundColor: t.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: t.border,
    marginLeft: 72,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    paddingRight: 12,
  },
  settingTitle: {
    color: t.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  settingDesc: {
    color: t.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionBtn: {
    backgroundColor: t.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  badge: {
    backgroundColor: t.bgElevated,
    borderWidth: 1,
    borderColor: t.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: t.textSecondary,
    fontSize: 13,
    fontWeight: 'bold',
  },
});

