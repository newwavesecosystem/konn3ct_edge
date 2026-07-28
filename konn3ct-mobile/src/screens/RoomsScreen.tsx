import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import {
  Video,
  Plus,
  Users,
  Globe,
  Lock,
  Bell,
  MoreVertical,
  Copy,
  Play,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  Calendar,
} from 'lucide-react-native';
import { useAuthStore } from '../store/useAuthStore';
import {
  fetchMyRooms,
  fetchMyRoomsData,
  createRoom,
  deleteRoom,
  startRoom,
  type Room,
  type CreateRoomPayload,
} from '../api/rooms';
import { APP_CONFIG } from '../config/appConfig';

const EDGE_FRONTEND_URL = process.env.EXPO_PUBLIC_EDGE_FRONTEND_URL || 'https://meetingapp.konn3ct.net';

const { width } = Dimensions.get('window');

// ─── Colors ──────────────────────────────────────────────────────────────────
const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  brandGreenDark: '#145339',
  brandGreenLight: '#f0fdf4',
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
  amber: '#f59e0b',
  amberBg: '#fffbeb',
  purple: '#8b5cf6',
  successBg: '#f0fdf4',
  success: '#207450',
  overlay: 'rgba(0,0,0,0.5)',
};

// ─── Palette for room colour accents (cycling) ────────────────────────────────
const ROOM_PALETTES: [string, string][] = [
  ['#012E89', '#3b82f6'],
  ['#207450', '#34d399'],
  ['#f59e0b', '#fbbf24'],
  ['#8b5cf6', '#c084fc'],
  ['#ef4444', '#f87171'],
  ['#06b6d4', '#67e8f9'],
];

function getPalette(room: Room, index: number): [string, string] {
  if (room.color && room.color !== '#fffff' && room.color !== '#ffffff') {
    return [room.color, room.color + 'aa'];
  }
  return ROOM_PALETTES[index % ROOM_PALETTES.length];
}

// ─── Skeleton loader card ─────────────────────────────────────────────────────
function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Animated.View style={[styles.roomCard, { opacity }]}>
      <View style={[styles.roomCardTopStrip, { backgroundColor: COLORS.border }]} />
      <View style={styles.roomCardContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.border }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 14, borderRadius: 6, backgroundColor: COLORS.border, width: '70%' }} />
            <View style={{ height: 11, borderRadius: 6, backgroundColor: COLORS.border, width: '40%' }} />
          </View>
        </View>
        <View style={{ height: 11, borderRadius: 6, backgroundColor: COLORS.border, width: '30%', marginBottom: 20 }} />
        <View style={{ height: 1, backgroundColor: COLORS.border, marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ height: 11, borderRadius: 6, backgroundColor: COLORS.border, width: '25%' }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.border }} />
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.border }} />
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.border }} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RoomsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();

  // ── Data state ──
  const [rooms, setRooms] = useState<Room[]>([]);
  const [totalRooms, setTotalRooms] = useState(0);
  const [maxRooms, setMaxRooms] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // ── Create modal state ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateRoomPayload>({
    name: '',
    url: '',
    mode: 'meeting',
    privacy: 0,
    color: '',
    access_code: '',
  });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // ── Starting room state ──
  const [startingRoomId, setStartingRoomId] = useState<number | null>(null);

  // ── Deleting room state ──
  const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null);

  // ── Toast state ──
  const [toast, setToast] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(''));
  };

  const loadRooms = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      const data = await fetchMyRoomsData();
      setRooms(data.rooms);
      setTotalRooms(data.total_rooms);
      setMaxRooms(data.max_rooms);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to load rooms.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // ─── Stats derived from real data ─────────────────────────────────────────

  const stats = {
    total: totalRooms || rooms.length,
    active: rooms.filter((r) => r.status === 'active' || r.status === '1' || Number(r.status) === 1).length,
    inactive: rooms.filter((r) => r.status === 'inactive' || r.status === '0' || Number(r.status) === 0).length,
    scheduled: rooms.filter((r) => r.status === 'scheduled').length,
  };

  // ─── Create Room ──────────────────────────────────────────────────────────

  const handleCreateRoom = async () => {
    if (maxRooms > 0 && totalRooms >= maxRooms) {
      if (APP_CONFIG.GOV_LOGIN) {
        setCreateError(`Room limit reached. You can only create up to ${maxRooms} rooms.`);
      } else {
        setCreateError(`Room limit reached. You can only create up to ${maxRooms} rooms on your current plan.`);
      }
      return;
    }

    if (!createForm.name.trim()) {
      setCreateError('Room name is required.');
      return;
    }
    if (!createForm.url.trim()) {
      setCreateError('Room URL is required.');
      return;
    }
    // Basic slug validation: lowercase alphanumeric + hyphens
    if (!/^[a-z0-9-]+$/.test(createForm.url.trim())) {
      setCreateError('URL may only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    try {
      setCreating(true);
      setCreateError('');
      const payload: CreateRoomPayload = {
        name: createForm.name.trim(),
        url: createForm.url.trim(),
        mode: createForm.mode,
        privacy: createForm.privacy,
        color: createForm.color || undefined,
        access_code: createForm.access_code ? createForm.access_code.trim() : '',
      };
      const res = await createRoom(payload);
      if (res.success) {
        setCreateSuccess('Room created successfully!');
        // Reload list
        await loadRooms();
        setTimeout(() => {
          setShowCreateModal(false);
          setCreateSuccess('');
          setCreateForm({ name: '', url: '', mode: 'meeting', privacy: 0, color: '', access_code: '' });
        }, 1200);
      } else {
        setCreateError(res.message || 'Failed to create room.');
      }
    } catch (err: any) {
      setCreateError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to create room.'
      );
    } finally {
      setCreating(false);
    }
  };

  // ─── Start Room ───────────────────────────────────────────────────────────

  const handleStartRoom = async (room: Room) => {
    try {
      setStartingRoomId(room.id);
      const startRes = await startRoom(room.id);
      
      console.log('--- ROOMS SCREEN: START ROOM RESPONSE ---');
      console.log(JSON.stringify(startRes, null, 2));

      const roomId: string = room.url || String(room.id);
      const meetingToken = startRes?.sessionToken || startRes?.url?.match(/[?&]t=([^&]+)/)?.[1];
      const signalUrl = startRes?.signalUrl || startRes?.signal_url;
      console.log('ROOMS SCREEN EXTRACTED TOKEN:', meetingToken ? 'YES (Length: ' + meetingToken.length + ')' : 'NO TOKEN FOUND');

      navigation.navigate('Meeting', { roomId, meetingToken, signalUrl, micOn: false, cameraOn: false });
    } catch (err: any) {
      Alert.alert(
        'Start Failed',
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Could not start the room. Please try again.'
      );
    } finally {
      setStartingRoomId(null);
    }
  };

  // ─── Delete Room ──────────────────────────────────────────────────────────

  const handleDeleteRoom = (room: Room) => {
    Alert.alert(
      'Delete Room',
      `Are you sure you want to delete "${room.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingRoomId(room.id);
              await deleteRoom(room.id);
              setRooms((prev) => prev.filter((r) => r.id !== room.id));
              showToast('Room deleted.');
            } catch (err: any) {
              Alert.alert(
                'Error',
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Could not delete the room.'
              );
            } finally {
              setDeletingRoomId(null);
            }
          },
        },
      ]
    );
  };

  // ─── Copy URL ─────────────────────────────────────────────────────────────

  const handleCopyUrl = async (roomSlug: string) => {
    const fullUrl = `${EDGE_FRONTEND_URL}/join/${roomSlug}`;
    await Clipboard.setStringAsync(fullUrl);
    showToast('Room URL copied!');
  };

  // ─── Render: Stat cards ───────────────────────────────────────────────────

  const STAT_ITEMS = [
    { label: 'Total Rooms', value: stats.total, icon: Video, color: COLORS.brandBlue },
    { label: 'Active', value: stats.active, icon: Play, color: COLORS.brandGreen },
    { label: 'Scheduled', value: stats.scheduled, icon: Globe, color: COLORS.amber },
    { label: 'Inactive', value: stats.inactive, icon: Lock, color: COLORS.danger },
  ];

  const renderStatCard = (item: typeof STAT_ITEMS[0], idx: number) => {
    const Icon = item.icon;
    return (
      <View key={idx} style={styles.statCard}>
        <View style={[styles.statIconBox, { backgroundColor: `${item.color}18` }]}>
          <Icon color={item.color} size={19} />
        </View>
        <View>
          <Text style={styles.statValue}>{item.value}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </View>
      </View>
    );
  };

  // ─── Render: Room card ────────────────────────────────────────────────────

  const renderRoomCard = (room: Room, index: number) => {
    const palette = getPalette(room, index);
    const isLocked = room.privacy === 1 || String(room.privacy) === '1';
    const isStarting = startingRoomId === room.id;
    const isDeleting = deletingRoomId === room.id;

    const statusColor =
      room.status === 'active' || room.status === '1' || Number(room.status) === 1
        ? COLORS.brandGreen
        : room.status === 'scheduled'
        ? COLORS.amber
        : COLORS.textMuted;
    const statusLabel =
      room.status === 'active' || room.status === '1' || Number(room.status) === 1
        ? 'Active'
        : room.status === 'scheduled'
        ? 'Scheduled'
        : 'Inactive';

    return (
      <View key={room.id} style={styles.roomCard}>
        {/* Top accent strip */}
        <View style={[styles.roomCardTopStrip, { backgroundColor: palette[0] }]} />

        <View style={styles.roomCardContent}>
          {/* Header row */}
          <View style={styles.roomCardHeader}>
            <View style={styles.roomTitleGroup}>
              <View style={[styles.roomIconBox, { backgroundColor: palette[0] + '20' }]}>
                <Video color={palette[0]} size={20} />
              </View>
              <View style={styles.roomTextGroup}>
                <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
                <Text style={styles.roomUrl} numberOfLines={1}>/{room.url}</Text>
              </View>
            </View>

            <TouchableOpacity
              testID={`delete-room-${room.id}`}
              style={styles.menuButton}
              onPress={() => handleDeleteRoom(room)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size={16} color={COLORS.danger} />
              ) : (
                <Trash2 color={COLORS.danger} size={18} />
              )}
            </TouchableOpacity>
          </View>

          {/* Status + Lock badges */}
          <View style={styles.roomStatusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>

            {isLocked ? (
              <View style={[styles.statusBadge, { backgroundColor: COLORS.dangerBg }]}>
                <Lock color={COLORS.danger} size={11} />
                <Text style={[styles.statusText, { color: COLORS.danger }]}>Locked</Text>
              </View>
            ) : (
              <View style={[styles.statusBadge, { backgroundColor: COLORS.brandGreenLight }]}>
                <Globe color={COLORS.brandGreen} size={11} />
                <Text style={[styles.statusText, { color: COLORS.brandGreen }]}>Open</Text>
              </View>
            )}

            <View style={[styles.statusBadge, { backgroundColor: COLORS.amberBg }]}>
              <Text style={[styles.statusText, { color: COLORS.amber, textTransform: 'capitalize' }]}>
                {room.mode || 'meeting'}
              </Text>
            </View>
          </View>

          {/* Footer row */}
          <View style={styles.roomFooter}>
            <View />

            <View style={styles.roomActionGroup}>
              {/* Schedule Room */}
              <TouchableOpacity
                style={styles.roomActionBtn}
                onPress={() => navigation.navigate('Schedule', { prefillRoomId: String(room.id) })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Calendar color={COLORS.textMuted} size={14} />
              </TouchableOpacity>

              {/* Copy URL */}
              <TouchableOpacity
                style={styles.roomActionBtn}
                onPress={() => handleCopyUrl(room.url)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Copy color={COLORS.textMuted} size={14} />
              </TouchableOpacity>

              {/* Start Room */}
              <TouchableOpacity
                style={[styles.roomActionBtn, styles.roomActionBtnPrimary]}
                onPress={() => handleStartRoom(room)}
                disabled={isStarting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isStarting ? (
                  <ActivityIndicator size={14} color={COLORS.surface} />
                ) : (
                  <Play color={COLORS.surface} size={13} fill={COLORS.surface} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // ─── Render: Empty state ──────────────────────────────────────────────────

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconBox}>
        <Video color={COLORS.textMuted} size={40} />
      </View>
      <Text style={styles.emptyTitle}>No rooms yet</Text>
      <Text style={styles.emptySubtitle}>
        Create your first room to start hosting instant meetings or webinars.
      </Text>
      <TouchableOpacity style={styles.emptyCreateBtn} onPress={() => setShowCreateModal(true)}>
        <Plus color={COLORS.surface} size={16} />
        <Text style={styles.emptyCreateBtnText}>Create your first room</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Render: Error state ──────────────────────────────────────────────────

  const renderError = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconBox, { backgroundColor: COLORS.dangerBg }]}>
        <AlertCircle color={COLORS.danger} size={36} />
      </View>
      <Text style={[styles.emptyTitle, { color: COLORS.danger }]}>Failed to load rooms</Text>
      <Text style={styles.emptySubtitle}>{error}</Text>
      <TouchableOpacity style={[styles.emptyCreateBtn, { backgroundColor: COLORS.brandBlue }]} onPress={() => loadRooms()}>
        <RefreshCw color={COLORS.surface} size={16} />
        <Text style={styles.emptyCreateBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Render: Create modal ─────────────────────────────────────────────────

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!creating) setShowCreateModal(false);
      }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            {/* Handle bar */}
            <View style={styles.modalHandle} />

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Create a Room</Text>
                <Text style={styles.modalSubtitle}>Set up a new meeting space</Text>
              </View>
              <TouchableOpacity
                onPress={() => { if (!creating) setShowCreateModal(false); }}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X color={COLORS.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            {/* Error / Success banners */}
            {createError ? (
              <View style={styles.modalError}>
                <AlertCircle color={COLORS.danger} size={14} />
                <Text style={styles.modalErrorText}>{createError}</Text>
              </View>
            ) : null}
            {createSuccess ? (
              <View style={styles.modalSuccess}>
                <CheckCircle color={COLORS.success} size={14} />
                <Text style={styles.modalSuccessText}>{createSuccess}</Text>
              </View>
            ) : null}

            {/* Form */}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Room Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Room Name *</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Marketing Weekly Sync"
                  placeholderTextColor={COLORS.textMuted}
                  value={createForm.name}
                  onChangeText={(v) => {
                    const generatedSlug = v
                      .toLowerCase()
                      .replace(/[^a-z0-9- ]/g, '') // remove invalid chars, keep spaces temporarily
                      .trim()
                      .replace(/\s+/g, '-'); // replace spaces with hyphens
                    setCreateForm((p) => ({ ...p, name: v, url: generatedSlug }));
                  }}
                  returnKeyType="next"
                />
              </View>

              {/* Room URL slug */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Room URL Slug (Auto-generated)</Text>
                <View style={[styles.urlInputRow, { backgroundColor: COLORS.border + '50' }]}>
                  <Text style={[styles.urlPrefix, { backgroundColor: 'transparent' }]}>/</Text>
                  <TextInput
                    style={[styles.fieldInput, { flex: 1, borderLeftWidth: 0, borderRadius: 0, backgroundColor: 'transparent', color: COLORS.textMuted }]}
                    placeholder="my-room-name"
                    placeholderTextColor={COLORS.textMuted}
                    value={createForm.url}
                    editable={false}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text style={styles.fieldHint}>This is automatically generated from your room name.</Text>
              </View>

              {/* Mode toggle */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Room Mode</Text>
                <View style={styles.modeToggleRow}>
                  {(['meeting', 'webinar'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modeOption, createForm.mode === m && styles.modeOptionActive]}
                      onPress={() => setCreateForm((p) => ({ ...p, mode: m }))}
                    >
                      {m === 'meeting' ? (
                        <Users color={createForm.mode === m ? COLORS.surface : COLORS.textMuted} size={15} />
                      ) : (
                        <Zap color={createForm.mode === m ? COLORS.surface : COLORS.textMuted} size={15} />
                      )}
                      <Text style={[styles.modeOptionText, createForm.mode === m && styles.modeOptionTextActive]}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Privacy toggle */}
              <View style={styles.fieldGroupRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Private Room</Text>
                  <Text style={styles.fieldHint}>Restrict access with a code</Text>
                </View>
                <Switch
                  value={createForm.privacy === 1}
                  onValueChange={(v) => setCreateForm((p) => ({ ...p, privacy: v ? 1 : 0 }))}
                  trackColor={{ false: COLORS.border, true: COLORS.brandGreen }}
                  thumbColor={COLORS.surface}
                />
              </View>

              {/* Access code (shown only when private) */}
              {createForm.privacy === 1 ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Access Code (optional)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Leave empty to auto-generate"
                    placeholderTextColor={COLORS.textMuted}
                    value={createForm.access_code}
                    onChangeText={(v) => setCreateForm((p) => ({ ...p, access_code: v }))}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </View>
              ) : null}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, creating && { opacity: 0.7 }]}
                onPress={handleCreateRoom}
                disabled={creating}
                activeOpacity={0.85}
              >
                {creating ? (
                  <ActivityIndicator color={COLORS.surface} size={18} style={{ marginRight: 8 }} />
                ) : (
                  <Plus color={COLORS.surface} size={18} />
                )}
                <Text style={styles.submitBtnText}>
                  {creating ? 'Creating...' : 'Create Room'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ─── Main render ──────────────────────────────────────────────────────────

  const firstName = user?.name?.split(' ')[0] || 'User';

  return (
    <View style={styles.container}>
      {/* ── Sticky Header ── */}
      <View style={[styles.stickyHeader, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.stickyHeaderLeft}>
          <View style={styles.avatarRing}>
            <Text style={styles.avatarInitial}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.stickyHeaderName}>Hi, {firstName.toUpperCase()}</Text>
        </View>

        <View style={styles.stickyHeaderRight}>
          {APP_CONFIG.SHOW_NOTIFICATIONS && (
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell color={COLORS.textPrimary} size={22} />
          </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Scroll content ── */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRooms(true)}
            tintColor={COLORS.brandGreen}
            colors={[COLORS.brandGreen]}
          />
        }
      >
        {/* Page header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Rooms</Text>
          <Text style={styles.pageSubtitle}>Create and manage your meeting rooms.</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            testID="create-room-btn"
            style={styles.btnPrimary}
            activeOpacity={0.85}
            onPress={() => {
              setCreateError('');
              setCreateSuccess('');
              setShowCreateModal(true);
            }}
          >
            <Plus color="#ffffff" size={16} />
            <Text style={styles.btnPrimaryText}>Create Room</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnOutline}
            activeOpacity={0.7}
            onPress={() => loadRooms(true)}
          >
            <RefreshCw color={COLORS.textPrimary} size={16} />
            <Text style={styles.btnOutlineText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        {!loading && !error && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContainer}
          >
            {STAT_ITEMS.map(renderStatCard)}
          </ScrollView>
        )}

        {/* Rooms list */}
        <View style={styles.roomsList}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : error ? (
            renderError()
          ) : rooms.length === 0 ? (
            renderEmpty()
          ) : (
            rooms.map((room, index) => renderRoomCard(room, index))
          )}
        </View>
      </ScrollView>

      {/* ── Create room modal ── */}
      {renderCreateModal()}

      {/* ── Toast notification ── */}
      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            { bottom: insets.bottom + 100, opacity: toastAnim },
          ]}
        >
          <CheckCircle color={COLORS.surface} size={14} />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },

  // Sticky Header
  stickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    zIndex: 10,
  },
  stickyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: COLORS.brandGreen,
    backgroundColor: COLORS.brandGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.brandGreen,
  },
  stickyHeaderName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: -0.3,
  },
  stickyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBtn: {
    padding: 4,
  },

  // Scroll content
  scrollContent: {
    paddingTop: 24,
  },
  pageHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.brandGreen,
    gap: 8,
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  btnOutlineText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // Stats
  statsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    minWidth: 150,
    gap: 12,
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // Rooms list
  roomsList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  roomCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  roomCardTopStrip: {
    height: 5,
    width: '100%',
  },
  roomCardContent: {
    padding: 18,
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  roomTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roomIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomTextGroup: {
    flex: 1,
    paddingRight: 12,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  roomUrl: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  menuButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.dangerBg,
    marginTop: -2,
  },
  roomStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  roomIdText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  roomActionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  roomActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomActionBtnPrimary: {
    backgroundColor: COLORS.brandGreen,
    width: 36,
    height: 36,
    borderRadius: 10,
  },

  // Empty / Error states
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.brandGreen,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyCreateBtnText: {
    color: COLORS.surface,
    fontWeight: '700',
    fontSize: 15,
  },

  // Modal / bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.pageBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  modalError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerBg,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    marginBottom: 16,
  },
  modalErrorText: {
    color: COLORS.danger,
    fontSize: 13,
    flex: 1,
  },
  modalSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.successBg,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
    marginBottom: 16,
  },
  modalSuccessText: {
    color: COLORS.success,
    fontSize: 13,
    flex: 1,
  },

  // Form fields
  fieldGroup: {
    marginBottom: 20,
  },
  fieldGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.pageBg,
  },
  fieldHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 5,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.pageBg,
  },
  urlPrefix: {
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMuted,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: COLORS.border,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.pageBg,
  },
  modeOptionActive: {
    borderColor: COLORS.brandGreen,
    backgroundColor: COLORS.brandGreen,
  },
  modeOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modeOptionTextActive: {
    color: COLORS.surface,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.brandGreen,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: '700',
  },

  // Toast
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  toastText: {
    color: COLORS.surface,
    fontSize: 13,
    fontWeight: '600',
  },
});
