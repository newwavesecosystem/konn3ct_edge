import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, Linking, Animated, Keyboard } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { MediasoupService } from '../../webrtc/MediasoupService';
import { Smile, Paperclip, Send, Download } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { meetingThemeTokens } from '../../theme/meetingTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../../api/client';

interface ChatPanelProps {
  service: MediasoupService | null;
}

const CHAT_EMOJIS = [
  // Smilies
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖",
  // Gestures
  "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏",
  // Objects & Symbols
  "❤️", "🔥", "✨", "🎉", "💯", "🚀", "💡", "🎈", "🎵", "☕", "⭐", "🌟", "✅", "❌", "❓", "❗", "👀", "🧠", "💼", "📈", "📉", "📌", "📍", "✂️", "🗑️"
];

const parseSafeDate = (timestamp: any) => {
  if (!timestamp) return new Date();
  if (typeof timestamp === 'number') {
    return new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
  }
  const str = String(timestamp);
  // Fix SQL formatted dates missing the "T" and "Z"
  if (str.includes('-') && str.includes(' ') && !str.includes('T')) {
    const d = new Date(str.replace(' ', 'T') + 'Z');
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const ChatPanel: React.FC<ChatPanelProps> = ({ service }) => {
  const [message, setMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messages = useMeetingStore(state => state.chatMessages);
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const currentUserId = useMeetingStore(state => state.currentUserId);
  const participants = useMeetingStore(state => state.participants);
  const addChatMessage = useMeetingStore(state => state.addChatMessage);
  const theme = useMeetingStore(state => state.theme);
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);
  
  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;

  const scrollViewRef = useRef<ScrollView>(null);
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

      // Request presigned URL from the Next.js API (edge.konn3ct.net hosts Next.js)
      const res = await fetch("https://edge.konn3ct.net/api/upload", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name, 
          contentType: file.mimeType || 'application/octet-stream', 
          fileSize: file.size 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get upload URL");

      // Upload the file to S3 using Expo FileSystem to avoid React Native Blob bugs
      await FileSystem.uploadAsync(data.presignedUrl, file.uri, {
        httpMethod: 'PUT',
        headers: {
          "Content-Type": file.mimeType || 'application/octet-stream',
          "x-amz-acl": "public-read"
        }
      });

      // Dispatch chat message
      const fileUrl = data.publicUrl;
      const fileMessage = `Shared a file: ${file.name} ||| FILE_URL: ${fileUrl}`;
      
      // Optimistic update
      const me = participants.find(p => p.userId === currentUserId);
      if (me) {
        addChatMessage({
          id: `m-local-${Date.now()}`,
          userId: me.userId,
          name: me.name,
          message: fileMessage,
          timestamp: new Date().toISOString()
        });
      }

      service.sendChatMessage(fileMessage);
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Animated.View 
      style={[styles.container, { paddingBottom: keyboardHeightAnim }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Meeting Chat</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer} 
        contentContainerStyle={{ paddingBottom: 20 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, index) => {
          const isMe = msg.userId === currentUserId;
          let rawText = msg.message || msg.text || msg.content || msg.body || '';
          let parsedFileUrl = msg.fileUrl;
          
          if (rawText.includes(' ||| FILE_URL: ')) {
            const parts = rawText.split(' ||| FILE_URL: ');
            rawText = parts[0];
            parsedFileUrl = parts[1];
          }

          return (
            <View key={msg.id || index} style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
              <View style={styles.msgHeader}>
                <Text style={[styles.msgSender, isMe && { color: 'white' }]}>{isMe ? "You" : msg.name}</Text>
                <Text style={[styles.msgTime, isMe && { color: 'rgba(255,255,255,0.8)' }]}>
                  {parseSafeDate(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={[styles.msgText, isMe && { color: 'white' }]}>
                {rawText}
              </Text>
              {parsedFileUrl && (
                <View style={styles.attachmentBox}>
                  {parsedFileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                    <Image source={{ uri: parsedFileUrl }} style={styles.attachmentImage} />
                  ) : (
                    <TouchableOpacity style={styles.downloadBtn} onPress={() => Linking.openURL(parsedFileUrl!)}>
                      <Download size={14} color={tokens.primary} />
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
        <View style={styles.emojiPickerContainer}>
          <ScrollView contentContainerStyle={styles.emojiGrid}>
            {CHAT_EMOJIS.map(emoji => (
              <TouchableOpacity key={emoji} onPress={() => setMessage(prev => prev + emoji)} style={styles.emojiGridBtn}>
                <Text style={styles.emojiGridText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.inputContainer, { paddingBottom: safeBottom + 12 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleFileUpload} disabled={isUploading}>
          <Paperclip size={20} color={isUploading ? tokens.textMuted : tokens.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowEmojis(!showEmojis)}>
          <Smile size={20} color={tokens.primary} />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          placeholder={isUploading ? "Uploading..." : "Type a message..."}
          placeholderTextColor={tokens.textMuted}
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
  messagesContainer: { flex: 1, padding: 16 },
  messageBubble: { padding: 12, borderRadius: 12, marginBottom: 12, maxWidth: '85%' },
  messageBubbleMe: { backgroundColor: t.messageMeBg, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  messageBubbleOther: { backgroundColor: t.messageOtherBg, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: t.border },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center', gap: 12 },
  msgSender: { color: t.primary, fontWeight: 'bold', fontSize: 14 },
  msgTime: { color: t.textMuted, fontSize: 10 },
  msgText: { color: t.textPrimary, fontSize: 15 },
  emptyText: { color: t.textMuted, textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  attachmentBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8 },
  attachmentImage: { width: '100%', height: 150, borderRadius: 8, resizeMode: 'cover' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  downloadText: { color: t.primary, fontSize: 12, textDecorationLine: 'underline' },
  emojiPickerContainer: {
    height: 180,
    backgroundColor: t.bg,
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  emojiGridBtn: {
    width: '12.5%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiGridText: {
    fontSize: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: t.border,
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: { padding: 4 },
  input: {
    flex: 1,
    backgroundColor: t.inputBg,
    color: t.textPrimary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: t.border,
  },
  sendBtn: { backgroundColor: t.primary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: t.messageOtherBg },
});
