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

  const handleEndPoll = (pollId: string) => {
    if (service) service.endPoll(pollId);
    useMeetingStore.getState().endPoll(pollId);
  };

  const handleCreate = () => {
    if (!question.trim() || options.filter(o => o.trim()).length < 2) return;
    if (service) {
      service.createPoll(
        'poll-' + Math.random().toString(36).substr(2, 9),
        question.trim(),
        options.filter(o => o.trim()).map((text, index) => ({ id: `o${index + 1}`, text, votes: 0 }))
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
          <TouchableOpacity key="create-btn" style={styles.createBtn} onPress={() => setIsCreating(true)}>
            <Text style={styles.createText}>+ Create New Poll</Text>
          </TouchableOpacity>
        )}

        {isCreating && (
          <View key="create-form" style={styles.createForm}>
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
                key={`option-input-${idx}`}
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
          const pollEnded = poll.isActive === false;
          return (
            <View key={poll.id} style={[styles.pollCard, pollEnded && styles.pollCardEnded]}>
              <View style={styles.pollHeader}>
                <Text style={[styles.pollQuestion, pollEnded && styles.pollQuestionEnded]}>{poll.question}</Text>
                {pollEnded ? (
                  <View style={styles.endedBadge}>
                    <Text style={styles.endedBadgeText}>Ended</Text>
                  </View>
                ) : (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>Live</Text>
                  </View>
                )}
              </View>
              {poll.options.map((opt, idx) => {
                const optVotes = opt.votes || 0;
                const percent = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                const optId = opt.id || `o${idx + 1}`;
                return (
                  <TouchableOpacity 
                    key={optId} 
                    style={styles.optionRow}
                    onPress={() => !poll.votedOptionId && !pollEnded && handleVote(poll.id, optId)}
                    disabled={!!poll.votedOptionId || pollEnded}
                  >
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionText, pollEnded && { opacity: 0.6 }]}>{opt.text}</Text>
                      <Text style={styles.optionVotes}>{percent}% ({optVotes})</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${percent}%` }, pollEnded && styles.progressFillEnded]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.pollFooter}>
                <Text style={styles.pollVoteCount}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</Text>
                {isHost && !pollEnded && (
                  <TouchableOpacity style={styles.endPollBtn} onPress={() => handleEndPoll(poll.id)}>
                    <Text style={styles.endPollText}>End Poll</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {!isCreating && polls.length === 0 && (
          <Text key="empty-text" style={styles.emptyText}>No active polls right now.</Text>
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
  pollCardEnded: { opacity: 0.75 },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  pollQuestion: { color: t.textPrimary, fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 8 },
  pollQuestionEnded: { opacity: 0.7 },
  liveBadge: { backgroundColor: t.primary + '30', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveBadgeText: { color: t.primary, fontSize: 10, fontWeight: 'bold' },
  endedBadge: { backgroundColor: t.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  endedBadgeText: { color: t.textMuted, fontSize: 10, fontWeight: 'bold' },
  optionRow: { marginBottom: 12 },
  optionContent: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  optionText: { color: t.textPrimary },
  optionVotes: { color: t.textMuted, fontSize: 12 },
  progressTrack: { height: 6, backgroundColor: t.bg, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: t.primary, borderRadius: 3 },
  progressFillEnded: { backgroundColor: t.textMuted },
  pollFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  pollVoteCount: { color: t.textMuted, fontSize: 11 },
  endPollBtn: { backgroundColor: t.danger + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  endPollText: { color: t.danger, fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: t.textMuted, textAlign: 'center', marginTop: 40, fontStyle: 'italic' }
});
