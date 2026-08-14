import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Linking,
  RefreshControl,
  Alert,
  Share,
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
import { fetchRecordings, deleteRecording, RecordingItem, DownloadLinks } from '../api/recordings';

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

const formatBytes = (bytesStr?: string | number) => {
  if (!bytesStr) return '0 MB';
  const bytes = Number(bytesStr);
  if (isNaN(bytes)) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
};

const formatDuration = (start?: string, end?: string) => {
  if (!start || !end) return '---';
  const s = Number(start);
  const e = Number(end);
  if (isNaN(s) || isNaN(e)) return '---';
  const ms = e - s;
  if (ms <= 0) return '0m';
  const totalMins = Math.floor(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const formatDate = (timestamp?: string) => {
  if (!timestamp) return '---';
  const d = new Date(Number(timestamp));
  if (isNaN(d.getTime())) return '---';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Cycle through colors
const REC_PALETTES: [string, string][] = [
  ['#3b82f6', '#2563eb'], // Blue
  ['#10b981', '#059669'], // Green
  ['#8b5cf6', '#7c3aed'], // Purple
  ['#ec4899', '#db2777'], // Pink
  ['#f59e0b', '#d97706'], // Amber
];

export default function RecordingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLinks | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchRecordings();
      setRecordings(res.recordings);
      if (res.downloadLinks) {
        setDownloadLinks(res.downloadLinks);
      }
    } catch (e) {
      console.error('Failed to load recordings', e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Recording', 'Are you sure you want to delete this recording?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecording(id);
            Alert.alert('Success', 'Recording deleted');
            loadData();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete recording');
          }
        }
      }
    ]);
  };

  const handlePlay = (rec: RecordingItem) => {
    const url = rec.playback?.format?.url;
    if (url) {
      Linking.openURL(url).catch(() => Alert.alert('Error', 'Cannot open playback URL'));
    } else {
      Alert.alert('Notice', 'Playback URL not available yet.');
    }
  };

  const handleDownload = (rec: RecordingItem) => {
    if (!downloadLinks || !downloadLinks.video) {
      Alert.alert('Error', 'Download links not available.');
      return;
    }
    const url = downloadLinks.video.url.replace('replaceRecordID', rec.recordID);
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Cannot open download URL'));
  };

  const handleShare = (rec: RecordingItem) => {
    const url = rec.playback?.format?.url;
    if (url) {
      Share.share({ message: `Watch this recording: ${rec.name}\n${url}` });
    } else {
      Alert.alert('Notice', 'No URL to share.');
    }
  };

  const renderStatCard = (stat: any) => {
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

  const renderRecordingCard = (rec: RecordingItem, index: number) => {
    const colors = REC_PALETTES[index % REC_PALETTES.length];
    
    return (
      <View key={rec.recordID} style={styles.recCard}>
        {/* Thumbnail Area */}
        <TouchableOpacity 
          activeOpacity={0.85}
          onPress={() => handlePlay(rec)}
        >
          <LinearGradient
            colors={colors as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.thumbnail}
          >
            <View style={styles.playIconContainer}>
              <Play color={colors[1]} size={24} fill={colors[1]} style={{ marginLeft: 3 }} />
            </View>
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(rec.startTime, rec.endTime)}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.cardContent}>
          {/* Header Info */}
          <View style={styles.cardHeader}>
            <Text style={styles.recName} numberOfLines={1}>{rec.name}</Text>
            <Text style={styles.recDate}>{formatDate(rec.startTime)}</Text>
          </View>

          {/* Footer Actions & Meta */}
          <View style={styles.cardFooter}>
            <View style={styles.metaGroup}>
              <View style={styles.metaItem}>
                <Users color={COLORS.textMuted} size={12} />
                <Text style={styles.metaText}>{rec.participants || 0}</Text>
              </View>
              <View style={styles.dotSeparator} />
              <Text style={styles.metaText}>{formatBytes(rec.size)}</Text>
            </View>

            <View style={styles.actionsGroup}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(rec)}>
                <Share2 color={COLORS.textMuted} size={16} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDownload(rec)}>
                <Download color={COLORS.textMuted} size={16} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnDanger} onPress={() => handleDelete(rec.recordID)}>
                <Trash2 color={COLORS.danger} size={16} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const totalRecs = recordings.length;
  const totalDurationMs = recordings.reduce((acc, r) => {
    const s = Number(r.startTime);
    const e = Number(r.endTime);
    if (!isNaN(s) && !isNaN(e) && e > s) {
      return acc + (e - s);
    }
    return acc;
  }, 0);
  const totalDurationStr = formatDuration('0', String(totalDurationMs));
  const totalParticipants = recordings.reduce((acc, r) => acc + Number(r.participants || 0), 0);
  
  const thisMonthCount = recordings.filter(r => {
    if (!r.startTime) return false;
    const d = new Date(Number(r.startTime));
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const dynamicStats = [
    { id: 'total', label: 'Total Recordings', value: String(totalRecs), icon: Film, color: COLORS.brandBlue },
    { id: 'duration', label: 'Total Duration', value: totalDurationStr, icon: Clock, color: COLORS.brandGreen },
    { id: 'participants', label: 'Participants', value: String(totalParticipants), icon: Users, color: COLORS.purple },
    { id: 'thisMonth', label: 'This Month', value: String(thisMonthCount), icon: Calendar, color: COLORS.amber },
  ];

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
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >

        {/* Quick Stats */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsContainer}
        >
          {dynamicStats.map(renderStatCard)}
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
          {(() => {
            const filteredRecordings = recordings.filter(r => 
              (r.name || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
            
            if (filteredRecordings.length === 0 && !isLoading) {
              return (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.textMuted }}>
                    {searchQuery ? 'No recordings match your search.' : 'No recordings found.'}
                  </Text>
                </View>
              );
            }
            return filteredRecordings.map((r, idx) => renderRecordingCard(r, idx));
          })()}
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
