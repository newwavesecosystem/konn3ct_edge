import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { fetchStreamings, startStreaming, startComboStreaming, stopStreaming, StreamingItem } from '../api/streamings';
import { fetchMyRooms, Room } from '../api/rooms';
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
  ChevronDown,
  Check,
  Search,
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

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export default function StreamingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // API States
  const [streamings, setStreamings] = React.useState<StreamingItem[]>([]);
  const [myRooms, setMyRooms] = React.useState<Room[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Modal States
  const [isModalVisible, setModalVisible] = React.useState(false);
  const [showRoomSelect, setShowRoomSelect] = React.useState(false);
  const [roomSearch, setRoomSearch] = React.useState('');
  const [streamType, setStreamType] = React.useState<'Youtube' | 'Facebook' | 'Combo'>('Youtube');
  const [roomId, setRoomId] = React.useState('');
  const [streamKey, setStreamKey] = React.useState('');
  const [youtubeKey, setYoutubeKey] = React.useState('');
  const [facebookKey, setFacebookKey] = React.useState('');
  const [isStarting, setIsStarting] = React.useState(false);

  const selectedRoom = myRooms.find(r => String(r.id) === String(roomId));

  const filteredRooms = React.useMemo(() => {
    if (!roomSearch.trim()) return myRooms;
    const q = roomSearch.toLowerCase();
    return myRooms.filter(r => (r.name || `Room ${r.id}`).toLowerCase().includes(q));
  }, [myRooms, roomSearch]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [streamingsData, roomsData] = await Promise.all([
        fetchStreamings(),
        fetchMyRooms()
      ]);
      setStreamings(streamingsData);
      setMyRooms(roomsData);
      
      // Auto-select first room if none selected
      if (roomsData.length > 0 && !roomId) {
        setRoomId(String(roomsData[0].id));
      }
    } catch (error) {
      console.error('Failed to load streamings or rooms', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleStopStream = async (id: string | number) => {
    try {
      await stopStreaming(id);
      Alert.alert('Success', 'Stream stopped successfully');
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to stop stream');
    }
  };

  const handleStartStream = async () => {
    if (!roomId) {
      Alert.alert('Error', 'Room ID is required');
      return;
    }
    setIsStarting(true);
    try {
      if (streamType === 'Combo') {
        if (!youtubeKey || !facebookKey) {
          Alert.alert('Error', 'Both Youtube and Facebook keys are required for Combo streaming.');
          setIsStarting(false);
          return;
        }
        await startComboStreaming({ room_id: roomId, youtube_key: youtubeKey, facebook_key: facebookKey });
      } else {
        if (!streamKey) {
          Alert.alert('Error', 'Stream key is required.');
          setIsStarting(false);
          return;
        }
        await startStreaming({ room_id: roomId, type: streamType, key: streamKey });
      }
      
      Alert.alert('Success', 'Stream started successfully');
      setModalVisible(false);
      setRoomId('');
      setStreamKey('');
      setYoutubeKey('');
      setFacebookKey('');
      loadData();
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Failed to start stream';
      Alert.alert('Error', msg);
    } finally {
      setIsStarting(false);
    }
  };

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

  const renderStatCard = (stat: { id: string; label: string; value: string; icon: any; color: string }) => {
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

  const totalStreams = streamings.length;
  const activeStreams = streamings.filter(s => {
    const stat = String(s.status || '').toLowerCase();
    return stat === 'running' || s.is_running === true || stat === 'active' || stat === '1';
  }).length;

  const dynamicStats = [
    { id: 'total', label: 'Total Streams', value: String(totalStreams), icon: Radio, color: COLORS.brandBlue },
    { id: 'active', label: 'Active Streams', value: String(activeStreams), icon: PlayCircle, color: COLORS.brandGreen },
  ];

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
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} />}
      >

        {/* Action Button */}
        <View style={styles.actionRow}>
          <TouchableOpacity testID="open-stream-modal" activeOpacity={0.85} style={{ flex: 1 }} onPress={() => setModalVisible(true)}>
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
          {dynamicStats.map(renderStatCard)}
        </ScrollView>

        {/* Streams List */}
        <View style={styles.streamsList}>
          {streamings.length === 0 && !isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: COLORS.textMuted }}>No active or past streams found.</Text>
            </View>
          ) : (
            streamings.map((stream, i) => {
              const platform = stream.type || stream.platform || 'Youtube';
              const PlatformIcon = getPlatformIcon(platform);
              const roomName = stream.room_name || stream.room?.name || `Room ${stream.room_id || 'Unknown'}`;
              
              const statusStr = String(stream.status || '').toLowerCase();
              const isRunning = statusStr === 'running' || stream.is_running === true || statusStr === 'active' || statusStr === '1';
              
              const gradientColors = isRunning 
                ? [COLORS.brandGreen, '#34d399'] 
                : [COLORS.inactive, '#d1d5db'];
              const iconBgColor = isRunning ? COLORS.brandGreen : COLORS.inactive;

              return (
                <View key={stream.id || i} style={styles.streamCard}>
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
                          <Text style={styles.roomName} numberOfLines={1}>{roomName}</Text>
                          <Text style={styles.platformType} numberOfLines={1}>{platform}</Text>
                        </View>
                      </View>
                      
                      <View style={[styles.statusBadge, isRunning ? styles.statusBadgeActive : styles.statusBadgeEnded]}>
                        <Text style={[styles.statusBadgeText, isRunning ? styles.statusBadgeTextActive : styles.statusBadgeTextEnded]}>
                          {isRunning ? 'Running' : 'Ended'}
                        </Text>
                      </View>
                    </View>

                    {/* Meta Row */}
                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Calendar color={COLORS.textMuted} size={14} />
                        <Text style={styles.metaText}>Started: <Text style={styles.metaValue}>{formatDate(stream.created_at)}</Text></Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Clock color={COLORS.textMuted} size={14} />
                        <Text style={styles.metaText}>Updated: <Text style={styles.metaValue}>{formatDate(stream.updated_at)}</Text></Text>
                      </View>
                    </View>

                    {/* Footer Action */}
                    <View style={styles.cardFooter}>
                      {isRunning ? (
                        <TouchableOpacity 
                          style={styles.stopBtn} 
                          activeOpacity={0.8}
                          onPress={() => handleStopStream(stream.id)}
                        >
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
            })
          )}
        </View>
      </ScrollView>

      {/* Start Stream Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Start New Stream</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color={COLORS.textMuted} size={24} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              enableOnAndroid={true}
              enableAutomaticScroll={true}
              extraScrollHeight={120}
              extraHeight={120}
              contentContainerStyle={{ paddingBottom: 80 }}
            >
              <Text style={styles.inputLabel}>Select Room</Text>
              <TouchableOpacity 
                style={styles.dropdownBtn} 
                activeOpacity={0.7}
                onPress={() => setShowRoomSelect(!showRoomSelect)}
                testID="stream-room-dropdown-btn"
              >
                <Text style={[styles.dropdownBtnText, !selectedRoom && { color: COLORS.inactive }]}>
                  {selectedRoom ? (selectedRoom.name || `Room ${selectedRoom.id}`) : 'Select a room...'}
                </Text>
                <ChevronDown size={20} color={COLORS.textMuted} />
              </TouchableOpacity>

              {showRoomSelect && (
                <View style={styles.dropdownList}>
                  {/* Search bar inside dropdown */}
                  <View style={styles.dropdownSearchRow}>
                    <Search size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.dropdownSearchInput}
                      placeholder="Search rooms..."
                      value={roomSearch}
                      onChangeText={setRoomSearch}
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {roomSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setRoomSearch('')} style={{ padding: 4 }}>
                        <X size={14} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView
                    nestedScrollEnabled={true}
                    style={{ maxHeight: 200 }}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredRooms.length === 0 ? (
                      <Text style={styles.dropdownEmpty}>
                        {myRooms.length === 0 ? "No rooms found. Create a room first." : "No matching rooms found."}
                      </Text>
                    ) : (
                      filteredRooms.map(r => {
                        const rId = String(r.id);
                        const isSelected = roomId === rId;
                        return (
                          <TouchableOpacity 
                            key={rId} 
                            style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                            onPress={() => {
                              setRoomId(rId);
                              setShowRoomSelect(false);
                              setRoomSearch('');
                            }}
                          >
                            <Text style={[styles.dropdownItemText, isSelected && { color: COLORS.brandBlue, fontWeight: 'bold' }]}>
                              {r.name || `Room ${rId}`}
                            </Text>
                            {isSelected && <Check size={16} color={COLORS.brandBlue} />}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.inputLabel}>Platform Type</Text>
              <View style={styles.typeSelector}>
                {['Youtube', 'Facebook', 'Combo'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, streamType === t && styles.typeBtnActive]}
                    onPress={() => setStreamType(t as any)}
                  >
                    <Text style={[styles.typeBtnText, streamType === t && styles.typeBtnTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {streamType === 'Combo' ? (
                <>
                  <Text style={styles.inputLabel}>YouTube Stream Key</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter YouTube Key"
                    value={youtubeKey}
                    onChangeText={setYoutubeKey}
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Facebook Stream Key</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter Facebook Key"
                    value={facebookKey}
                    onChangeText={setFacebookKey}
                    autoCapitalize="none"
                  />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>{streamType} Stream Key</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder={`Enter ${streamType} Key`}
                    value={streamKey}
                    onChangeText={setStreamKey}
                    autoCapitalize="none"
                  />
                </>
              )}

              <TouchableOpacity 
                testID="start-stream-btn"
                style={[styles.submitBtn, isStarting && { opacity: 0.7 }]} 
                onPress={handleStartStream}
                disabled={isStarting}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[COLORS.brandBlue, COLORS.brandBlueDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtnGradient}
                >
                  {isStarting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Cast color="#ffffff" size={18} />
                      <Text style={styles.submitBtnText}>Start Stream</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>
        </KeyboardAvoidingView>
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
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '92%',
    flexShrink: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  inputField: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: `${COLORS.brandBlue}10`,
    borderColor: COLORS.brandBlue,
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  typeBtnTextActive: {
    color: COLORS.brandBlue,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownBtnText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  dropdownList: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  dropdownEmpty: {
    padding: 14,
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  dropdownItemText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  submitBtn: {
    marginTop: 24,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
