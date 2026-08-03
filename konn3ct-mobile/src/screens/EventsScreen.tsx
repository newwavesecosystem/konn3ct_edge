import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Image,
  Share,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  Bell,
  CalendarDays,
  Users,
  MapPin,
  Clock,
  Globe,
  Plus,
  MoreVertical,
  X,
  AlignLeft,
  DollarSign,
  Tag,
  Check,
  ChevronDown,
  Send,
  Search,
  RefreshCw,
  Lock,
  Unlock,
  Image as ImageIcon,
  UserPlus,
  ChevronRight,
  AlertCircle,
  Copy,
  Link,
  Video,
  Share2,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import {
  fetchEventSummary,
  fetchEventList,
  fetchRecentRegistrations,
  fetchEventParticipants,
  sendPreregReminder,
  createEvent,
  EventItem,
  EventParticipant,
  RecentRegistration,
  EventSummary,
  CreateEventPayload,
} from '../api/events';
import { fetchMyRooms, Room } from '../api/rooms';
import { APP_CONFIG } from '../config/appConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const COLORS = {
  pageBg: '#f4f6f9',
  surface: '#ffffff',
  brandBlue: '#012E89',
  brandGreen: '#207450',
  brandGreenLight: '#eef8f3',
  textPrimary: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  danger: '#ef4444',
  blue: '#3b82f6',
  blueLight: '#eff6ff',
  emerald: '#10b981',
  amber: '#f59e0b',
  amberLight: '#fffbeb',
  purple: '#8b5cf6',
  purpleLight: '#f5f3ff',
};

const TIMEZONES = [
  'Africa/Lagos',
  'Africa/Abidjan',
  'Africa/Nairobi',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
];

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];
const REMINDER_OPTIONS = [
  { label: '1 day before', value: '1' },
  { label: '2 days before', value: '2' },
  { label: '3 days before', value: '3' },
  { label: '5 days before', value: '5' },
  { label: '1 week before', value: '7' },
];

type ActiveTab = 'events' | 'recent';
type DropdownType = 'room' | 'timezone' | 'currency' | 'reminder' | null;

// ─── Participant Modal ─────────────────────────────────────────────────────────

function ParticipantsModal({
  event,
  visible,
  onClose,
}: {
  event: EventItem | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    if (visible && event?.id) {
      setLoading(true);
      setError(null);
      fetchEventParticipants(String(event.id))
        .then(setParticipants)
        .catch((e) => setError(e?.response?.data?.message || 'Failed to load participants'))
        .finally(() => setLoading(false));
    }
  }, [visible, event]);

  const handleSendReminder = async () => {
    if (!event?.id) return;
    setSendingReminder(true);
    try {
      const result = await sendPreregReminder(String(event.id));
      Alert.alert('Reminder Sent', result.message || 'Reminder emails sent to all participants!');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  if (!event) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={[styles.modalHeaderTop, { paddingTop: 24 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.modalTitle} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.modalSubtitle}>Registered Participants</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Send Reminder Button */}
        {/*
        <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
          <TouchableOpacity
            style={[styles.reminderBtn, sendingReminder && { opacity: 0.6 }]}
            onPress={handleSendReminder}
            disabled={sendingReminder}
          >
            {sendingReminder
              ? <ActivityIndicator color="#fff" size="small" />
              : <Send color="#fff" size={16} />}
            <Text style={styles.reminderBtnText}>{sendingReminder ? 'Sending...' : 'Send Reminder'}</Text>
          </TouchableOpacity>
        </View>
        */}

        {/* List */}
        {loading ? (
          <View style={styles.centeredLoader}>
            <ActivityIndicator size="large" color={COLORS.brandGreen} />
            <Text style={styles.loaderText}>Loading participants…</Text>
          </View>
        ) : error ? (
          <View style={styles.centeredLoader}>
            <AlertCircle color={COLORS.danger} size={40} />
            <Text style={[styles.loaderText, { color: COLORS.danger }]}>{error}</Text>
          </View>
        ) : participants.length === 0 ? (
          <View style={styles.centeredLoader}>
            <Users color={COLORS.textMuted} size={48} />
            <Text style={styles.emptyText}>No participants yet</Text>
            <Text style={[styles.loaderText, { marginTop: 4 }]}>Share the event link to get registrations</Text>
          </View>
        ) : (
          <FlatList
            data={participants}
            keyExtractor={(item, i) => String(item.id ?? i)}
            contentContainerStyle={{ padding: 20, gap: 12 }}
            renderItem={({ item }) => (
              <View style={styles.participantCard}>
                <View style={styles.participantAvatar}>
                  <Text style={styles.participantAvatarText}>
                    {(item.name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.participantName}>{item.name}</Text>
                  <Text style={styles.participantEmail}>{item.email}</Text>
                  {item.phone ? <Text style={styles.participantMeta}>{item.phone}</Text> : null}
                  {item.registered_at ? (
                    <Text style={styles.participantMeta}>
                      Registered: {new Date(item.registered_at).toLocaleDateString()}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Create Event Modal ────────────────────────────────────────────────────────

function CreateEventModal({
  visible,
  onClose,
  onCreated,
  rooms,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  rooms: Room[];
}) {
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [hostname, setHostname] = useState('');
  const [roomId, setRoomId] = useState('');
  const [about, setAbout] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [isPublic, setIsPublic] = useState(true);
  const [isFree, setIsFree] = useState(true);
  const [currency, setCurrency] = useState('NGN');
  const [amount, setAmount] = useState('');
  const [reminder, setReminder] = useState('2');
  const [tags, setTags] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoAsset, setLogoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [activeDropdown, setActiveDropdown] = useState<DropdownType>(null);

  const resetForm = () => {
    setTitle(''); setHostname(''); setRoomId(''); setAbout('');
    setDate(new Date()); setTimezone('Africa/Lagos'); setIsPublic(true);
    setIsFree(true); setCurrency('NGN'); setAmount(''); setReminder('2');
    setTags(''); setLogoUri(null); setLogoAsset(null); setActiveDropdown(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType?.toLowerCase() || '';
      const uri = asset.uri.toLowerCase();
      
      const isJpeg = mimeType === 'image/jpeg' || mimeType === 'image/jpg' || uri.endsWith('.jpg') || uri.endsWith('.jpeg');
      const isPng = mimeType === 'image/png' || uri.endsWith('.png');

      if (!isJpeg && !isPng) {
        Alert.alert('Invalid Format', 'Please select a PNG, JPG, or JPEG image file.');
        return;
      }

      setLogoAsset(asset);
      setLogoUri(asset.uri);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Please enter an Event Title.'); return; }
    if (!hostname.trim()) { Alert.alert('Required', 'Please enter a Host Name.'); return; }
    if (!roomId) { Alert.alert('Required', 'Please select a Room.'); return; }

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    const payload: CreateEventPayload = {
      title: title.trim(),
      room_id: roomId,
      hostname: hostname.trim(),
      date: dateStr,
      time: timeStr,
      timezone,
      about: about.trim(),
      reminder,
      public: isPublic ? '1' : '0',
      tags: tags.trim(),
      free: isFree ? '1' : '0',
      currency: isFree ? undefined : currency,
      amount: isFree ? undefined : amount,
    };

    if (logoUri && logoAsset) {
      // Prefer the MIME type reported by the picker; fall back to guessing from URI
      let mimeType = logoAsset.mimeType || '';
      if (!mimeType) {
        const ext = (logoUri.split('/').pop() || '').split('.').pop()?.toLowerCase();
        mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      }
      // Normalize: 'image/jpg' is not a valid MIME type; must be 'image/jpeg'
      if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

      let ext = mimeType.split('/')[1] || 'jpg';
      if (ext === 'jpeg') ext = 'jpg';
      const filename = `event_logo_${Date.now()}.${ext}`;
      payload.logo = { uri: logoUri, name: filename, type: mimeType };
    }

    setIsSubmitting(true);
    try {
      const res = await createEvent(payload);
      if (res.success !== false) {
        Alert.alert('Success', res.message || 'Event created successfully!');
        resetForm();
        onCreated();
      } else {
        Alert.alert('Error', res.message || 'Failed to create event.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRoom = rooms.find((r) => String(r.id) === roomId);

  const renderDropdown = (type: DropdownType, options: { label: string; value: string }[], currentValue: string, onSelect: (v: string) => void) => (
    <View style={styles.dropdownList}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.dropdownItem, currentValue === opt.value && styles.dropdownItemActive]}
          onPress={() => { onSelect(opt.value); setActiveDropdown(null); }}
        >
          <Text style={[styles.dropdownItemText, currentValue === opt.value && { color: COLORS.brandGreen, fontWeight: 'bold' }]}>
            {opt.label}
          </Text>
          {currentValue === opt.value && <Check size={16} color={COLORS.brandGreen} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalContainer}
      >
        <View style={[styles.modalHeaderTop, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 24) : 24 }]}>
          <View>
            <Text style={styles.modalTitle}>Create New Event</Text>
            <Text style={styles.modalSubtitle}>Set up your pre-registered event details.</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <X size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Basic Details ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <AlignLeft size={18} color={COLORS.brandBlue} />
              <Text style={styles.sectionHeading}>Basic Details</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.formGroup}>
              <Text style={styles.label}>Event Title <Text style={styles.asterisk}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Annual Tech Summit"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Host Name <Text style={styles.asterisk}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Your Name or Company"
                value={hostname}
                onChangeText={setHostname}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Select Room <Text style={styles.asterisk}>*</Text></Text>
              <TouchableOpacity
                style={styles.selectBtn}
                activeOpacity={0.7}
                onPress={() => setActiveDropdown(activeDropdown === 'room' ? null : 'room')}
              >
                <Text style={[styles.selectBtnText, !selectedRoom && { color: '#94a3b8' }]}>
                  {selectedRoom ? selectedRoom.name : rooms.length === 0 ? 'No rooms available' : 'Choose a room'}
                </Text>
                <ChevronDown size={20} color="#64748b" />
              </TouchableOpacity>
              {activeDropdown === 'room' && rooms.length > 0 && renderDropdown(
                'room',
                rooms.map((r) => ({ label: r.name, value: String(r.id) })),
                roomId,
                setRoomId
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>About the Event</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe what your event is about..."
                value={about}
                onChangeText={setAbout}
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tags (comma-separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. gaming,tech,business"
                value={tags}
                onChangeText={setTags}
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
            </View>

            {/* Logo Upload */}
            <View style={styles.formGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[styles.label, { marginBottom: 0 }]}>Event Logo / Banner</Text>
                {logoUri && (
                  <TouchableOpacity 
                    onPress={() => {
                      setLogoUri(null);
                      setLogoAsset(null);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <X size={14} color={COLORS.danger} />
                    <Text style={{ fontSize: 13, color: COLORS.danger, fontWeight: '600' }}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <TouchableOpacity style={styles.logoPickerBtn} onPress={pickImage} activeOpacity={0.7}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoPicked} />
                ) : (
                  <>
                    <ImageIcon size={22} color={COLORS.textMuted} />
                    <Text style={styles.logoPickerText}>Tap to choose image</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Scheduling ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <CalendarDays size={18} color={COLORS.brandGreen} />
              <Text style={styles.sectionHeading}>Scheduling</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.dateTimeContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subLabel}>DATE <Text style={styles.asterisk}>*</Text></Text>
                <TouchableOpacity style={styles.dtBtn} onPress={() => setShowDatePicker(true)}>
                  <CalendarDays size={16} color={COLORS.brandGreen} />
                  <Text style={styles.dtBtnText}>{date.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.subLabel}>TIME <Text style={styles.asterisk}>*</Text></Text>
                <TouchableOpacity style={styles.dtBtn} onPress={() => setShowTimePicker(true)}>
                  <Clock size={16} color={COLORS.brandGreen} />
                  <Text style={styles.dtBtnText}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Timezone</Text>
              <TouchableOpacity
                style={styles.selectBtn}
                activeOpacity={0.7}
                onPress={() => setActiveDropdown(activeDropdown === 'timezone' ? null : 'timezone')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Globe size={16} color={COLORS.textMuted} />
                  <Text style={styles.selectBtnText}>{timezone}</Text>
                </View>
                <ChevronDown size={20} color="#64748b" />
              </TouchableOpacity>
              {activeDropdown === 'timezone' && renderDropdown(
                'timezone',
                TIMEZONES.map((tz) => ({ label: tz, value: tz })),
                timezone,
                setTimezone
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Reminder</Text>
              <TouchableOpacity
                style={styles.selectBtn}
                activeOpacity={0.7}
                onPress={() => setActiveDropdown(activeDropdown === 'reminder' ? null : 'reminder')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Bell size={16} color={COLORS.textMuted} />
                  <Text style={styles.selectBtnText}>
                    {REMINDER_OPTIONS.find((r) => r.value === reminder)?.label || `${reminder} day(s) before`}
                  </Text>
                </View>
                <ChevronDown size={20} color="#64748b" />
              </TouchableOpacity>
              {activeDropdown === 'reminder' && renderDropdown(
                'reminder',
                REMINDER_OPTIONS,
                reminder,
                setReminder
              )}
            </View>
          </View>

          {/* ── Visibility ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <Globe size={18} color={COLORS.purple} />
              <Text style={styles.sectionHeading}>Visibility</Text>
            </View>
            <View style={styles.divider} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.ticketTypeBtn, isPublic && styles.ticketTypeActive]}
                onPress={() => setIsPublic(true)}
              >
                <Unlock size={16} color={isPublic ? COLORS.brandGreen : COLORS.textMuted} />
                <Text style={[styles.ticketTypeText, isPublic && styles.ticketTypeTextActive]}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ticketTypeBtn, !isPublic && styles.ticketTypeActive]}
                onPress={() => setIsPublic(false)}
              >
                <Lock size={16} color={!isPublic ? COLORS.brandGreen : COLORS.textMuted} />
                <Text style={[styles.ticketTypeText, !isPublic && styles.ticketTypeTextActive]}>Private</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Ticketing ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeadingRow}>
              <Tag size={18} color={COLORS.amber} />
              <Text style={styles.sectionHeading}>Ticketing</Text>
            </View>
            <View style={styles.divider} />
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <TouchableOpacity
                style={[styles.ticketTypeBtn, isFree && styles.ticketTypeActive, APP_CONFIG.GOV_LOGIN && { flex: 0.5 }]}
                onPress={() => setIsFree(true)}
              >
                <Text style={[styles.ticketTypeText, isFree && styles.ticketTypeTextActive]}>Free</Text>
              </TouchableOpacity>
              {!APP_CONFIG.GOV_LOGIN && (
                <TouchableOpacity
                  style={[styles.ticketTypeBtn, !isFree && styles.ticketTypeActive]}
                  onPress={() => setIsFree(false)}
                >
                  <Text style={[styles.ticketTypeText, !isFree && styles.ticketTypeTextActive]}>Paid</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isFree && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Currency</Text>
                  <TouchableOpacity
                    style={styles.selectBtn}
                    activeOpacity={0.7}
                    onPress={() => setActiveDropdown(activeDropdown === 'currency' ? null : 'currency')}
                  >
                    <Text style={styles.selectBtnText}>{currency}</Text>
                    <ChevronDown size={20} color="#64748b" />
                  </TouchableOpacity>
                  {activeDropdown === 'currency' && renderDropdown(
                    'currency',
                    CURRENCIES.map((c) => ({ label: c, value: c })),
                    currency,
                    setCurrency
                  )}
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Ticket Price ({currency})</Text>
                  <View style={styles.priceInputRow}>
                    <DollarSign size={18} color="#64748b" style={styles.priceIcon} />
                    <TextInput
                      style={[styles.input, { flex: 1, paddingLeft: 40 }]}
                      placeholder="0.00"
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="submit-event-btn"
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitBtnText}>Create Event</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(e, selected) => {
            setShowDatePicker(false);
            if (selected) setDate(selected);
          }}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={date}
          mode="time"
          display="default"
          onChange={(e, selected) => {
            setShowTimePicker(false);
            if (selected) setDate(selected);
          }}
        />
      )}
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<ActiveTab>('events');
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [recentRegs, setRecentRegs] = useState<RecentRegistration[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [participantsModal, setParticipantsModal] = useState<EventItem | null>(null);

  // ── Data Loading ──────────────────────────────────────────────────────────
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [summaryData, eventData, roomData] = await Promise.all([
        fetchEventSummary().catch(() => null),
        fetchEventList().catch(() => []),
        fetchMyRooms().catch(() => []),
      ]);
      setSummary(summaryData);
      setEvents(eventData);
      setRooms(roomData);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadRecentRegistrations = useCallback(async () => {
    try {
      const data = await fetchRecentRegistrations();
      setRecentRegs(data);
    } catch {
      setRecentRegs([]);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'recent') {
      loadRecentRegistrations();
    }
  }, [activeTab, loadRecentRegistrations]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
    if (activeTab === 'recent') loadRecentRegistrations();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${m} ${ampm}`;
  };

  // ── Event Card ─────────────────────────────────────────────────────────────
  const renderEventCard = ({ item: evt }: { item: EventItem }) => (
    <View style={styles.eventCard}>
      <LinearGradient
        colors={['#34d399', '#3b82f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardTopStrip}
      />
      <View style={styles.cardContent}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.eventTitle} numberOfLines={2}>{evt.title}</Text>
            <View style={styles.eventBadges}>
              <View style={[styles.badge, { backgroundColor: evt.free ? COLORS.brandGreenLight : COLORS.amberLight }]}>
                <Text style={[styles.badgeText, { color: evt.free ? COLORS.brandGreen : COLORS.amber }]}>
                  {evt.free ? 'Free' : `${evt.currency || ''} ${evt.amount || ''}`.trim()}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: evt.public ? COLORS.blueLight : '#fef2f2' }]}>
                <Text style={[styles.badgeText, { color: evt.public ? COLORS.blue : COLORS.danger }]}>
                  {evt.public ? 'Public' : 'Private'}
                </Text>
              </View>
            </View>
          </View>
          {evt.logo ? (
            <Image source={{ uri: evt.logo }} style={styles.eventLogo} />
          ) : null}
        </View>

        {/* Meta */}
        <View style={styles.metaList}>
          <View style={styles.metaItem}>
            <Users color={COLORS.textMuted} size={14} />
            <Text style={styles.metaText}>{evt.hostname || evt.host_name || '—'}</Text>
          </View>
          {(evt.room_name || evt.room_id) ? (
            <View style={styles.metaItem}>
              <MapPin color={COLORS.textMuted} size={14} />
              <Text style={styles.metaText}>
                {evt.room_name || rooms.find(r => String(r.id) === String(evt.room_id))?.name || `Room ${evt.room_id}`}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <CalendarDays color={COLORS.textMuted} size={14} />
            <Text style={styles.metaText}>{formatDate(evt.date)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Clock color={COLORS.textMuted} size={14} />
            <Text style={styles.metaText}>{formatTime(evt.time)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Globe color={COLORS.textMuted} size={14} />
            <Text style={styles.metaText}>{evt.timezone}</Text>
          </View>
          {evt.tags ? (
            <View style={styles.metaItem}>
              <Tag color={COLORS.textMuted} size={14} />
              <Text style={styles.metaText} numberOfLines={1}>{evt.tags}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            testID={`view-participants-${evt.id}`}
            style={styles.participantsBtn}
            activeOpacity={0.8}
            onPress={() => setParticipantsModal(evt)}
          >
            <Users color={COLORS.brandGreen} size={16} />
            <Text style={styles.participantsBtnText}>
              View Participants{evt.participants_count != null ? ` (${evt.participants_count})` : ''}
            </Text>
          </TouchableOpacity>

          <View style={styles.copyActionRow}>
            <TouchableOpacity
              testID={`share-event-link-${evt.id}`}
              style={styles.copyEventBtn}
              activeOpacity={0.8}
              onPress={async () => {
                const govMDA = await AsyncStorage.getItem('@1gov_mda');
                var eventUrl = evt.event_url.toString();
                if (govMDA != null) {
                  eventUrl = evt.event_url.toString().replace('govsupport', govMDA || '');
                }

                const host = evt.hostname || evt.host_name;
                const formattedDate = evt.date ? formatDate(evt.date) : '';
                const formattedTime = evt.time ? formatTime(evt.time) : '';

                let shareMessage = `📅 You're invited to: ${evt.title}\n\n`;
                if (host) shareMessage += `👤 Host: ${host}\n`;
                if (formattedDate) shareMessage += `🗓️ Date: ${formattedDate}\n`;
                if (formattedTime) shareMessage += `⏰ Time: ${formattedTime}${evt.timezone ? ` (${evt.timezone})` : ''}\n`;
                if (evt.about) shareMessage += `\n📝 About: ${evt.about}\n`;
                shareMessage += `\n🔗 Register & Join here:\n${eventUrl}`;
                
                try {
                  await Share.share({
                    title: `Event Invitation: ${evt.title}`,
                    message: shareMessage,
                    url: eventUrl,
                  });
                } catch (error) {
                  console.error('Error sharing event link:', error);
                }
              }}
            >
              <Share2 color={COLORS.purple} size={15} />
              <Text style={styles.copyEventBtnText}>Share Event Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID={`copy-meeting-link-${evt.id}`}
              style={styles.copyMeetingBtn}
              activeOpacity={0.8}
              onPress={async () => {
                const matched = rooms.find((r) => String(r.id) === String(evt.room_id));
                const roomSlug =
                  evt.room_name ||
                  matched?.url ||
                  matched?.name ||
                  String(evt.room_id);
                const edgeFrontendUrl =
                  process.env.EXPO_PUBLIC_EDGE_FRONTEND_URL ||
                  'https://meetingapp.konn3ct.net';
                const meetingUrl = `${edgeFrontendUrl}/join/${roomSlug}`;
                await Clipboard.setStringAsync(meetingUrl);
                Alert.alert('Meeting Link Copied', `Meeting link copied!\n\n${meetingUrl}`);
              }}
            >
              <Video color={COLORS.blue} size={15} />
              <Text style={styles.copyMeetingBtnText}>Copy Meeting Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  // ── Recent Registration Card ───────────────────────────────────────────────
  const renderRecentCard = ({ item }: { item: RecentRegistration }) => (
    <View style={styles.recentCard}>
      <View style={styles.participantAvatar}>
        <Text style={styles.participantAvatarText}>
          {(item.name || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.participantName}>{item.name}</Text>
        <Text style={styles.participantEmail}>{item.email}</Text>
        {item.event_title ? (
          <Text style={styles.recentEventTitle} numberOfLines={1}>📅 {item.event_title}</Text>
        ) : null}
      </View>
      {item.registered_at ? (
        <Text style={styles.recentTime}>
          {new Date(item.registered_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
        </Text>
      ) : null}
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Page Header ── */}
      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 24) }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.pageTitle}>Events</Text>
          <Text style={styles.pageSubtitle}>Manage pre-registered events & participants</Text>
        </View>
        {!APP_CONFIG.GOV_LOGIN && (
          <TouchableOpacity 
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                // @ts-ignore
                navigation.navigate('MainTabs');
              }
            }} 
            style={styles.closeBtn}
          >
            <X size={24} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 160 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.brandGreen]}
            tintColor={COLORS.brandGreen}
          />
        }
      >
        {/* ── Summary Stats ── */}
        <View style={styles.statsActionContainer}>
          <View style={styles.statsBox}>
            <View style={styles.statGroup}>
              <View style={[styles.statIconBox, { backgroundColor: `${COLORS.blue}15` }]}>
                <CalendarDays color={COLORS.blue} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Total Events</Text>
                {loading
                  ? <View style={styles.skeletonStat} />
                  : <Text style={styles.statValue}>{summary?.total_events ?? events.length}</Text>
                }
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statGroup}>
              <View style={[styles.statIconBox, { backgroundColor: `${COLORS.emerald}15` }]}>
                <Users color={COLORS.emerald} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Participants</Text>
                {loading
                  ? <View style={styles.skeletonStat} />
                  : <Text style={styles.statValue}>{summary?.total_participants ?? '—'}</Text>
                }
              </View>
            </View>
          </View>

          <TouchableOpacity
            testID="create-event-btn"
            style={styles.createBtn}
            activeOpacity={0.85}
            onPress={() => setCreateModalVisible(true)}
          >
            <Plus color="#ffffff" size={20} />
            <Text style={styles.createBtnText}>Create Event</Text>
          </TouchableOpacity>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabBar}>
          {(['events', 'recent'] as ActiveTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'events' ? `My Events${events.length > 0 ? ` (${events.length})` : ''}` : 'Recent Registrations'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Content ── */}
        {loading ? (
          <View style={styles.centeredLoader}>
            <ActivityIndicator size="large" color={COLORS.brandGreen} />
            <Text style={styles.loaderText}>Loading events…</Text>
          </View>
        ) : error ? (
          <View style={styles.centeredLoader}>
            <AlertCircle color={COLORS.danger} size={48} />
            <Text style={[styles.emptyText, { color: COLORS.danger }]}>Something went wrong</Text>
            <Text style={styles.loaderText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadData()}>
              <RefreshCw color="#fff" size={16} />
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'events' ? (
          events.length === 0 ? (
            <View style={styles.centeredLoader}>
              <CalendarDays color={COLORS.textMuted} size={56} />
              <Text style={styles.emptyText}>No events yet</Text>
              <Text style={styles.loaderText}>Create your first event to get started</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => setCreateModalVisible(true)}>
                <Plus color="#fff" size={16} />
                <Text style={styles.retryBtnText}>Create Event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={events}
              keyExtractor={(item, i) => String(item.id ?? i)}
              renderItem={renderEventCard}
              contentContainerStyle={styles.eventsList}
              scrollEnabled={false}
            />
          )
        ) : (
          recentRegs.length === 0 ? (
            <View style={styles.centeredLoader}>
              <UserPlus color={COLORS.textMuted} size={56} />
              <Text style={styles.emptyText}>No recent registrations</Text>
              <Text style={styles.loaderText}>Participants who register for your events will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={recentRegs}
              keyExtractor={(item, i) => String(item.id ?? i)}
              renderItem={renderRecentCard}
              contentContainerStyle={[styles.eventsList, { gap: 10 }]}
              scrollEnabled={false}
            />
          )
        )}
      </ScrollView>

      {/* ── Create Modal ── */}
      <CreateEventModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={() => {
          setCreateModalVisible(false);
          loadData(true);
        }}
        rooms={rooms}
      />

      {/* ── Participants Modal ── */}
      <ParticipantsModal
        event={participantsModal}
        visible={!!participantsModal}
        onClose={() => setParticipantsModal(null)}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },

  // Page Header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    zIndex: 10,
  },
  pageTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, color: '#64748b', marginTop: 3 },
  closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 12 },

  // Scroll
  scrollContent: { paddingTop: 24 },

  // Stats
  statsActionContainer: { paddingHorizontal: 20, marginBottom: 20, gap: 14 },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  statGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 },
  statIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  statDivider: { width: 1, height: '70%', backgroundColor: COLORS.border },
  skeletonStat: { height: 18, width: 40, borderRadius: 6, backgroundColor: '#e2e8f0', marginTop: 4 },

  // Create Btn
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.brandGreen, height: 52, borderRadius: 14, gap: 8,
    shadowColor: COLORS.brandGreen, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  createBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },

  // Tabs
  tabBar: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 20,
    backgroundColor: '#fff', borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.brandGreen },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: '#fff' },

  // Events List
  eventsList: { paddingHorizontal: 20, gap: 16 },
  eventCard: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 3, overflow: 'hidden',
  },
  cardTopStrip: { height: 6, width: '100%' },
  cardContent: { padding: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  eventTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 22 },
  eventBadges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  eventLogo: { width: 48, height: 48, borderRadius: 10, marginLeft: 12 },

  metaList: { gap: 10, marginBottom: 18 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { fontSize: 13, fontWeight: '500', color: COLORS.textMuted, flex: 1 },

  cardFooter: { paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  participantsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 44, borderRadius: 12, backgroundColor: COLORS.brandGreenLight, gap: 8,
  },
  participantsBtnText: {
    color: COLORS.brandGreen,
    fontWeight: '600',
    fontSize: 14,
  },
  copyActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  copyEventBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    backgroundColor: COLORS.purpleLight,
    borderRadius: 12,
  },
  copyEventBtnText: {
    color: COLORS.purple,
    fontWeight: '600',
    fontSize: 13,
  },
  copyMeetingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    backgroundColor: COLORS.blueLight,
    borderRadius: 12,
  },
  copyMeetingBtnText: {
    color: COLORS.blue,
    fontWeight: '600',
    fontSize: 13,
  },

  // Recent Registrations
  recentCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, gap: 12,
  },
  recentEventTitle: { fontSize: 12, color: COLORS.brandBlue, marginTop: 2 },
  recentTime: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },

  // Participant card (used in both list)
  participantCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, gap: 12,
  },
  participantAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.brandBlue, justifyContent: 'center', alignItems: 'center',
  },
  participantAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  participantName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  participantEmail: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  participantMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },

  // Empty / Loader
  centeredLoader: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 12 },
  loaderText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyText: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: COLORS.brandGreen, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Reminder btn
  reminderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.brandBlue, height: 46, borderRadius: 12, gap: 8,
  },
  reminderBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeaderTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingBottom: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginTop: 3 },
  modalScrollContent: { padding: 20 },
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    marginBottom: 18, borderWidth: 1, borderColor: '#f1f5f9',
  },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeading: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },
  formGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  asterisk: { color: '#ef4444' },
  subLabel: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 8 },
  input: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15, color: '#0f172a',
  },
  textArea: { height: 110, paddingTop: 14, paddingBottom: 14 },
  selectBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16, height: 50,
  },
  selectBtnText: { fontSize: 15, color: '#0f172a', flex: 1 },
  dropdownList: {
    marginTop: 6, backgroundColor: '#fff', borderWidth: 1,
    borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden',
  },
  dropdownItem: {
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dropdownItemActive: { backgroundColor: 'rgba(32,116,80,0.05)' },
  dropdownItemText: { fontSize: 14, color: '#334155' },

  dateTimeContainer: { flexDirection: 'row', marginBottom: 18 },
  dtBtn: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, height: 52, justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 8,
  },
  dtBtnText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },

  ticketTypeBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
    borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#f8fafc',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  ticketTypeActive: { borderColor: '#207450', backgroundColor: 'rgba(32,116,80,0.05)' },
  ticketTypeText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  ticketTypeTextActive: { color: '#207450' },

  priceInputRow: { position: 'relative', justifyContent: 'center' },
  priceIcon: { position: 'absolute', left: 14, zIndex: 1 },

  // Logo picker
  logoPickerBtn: {
    height: 90, borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0',
    borderStyle: 'dashed', backgroundColor: '#f8fafc',
    justifyContent: 'center', alignItems: 'center', gap: 8, flexDirection: 'row',
  },
  logoPickerText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  logoPicked: { width: '100%', height: '100%', borderRadius: 10 },

  modalFooter: {
    flexDirection: 'row', padding: 20, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 12,
  },
  cancelBtn: {
    flex: 1, height: 54, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff',
  },
  cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
  submitBtn: {
    flex: 1.5, height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#207450', shadowColor: '#207450',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});
