import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  History,
  Send,
  Video,
  MapPin,
  Mail,
  RefreshCcw,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
};

const MOCK_HISTORY = [
  {
    id: 1,
    type: 'meeting',
    roomname: 'Quarterly Planning',
    guest: 'john.doe@example.com, sarah.w@example.com',
    date: 'Oct 24, 2026',
  },
  {
    id: 2,
    type: 'webinar',
    roomname: 'Product Launch v2.0',
    guest: 'investors@domain.com, press@media.com, team@company.com',
    date: 'Oct 20, 2026',
  },
  {
    id: 3,
    type: 'meeting',
    roomname: 'Design Sync',
    guest: 'uiux@design.com',
    date: 'Oct 18, 2026',
  },
  {
    id: 4,
    type: 'meeting',
    roomname: '1-on-1 with Michael',
    guest: 'mike@company.com',
    date: 'Oct 15, 2026',
  },
  {
    id: 5,
    type: 'webinar',
    roomname: 'Tech All Hands',
    guest: 'engineering@startup.io',
    date: 'Sep 30, 2026',
  },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [resendingId, setResendingId] = useState<number | null>(null);

  const handleResend = (id: number) => {
    setResendingId(id);
    // Mock network delay
    setTimeout(() => {
      setResendingId(null);
    }, 1500);
  };

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 24) : 24 }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.modalTitle}>Invite History</Text>
          <Text style={styles.modalSubtitle}>Review past meeting invitations and easily resend them to your guests.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity activeOpacity={0.85}>
          <LinearGradient
            colors={[COLORS.brandGreen, '#145339']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sendNewBtn}
          >
            <Send color="#fff" size={16} />
            <Text style={styles.sendNewBtnText}>Send New Invite</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listContainer}>
          {MOCK_HISTORY.map((item) => {
            const emails = item.guest.split(',').map(e => e.trim()).filter(Boolean);
            const isWebinar = item.type === 'webinar';

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.typeBadge, isWebinar ? styles.typeBadgeWebinar : styles.typeBadgeMeeting]}>
                    <Video size={12} color={isWebinar ? '#9333ea' : '#2563eb'} />
                    <Text style={[styles.typeBadgeText, isWebinar ? { color: '#9333ea' } : { color: '#2563eb' }]}>
                      {item.type.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>{item.date}</Text>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.roomRow}>
                    <MapPin size={16} color={COLORS.textMuted} />
                    <Text style={styles.roomName} numberOfLines={1}>{item.roomname}</Text>
                  </View>

                  <View style={styles.guestList}>
                    {emails.length > 0 ? emails.map((email, i) => (
                      <View key={`${email}-${i}`} style={styles.emailRow}>
                        <Mail size={12} color={COLORS.textMuted} />
                        <Text style={styles.emailText} numberOfLines={1}>{email}</Text>
                      </View>
                    )) : (
                      <Text style={styles.noGuestText}>No guests</Text>
                    )}
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <TouchableOpacity 
                    style={[styles.resendBtn, resendingId === item.id && styles.resendBtnActive]}
                    onPress={() => handleResend(item.id)}
                    disabled={resendingId === item.id}
                  >
                    <RefreshCcw size={14} color={COLORS.brandGreen} />
                    <Text style={styles.resendBtnText}>
                      {resendingId === item.id ? 'Resending...' : 'Resend'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {MOCK_HISTORY.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <History size={32} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No invites found</Text>
              <Text style={styles.emptySubtitle}>Your sent meeting invitations will appear here.</Text>
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
  sendNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  sendNewBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Main Content
  scrollContent: {
    paddingTop: 16,
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
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeBadgeMeeting: { backgroundColor: '#dbeafe' },
  typeBadgeWebinar: { backgroundColor: '#f3e8ff' },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  cardBody: {
    marginBottom: 16,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  guestList: {
    gap: 6,
    paddingLeft: 4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emailText: {
    fontSize: 13,
    color: COLORS.textMuted,
    flex: 1,
  },
  noGuestText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(32, 116, 80, 0.2)',
    backgroundColor: 'rgba(32, 116, 80, 0.05)',
  },
  resendBtnActive: {
    opacity: 0.5,
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brandGreen,
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
