import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Video,
  Plus,
  Users,
  Globe,
  Lock,
  Headset,
  Bell,
  MoreVertical,
  Copy,
  ExternalLink,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandBlueDark: '#001D5C',
  brandGreen: '#207450',
  brandGreenDark: '#145339',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
  amber: '#f59e0b',
  purple: '#8b5cf6',
};

const MOCK_STATS = [
  { id: 'total', label: 'Total Rooms', value: '12', icon: Video, color: COLORS.brandBlue },
  { id: 'active', label: 'Active Rooms', value: '5', icon: Users, color: COLORS.brandGreen },
  { id: 'scheduled', label: 'Scheduled Rooms', value: '3', icon: Globe, color: COLORS.amber },
  { id: 'inactive', label: 'Inactive Rooms', value: '4', icon: Lock, color: COLORS.danger },
];

const MOCK_ROOMS = [
  {
    id: 'room-1',
    name: 'Marketing Weekly Sync',
    url: 'marketing-weekly',
    isLocked: false,
    gradient: [COLORS.brandBlue, '#3b82f6'],
  },
  {
    id: 'room-2',
    name: 'Design Critiques',
    url: 'design-crits',
    isLocked: true,
    gradient: [COLORS.brandGreen, '#34d399'],
  },
  {
    id: 'room-3',
    name: 'Engineering All Hands',
    url: 'eng-all-hands',
    isLocked: false,
    gradient: [COLORS.amber, '#fbbf24'],
  },
  {
    id: 'room-4',
    name: 'Client Presentation: Acme Corp',
    url: 'acme-presentation',
    isLocked: true,
    gradient: [COLORS.purple, '#c084fc'],
  },
];

export default function RoomsScreen() {
  const insets = useSafeAreaInsets();
  
  // Mock user data for the header
  const firstName = 'KAYODE';
  
  const handleAvatarPress = () => {
    console.log('Avatar pressed');
  };

  const renderStatCard = (stat: typeof MOCK_STATS[0]) => {
    const Icon = stat.icon;
    return (
      <View key={stat.id} style={styles.statCard}>
        <View style={[styles.statIconBox, { backgroundColor: `${stat.color}15` }]}>
          <Icon color={stat.color} size={20} />
        </View>
        <View style={styles.statTextContainer}>
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </View>
      </View>
    );
  };

  const renderRoomCard = (room: typeof MOCK_ROOMS[0]) => {
    return (
      <View key={room.id} style={styles.roomCard}>
        <LinearGradient
          colors={room.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.roomCardTopStrip}
        />
        
        <View style={styles.roomCardContent}>
          {/* Header Row */}
          <View style={styles.roomCardHeader}>
            <View style={styles.roomTitleGroup}>
              <LinearGradient
                colors={room.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.roomIconBox}
              >
                <Video color="#ffffff" size={20} />
              </LinearGradient>
              <View style={styles.roomTextGroup}>
                <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
                <Text style={styles.roomUrl} numberOfLines={1}>/{room.url}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.menuButton}>
              <MoreVertical color={COLORS.textMuted} size={20} />
            </TouchableOpacity>
          </View>

          {/* Status Row */}
          <View style={styles.roomStatusRow}>
            <View style={styles.statusBadge}>
              <Globe color={COLORS.textMuted} size={12} />
              <Text style={styles.statusText}>Live</Text>
            </View>
            <View style={styles.statusDot} />
            {room.isLocked ? (
              <View style={styles.statusBadge}>
                <Lock color={COLORS.danger} size={12} />
                <Text style={[styles.statusText, { color: COLORS.danger }]}>Locked</Text>
              </View>
            ) : (
              <View style={styles.statusBadge}>
                <Globe color={COLORS.brandGreen} size={12} />
                <Text style={[styles.statusText, { color: COLORS.brandGreen }]}>Open</Text>
              </View>
            )}
          </View>

          {/* Footer Row */}
          <View style={styles.roomFooter}>
            <Text style={styles.roomIdText}>ID: {room.id}</Text>
            <View style={styles.roomActionGroup}>
              <TouchableOpacity style={styles.roomActionBtn}>
                <Copy color={COLORS.textMuted} size={14} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.roomActionBtn}>
                <ExternalLink color={COLORS.textMuted} size={14} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
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

          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => (navigation.navigate as any)('Notifications')}>
            <Bell color={COLORS.textPrimary} size={24} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>20</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Rooms</Text>
          <Text style={styles.pageSubtitle}>Create and manage your meeting rooms.</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnOutline} activeOpacity={0.7}>
            <Plus color={COLORS.textPrimary} size={16} />
            <Text style={styles.btnOutlineText}>Schedule</Text>
          </TouchableOpacity>
          
          <TouchableOpacity activeOpacity={0.85} style={{ flex: 1 }}>
            <LinearGradient
              colors={[COLORS.brandGreen, COLORS.brandGreenDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnPrimary}
            >
              <Plus color="#ffffff" size={16} />
              <Text style={styles.btnPrimaryText}>Create Room</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsContainer}
        >
          {MOCK_STATS.map(renderStatCard)}
        </ScrollView>

        {/* Rooms Grid/List */}
        <View style={styles.roomsList}>
          {MOCK_ROOMS.map(renderRoomCard)}
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
    backgroundColor: '#F43F5E',
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

  // Main Content
  scrollContent: {
    paddingTop: 24,
  },
  pageHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  btnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  btnOutlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Stats
  statsContainer: {
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    minWidth: 160,
    gap: 12,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTextContainer: {
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Rooms List
  roomsList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  roomCard: {
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
  roomCardTopStrip: {
    height: 6,
    width: '100%',
  },
  roomCardContent: {
    padding: 20,
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  roomTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roomIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomTextGroup: {
    flex: 1,
    paddingRight: 16,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  roomUrl: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  menuButton: {
    padding: 4,
    marginRight: -4,
    marginTop: -4,
  },
  roomStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  roomIdText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  roomActionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  roomActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
