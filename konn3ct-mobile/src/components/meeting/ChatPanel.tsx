import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { MediasoupService } from '../../webrtc/MediasoupService';

interface ChatPanelProps {
  service: MediasoupService | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ service }) => {
  const [message, setMessage] = useState('');
  const messages = useMeetingStore(state => state.chatMessages);
  const setActivePane = useMeetingStore(state => state.setActivePane);

  const handleSend = () => {
    if (!message.trim() || !service) return;
    service.sendChatMessage(message.trim());
    setMessage('');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Meeting Chat</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.messagesContainer}>
        {messages.map((msg, index) => (
          <View key={msg.id || index} style={styles.messageBubble}>
            <View style={styles.msgHeader}>
              <Text style={styles.msgSender}>{msg.name}</Text>
              <Text style={styles.msgTime}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={styles.msgText}>{msg.message}</Text>
          </View>
        ))}
        {messages.length === 0 && (
          <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#94a3b8"
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity 
          style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!message.trim()}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  messagesContainer: { flex: 1, padding: 16 },
  messageBubble: {
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  msgSender: { color: '#38bdf8', fontWeight: 'bold', fontSize: 14 },
  msgTime: { color: '#94a3b8', fontSize: 12 },
  msgText: { color: 'white', fontSize: 15 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    color: 'white',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  sendBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sendBtnDisabled: { backgroundColor: '#334155' },
  sendText: { color: 'white', fontWeight: 'bold' }
});
