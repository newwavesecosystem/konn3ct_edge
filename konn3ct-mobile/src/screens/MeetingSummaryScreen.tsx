import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Brain, FileText, CheckCircle } from 'lucide-react-native';
import { apiClient } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'MeetingSummary'>;

export function MeetingSummaryScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
  const [summary, setSummary] = useState<any>(null);
  const [transcriptions, setTranscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/ai/summary/${roomId}`).then(res => res.data).catch(() => null),
      apiClient.get(`/ai/transcription/${roomId}`).then(res => res.data).catch(() => [])
    ]).then(([s, t]) => {
      setSummary(s);
      setTranscriptions(t);
      setIsLoading(false);
    });
  }, [roomId]);

  let actionItems: string[] = [];
  try {
    if (summary?.actionItems) {
      actionItems = JSON.parse(summary.actionItems);
    }
  } catch (e) {}

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* AI Summary Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain color="#3b82f6" size={24} />
            <Text style={styles.sectionTitle}>AI Summary</Text>
          </View>
          {summary ? (
            <Text style={styles.summaryText}>{summary.summary}</Text>
          ) : (
            <Text style={styles.emptyText}>No summary available.</Text>
          )}
        </View>

        {/* Action Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CheckCircle color="#10b981" size={24} />
            <Text style={styles.sectionTitle}>Action Items</Text>
          </View>
          {actionItems.length > 0 ? (
            actionItems.map((item, i) => (
              <View key={i} style={styles.actionItem}>
                <View style={styles.checkbox} />
                <Text style={styles.actionItemText}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No action items identified.</Text>
          )}
        </View>

        {/* Transcript Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText color="#f59e0b" size={24} />
            <Text style={styles.sectionTitle}>Full Transcript</Text>
          </View>
          {transcriptions.length > 0 ? (
            transcriptions.map((t, i) => (
              <View key={i} style={styles.transcriptItem}>
                <Text style={styles.transcriptText}>{t.content}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No transcript available.</Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  summaryText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 24,
  },
  emptyText: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#334155',
    marginRight: 10,
    marginTop: 2,
  },
  actionItemText: {
    color: '#cbd5e1',
    flex: 1,
    fontSize: 14,
  },
  transcriptItem: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
  },
  transcriptText: {
    color: '#94a3b8',
    fontSize: 14,
  }
});
