import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { MediasoupService } from '../../webrtc/MediasoupService';

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

      <ScrollView style={styles.listContainer}>
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
                    <Text style={styles.btnText}>Deny</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAdmit(user.userId)} style={[styles.actionBtn, styles.admitBtn]}>
                    <Text style={styles.btnText}>Admit</Text>
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
                  <Text style={styles.btnText}>Kick</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '70%',
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  closeText: { color: '#94a3b8', fontSize: 20 },
  listContainer: { flex: 1, padding: 16 },
  muteAllBtn: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  muteAllText: { color: 'white', fontWeight: 'bold' },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  userName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  roleText: { color: '#64748b', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  actions: { flexDirection: 'row' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  admitBtn: { backgroundColor: '#10b981' },
  denyBtn: { backgroundColor: '#ef4444' },
  btnText: { color: 'white', fontSize: 12, fontWeight: 'bold' }
});
