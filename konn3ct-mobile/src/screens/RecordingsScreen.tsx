import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Headset,
  Bell,
  Film,
  Clock,
  Users,
  Calendar,
  Search,
  Play,
  Share2,
  Download,
  Trash2,
  X,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
  amber: '#f59e0b',
  purple: '#8b5cf6',
};

const MOCK_STATS = [
  { id: 'total', label: 'Total Recordings', value: '24', icon: Film, color: COLORS.brandBlue },
  { id: 'duration', label: 'Total Duration', value: '18h 30m', icon: Clock, color: COLORS.brandGreen },
  { id: 'participants', label: 'Participants', value: '450', icon: Users, color: COLORS.purple },
  { id: 'thisMonth', label: 'This Month', value: '8', icon: Calendar, color: COLORS.amber },
];

const MOCK_RECORDINGS = [
  {
    id: 'rec-1',
    name: 'Q3 Global Townhall',
    date: 'Oct 15, 2026',
    duration: '1h 45m',
    participants: 120,
    size: '450 MB',
    colors: ['#3b82f6', '#2563eb'], // Blue
  },
  {
    id: 'rec-2',
    name: 'Design Sync - Mobile App',
    date: 'Oct 12, 2026',
    duration: '45m',
    participants: 8,
    size: '120 MB',
    colors: ['#ec4899', '#db2777'], // Pink
  },
  {
    id: 'rec-3',
    name: 'Investor Q&A Session',
    date: 'Oct 10, 2026',
    duration: '1h 10m',
    participants: 45,
    size: '280 MB',
    colors: ['#10b981', '#059669'], // Green
  },
];

export default function RecordingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  const handleAction = (action: string, id: string) => {
    console.log(`${action} recording:`, id);
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

  const renderRecordingCard = (rec: typeof MOCK_RECORDINGS[0]) => {
    return (
      <View key={rec.id} style={styles.recCard}>
        {/* Thumbnail Area */}
        <TouchableOpacity 
          activeOpacity={0.85}
          onPress={() => handleAction('Play', rec.id)}
        >
          <LinearGradient
            colors={rec.colors as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.thumbnail}
          >
            <View style={styles.playIconContainer}>
              <Play color={rec.colors[1]} size={24} fill={rec.colors[1]} style={{ marginLeft: 3 }} />
            </View>
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{rec.duration}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.cardContent}>
          {/* Header Info */}
          <View style={styles.cardHeader}>
            <Text style={styles.recName} numberOfLines={1}>{rec.name}</Text>
            <Text style={styles.recDate}>{rec.date}</Text>
          </View>

          {/* Footer Actions & Meta */}
          <View style={styles.cardFooter}>
            <View style={styles.metaGroup}>
              <View style={styles.metaItem}>
                <Users color={COLORS.textMuted} size={12} />
                <Text style={styles.metaText}>{rec.participants}</Text>
              </View>
              <View style={styles.dotSeparator} />
              <Text style={styles.metaText}>{rec.size}</Text>
            </View>

            <View style={styles.actionsGroup}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('Share', rec.id)}>
                <Share2 color={COLORS.textMuted} size={16} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleAction('Download', rec.id)}>
                <Download color={COLORS.textMuted} size={16} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnDanger} onPress={() => handleAction('Delete', rec.id)}>
                <Trash2 color={COLORS.danger} size={16} />
              </TouchableOpacity>
            </View>
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
          <Text style={styles.modalTitle}>Recordings</Text>
          <Text style={styles.modalSubtitle}>View, share, and manage your recorded sessions.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Quick Stats */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsContainer}
        >
          {MOCK_STATS.map(renderStatCard)}
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Search color={COLORS.textMuted} size={18} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recordings..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Recordings List */}
        <View style={styles.recordingsList}>
          {MOCK_RECORDINGS.map(renderRecordingCard)}
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

  // Search
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
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
  },

  // Recordings List
  recordingsList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  recCard: {
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
  thumbnail: {
    height: 140,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  playIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    marginBottom: 16,
  },
  recName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  recDate: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  actionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDanger: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${COLORS.danger}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
