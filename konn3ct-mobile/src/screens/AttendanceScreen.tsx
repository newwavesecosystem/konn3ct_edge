import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Headset,
  Bell,
  FileBarChart,
  UserCircle,
  CalendarDays,
  Users,
  X,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { fetchMeetingAttendanceList, fetchAttendanceDetails, MeetingAttendanceSession, MeetingParticipant } from '../api/attendance';

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  brandGreenLight: '#eef8f3',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatTime = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function AttendanceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  const [attendanceList, setAttendanceList] = useState<MeetingAttendanceSession[]>([]);
  const [participantsList, setParticipantsList] = useState<MeetingParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  const loadAttendance = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMeetingAttendanceList();
      setAttendanceList(data);
    } catch (e) {
      console.error('Failed to load attendance:', e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadAttendance();
  }, []);

  const handleAction = async (action: string, meeting: MeetingAttendanceSession) => {
    if (action === 'View Participants') {
      const roomId = meeting.room_info?.id || meeting.room_id || meeting.roomId || meeting.id;
      const meetingId = meeting.identifier || meeting.meeting_id || meeting.meetingId || meeting.id;
      setSelectedMeetingId(String(meeting.id));
      setModalVisible(true);
      
      setIsLoadingParticipants(true);
      setParticipantsList([]);
      try {
        const details = await fetchAttendanceDetails(String(roomId), String(meetingId));
        setParticipantsList(details);
      } catch (e) {
        console.error('Failed to load participants:', e);
      } finally {
        setIsLoadingParticipants(false);
      }
    }
  };

  const renderAttendanceCard = (meeting: MeetingAttendanceSession, index: number) => {
    const host = meeting.host || meeting.host_name || meeting.hostname || meeting.name || 'Unknown Host';
    const date = meeting.date ? formatDate(meeting.date) : meeting.created_at ? formatDate(meeting.created_at) : 'No date';
    const time = meeting.time || formatTime(meeting.created_at) || '—';

    return (
      <View key={meeting.id || index} style={styles.card}>
        <LinearGradient
          colors={['#34d399', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardTopStrip}
        />
        
        <View style={styles.cardContent}>
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={styles.hostBadge}>
              <UserCircle color={COLORS.brandBlue} size={16} />
              <Text style={styles.hostName} numberOfLines={1}>{host}</Text>
            </View>
            <View style={styles.indexBadge}>
              <Text style={styles.indexBadgeText}>#{index + 1}</Text>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.metaRow}>
            <CalendarDays color={COLORS.textMuted} size={16} />
            <Text style={styles.metaText}>{date} • {time}</Text>
          </View>

          {/* Footer Action */}
          <TouchableOpacity 
            style={styles.participantsBtn} 
            activeOpacity={0.8}
            onPress={() => handleAction('View Participants', meeting)}
          >
            <Users color={COLORS.brandGreen} size={16} />
            <Text style={styles.participantsBtnText}>View Participants</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Math.max(insets.top, 24) }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.modalTitle}>Meeting Attendance</Text>
          <Text style={styles.modalSubtitle}>View detailed participant logs for past meetings.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadAttendance} />}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={{ flex: 1 }} />
          {/* Stats Box */}
          <View style={styles.statsBox}>
            <Text style={styles.statLabel}>Total Meetings</Text>
            <Text style={styles.statValue}>{attendanceList.length}</Text>
          </View>
        </View>

        {/* List */}
        <View style={styles.listContainer}>
          {attendanceList.length === 0 && !isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted }}>No past meetings found.</Text>
            </View>
          ) : (
            attendanceList.map((meeting, index) => renderAttendanceCard(meeting, index))
          )}
        </View>
      </ScrollView>

      {/* View Participants Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeaderTop, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 24) : 24 }]}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.modalTitle}>Meeting Participants</Text>
              <Text style={styles.modalSubtitle}>Detailed attendee log and duration metrics.</Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoadingParticipants ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.brandGreen} />
                <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading participants...</Text>
              </View>
            ) : participantsList.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: COLORS.textMuted }}>No participants logged for this session.</Text>
              </View>
            ) : (
              participantsList.map((participant, i) => {
                const joinTimeDisplay = participant.join_time
                  || participant.joinTime
                  || (participant.created_at ? formatTime(participant.created_at) : '—');
                const statusDisplay = participant.status 
                  ? participant.status.charAt(0).toUpperCase() + participant.status.slice(1)
                  : 'Joined';

                return (
                  <View key={participant.id || i} style={styles.participantCard}>
                    <View style={styles.participantHeader}>
                      <View style={styles.participantAvatar}>
                        <Text style={styles.participantInitial}>{(participant.name || '?').charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.participantName}>{participant.name || 'Unknown User'}</Text>
                        <Text style={styles.participantEmail}>{participant.email || '—'}</Text>
                      </View>
                      {participant.duration ? (
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>{participant.duration}</Text>
                        </View>
                      ) : (
                        <View style={[styles.durationBadge, { backgroundColor: '#e0f2fe' }]}>
                          <Text style={[styles.durationText, { color: '#0369a1' }]}>{statusDisplay}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.participantTimeline}>
                      <View style={styles.timelineItem}>
                        <Text style={styles.timelineLabel}>Time Logged</Text>
                        <Text style={styles.timelineTime}>{joinTimeDisplay}</Text>
                      </View>
                      {participant.leave_time || participant.leaveTime ? (
                        <View style={styles.timelineItem}>
                          <Text style={styles.timelineLabel}>Left</Text>
                          <Text style={styles.timelineTime}>{participant.leave_time || participant.leaveTime}</Text>
                        </View>
                      ) : (
                        <View style={styles.timelineItem}>
                          <Text style={styles.timelineLabel}>Date</Text>
                          <Text style={styles.timelineTime}>{participant.created_at ? formatDate(participant.created_at) : '—'}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            <View style={{height: 40}} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },
  
  // Header
  modalHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 10,
  },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4, lineHeight: 20 },
  closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 12 },

  // Main Content
  scrollContent: {
    paddingTop: 24,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statsBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
    minWidth: 90,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 4,
  },

  // List Container
  listContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  cardTopStrip: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  hostName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  indexBadge: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  indexBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  participantsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.brandGreenLight,
    gap: 8,
  },
  participantsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brandGreen,
  },

  // Modal Container
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalScrollContent: { padding: 20 },
  
  participantCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(32, 116, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.brandGreen,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  participantEmail: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  durationBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },
  participantTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  timelineItem: {
    alignItems: 'center',
    flex: 1,
  },
  timelineLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
});
