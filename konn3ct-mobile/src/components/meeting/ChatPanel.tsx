import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Image, Alert, Linking, Animated,
  Keyboard, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { MediasoupService } from '../../webrtc/MediasoupService';
import { Smile, Paperclip, Send, Download, Lock, ChevronDown, Search, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { meetingThemeTokens } from '../../theme/meetingTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatPanelProps {
  service: MediasoupService | null;
}

const CHAT_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍",
  "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩",
  "👋", "🤚", "🖐️", "✋", "👌", "✌️", "🤞", "👍", "👎", "✊", "👏", "🙌", "🙏",
  "❤️", "🔥", "✨", "🎉", "💯", "🚀", "💡", "🎈", "🎵", "☕", "⭐", "✅", "❌", "👀",
];

const parseSafeDate = (timestamp: any) => {
  if (!timestamp) return new Date();
  if (typeof timestamp === 'number') {
    return new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
  }
  const str = String(timestamp);
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
  const [targetUserId, setTargetUserId] = useState<string>('everyone');
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');

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

  // Keyboard animation
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeightAnim, { toValue: e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: false }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardHeightAnim, { toValue: 0, duration: e.duration || 250, useNativeDriver: false }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const otherParticipants = participants
    .filter(p => p.userId !== currentUserId)
    .map(p => ({ ...p, routingId: p.participantId || p.userId }));

  const filteredParticipants = recipientSearch.trim()
    ? otherParticipants.filter(p => p.name.toLowerCase().includes(recipientSearch.toLowerCase()))
    : otherParticipants;

  const targetLabel = targetUserId === 'everyone'
    ? 'Everyone'
    : (otherParticipants.find(p => p.routingId === targetUserId)?.name ?? 'Someone');

  const isPrivateMode = targetUserId !== 'everyone';

  const handleSend = () => {
    if (!message.trim() || !service || isUploading) return;

    const me = participants.find(p => p.userId === currentUserId);
    if (me) {
      addChatMessage({
        id: `m-local-${Date.now()}`,
        userId: me.userId,
        name: me.name,
        message: message.trim(),
        timestamp: new Date().toISOString(),
        isPrivate: isPrivateMode,
      });
    }

    console.log('[CHAT] sending message. isPrivate:', isPrivateMode, 'targetUserId (participantId):', isPrivateMode ? targetUserId : 'none');
    service.sendChatMessage(message.trim(), isPrivateMode ? targetUserId : undefined);
    setMessage('');
    setShowEmojis(false);
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const file = result.assets[0];
      if (file.size && file.size > 1073741824) {
        Alert.alert("File too large", "File exceeds 1GB limit.");
        return;
      }
      setIsUploading(true);
      const res = await fetch("https://edge.konn3ct.net/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.mimeType || 'application/octet-stream', fileSize: file.size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get upload URL");
      await FileSystem.uploadAsync(data.presignedUrl, file.uri, {
        httpMethod: 'PUT',
        headers: { "Content-Type": file.mimeType || 'application/octet-stream', "x-amz-acl": "public-read" },
      });
      const fileUrl = data.publicUrl;
      const fileMessage = `Shared a file: ${file.name} ||| FILE_URL: ${fileUrl}`;
      const me = participants.find(p => p.userId === currentUserId);
      if (me) {
        addChatMessage({ id: `m-local-${Date.now()}`, userId: me.userId, name: me.name, message: fileMessage, timestamp: new Date().toISOString() });
      }
      service?.sendChatMessage(fileMessage, isPrivateMode ? targetUserId : undefined);
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  const openRecipientModal = () => {
    setRecipientSearch('');
    setShowEmojis(false);
    setShowRecipientModal(true);
  };

  const selectRecipient = (routingId: string) => {
    setTargetUserId(routingId);
    setShowRecipientModal(false);
    setRecipientSearch('');
  };

  return (
    <Animated.View style={[styles.container, { paddingBottom: keyboardHeightAnim }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Meeting Chat</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={{ paddingBottom: 20 }}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, index) => {
          const isMe = msg.userId === currentUserId;
          let rawText = msg.message || (msg as any).text || (msg as any).content || '';
          let parsedFileUrl = msg.fileUrl;
          if (rawText.includes(' ||| FILE_URL: ')) {
            const parts = rawText.split(' ||| FILE_URL: ');
            rawText = parts[0];
            parsedFileUrl = parts[1];
          }

          return (
            <View key={msg.id || index} style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
              <View style={styles.msgHeader}>
                <Text style={[styles.msgSender, isMe && { color: 'white' }]} numberOfLines={1}>
                  {isMe ? 'You' : msg.name}
                </Text>
                <View style={styles.msgMetaRow}>
                  {msg.isPrivate && (
                    <View style={styles.privateBadge}>
                      <Lock size={9} color="#f87171" />
                      <Text style={styles.privateBadgeText}>Private</Text>
                    </View>
                  )}
                  <Text style={[styles.msgTime, isMe && { color: 'rgba(255,255,255,0.75)' }]}>
                    {parseSafeDate(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
              <Text style={[styles.msgText, isMe && { color: 'white' }]}>{rawText}</Text>
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

      {/* Emoji Picker */}
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

      {/* Input Row */}
      <View style={[styles.inputContainer, { paddingBottom: safeBottom + 12 }]}>
        {/* "To:" selector */}
        <TouchableOpacity
          style={[styles.toSelector, isPrivateMode && styles.toSelectorPrivate]}
          onPress={openRecipientModal}
        >
          {isPrivateMode && <Lock size={10} color="#f87171" />}
          <Text style={[styles.toSelectorText, isPrivateMode && styles.toSelectorTextPrivate]} numberOfLines={1}>
            To: {targetLabel}
          </Text>
          <ChevronDown size={11} color={isPrivateMode ? '#f87171' : tokens.textMuted} />
        </TouchableOpacity>

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleFileUpload} disabled={isUploading}>
            <Paperclip size={20} color={isUploading ? tokens.textMuted : tokens.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowEmojis(v => !v)}>
            <Smile size={20} color={tokens.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={isUploading ? "Uploading..." : isPrivateMode ? `Private to ${targetLabel}...` : "Type a message..."}
            placeholderTextColor={tokens.textMuted}
            value={message}
            onChangeText={setMessage}
            onSubmitEditing={handleSend}
            editable={!isUploading}
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!message.trim() || isUploading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!message.trim() || isUploading}
            testID="send-chat-button"
          >
            {isUploading ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="white" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Recipient Picker Modal ── */}
      <Modal
        visible={showRecipientModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowRecipientModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowRecipientModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send message to</Text>
              <TouchableOpacity onPress={() => setShowRecipientModal(false)} style={styles.modalCloseBtn}>
                <X size={18} color={tokens.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={styles.searchBar}>
              <Search size={15} color={tokens.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search participants..."
                placeholderTextColor={tokens.textMuted}
                value={recipientSearch}
                onChangeText={setRecipientSearch}
                autoFocus
              />
              {recipientSearch.length > 0 && (
                <TouchableOpacity onPress={() => setRecipientSearch('')}>
                  <X size={14} color={tokens.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Participant list */}
            <FlatList
              data={[{ routingId: 'everyone', name: 'Everyone' }, ...filteredParticipants]}
              keyExtractor={item => item.routingId}
              style={styles.participantList}
              renderItem={({ item }) => {
                const isSelected = targetUserId === item.routingId;
                const isEveryone = item.routingId === 'everyone';
                return (
                  <TouchableOpacity
                    style={[styles.participantRow, isSelected && styles.participantRowSelected]}
                    onPress={() => selectRecipient(item.routingId)}
                  >
                    <View style={[styles.participantAvatar, isEveryone && styles.participantAvatarEveryone]}>
                      <Text style={styles.participantAvatarText}>
                        {isEveryone ? '👥' : item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.participantName, isSelected && styles.participantNameSelected]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {!isEveryone && (
                      <View style={styles.privatePillSmall}>
                        <Lock size={9} color={tokens.textMuted} />
                        <Text style={styles.privatePillText}>Private</Text>
                      </View>
                    )}
                    {isSelected && (
                      <View style={styles.selectedDot} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.noResults}>No participants found</Text>
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
};

const getStyles = (t: any) => StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '85%', backgroundColor: t.bgElevated,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 },
    shadowOpacity: t.shadowOpacity, shadowRadius: 10, elevation: 10, zIndex: 100,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: t.border },
  title: { color: t.textPrimary, fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  closeText: { color: t.textMuted, fontSize: 20 },
  messagesContainer: { flex: 1, padding: 16 },
  messageBubble: { padding: 12, borderRadius: 12, marginBottom: 12, maxWidth: '85%' },
  messageBubbleMe: { backgroundColor: t.messageMeBg, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  messageBubbleOther: { backgroundColor: t.messageOtherBg, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: t.border },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center', gap: 8 },
  msgSender: { color: t.primary, fontWeight: 'bold', fontSize: 13, flexShrink: 1 },
  msgMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 20 },
  privateBadgeText: { color: '#f87171', fontSize: 9, fontWeight: '600' },
  msgTime: { color: t.textMuted, fontSize: 10 },
  msgText: { color: t.textPrimary, fontSize: 15 },
  emptyText: { color: t.textMuted, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  attachmentBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8 },
  attachmentImage: { width: '100%', height: 150, borderRadius: 8, resizeMode: 'cover' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  downloadText: { color: t.primary, fontSize: 12, textDecorationLine: 'underline' },
  emojiPickerContainer: { height: 180, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.border },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  emojiGridBtn: { width: '12.5%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  emojiGridText: { fontSize: 24 },
  inputContainer: { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8, paddingHorizontal: 12 },
  toSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: t.bg, borderWidth: 1, borderColor: t.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8, maxWidth: '75%',
  },
  toSelectorPrivate: { borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.08)' },
  toSelectorText: { color: t.textMuted, fontSize: 12, flexShrink: 1 },
  toSelectorTextPrivate: { color: '#f87171' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 4 },
  input: { flex: 1, backgroundColor: t.inputBg, color: t.textPrimary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: t.border },
  sendBtn: { backgroundColor: t.primary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: t.messageOtherBg },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalSheet: { width: '100%', maxHeight: '65%', backgroundColor: t.bgElevated, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: t.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border },
  modalTitle: { color: t.textPrimary, fontSize: 16, fontWeight: 'bold' },
  modalCloseBtn: { padding: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.inputBg, borderRadius: 10, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: t.border },
  searchInput: { flex: 1, color: t.textPrimary, fontSize: 13, padding: 0 },
  participantList: { maxHeight: 320 },
  participantRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: t.border },
  participantRowSelected: { backgroundColor: t.primary + '18' },
  participantAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.primary + '30', alignItems: 'center', justifyContent: 'center' },
  participantAvatarEveryone: { backgroundColor: t.bg },
  participantAvatarText: { fontSize: 15, color: t.textPrimary, fontWeight: '600' },
  participantName: { flex: 1, color: t.textPrimary, fontSize: 14, fontWeight: '500' },
  participantNameSelected: { color: t.primary, fontWeight: 'bold' },
  privatePillSmall: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: t.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  privatePillText: { color: t.textMuted, fontSize: 10 },
  selectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary },
  noResults: { color: t.textMuted, textAlign: 'center', padding: 24, fontStyle: 'italic' },
});
