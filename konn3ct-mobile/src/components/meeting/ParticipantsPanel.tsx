import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { meetingThemeTokens } from '../../theme/meetingTheme';
import { MediasoupService } from '../../webrtc/MediasoupService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ParticipantsPanelProps {
  service: MediasoupService | null;
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({ service }) => {
  const participants = useMeetingStore(state => state.participants);
  const waitingRoom = useMeetingStore(state => state.waitingRoom);
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const currentUserRole = useMeetingStore(state => state.currentUserRole);
  const currentUserId = useMeetingStore(state => state.currentUserId);
  
  const isHost = currentUserRole === 'host';
  const theme = useMeetingStore(state => state.theme);
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);

  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;

  const handleAdmit = (userId: string) => {
    if (service) service.admitUser(userId);
  };

  const handleDeny = (userId: string) => {
    if (service) service.denyUser(userId);
  };

  const handleKick = (userId: string) => {
    if (service && service.ws && service.ws.readyState === WebSocket.OPEN) {
      service.ws.send(JSON.stringify({ type: 'kick_user', userId }));
    }
  };

  const handleMuteAll = () => {
    if (service) service.forceMute();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Participants ({participants.length})</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: safeBottom + 16 }}>
        {isHost && (
          <TouchableOpacity style={styles.muteAllBtn} onPress={handleMuteAll}>
            <Text style={styles.muteAllText}>Mute All</Text>
          </TouchableOpacity>
        )}

        {isHost && waitingRoom.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Waiting Room ({waitingRoom.length})</Text>
            {waitingRoom.map(user => (
              <View key={user.userId} style={styles.userRow}>
                <Text style={styles.userName}>{user.name}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => handleDeny(user.userId)} style={[styles.actionBtn, styles.denyBtn]}>
                    <Text style={styles.denyText}>Deny</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAdmit(user.userId)} style={[styles.actionBtn, styles.admitBtn]}>
                    <Text style={styles.admitText}>Admit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>In Meeting</Text>
          {participants.map(user => (
            <View key={user.userId} style={styles.userRow}>
              <View>
                <Text style={styles.userName}>{user.name} {user.userId === currentUserId ? '(You)' : ''}</Text>
                <Text style={styles.roleText}>{user.role}</Text>
              </View>
              {isHost && user.userId !== currentUserId && (
                <TouchableOpacity onPress={() => handleKick(user.userId)} style={[styles.actionBtn, styles.denyBtn]}>
                  <Text style={styles.denyText}>Kick</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
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
    borderBottomColor: t.border
  },
  title: { color: t.textPrimary, fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  closeText: { color: t.textMuted, fontSize: 20 },
  listContainer: { flex: 1, padding: 16 },
  muteAllBtn: {
    backgroundColor: t.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  muteAllText: { color: t.textInverse, fontWeight: 'bold' },
  section: { marginBottom: 24 },
  sectionTitle: { color: t.textMuted, fontSize: 12, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: t.bgElevated,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: t.border,
  },
  userName: { color: t.textPrimary, fontSize: 16, fontWeight: 'bold' },
  roleText: { color: t.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  actions: { flexDirection: 'row' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  admitBtn: { backgroundColor: t.success },
  admitText: { color: t.textInverse, fontWeight: 'bold', fontSize: 12 },
  denyBtn: { backgroundColor: t.danger },
  denyText: { color: t.textInverse, fontWeight: 'bold', fontSize: 12 },
  muteBtn: { backgroundColor: t.primary, paddingHorizontal: 8 },
  lowerHandBtn: { backgroundColor: '#d97706', paddingHorizontal: 8 },
});
