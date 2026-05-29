import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { MediasoupService } from '../../webrtc/MediasoupService';

interface PollsPanelProps {
  service: MediasoupService | null;
}

export const PollsPanel: React.FC<PollsPanelProps> = ({ service }) => {
  const polls = useMeetingStore(state => state.polls);
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const currentUserRole = useMeetingStore(state => state.currentUserRole);
  
  const isHost = currentUserRole === 'host';
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleVote = (pollId: string, optionId: string) => {
    if (service) service.votePoll(pollId, optionId);
  };

  const handleCreate = () => {
    if (!question.trim() || options.filter(o => o.trim()).length < 2) return;
    if (service) {
      service.createPoll(
        'poll-' + Math.random().toString(36).substr(2, 9),
        question.trim(),
        options.filter(o => o.trim()).map(text => ({ text }))
      );
    }
    setQuestion('');
    setOptions(['', '']);
    setIsCreating(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meeting Polls</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {isHost && !isCreating && (
          <TouchableOpacity style={styles.createBtn} onPress={() => setIsCreating(true)}>
            <Text style={styles.createText}>+ Create New Poll</Text>
          </TouchableOpacity>
        )}

        {isCreating && (
          <View style={styles.createForm}>
            <Text style={styles.label}>Question</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g. What should we build next?"
              placeholderTextColor="#94a3b8"
              value={question}
              onChangeText={setQuestion}
            />
            <Text style={styles.label}>Options</Text>
            {options.map((opt, idx) => (
              <TextInput
                key={idx}
                style={styles.input}
                placeholder={`Option ${idx + 1}`}
                placeholderTextColor="#94a3b8"
                value={opt}
                onChangeText={text => {
                  const newOpts = [...options];
                  newOpts[idx] = text;
                  setOptions(newOpts);
                }}
              />
            ))}
            <TouchableOpacity 
              style={styles.addOptionBtn}
              onPress={() => setOptions([...options, ''])}
            >
              <Text style={styles.addOptionText}>+ Add Option</Text>
            </TouchableOpacity>
            
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreating(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreate}>
                <Text style={styles.submitText}>Launch Poll</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!isCreating && polls.map(poll => {
          const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);
          return (
            <View key={poll.id} style={styles.pollCard}>
              <Text style={styles.pollQuestion}>{poll.question}</Text>
              {poll.options.map(opt => {
                const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                return (
                  <TouchableOpacity 
                    key={opt.id} 
                    style={styles.optionRow}
                    onPress={() => !poll.votedOptionId && handleVote(poll.id, opt.id)}
                    disabled={!!poll.votedOptionId}
                  >
                    <View style={styles.optionContent}>
                      <Text style={styles.optionText}>{opt.text}</Text>
                      <Text style={styles.optionVotes}>{percent}% ({opt.votes})</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${percent}%` }]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {!isCreating && polls.length === 0 && (
          <Text style={styles.emptyText}>No active polls right now.</Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '70%',
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  closeText: { color: '#94a3b8', fontSize: 20 },
  content: { flex: 1, padding: 16 },
  createBtn: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  createText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  createForm: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12 },
  label: { color: '#94a3b8', marginBottom: 8, fontWeight: 'bold' },
  input: {
    backgroundColor: '#1e293b',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  addOptionBtn: { padding: 8, alignItems: 'center' },
  addOptionText: { color: '#38bdf8', fontWeight: 'bold' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancelBtn: { padding: 12, marginRight: 8 },
  cancelText: { color: '#94a3b8', fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#10b981', padding: 12, borderRadius: 8 },
  submitText: { color: 'white', fontWeight: 'bold' },
  pollCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 12, marginBottom: 16 },
  pollQuestion: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  optionRow: { marginBottom: 12 },
  optionContent: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  optionText: { color: 'white' },
  optionVotes: { color: '#94a3b8', fontSize: 12 },
  progressTrack: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#38bdf8', borderRadius: 3 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40, fontStyle: 'italic' }
});
