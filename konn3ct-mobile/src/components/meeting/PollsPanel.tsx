import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Animated, Keyboard } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { MediasoupService } from '../../webrtc/MediasoupService';
import { meetingThemeTokens } from '../../theme/meetingTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface PollsPanelProps {
  service: MediasoupService | null;
}

export const PollsPanel: React.FC<PollsPanelProps> = ({ service }) => {
  const polls = useMeetingStore(state => state.polls);
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const currentUserRole = useMeetingStore(state => state.currentUserRole);
  
  const isHost = currentUserRole === 'host';
  const theme = useMeetingStore(state => state.theme);
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);
  
  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [keyboardHeightAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
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
    <Animated.View style={[styles.container, { paddingBottom: keyboardHeightAnim }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Meeting Polls</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: safeBottom + 16 }}
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === 'android' ? 100 : 20}
        keyboardShouldPersistTaps="handled"
      >
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
              placeholderTextColor={tokens.textMuted}
              value={question}
              onChangeText={setQuestion}
            />
            <Text style={styles.label}>Options</Text>
            {options.map((opt, idx) => (
              <TextInput
                key={idx}
                style={styles.input}
                placeholder={`Option ${idx + 1}`}
                placeholderTextColor={tokens.textMuted}
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
      </KeyboardAwareScrollView>
    </Animated.View>
  );
};

const getStyles = (t: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '85%',
    backgroundColor: t.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: t.shadowOpacity, shadowRadius: 10, elevation: 10,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.border
  },
  title: { color: t.textPrimary, fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  closeText: { color: t.textMuted, fontSize: 20 },
  content: { flex: 1, padding: 16 },
  createBtn: {
    backgroundColor: t.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  createText: { color: t.textInverse, fontWeight: 'bold', fontSize: 16 },
  createForm: { backgroundColor: t.bgElevated, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: t.border },
  label: { color: t.textSecondary, marginBottom: 8, fontWeight: 'bold' },
  input: {
    backgroundColor: t.inputBg,
    color: t.textPrimary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  addOptionBtn: { padding: 8, alignItems: 'center' },
  addOptionText: { color: t.primary, fontWeight: 'bold' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancelBtn: { padding: 12, marginRight: 8 },
  cancelText: { color: t.textMuted, fontWeight: 'bold' },
  submitBtn: { backgroundColor: t.primary, padding: 12, borderRadius: 8 },
  submitText: { color: t.textInverse, fontWeight: 'bold' },
  pollCard: { backgroundColor: t.bgElevated, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: t.border },
  pollQuestion: { color: t.textPrimary, fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  optionRow: { marginBottom: 12 },
  optionContent: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  optionText: { color: t.textPrimary },
  optionVotes: { color: t.textMuted, fontSize: 12 },
  progressTrack: { height: 6, backgroundColor: t.bg, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: t.primary, borderRadius: 3 },
  emptyText: { color: t.textMuted, textAlign: 'center', marginTop: 40, fontStyle: 'italic' }
});
