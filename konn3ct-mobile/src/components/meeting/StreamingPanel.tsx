import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Animated, Keyboard, Platform, Alert } from 'react-native';
import { Radio, Plus, Trash2, StopCircle, RefreshCw, X, Globe } from 'lucide-react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useAuthStore } from '../../store/useAuthStore';
import { streamingApi } from '../../api/client';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { meetingThemeTokens } from '../../theme/meetingTheme';

interface StreamingPanelProps {
  roomId: string;
}

export const StreamingPanel: React.FC<StreamingPanelProps> = ({ roomId }) => {
  const { isHost, theme, setActivePane } = useMeetingStore();
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);

  const [rtmpUrls, setRtmpUrls] = useState<string[]>(['']);
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [keyboardHeightAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (Platform.OS === 'android') {
      const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
        Animated.timing(keyboardHeightAnim, {
          toValue: e.endCoordinates.height,
          duration: 250,
          useNativeDriver: false
        }).start();
      });
      const hideSub = Keyboard.addListener('keyboardDidHide', () => {
        Animated.timing(keyboardHeightAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false
        }).start();
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }
  }, []);

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, [roomId]);

  const fetchStreams = async () => {
    if (!isHost || !roomId) return;
    try {
      const streams = await streamingApi.getStreams(roomId);
      setActiveStreams(streams.filter(s => s.status === 'live' || s.status === 'processing'));
    } catch (err) {
      console.error("Failed to fetch streams", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addUrlField = () => {
    if (rtmpUrls.length >= 5) {
      Alert.alert('Error', 'Maximum 5 simultaneous streams allowed.');
      return;
    }
    setRtmpUrls([...rtmpUrls, '']);
  };

  const removeUrlField = (index: number) => {
    setRtmpUrls(rtmpUrls.filter((_, i) => i !== index));
  };

  const handleUrlChange = (index: number, val: string) => {
    const newUrls = [...rtmpUrls];
    newUrls[index] = val;
    setRtmpUrls(newUrls);
  };

  const handleStartStream = async () => {
    const validUrls = rtmpUrls.filter(u => u.trim().length > 0);
    if (validUrls.length === 0) {
      Alert.alert('Error', 'Please enter at least one valid RTMP URL.');
      return;
    }

    try {
      setIsStarting(true);
      await streamingApi.startStream({
        roomId,
        rtmpUrls: validUrls
      });
      Alert.alert('Success', 'Streaming process started! It may take a minute to go live.');
      setRtmpUrls(['']); // Reset form
      fetchStreams();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to start streaming');
    } finally {
      setIsStarting(false);
    }
  };

  // Only host can initiate streaming
  if (!isHost) {
    return (
      <View style={styles.container}>
        <View style={styles.dragIndicatorContainer}>
          <View style={styles.dragIndicator} />
        </View>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrapper}>
              <Radio size={22} color={tokens.primary} />
            </View>
            <Text style={styles.headerTitle}>Live Streaming</Text>
          </View>
          <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
            <X size={20} color={tokens.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.mutedText}>Only the meeting host can manage live streams.</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { paddingBottom: keyboardHeightAnim }]}>
      <View style={styles.dragIndicatorContainer}>
        <View style={styles.dragIndicator} />
      </View>
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrapper}>
            <Radio size={22} color={tokens.primary} />
          </View>
          <Text style={styles.headerTitle}>Live Streaming</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={fetchStreams} disabled={isLoading} style={styles.iconBtn}>
            <RefreshCw size={20} color={tokens.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
            <X size={20} color={tokens.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAwareScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === 'android' ? 100 : 20}
        keyboardShouldPersistTaps="handled"
      >
        
        {/* Active Streams */}
        {activeStreams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE BROADCASTS</Text>
            {activeStreams.map(stream => (
              <View key={stream.id} style={styles.streamCard}>
                <View style={styles.streamHeader}>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: stream.status === 'processing' ? tokens.warning : tokens.danger }]} />
                    <Text style={styles.statusText}>{stream.status.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleStopStream(stream.id)} style={styles.stopBtn}>
                    <StopCircle size={14} color={tokens.danger} />
                    <Text style={styles.stopBtnText}>Stop</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.streamDetail}>Broadcasting to {stream.rtmpUrls.length} destination(s)</Text>
              </View>
            ))}
          </View>
        )}

        {/* Start New Stream */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>START NEW BROADCAST</Text>
            <TouchableOpacity onPress={addUrlField} style={styles.addBtn}>
              <Plus size={16} color={tokens.primary} />
              <Text style={styles.addBtnText}>Add URL</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardGroup}>
            {rtmpUrls.map((url, i) => (
              <View key={i} style={[styles.inputRow, i > 0 && styles.inputRowBorder]}>
                <View style={styles.inputIconWrapper}>
                  <Globe size={18} color={tokens.textMuted} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="rtmp://a.rtmp.youtube.com/live2/..."
                  placeholderTextColor={tokens.textMuted}
                  value={url}
                  onChangeText={(val) => handleUrlChange(i, val)}
                  autoCapitalize="none"
                />
                {rtmpUrls.length > 1 && (
                  <TouchableOpacity onPress={() => removeUrlField(i)} style={styles.trashBtn}>
                    <Trash2 size={18} color={tokens.danger} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          <Text style={styles.helpText}>
            Enter the RTMP URLs and Stream Keys for platforms like YouTube or Facebook.
          </Text>

          <TouchableOpacity 
            style={[styles.primaryBtn, isStarting && styles.primaryBtnDisabled]} 
            onPress={handleStartStream}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Start Broadcast</Text>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAwareScrollView>
    </Animated.View>
  );
};

const getStyles = (t: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '75%',
    backgroundColor: t.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: t.shadowOpacity, shadowRadius: 15, elevation: 10,
    zIndex: 100,
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragIndicator: {
    width: 48,
    height: 5,
    backgroundColor: t.border,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: t.bgActiveBadge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: t.textPrimary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  mutedText: {
    color: t.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: t.textMuted,
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginLeft: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.bgActiveBadge,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addBtnText: {
    color: t.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardGroup: {
    backgroundColor: t.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  inputRowBorder: {
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  inputIconWrapper: {
    width: 32,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: t.textPrimary,
    padding: 12,
    fontSize: 15,
  },
  trashBtn: {
    padding: 8,
    backgroundColor: t.bgElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: t.border,
  },
  streamCard: {
    backgroundColor: t.bg,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  streamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: t.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: t.bgElevated,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
  },
  stopBtnText: {
    color: t.danger,
    fontSize: 12,
    fontWeight: 'bold',
  },
  streamDetail: {
    color: t.textSecondary,
    fontSize: 13,
  },
  helpText: {
    color: t.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
    marginLeft: 8,
  },
  primaryBtn: {
    backgroundColor: t.primary,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: t.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
