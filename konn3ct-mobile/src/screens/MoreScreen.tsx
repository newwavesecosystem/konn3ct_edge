import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Cast,
  Film,
  CreditCard,
  Users,
  Heart,
  ClipboardCheck,
  Calendar,
  History,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
  Bell,
  Headset,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/useAuthStore';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40 - 16) / 2; // 2 columns, 20px padding each side, 16px gap

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandBlueDark: '#001D5C',
  brandGreen: '#207450',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
};

const GRID_ITEMS = [
  { id: 'streaming', title: 'Streaming', subtitle: 'Go live now', icon: Cast, colors: ['#3b82f6', '#2563eb'] },
  { id: 'recordings', title: 'Recordings', subtitle: 'Past sessions', icon: Film, colors: ['#8b5cf6', '#7c3aed'] },
  { id: 'events', title: 'Events', subtitle: 'Schedule', icon: Calendar, colors: ['#ec4899', '#db2777'] },
  { id: 'attendance', title: 'Attendance', subtitle: 'Track metrics', icon: ClipboardCheck, colors: ['#14b8a6', '#0d9488'] },
  { id: 'payments', title: 'Payments', subtitle: 'Billing & plans', icon: CreditCard, colors: ['#eab308', '#ca8a04'] },
  { id: 'donations', title: 'Donations', subtitle: 'Support & gifts', icon: Heart, colors: ['#f43f5e', '#e11d48'] },
  { id: 'referees', title: 'Referees', subtitle: 'Manage officials', icon: Users, colors: ['#84cc16', '#65a30d'] },
];

const LIST_ITEMS = [
  { id: 'history', title: 'History', icon: History, color: '#64748b', bg: '#f8fafc' },
  { id: 'settings', title: 'Settings', icon: Settings, color: '#475569', bg: '#f1f5f9' },
  { id: 'logout', title: 'Log Out', icon: LogOut, color: COLORS.danger, bg: '#fef2f2', action: 'logout' },
];

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuthStore();
  
  // Mock user data for the header
  const firstName = 'KAYODE';
  
  const handleAvatarPress = () => {
    console.log('Avatar pressed');
  };

  const handlePress = (item: any) => {
    if (item.action === 'logout') {
      logout();
    } else {
      console.log('Navigate to:', item.title);
    }
  };

  const renderGridItem = (item: any) => {
    const Icon = item.icon;
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.gridCard}
        activeOpacity={0.8}
        onPress={() => handlePress(item)}
      >
        {/* Decorative Watermark */}
        <Icon color={item.colors[0]} size={80} strokeWidth={1} style={styles.watermarkIcon} />
        
        <LinearGradient
          colors={item.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gridIconGradient}
        >
          <Icon color="#ffffff" size={20} strokeWidth={2.5} />
        </LinearGradient>
        
        <View style={styles.cardTextContent}>
          <Text style={styles.gridTitle}>{item.title}</Text>
          <Text style={styles.gridSubtitle}>{item.subtitle}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListItem = (item: any, isLast: boolean) => {
    const Icon = item.icon;
    const isDanger = item.action === 'logout';

    return (
      <React.Fragment key={item.id}>
        <TouchableOpacity
          style={styles.listRow}
          activeOpacity={0.7}
          onPress={() => handlePress(item)}
        >
          <View style={[styles.listIconBox, { backgroundColor: item.bg }]}>
            <Icon color={item.color} size={20} strokeWidth={2.5} />
          </View>
          <Text style={[styles.listRowTitle, isDanger && { color: COLORS.danger }]}>
            {item.title}
          </Text>
          {!isDanger && <ChevronRight color="#cbd5e1" size={20} />}
        </TouchableOpacity>
        {!isLast && <View style={styles.divider} />}
      </React.Fragment>
    );
  };

  return (
    <View style={styles.container}>
      {/* ===== STICKY HEADER ===== */}
      <View style={[styles.stickyHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.stickyHeaderLeft}>
          <TouchableOpacity style={styles.avatarLogoContainer} onPress={handleAvatarPress} activeOpacity={0.8}>
            <View style={styles.avatarRing}>
              <Text style={styles.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>2</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.stickyHeaderName}>Hi, {firstName.toUpperCase()}</Text>
        </View>

        <View style={styles.stickyHeaderRight}>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Headset color={COLORS.textPrimary} size={24} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Bell color={COLORS.textPrimary} size={24} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>20</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: 20, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Header Banner */}
        <LinearGradient
          colors={[COLORS.brandBlue, COLORS.brandBlueDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerBanner}
        >
          <View style={styles.headerGlow} />
          <View style={styles.headerContent}>
            <View style={styles.headerIconWrapper}>
              <Sparkles color="#fff" size={24} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Explore Hub</Text>
              <Text style={styles.headerSubtitle}>Discover all Konn3ct features</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Bento Box Grid */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Tools & Features</Text>
          <View style={styles.gridContainer}>
            {GRID_ITEMS.map((item) => renderGridItem(item))}
          </View>
        </View>

        {/* Account & App List */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Account & Preferences</Text>
          <View style={styles.listCard}>
            {LIST_ITEMS.map((item, idx) => renderListItem(item, idx === LIST_ITEMS.length - 1))}
          </View>
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
  scrollContent: {
    paddingHorizontal: 20,
  },
  
  // Sticky Header
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    zIndex: 10,
  },
  stickyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarLogoContainer: {
    position: 'relative',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#10B981', // green ring
    backgroundColor: 'rgba(16, 185, 129, 0.15)', // light green bg
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -6,
    right: -8,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.pageBg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  avatarBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  stickyHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: -0.3,
  },
  stickyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F43F5E', // rose/red
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.pageBg,
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Header Banner
  headerBanner: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  headerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },

  // Sections
  sectionContainer: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 16,
    marginLeft: 4,
  },

  // Grid Styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16, 
  },
  gridCard: {
    width: COLUMN_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 120,
    justifyContent: 'space-between',
  },
  watermarkIcon: {
    position: 'absolute',
    bottom: -16,
    right: -16,
    opacity: 0.06,
    transform: [{ rotate: '-10deg' }],
  },
  gridIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTextContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  gridSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },

  // List Styles
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  listIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  listRowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 74, // align with text
  },
});
