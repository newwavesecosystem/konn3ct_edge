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
  Bell,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  Clock,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { APP_CONFIG } from '../config/appConfig';

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
};

const INITIAL_MOCK_NOTIFICATIONS = [
  {
    id: 1,
    title: 'New Meeting Scheduled',
    description: "You have been invited to 'Quarterly Planning' by John Doe.",
    time: '10 minutes ago',
    type: 'info',
    isUnread: true,
  },
  {
    id: 2,
    title: 'System Update Complete',
    description: `${APP_CONFIG.APP_NAME} dashboard has been updated to version 2.4.0 successfully.`,
    time: '2 hours ago',
    type: 'success',
    isUnread: true,
  },
  {
    id: 3,
    title: 'Upcoming Meeting Reminder',
    description: "Your meeting 'Product Sync' starts in 15 minutes.",
    time: '5 hours ago',
    type: 'warning',
    isUnread: false,
  },
  {
    id: 4,
    title: 'Subscription Renewed',
    description: 'Your premium subscription has been successfully renewed for another month.',
    time: '1 day ago',
    type: 'success',
    isUnread: false,
  },
  {
    id: 5,
    title: 'Network Latency Warning',
    description: 'We detected high latency during your last call. Check your internet connection.',
    time: '2 days ago',
    type: 'danger',
    isUnread: false,
  },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState(INITIAL_MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => n.isUnread).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isUnread: false })));
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIconConfig = (type: string) => {
    switch (type) {
      case 'success':
        return { icon: CheckCircle2, color: COLORS.success, bg: 'rgba(16, 185, 129, 0.1)' };
      case 'warning':
        return { icon: Clock, color: COLORS.warning, bg: 'rgba(245, 158, 11, 0.1)' };
      case 'danger':
        return { icon: AlertTriangle, color: COLORS.danger, bg: 'rgba(239, 68, 68, 0.1)' };
      default:
        return { icon: CalendarDays, color: COLORS.brandBlue, bg: 'rgba(1, 46, 137, 0.1)' };
    }
  };

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 24) : 24 }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.headerIconBox}>
              <Bell size={20} color={COLORS.brandGreen} />
            </View>
            <Text style={styles.modalTitle}>Notifications</Text>
          </View>
          <Text style={styles.modalSubtitle}>Stay updated with your latest alerts and activities.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Controls Row */}
      {notifications.length > 0 && (
        <View style={styles.controlsRow}>
          <Text style={styles.unreadCountText}>
            {unreadCount} {unreadCount === 1 ? 'unread' : 'unread'}
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markReadBtn} onPress={markAllAsRead}>
              <CheckCircle2 size={16} color={COLORS.textMuted} />
              <Text style={styles.markReadText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listContainer}>
          {notifications.map((notif) => {
            const { icon: Icon, color, bg } = getIconConfig(notif.type);

            return (
              <View key={notif.id} style={[styles.card, notif.isUnread && styles.cardUnread]}>
                {notif.isUnread && <View style={styles.unreadIndicator} />}
                
                <View style={styles.cardContent}>
                  <View style={[styles.iconBox, { backgroundColor: bg }]}>
                    <Icon size={20} color={color} />
                  </View>
                  
                  <View style={styles.textContainer}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, notif.isUnread && styles.titleUnread]} numberOfLines={1}>
                        {notif.title}
                      </Text>
                      <Text style={styles.timeText}>{notif.time}</Text>
                    </View>
                    <Text style={[styles.desc, notif.isUnread && styles.descUnread]}>
                      {notif.description}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.dismissBtn} 
                  onPress={() => removeNotification(notif.id)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}

          {notifications.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Bell size={32} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>You're all caught up! Check back later for updates.</Text>
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
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(32, 116, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginTop: 12, lineHeight: 20 },
  closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 12, alignSelf: 'flex-start' },

  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  unreadCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  markReadText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },

  // Main Content
  scrollContent: {
    paddingTop: 16,
  },
  listContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    overflow: 'hidden',
    position: 'relative',
  },
  cardUnread: {
    backgroundColor: COLORS.surface,
    borderColor: 'rgba(32, 116, 80, 0.2)',
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 20,
    bottom: 20,
    width: 4,
    backgroundColor: COLORS.brandGreen,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    paddingRight: 16, // space for dismiss button
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(15, 23, 42, 0.8)',
    flex: 1,
    paddingRight: 8,
  },
  titleUnread: {
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  desc: {
    fontSize: 14,
    color: 'rgba(100, 116, 139, 0.8)',
    lineHeight: 20,
  },
  descUnread: {
    color: COLORS.textMuted,
  },
  dismissBtn: {
    position: 'absolute',
    right: 12,
    bottom: 16,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
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
