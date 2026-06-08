import React, { useState } from 'react';
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
  Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Headset,
  Bell,
  Calendar,
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
  CalendarIcon
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

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
  emerald: '#10b981',
};

const MOCK_EVENTS = [
  {
    id: 'evt-1',
    title: 'Konnect Global Summit 2026',
    host: 'Kayode Admin',
    room: 'Main Auditorium',
    date: 'Dec 15, 2026',
    time: '10:00 AM',
    timezone: 'Africa/Lagos',
  },
  {
    id: 'evt-2',
    title: 'Product Design Workshop',
    host: 'UX Team',
    room: 'Design Studio A',
    date: 'Dec 20, 2026',
    time: '02:00 PM',
    timezone: 'Europe/London',
  },
  {
    id: 'evt-3',
    title: 'Q4 Engineering All Hands',
    host: 'John Doe',
    room: 'Tech Hub',
    date: 'Dec 28, 2026',
    time: '09:00 AM',
    timezone: 'America/New_York',
  },
];

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [host, setHost] = useState('');
  const [roomId, setRoomId] = useState('');
  const [showRoomSelect, setShowRoomSelect] = useState(false);
  const [about, setAbout] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timezone, setTimezone] = useState('Africa/Lagos');
  
  const [isFree, setIsFree] = useState(true);
  const [currency, setCurrency] = useState('NGN');
  const [amount, setAmount] = useState('');
  const [reminder, setReminder] = useState('1'); 

  const mockRooms = [
    { id: 'r1', name: 'Main Auditorium' },
    { id: 'r2', name: 'Design Studio A' },
    { id: 'r3', name: 'Tech Hub' }
  ];

  const handleAction = (action: string, id?: string) => {
    if (action === 'Create Event') {
      setModalVisible(true);
    } else {
      console.log(`${action} triggered`, id ? `for ${id}` : '');
    }
  };

  const handleCreate = () => {
    if (!title.trim() || !host.trim() || !roomId) {
      Alert.alert("Required Fields", "Please fill in Event Title, Host Name, and select a Room.");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setModalVisible(false);
      Alert.alert("Success", "Event created successfully!");
      // Reset form
      setTitle('');
      setHost('');
      setRoomId('');
      setAbout('');
      setIsFree(true);
      setAmount('');
    }, 1500);
  };

  const selectedRoom = mockRooms.find(r => r.id === roomId);

  const renderEventCard = (evt: typeof MOCK_EVENTS[0]) => {
    return (
      <View key={evt.id} style={styles.eventCard}>
        <LinearGradient
          colors={['#34d399', '#3b82f6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cardTopStrip}
        />
        
        <View style={styles.cardContent}>
          {/* Header Row */}
          <View style={styles.cardHeader}>
            <Text style={styles.eventTitle} numberOfLines={2}>{evt.title}</Text>
            <TouchableOpacity style={styles.moreBtn} onPress={() => handleAction('Options', evt.id)}>
              <MoreVertical color={COLORS.textMuted} size={18} />
            </TouchableOpacity>
          </View>

          {/* Meta Details */}
          <View style={styles.metaList}>
            <View style={styles.metaItem}>
              <Users color={COLORS.textMuted} size={14} style={styles.metaIcon} />
              <Text style={styles.metaText}>{evt.host}</Text>
            </View>
            <View style={styles.metaItem}>
              <MapPin color={COLORS.textMuted} size={14} style={styles.metaIcon} />
              <Text style={styles.metaText}>{evt.room}</Text>
            </View>
            <View style={styles.metaItem}>
              <CalendarDays color={COLORS.textMuted} size={14} style={styles.metaIcon} />
              <Text style={styles.metaText}>{evt.date}</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock color={COLORS.textMuted} size={14} style={styles.metaIcon} />
              <Text style={styles.metaText}>{evt.time}</Text>
            </View>
            <View style={styles.metaItem}>
              <Globe color={COLORS.textMuted} size={14} style={styles.metaIcon} />
              <Text style={styles.metaText}>{evt.timezone}</Text>
            </View>
          </View>

          {/* Footer Action */}
          <View style={styles.cardFooter}>
            <TouchableOpacity 
              style={styles.participantsBtn} 
              activeOpacity={0.8}
              onPress={() => handleAction('View Participants', evt.id)}
            >
              <Users color={COLORS.brandGreen} size={16} />
              <Text style={styles.participantsBtnText}>View Participants</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ===== HEADER ===== */}
      <View style={[styles.modalHeaderTop, { paddingTop: Math.max(insets.top, 24) }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <Text style={styles.modalTitle}>Events Overview</Text>
          <Text style={styles.modalSubtitle}>Manage your pre-registered events, track participants, and share links.</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Stats & Actions */}
        <View style={styles.statsActionContainer}>
          <View style={styles.statsBox}>
            <View style={styles.statGroup}>
              <View style={[styles.statIconBox, { backgroundColor: `${COLORS.blue}15` }]}>
                <CalendarDays color={COLORS.blue} size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel} numberOfLines={2}>Total Events</Text>
                <Text style={styles.statValue}>12</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statGroup}>
              <View style={[styles.statIconBox, { backgroundColor: `${COLORS.emerald}15` }]}>
                <Users color={COLORS.emerald} size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel} numberOfLines={2}>Total Participants</Text>
                <Text style={styles.statValue}>3,450</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.createBtn} activeOpacity={0.8} onPress={() => handleAction('Create Event')}>
            <Plus color="#ffffff" size={20} />
            <Text style={styles.createBtnText}>Create Event</Text>
          </TouchableOpacity>
        </View>

        {/* Events List */}
        <View style={styles.eventsList}>
          {MOCK_EVENTS.map(renderEventCard)}
        </View>
      </ScrollView>

      {/* Create Event Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={[styles.modalHeaderTop, { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 24) : 24 }]}>
            <View>
              <Text style={styles.modalTitle}>Create New Event</Text>
              <Text style={styles.modalSubtitle}>Set up your pre-registered event details.</Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Basic Details */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <AlignLeft size={18} color="#012E89" />
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
                  value={host}
                  onChangeText={setHost}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Select Room <Text style={styles.asterisk}>*</Text></Text>
                <TouchableOpacity 
                  style={styles.selectBtn} 
                  activeOpacity={0.7}
                  onPress={() => setShowRoomSelect(!showRoomSelect)}
                >
                  <Text style={[styles.selectBtnText, !selectedRoom && {color: '#94a3b8'}]}>
                    {selectedRoom ? selectedRoom.name : 'Choose a room'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>

                {showRoomSelect && (
                  <View style={styles.dropdownList}>
                    {mockRooms.map(r => (
                      <TouchableOpacity 
                        key={r.id} 
                        style={[styles.dropdownItem, roomId === r.id && styles.dropdownItemActive]}
                        onPress={() => {
                          setRoomId(r.id);
                          setShowRoomSelect(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, roomId === r.id && {color: '#207450', fontWeight: 'bold'}]}>
                          {r.name}
                        </Text>
                        {roomId === r.id && <Check size={16} color="#207450" />}
                      </TouchableOpacity>
                    ))}
                  </View>
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
            </View>

            {/* Scheduling */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <CalendarIcon size={18} color="#207450" />
                <Text style={styles.sectionHeading}>Scheduling</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.dateTimeContainer}>
                <View style={{flex: 1}}>
                  <Text style={styles.subLabel}>DATE <Text style={styles.asterisk}>*</Text></Text>
                  <TouchableOpacity style={styles.dtBtn} onPress={() => setShowDatePicker(true)}>
                    <Text style={styles.dtBtnText}>{date.toLocaleDateString()}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{width: 12}} />
                <View style={{flex: 1}}>
                  <Text style={styles.subLabel}>TIME <Text style={styles.asterisk}>*</Text></Text>
                  <TouchableOpacity style={styles.dtBtn} onPress={() => setShowTimePicker(true)}>
                    <Text style={styles.dtBtnText}>{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.timezoneRow}>
                <Globe size={16} color="#64748b" />
                <Text style={styles.timezoneLabel}>Timezone</Text>
                <View style={styles.timezoneBox}>
                  <Text style={styles.timezoneText} numberOfLines={1}>{timezone}</Text>
                </View>
              </View>
            </View>

            {/* Ticketing */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <Tag size={18} color="#f59e0b" />
                <Text style={styles.sectionHeading}>Ticketing & Reminders</Text>
              </View>
              <View style={styles.divider} />

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <TouchableOpacity 
                  style={[styles.ticketTypeBtn, isFree && styles.ticketTypeActive]}
                  onPress={() => setIsFree(true)}
                >
                  <Text style={[styles.ticketTypeText, isFree && styles.ticketTypeTextActive]}>Free Event</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.ticketTypeBtn, !isFree && styles.ticketTypeActive]}
                  onPress={() => setIsFree(false)}
                >
                  <Text style={[styles.ticketTypeText, !isFree && styles.ticketTypeTextActive]}>Paid Event</Text>
                </TouchableOpacity>
              </View>

              {!isFree && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Ticket Price ({currency})</Text>
                  <View style={styles.priceInputRow}>
                    <DollarSign size={20} color="#64748b" style={styles.priceIcon} />
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
              )}

            </View>
            <View style={{height: 40}} />
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Creating...' : 'Create Event'}
              </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
  },
  
  // Header
  modalHeaderTop: {
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
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4, lineHeight: 20 },
  closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 12 },

  // Main Content
  scrollContent: {
    paddingTop: 24,
  },

  // Stats & Actions
  statsActionContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 16,
  },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  statGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: COLORS.border,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandGreen,
    height: 52,
    borderRadius: 14,
    gap: 8,
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Events List
  eventsList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  cardTopStrip: {
    height: 6,
    width: '100%',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 22,
    paddingRight: 12,
  },
  moreBtn: {
    padding: 4,
    marginRight: -4,
  },
  metaList: {
    gap: 10,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaIcon: {
    width: 16,
    opacity: 0.7,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  cardFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  participantsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.brandGreenLight,
    gap: 8,
  },
  participantsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brandGreen,
  },
  // Modal Container
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalScrollContent: { padding: 20 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeading: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },

  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  asterisk: { color: '#ef4444' },
  subLabel: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 8 },

  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15, color: '#0f172a' },
  textArea: { height: 100, paddingTop: 16, paddingBottom: 16 },
  
  selectBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, height: 50 },
  selectBtnText: { fontSize: 15, color: '#0f172a' },
  dropdownList: { marginTop: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden' },
  dropdownItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownItemActive: { backgroundColor: 'rgba(32, 116, 80, 0.05)' },
  dropdownItemText: { fontSize: 15, color: '#334155' },

  dateTimeContainer: { flexDirection: 'row', marginBottom: 20 },
  dtBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, height: 54, justifyContent: 'center', alignItems: 'center' },
  dtBtnText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },

  timezoneRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  timezoneLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginLeft: 8, marginRight: 12 },
  timezoneBox: { flex: 1, alignItems: 'flex-end' },
  timezoneText: { fontSize: 14, color: '#64748b', fontWeight: '500' },

  ticketTypeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#f8fafc' },
  ticketTypeActive: { borderColor: '#207450', backgroundColor: 'rgba(32, 116, 80, 0.05)' },
  ticketTypeText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  ticketTypeTextActive: { color: '#207450' },
  
  priceInputRow: { position: 'relative', justifyContent: 'center' },
  priceIcon: { position: 'absolute', left: 14, zIndex: 1 },

  modalFooter: { flexDirection: 'row', padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 12 },
  cancelBtn: { flex: 1, height: 54, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
  submitBtn: { flex: 1.5, height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#207450', shadowColor: '#207450', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});
