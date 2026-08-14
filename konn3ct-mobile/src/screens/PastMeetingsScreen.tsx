import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Search,
  Mail,
  CalendarDays,
  User2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { fetchSchedules } from '../api/schedule';

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
};

const AVATAR_COLORS = [
  { bg: '#dbeafe', text: '#2563eb' }, // Blue
  { bg: '#dcfce7', text: '#16a34a' }, // Green
  { bg: '#f3e8ff', text: '#9333ea' }, // Purple
  { bg: '#fef3c7', text: '#d97706' }, // Amber
  { bg: '#ffe4e6', text: '#e11d48' }, // Rose
  { bg: '#cffafe', text: '#0891b2' }, // Cyan
];

export default function PastMeetingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [searchTerm, setSearchTerm] = useState('');
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSchedules();
      const schedulesArray = Array.isArray(data) ? data : data?.data || [];
      const now = new Date().getTime();
      const pastSchedules = schedulesArray.filter((m: any) => {
        const meetingTime = new Date(m.time || m.start_time || m.startTime || m.date).getTime();
        return !isNaN(meetingTime) && meetingTime < now;
      });
      setMeetings(pastSchedules);
    } catch (e) {
      console.error('Error fetching past meetings', e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const title = (m.title || m.roomname || 'Meeting').toLowerCase();
      const term = searchTerm.toLowerCase();
      return title.includes(term);
    });
  }, [searchTerm, meetings]);

  const getInitials = (title: string) => {
    return title.substring(0, 2).toUpperCase() || 'M';
  };

  const getAvatarColor = (index: number) => {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  };

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 24) : 24 }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.modalTitle}>Past Meetings</Text>
          <Text style={styles.modalSubtitle}>Review your past meeting sessions.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.metricsRow}>
          <Text style={styles.metricsCount}>{filteredMeetings.length}</Text>
          <Text style={styles.metricsLabel}>Total Meetings</Text>
        </View>
        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search past meetings..."
            placeholderTextColor={COLORS.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCorrect={false}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearBtn}>
              <X size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >
        <View style={styles.listContainer}>
          {filteredMeetings.map((meeting, index) => {
            const title = meeting.title || meeting.roomname || 'Untitled Meeting';
            const avatarColor = getAvatarColor(index);

            let displayDate = meeting.time || meeting.date || 'Recently';
            if (displayDate.includes('T') || displayDate.includes('-')) {
              displayDate = new Date(displayDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
            
            const guestCount = meeting.guest ? meeting.guest.split(',').length : 0;

            return (
              <View key={meeting.id || index} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatarBox, { backgroundColor: avatarColor.bg }]}>
                    <Text style={[styles.avatarText, { color: avatarColor.text }]}>
                      {getInitials(title)}
                    </Text>
                  </View>
                </View>

                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>{title}</Text>
                  <View style={styles.emailRow}>
                    <User2 size={14} color={COLORS.textMuted} />
                    <Text style={styles.userEmail} numberOfLines={1}>{guestCount} Guests</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <CalendarDays size={14} color={COLORS.textMuted} />
                  <Text style={styles.joinDate}>{displayDate}</Text>
                </View>
              </View>
            );
          })}

          {filteredMeetings.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <CalendarDays size={32} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No past meetings found</Text>
              <Text style={styles.emptySubtitle}>When you complete meetings, they will appear here.</Text>
            </View>
          )}
        </View>
      </ScrollView>
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

  controlsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  metricsCount: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  metricsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },

  // Main Content
  scrollContent: {
    paddingTop: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  planBadge: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  userInfo: {
    marginBottom: 20,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  joinDate: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
});
