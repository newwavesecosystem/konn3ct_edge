import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Radio, Plus, Trash2, StopCircle, RefreshCw } from 'lucide-react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useAuthStore } from '../../store/useAuthStore';
import { streamingApi } from '../../api/client';

// Use basic alerts for native toasts
import { Alert } from 'react-native';

interface StreamingPanelProps {
  roomId: string;
}

export const StreamingPanel: React.FC<StreamingPanelProps> = ({ roomId }) => {
  const { currentUserRole } = useMeetingStore();
  const [rtmpUrls, setRtmpUrls] = useState<string[]>(['']);
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, [roomId]);

  const fetchStreams = async () => {
    if (currentUserRole !== 'host' || !roomId) return;
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

  const handleStopStream = async (streamId: string) => {
    try {
      await streamingApi.stopStream(streamId);
      Alert.alert('Success', 'Stop signal sent to stream.');
      fetchStreams();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to stop stream');
    }
  };

  if (currentUserRole !== 'host') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Radio size={20} color="#10b981" />
          <Text style={styles.headerTitle}>Live Streaming</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.mutedText}>Only the meeting host can manage live streams.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Radio size={20} color="#10b981" />
          <Text style={styles.headerTitle}>Live Streaming</Text>
        </View>
        <TouchableOpacity onPress={fetchStreams} disabled={isLoading} style={styles.iconBtn}>
          <RefreshCw size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        
        {/* Active Streams */}
        {activeStreams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ACTIVE BROADCASTS</Text>
            {activeStreams.map(stream => (
              <View key={stream.id} style={styles.streamCard}>
                <View style={styles.streamHeader}>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: stream.status === 'processing' ? '#fbbf24' : '#ef4444' }]} />
                    <Text style={styles.statusText}>{stream.status.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleStopStream(stream.id)} style={styles.stopBtn}>
                    <StopCircle size={14} color="#ef4444" />
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
              <Plus size={14} color="#10b981" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {rtmpUrls.map((url, i) => (
            <View key={i} style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="rtmp://a.rtmp.youtube.com/live2/..."
                placeholderTextColor="#64748b"
                value={url}
                onChangeText={(val) => handleUrlChange(i, val)}
                autoCapitalize="none"
              />
              {rtmpUrls.length > 1 && (
                <TouchableOpacity onPress={() => removeUrlField(i)} style={styles.trashBtn}>
                  <Trash2 size={18} color="#f87171" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <Text style={styles.helpText}>
            Enter the RTMP URLs and Stream Keys for platforms like YouTube or Facebook.
          </Text>

          <TouchableOpacity 
            style={[styles.primaryBtn, isStarting && styles.primaryBtnDisabled]} 
            onPress={handleStartStream}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryBtnText}>Go Live</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconBtn: {
    padding: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  mutedText: {
    color: '#94a3b8',
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  addBtnText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  streamCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
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
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 6,
  },
  stopBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  streamDetail: {
    color: '#94a3b8',
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  trashBtn: {
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  helpText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
