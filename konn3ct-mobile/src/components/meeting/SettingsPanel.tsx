import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Settings, Camera, Video, Mic, Smartphone } from 'lucide-react-native';
import { MediasoupService } from '../../webrtc/MediasoupService';

interface SettingsPanelProps {
  service: MediasoupService | null;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ service }) => {
  const handleSwitchCamera = () => {
    if (service) {
      service.switchCamera();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Settings size={20} color="#3b82f6" />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        
        {/* Device Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DEVICE SETTINGS</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Camera size={20} color="#94a3b8" />
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
                <Smartphone size={20} color="#94a3b8" />
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
                <Video size={20} color="#94a3b8" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  settingCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
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
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  settingDesc: {
    color: '#64748b',
    fontSize: 12,
  },
  actionBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  badge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
