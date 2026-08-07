import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Modal, TouchableWithoutFeedback, Alert
} from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { meetingThemeTokens } from '../../theme/meetingTheme';
import { MediasoupService } from '../../webrtc/MediasoupService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, MicOff, Shield, ShieldOff, UserMinus, ChevronRight, Lock, MessageSquare } from 'lucide-react-native';

interface ParticipantsPanelProps {
  service: MediasoupService | null;
}

interface ActionTarget {
  userId: string;
  name: string;
  role: string;
  isMuted?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  host: 'Host',
  'co-host': 'Co-host',
  presenter: 'Presenter',
  attendee: 'Attendee',
  guest: 'Guest',
};

const sendWs = (service: MediasoupService | null, payload: object) => {
  const ws = (service as any)?.ws;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
};

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({ service }) => {
  const participants  = useMeetingStore(state => state.participants);
  const waitingRoom   = useMeetingStore(state => state.waitingRoom);
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const isHost        = useMeetingStore(state => state.isHost);
  const currentUserId = useMeetingStore(state => state.currentUserId);
  const currentUserRole = useMeetingStore(state => state.currentUserRole);
  const chatLocked    = useMeetingStore(state => state.chatLocked);

  const theme  = useMeetingStore(state => state.theme);
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);

  const insets    = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;

  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);

  // Whether the current user can manage others
  const canManage = currentUserRole === 'host' || currentUserRole === 'co-host';
  const canManageChatLock = isHost || currentUserRole === 'co-host' || currentUserRole === 'moderator';
  const isActualHost = currentUserRole === 'host';

  /* ── handlers ─────────────────────────────────────────────────────────── */
  const handleAdmit = (userId: string) => { service?.admitUser(userId); useMeetingStore.getState().removeWaitingRoomUser(userId); };
  const handleDeny  = (userId: string) => { service?.denyUser(userId); useMeetingStore.getState().removeWaitingRoomUser(userId); };
  

  const handleMuteUser = (userId: string) => {
    sendWs(service, { type: 'force_mute', userId });
    setActionTarget(null);
  };

  const handleMakeCoHost = (userId: string) => {
    sendWs(service, { type: 'change_role', userId, newRole: 'co-host' });
    setActionTarget(null);
  };

  const handleRemoveCoHost = (userId: string) => {
    sendWs(service, { type: 'change_role', userId, newRole: 'attendee' });
    setActionTarget(null);
  };

  const handleKick = (userId: string) => {
    sendWs(service, { type: 'kick_user', userId });
    setActionTarget(null);
  };

  /* ── role badge ────────────────────────────────────────────────────────── */
  const getRoleBadgeStyle = (role: string) => {
    if (role === 'host')     return { bg: 'rgba(234,179,8,0.15)',  text: '#eab308' };
    if (role === 'co-host')  return { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' };
    if (role === 'presenter')return { bg: 'rgba(168,85,247,0.15)', text: '#a855f7' };
    return null;
  };

  /* ── participant row ────────────────────────────────────────────────────── */
  const renderParticipant = (user: any) => {
    const isMe = user.userId === currentUserId;
    const badge = getRoleBadgeStyle(user.role);
    const canAct = canManage && !isMe && user.role !== 'host';

    return (
      <TouchableOpacity
        key={user.userId}
        style={styles.userRow}
        activeOpacity={canAct ? 0.7 : 1}
        onPress={() => {
          if (canAct) setActionTarget(user);
        }}
      >
        {/* Avatar */}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {user.name?.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.name}{isMe ? ' (You)' : ''}
            </Text>
            {user.isMuted ? (
              <MicOff size={12} color={tokens.danger} style={{ marginLeft: 4 }} />
            ) : (
              <Mic size={12} color={tokens.success} style={{ marginLeft: 4 }} />
            )}
          </View>
          <View style={styles.roleRow}>
            {badge ? (
              <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.roleBadgeText, { color: badge.text }]}>
                  {ROLE_LABEL[user.role] ?? user.role}
                </Text>
              </View>
            ) : (
              <Text style={styles.roleText}>{ROLE_LABEL[user.role] ?? user.role}</Text>
            )}
          </View>
        </View>

        {/* Chevron for manageable participants */}
        {canAct && (
          <ChevronRight size={16} color={tokens.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  /* ── action sheet ─────────────────────────────────────────────────────── */
  const renderActionSheet = () => {
    if (!actionTarget) return null;
    const isCoHost = actionTarget.role === 'co-host';

    return (
      <Modal transparent animationType="slide" visible={!!actionTarget} onRequestClose={() => setActionTarget(null)}>
        <TouchableWithoutFeedback onPress={() => setActionTarget(null)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.actionSheet, { paddingBottom: safeBottom + 8 }]}>
          {/* Handle */}
          <View style={styles.sheetHandle} />

          {/* Participant header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetAvatar}>
              <Text style={styles.sheetAvatarText}>
                {actionTarget.name?.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.sheetName}>{actionTarget.name}</Text>
              <Text style={styles.sheetRole}>{ROLE_LABEL[actionTarget.role] ?? actionTarget.role}</Text>
            </View>
          </View>

          <View style={styles.sheetDivider} />

          {/* Mute / Ask to unmute */}
          {!actionTarget.isMuted ? (
            <TouchableOpacity style={styles.sheetAction} onPress={() => handleMuteUser(actionTarget.userId)}>
              <View style={[styles.sheetActionIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <MicOff size={18} color={tokens.danger} />
              </View>
              <Text style={styles.sheetActionText}>Mute Participant</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sheetAction} onPress={() => {
              sendWs(service, { type: 'ask_to_unmute', userId: actionTarget.userId });
              setActionTarget(null);
            }}>
              <View style={[styles.sheetActionIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                <Mic size={18} color={tokens.success} />
              </View>
              <Text style={styles.sheetActionText}>Ask to Unmute</Text>
            </TouchableOpacity>
          )}

          {/* Co-host toggle — only actual host can do this */}
          {isActualHost && (
            isCoHost ? (
              <TouchableOpacity style={styles.sheetAction} onPress={() => handleRemoveCoHost(actionTarget.userId)}>
                <View style={[styles.sheetActionIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                  <ShieldOff size={18} color={tokens.danger} />
                </View>
                <Text style={styles.sheetActionText}>Remove Co-host</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.sheetAction} onPress={() => handleMakeCoHost(actionTarget.userId)}>
                <View style={[styles.sheetActionIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                  <Shield size={18} color="#60a5fa" />
                </View>
                <Text style={styles.sheetActionText}>Make Co-host</Text>
              </TouchableOpacity>
            )
          )}

          {/* Kick */}
          <TouchableOpacity style={styles.sheetAction} onPress={() => handleKick(actionTarget.userId)}>
            <View style={[styles.sheetActionIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
              <UserMinus size={18} color={tokens.danger} />
            </View>
            <Text style={[styles.sheetActionText, { color: tokens.danger }]}>Remove from Meeting</Text>
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setActionTarget(null)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  };

  /* ── main render ──────────────────────────────────────────────────────── */
  const hosts      = participants.filter(p => p.role === 'host' || p.role === 'co-host');
  const presenters = participants.filter(p => p.role === 'presenter');
  const attendees  = participants.filter(p => p.role === 'attendee' || p.role === 'guest' || !ROLE_LABEL[p.role]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Participants ({participants.length})</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: safeBottom + 16 }}>

        {/* Waiting Room */}
        {isHost && waitingRoom.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Waiting Room ({waitingRoom.length})</Text>
            {waitingRoom.map(user => (
              <View key={user.userId} style={styles.userRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {user.name?.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => handleDeny(user.userId)} style={[styles.actionBtn, styles.denyBtn]}>
                    <Text style={styles.denyText}>Deny</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleAdmit(user.userId)} style={[styles.actionBtn, styles.admitBtn]}>
                    <Text style={styles.admitText}>Admit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Hosts / Co-hosts */}
        {hosts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Host{hosts.length > 1 ? 's' : ''} ({hosts.length})</Text>
            {hosts.map(renderParticipant)}
          </View>
        )}

        {/* Presenters */}
        {presenters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Presenters ({presenters.length})</Text>
            {presenters.map(renderParticipant)}
          </View>
        )}

        {/* Attendees */}
        {attendees.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendees ({attendees.length})</Text>
            {attendees.map(renderParticipant)}
          </View>
        )}
      </ScrollView>

      {renderActionSheet()}
    </View>
  );
};

const getStyles = (t: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '75%',
    backgroundColor: t.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 },
    shadowOpacity: t.shadowOpacity, shadowRadius: 10, elevation: 10,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  title: { color: t.textPrimary, fontSize: 18, fontWeight: 'bold', fontFamily: 'Inter' },
  closeBtn: { padding: 4 },
  closeText: { color: t.textMuted, fontSize: 20 },
  listContainer: { flex: 1, padding: 16 },

    hostControlRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    muteAllBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: t.danger,
      borderRadius: 12,
    },
    muteAllText: { color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: 'Inter' },
    lockChatBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: t.bgElevated,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: t.primary,
    },
    lockChatBtnActive: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    lockChatText: { color: t.primary, fontWeight: '700', fontSize: 14, fontFamily: 'Inter' },
    lockChatTextActive: { color: '#fff' },

  section: { marginBottom: 20 },
  sectionTitle: {
    color: t.textMuted, fontSize: 11, fontWeight: '700',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: t.bgElevated,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: t.border,
  },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: t.bgActive,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: t.textPrimary, fontSize: 13, fontWeight: '700' },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  userName: { color: t.textPrimary, fontSize: 14, fontWeight: '600', fontFamily: 'Inter', flexShrink: 1 },
  roleRow: { flexDirection: 'row', alignItems: 'center' },
  roleText: { color: t.textMuted, fontSize: 11, marginTop: 0 },
  roleBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter' },

  actions: { flexDirection: 'row' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  admitBtn: { backgroundColor: t.success },
  admitText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  denyBtn: { backgroundColor: t.danger },
  denyText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Action sheet modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionSheet: {
    backgroundColor: t.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: t.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sheetAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: t.bgActive,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  sheetAvatarText: { color: t.textPrimary, fontSize: 16, fontWeight: '700' },
  sheetName: { color: t.textPrimary, fontSize: 16, fontWeight: '700', fontFamily: 'Inter' },
  sheetRole: { color: t.textMuted, fontSize: 12, marginTop: 2 },
  sheetDivider: { height: 1, backgroundColor: t.border, marginBottom: 8 },

  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 2,
  },
  sheetActionIcon: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  sheetActionText: {
    color: t.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Inter',
  },

  cancelBtn: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: t.bgActive,
    alignItems: 'center',
  },
  cancelText: { color: t.textPrimary, fontSize: 15, fontWeight: '600', fontFamily: 'Inter' },
});
