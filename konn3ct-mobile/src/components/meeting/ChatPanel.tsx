import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Linking } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { MediasoupService } from '../../webrtc/MediasoupService';
import { Smile, Paperclip, Send, Download } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';

interface ChatPanelProps {
  service: MediasoupService | null;
}

const CHAT_EMOJIS = ["👏", "👍", "👎", "😂", "❤️", "😭", "😍", "😅", "🙏", "👀", "🚀", "💡", "✨", "🎈", "🎵", "☕"];

export const ChatPanel: React.FC<ChatPanelProps> = ({ service }) => {
  const [message, setMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messages = useMeetingStore(state => state.chatMessages);
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const currentUserId = useMeetingStore(state => state.currentUserId);
  const participants = useMeetingStore(state => state.participants);
  const addChatMessage = useMeetingStore(state => state.addChatMessage);

  const handleSend = () => {
    if (!message.trim() || !service || isUploading) return;
    
    // Optimistic UI Update
    const me = participants.find(p => p.userId === currentUserId);
    if (me) {
      addChatMessage({
        id: `m-local-${Date.now()}`,
        userId: me.userId,
        name: me.name,
        message: message.trim(),
        timestamp: new Date().toISOString()
      });
    }

    service.sendChatMessage(message.trim());
    setMessage('');
    setShowEmojis(false);
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      
      const file = result.assets[0];
      if (file.size && file.size > 1073741824) { // 1GB limit
        Alert.alert("File too large", "File exceeds 1GB limit.");
        return;
      }

      setIsUploading(true);

      // Request presigned URL from Next.js API
      const res = await fetch("https://edge.konn3ct.net/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.mimeType || 'application/octet-stream', fileSize: file.size })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Upload the file to S3
      const fileResp = await fetch(file.uri);
      const blob = await fileResp.blob();

      await fetch(data.presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.mimeType || 'application/octet-stream', "x-amz-acl": "public-read" },
        body: blob
      });

      // Dispatch chat message
      const fileUrl = data.publicUrl;
      const fileMessage = `Shared a file: ${file.name}`;
      
      // Optimistic update
      const me = participants.find(p => p.userId === currentUserId);
      if (me) {
        addChatMessage({
          id: `m-local-${Date.now()}`,
          userId: me.userId,
          name: me.name,
          message: fileMessage,
          timestamp: new Date().toISOString(),
          fileUrl
        });
      }

      service.sendChatMessage(fileMessage, undefined, fileUrl);
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
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

      <ScrollView style={styles.messagesContainer} contentContainerStyle={{ paddingBottom: 20 }}>
        {messages.map((msg, index) => {
          const isMe = msg.userId === currentUserId;
          return (
            <View key={msg.id || index} style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
              <View style={styles.msgHeader}>
                <Text style={[styles.msgSender, isMe && { color: 'white' }]}>{isMe ? "You" : msg.name}</Text>
                <Text style={styles.msgTime}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={styles.msgText}>{msg.message}</Text>
              {msg.fileUrl && (
                <View style={styles.attachmentBox}>
                  {msg.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                    <Image source={{ uri: msg.fileUrl }} style={styles.attachmentImage} />
                  ) : (
                    <TouchableOpacity style={styles.downloadBtn} onPress={() => Linking.openURL(msg.fileUrl!)}>
                      <Download size={14} color="#38bdf8" />
                      <Text style={styles.downloadText}>Download File</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
        {messages.length === 0 && (
          <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
        )}
      </ScrollView>

      {showEmojis && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiBar}>
          {CHAT_EMOJIS.map(emoji => (
            <TouchableOpacity key={emoji} onPress={() => setMessage(prev => prev + emoji)} style={styles.emojiBtn}>
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleFileUpload} disabled={isUploading}>
          <Paperclip size={20} color={isUploading ? "#64748b" : "#38bdf8"} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowEmojis(!showEmojis)}>
          <Smile size={20} color="#38bdf8" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          placeholder={isUploading ? "Uploading..." : "Type a message..."}
          placeholderTextColor="#94a3b8"
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={handleSend}
          editable={!isUploading}
        />
        <TouchableOpacity 
          style={[styles.sendBtn, (!message.trim() || isUploading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!message.trim() || isUploading}
        >
          {isUploading ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="white" />}
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
  messageBubble: { padding: 12, borderRadius: 12, marginBottom: 12, maxWidth: '85%' },
  messageBubbleMe: { backgroundColor: '#0284c7', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  messageBubbleOther: { backgroundColor: '#334155', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center', gap: 12 },
  msgSender: { color: '#38bdf8', fontWeight: 'bold', fontSize: 14 },
  msgTime: { color: '#94a3b8', fontSize: 10 },
  msgText: { color: 'white', fontSize: 15 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  attachmentBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8 },
  attachmentImage: { width: '100%', height: 150, borderRadius: 8, resizeMode: 'cover' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  downloadText: { color: '#38bdf8', fontSize: 12, textDecorationLine: 'underline' },
  emojiBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#334155', maxHeight: 50 },
  emojiBtn: { paddingHorizontal: 8, justifyContent: 'center' },
  emojiText: { fontSize: 22 },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: { padding: 4 },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    color: 'white',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtn: { backgroundColor: '#3b82f6', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#334155' },
});
