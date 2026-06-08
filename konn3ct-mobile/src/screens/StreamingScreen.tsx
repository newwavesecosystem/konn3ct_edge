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
  Radio,
  PlayCircle,
  Video,
  Cast,
  StopCircle,
  Globe,
  Calendar,
  Clock,
  X,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

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
  inactive: '#9ca3af',
};

const MOCK_STATS = [
  { id: 'total', label: 'Total Streams', value: '14', icon: Radio, color: COLORS.brandBlue },
  { id: 'active', label: 'Active Streams', value: '2', icon: PlayCircle, color: COLORS.brandGreen },
];

const MOCK_STREAMS = [
  {
    id: 'stream-1',
    roomName: 'Global Marketing Webinar',
    type: 'Youtube',
    isRunning: true,
    startedAt: 'Oct 24, 2026',
    endedAt: null,
  },
  {
    id: 'stream-2',
    roomName: 'Product Launch Q3',
    type: 'Facebook',
    isRunning: true,
    startedAt: 'Oct 24, 2026',
    endedAt: null,
  },
  {
    id: 'stream-3',
    roomName: 'Engineering Sync',
    type: 'Combo',
    isRunning: false,
    startedAt: 'Oct 20, 2026',
    endedAt: 'Oct 20, 2026',
  },
];

export default function StreamingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const getPlatformIcon = (type: string) => {
    switch (type) {
      case 'Youtube':
        return Video;
      case 'Facebook':
        return Cast;
      case 'Combo':
      default:
        return Globe;
    }
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

  const renderStreamCard = (stream: typeof MOCK_STREAMS[0]) => {
    const PlatformIcon = getPlatformIcon(stream.type);
    const gradientColors = stream.isRunning 
      ? [COLORS.brandGreen, '#34d399'] 
      : [COLORS.inactive, '#d1d5db'];
    
    const iconBgColor = stream.isRunning ? COLORS.brandGreen : COLORS.inactive;

    return (
      <View key={stream.id} style={styles.streamCard}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardTopStrip}
        />
        
        <View style={styles.cardContent}>
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <View style={styles.titleGroup}>
              <View style={[styles.platformIconBox, { backgroundColor: iconBgColor }]}>
                <PlatformIcon color="#ffffff" size={20} />
              </View>
              <View style={styles.textGroup}>
                <Text style={styles.roomName} numberOfLines={1}>{stream.roomName}</Text>
                <Text style={styles.platformType} numberOfLines={1}>{stream.type}</Text>
              </View>
            </View>
            
            <View style={[styles.statusBadge, stream.isRunning ? styles.statusBadgeActive : styles.statusBadgeEnded]}>
              <Text style={[styles.statusBadgeText, stream.isRunning ? styles.statusBadgeTextActive : styles.statusBadgeTextEnded]}>
                {stream.isRunning ? 'Running' : 'Ended'}
              </Text>
            </View>
          </View>

          {/* Meta Row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Calendar color={COLORS.textMuted} size={14} />
              <Text style={styles.metaText}>Started: <Text style={styles.metaValue}>{stream.startedAt}</Text></Text>
            </View>
            <View style={styles.metaItem}>
              <Clock color={COLORS.textMuted} size={14} />
              <Text style={styles.metaText}>Ended: <Text style={styles.metaValue}>{stream.endedAt || '---'}</Text></Text>
            </View>
          </View>

          {/* Footer Action */}
          <View style={styles.cardFooter}>
            {stream.isRunning ? (
              <TouchableOpacity style={styles.stopBtn} activeOpacity={0.8}>
                <StopCircle color="#ffffff" size={16} />
                <Text style={styles.stopBtnText}>Stop Streaming</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.endedBtn}>
                <Text style={styles.endedBtnText}>Stream Ended</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Math.max(insets.top, 24) }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.modalTitle}>Live Streams</Text>
          <Text style={styles.modalSubtitle}>Manage and broadcast your live sessions to external platforms.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Action Button */}
        <View style={styles.actionRow}>
          <TouchableOpacity activeOpacity={0.85} style={{ flex: 1 }}>
            <LinearGradient
              colors={[COLORS.brandBlue, COLORS.brandBlueDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnPrimary}
            >
              <Cast color="#ffffff" size={16} />
              <Text style={styles.btnPrimaryText}>Start Stream</Text>
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

        {/* Streams List */}
        <View style={styles.streamsList}>
          {MOCK_STREAMS.map(renderStreamCard)}
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

  // Main Content
  scrollContent: {
    paddingTop: 24,
  },

  // Action Button
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  btnPrimary: {
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

  // Streams List
  streamsList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  streamCard: {
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
    height: 6,
    width: '100%',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  platformIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textGroup: {
    flex: 1,
    paddingRight: 12,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  platformType: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: `${COLORS.brandGreen}15`,
  },
  statusBadgeEnded: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextActive: {
    color: COLORS.brandGreen,
  },
  statusBadgeTextEnded: {
    color: COLORS.textMuted,
  },
  metaRow: {
    gap: 8,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  metaValue: {
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  cardFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  stopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  endedBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  endedBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
