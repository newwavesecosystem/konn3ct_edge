import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Settings, Camera, Video, Mic, Smartphone } from 'lucide-react-native';
import { MediasoupService } from '../../webrtc/MediasoupService';
import { useMeetingStore } from '../../store/useMeetingStore';
import { meetingThemeTokens } from '../../theme/meetingTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

interface SettingsPanelProps {
  service: MediasoupService | null;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ service }) => {
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const theme = useMeetingStore(state => state.theme);
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);

  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;

  const handleSwitchCamera = () => {
    if (service) {
      service.switchCamera();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Settings size={20} color={tokens.primary} />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: safeBottom + 40 }}>
        
        {/* Device Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DEVICE SETTINGS</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Camera size={20} color={tokens.textMuted} />
                <View>
                  <Text style={styles.settingTitle}>Switch Camera</Text>
                  <Text style={styles.settingDesc}>Flip between front and rear cameras</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.actionBtn} onPress={handleSwitchCamera}>
                <Text style={styles.actionBtnText}>Flip</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Smartphone size={20} color={tokens.textMuted} />
                <View>
                  <Text style={styles.settingTitle}>Audio Output</Text>
                  <Text style={styles.settingDesc}>System Default</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Video Quality Settings (Placeholders for future implementation) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VIDEO QUALITY</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Video size={20} color={tokens.textMuted} />
                <View>
                  <Text style={styles.settingTitle}>HD Video</Text>
                  <Text style={styles.settingDesc}>Optimized for network</Text>
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
    height: '70%',
    backgroundColor: t.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: t.shadowOpacity, shadowRadius: 10, elevation: 10,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: t.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: { padding: 4 },
  closeText: { color: t.textMuted, fontSize: 20 },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: t.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  settingCard: {
    backgroundColor: t.bgElevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: t.border,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingTitle: {
    color: t.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  settingDesc: {
    color: t.textMuted,
    fontSize: 12,
  },
  actionBtn: {
    backgroundColor: t.bgActiveBadge,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    color: t.primary,
    fontWeight: 'bold',
    fontSize: 12,
  },
  badge: {
    backgroundColor: t.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: t.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
  },
});
