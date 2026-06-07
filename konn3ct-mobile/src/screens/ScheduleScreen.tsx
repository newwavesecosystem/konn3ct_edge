import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, Modal, TextInput, Alert, Platform,
  ScrollView, KeyboardAvoidingView 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Calendar, Plus, X, Clock, Video, MonitorPlay, 
  AlignLeft, Globe, Mail, Check, Users, ChevronDown 
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { apiClient } from '../api/client';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
};

export default function ScheduleScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [mode, setMode] = useState<'meeting' | 'webinar'>('meeting');
  const [title, setTitle] = useState('');
  const [hostname, setHostname] = useState('');
  const [additional, setAdditional] = useState('');
  const [date, setDate] = useState(new Date());
  
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomId, setRoomId] = useState('');
  const [showRoomSelect, setShowRoomSelect] = useState(false);

  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  const [guestEmail, setGuestEmail] = useState('');
  const [guests, setGuests] = useState<string[]>([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const fetchData = async () => {
    try {
      const [meetRes, roomsRes] = await Promise.all([
        apiClient.get('/scheduling').catch(() => ({ data: [] })),
        apiClient.get('/rooms').catch(() => ({ data: [] }))
      ]);
      setMeetings(meetRes.data || []);
      setRooms(roomsRes.data || []);
      if (roomsRes.data?.length > 0 && !roomId) {
        setRoomId(roomsRes.data[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const addGuest = () => {
    const email = guestEmail.trim();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!guests.includes(email)) {
      setGuests([...guests, email]);
    }
    setGuestEmail('');
  };

  const removeGuest = (email: string) => {
    setGuests(guests.filter(g => g !== email));
  };

  const handleSchedule = async () => {
    if (!title.trim() || !hostname.trim() || !roomId) {
      Alert.alert("Required Fields", "Please fill in Session Title, Hostname, and select a Room.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Sending data formatted for the scheduling endpoint. 
      // Including extra fields which might be used by the backend if they update to match dashboard.
      await apiClient.post('/scheduling', {
        title: title.trim(),
        startTime: date.toISOString(),
        durationMin: 60,
        roomId: roomId,
        hostname: hostname.trim(),
        mode,
        additional: additional.trim(),
        timezone,
        guests
      });
      
      setModalVisible(false);
      resetForm();
      fetchData();
      Alert.alert("Success", "Session scheduled successfully!");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to schedule session.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setHostname('');
    setAdditional('');
    setDate(new Date());
    setGuests([]);
    setGuestEmail('');
    setMode('meeting');
    setShowRoomSelect(false);
  };

  const renderMeetingItem = ({ item }: { item: any }) => {
    const meetDate = new Date(item.startTime);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateDay}>{meetDate.getDate()}</Text>
            <Text style={styles.dateMonth}>{meetDate.toLocaleString('default', { month: 'short' })}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>Room: {item.room?.name || 'Unknown'}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.timeRow}>
            <Clock size={16} color="#64748b" />
            <Text style={styles.timeText}>
              {meetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.joinBtn}
            onPress={() => navigation.navigate('Meeting', { roomId: item.room?.slug || item.roomId })}
          >
            <Video size={16} color="white" />
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const selectedRoom = rooms.find(r => String(r.id) === String(roomId));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Schedule</Text>
          <Text style={styles.subtitle}>Manage your upcoming meetings</Text>
        </View>
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Plus color="white" size={24} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#207450" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={meetings}
          renderItem={renderMeetingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Calendar size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Upcoming Meetings</Text>
              <Text style={styles.emptySubtitle}>Tap the + button to schedule your first session.</Text>
            </View>
          }
        />
      )}

      {/* Comprehensive Schedule Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeaderTop}>
            <View>
              <Text style={styles.modalTitle}>Schedule Session</Text>
              <Text style={styles.modalSubtitle}>Set up a new meeting or webinar.</Text>
            </View>
            <TouchableOpacity onPress={() => {
              setModalVisible(false);
              resetForm();
            }} style={styles.closeBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Mode Selection */}
            <View style={styles.modeContainer}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'meeting' && styles.modeBtnActive]}
                onPress={() => setMode('meeting')}
                activeOpacity={0.8}
              >
                <View style={[styles.modeIconBox, mode === 'meeting' ? {backgroundColor: '#207450'} : {backgroundColor: '#f1f5f9'}]}>
                  <Video size={20} color={mode === 'meeting' ? '#fff' : '#64748b'} />
                </View>
                <Text style={[styles.modeTitle, mode === 'meeting' && {color: '#207450'}]}>Meeting</Text>
                <Text style={styles.modeDesc}>Highly interactive, best for team syncs.</Text>
                {mode === 'meeting' && <View style={styles.modeCheck}><Check size={14} color="#207450" /></View>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeBtn, mode === 'webinar' && styles.modeBtnActiveWebinar]}
                onPress={() => setMode('webinar')}
                activeOpacity={0.8}
              >
                <View style={[styles.modeIconBox, mode === 'webinar' ? {backgroundColor: '#0284c7'} : {backgroundColor: '#f1f5f9'}]}>
                  <MonitorPlay size={20} color={mode === 'webinar' ? '#fff' : '#64748b'} />
                </View>
                <Text style={[styles.modeTitle, mode === 'webinar' && {color: '#0284c7'}]}>Webinar</Text>
                <Text style={styles.modeDesc}>View-only attendees, best for broadcasts.</Text>
                {mode === 'webinar' && <View style={styles.modeCheck}><Check size={14} color="#0284c7" /></View>}
              </TouchableOpacity>
            </View>

            {/* Basic Details Section */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>Basic Details</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Session Title <Text style={styles.asterisk}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Weekly Product Sync"
                  value={title}
                  onChangeText={setTitle}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Hostname <Text style={styles.asterisk}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. John Doe"
                  value={hostname}
                  onChangeText={setHostname}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <AlignLeft size={16} color="#64748b" />
                  <Text style={styles.labelWithIcon}>Description</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="What is this session about?"
                  value={additional}
                  onChangeText={setAdditional}
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Link to Room <Text style={styles.asterisk}>*</Text></Text>
                <TouchableOpacity 
                  style={styles.selectBtn} 
                  activeOpacity={0.7}
                  onPress={() => setShowRoomSelect(!showRoomSelect)}
                >
                  <Text style={[styles.selectBtnText, !selectedRoom && {color: '#94a3b8'}]}>
                    {selectedRoom ? selectedRoom.name : 'Select an existing room...'}
                  </Text>
                  <ChevronDown size={20} color="#64748b" />
                </TouchableOpacity>

                {showRoomSelect && (
                  <View style={styles.dropdownList}>
                    {rooms.length === 0 ? (
                      <Text style={styles.dropdownEmpty}>No rooms found.</Text>
                    ) : (
                      rooms.map(r => (
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
                      ))
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Date & Time Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <Calendar size={18} color="#207450" />
                <Text style={[styles.sectionHeading, {borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0}]}>Date & Time</Text>
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
                <Text style={styles.timezoneLabel}>Timezone <Text style={styles.asterisk}>*</Text></Text>
                <View style={styles.timezoneBox}>
                  <Text style={styles.timezoneText} numberOfLines={1}>{timezone}</Text>
                </View>
              </View>
            </View>

            {/* Invites & Access Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeadingRow}>
                <Mail size={18} color="#207450" />
                <Text style={[styles.sectionHeading, {borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0}]}>Invites & Access</Text>
              </View>
              <View style={styles.divider} />

              <View style={styles.formGroup}>
                <Text style={styles.label}>Invite Attendees</Text>
                
                <View style={styles.chipInputContainer}>
                  <View style={[styles.chipWrap, guests.length > 0 && { marginBottom: 12 }]}>
                    {guests.map((g, i) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{g}</Text>
                        <TouchableOpacity onPress={() => removeGuest(g)} style={styles.chipClose}>
                          <X size={12} color="#207450" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  <View style={styles.guestInputRow}>
                    <TextInput
                      style={styles.guestInput}
                      placeholder={guests.length === 0 ? "Type email..." : "Add another..."}
                      value={guestEmail}
                      onChangeText={setGuestEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor="#94a3b8"
                      onSubmitEditing={addGuest}
                    />
                    <TouchableOpacity style={styles.addGuestBtn} onPress={addGuest}>
                      <Text style={styles.addGuestBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.helpText}>Invited users will receive a calendar invite with the join link.</Text>
              </View>
            </View>

            <View style={{height: 40}} />
          </ScrollView>

          {/* Action Footer */}
          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleSchedule}
              disabled={isSubmitting}
            >
              <Text style={styles.submitBtnText}>
                {isSubmitting ? 'Scheduling...' : 'Schedule Session'}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },
  fab: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#207450', justifyContent: 'center', alignItems: 'center', shadowColor: '#207450', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  
  list: { padding: 16, paddingBottom: 140 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  dateBadge: { backgroundColor: 'rgba(32, 116, 80, 0.08)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', marginRight: 16 },
  dateDay: { color: '#207450', fontSize: 20, fontWeight: 'bold' },
  dateMonth: { color: '#10b981', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  cardTitle: { color: '#0f172a', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { color: '#64748b', fontSize: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { color: '#64748b', fontWeight: '600', marginLeft: 6 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  joinBtnText: { color: 'white', fontWeight: 'bold', marginLeft: 6 },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { color: '#334155', fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { color: '#64748b', textAlign: 'center', paddingHorizontal: 40 },
  
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 12 },
  
  modalScrollContent: { padding: 20 },
  
  modeContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  modeBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: '#f1f5f9', position: 'relative' },
  modeBtnActive: { borderColor: '#207450', backgroundColor: 'rgba(32, 116, 80, 0.04)' },
  modeBtnActiveWebinar: { borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.04)' },
  modeIconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modeTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  modeDesc: { fontSize: 12, color: '#64748b', textAlign: 'center' },
  modeCheck: { position: 'absolute', top: 12, right: 12 },

  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  sectionHeading: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12, marginBottom: 16 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },

  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  labelWithIcon: { fontSize: 14, fontWeight: '600', color: '#334155' },
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
  dropdownEmpty: { padding: 16, color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' },

  dateTimeContainer: { flexDirection: 'row', marginBottom: 20 },
  dtBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, height: 54, justifyContent: 'center', alignItems: 'center' },
  dtBtnText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },

  timezoneRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  timezoneLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginLeft: 8, marginRight: 12 },
  timezoneBox: { flex: 1, alignItems: 'flex-end' },
  timezoneText: { fontSize: 14, color: '#64748b', fontWeight: '500' },

  chipInputContainer: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(32, 116, 80, 0.1)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  chipText: { fontSize: 13, color: '#207450', fontWeight: '600', marginRight: 6 },
  chipClose: { padding: 2, backgroundColor: 'rgba(32, 116, 80, 0.1)', borderRadius: 10 },
  guestInputRow: { flexDirection: 'row', alignItems: 'center' },
  guestInput: { flex: 1, fontSize: 15, color: '#0f172a', padding: 0, height: 24 },
  addGuestBtn: { backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addGuestBtnText: { fontSize: 13, fontWeight: 'bold', color: '#475569' },
  helpText: { fontSize: 12, color: '#94a3b8', marginTop: 8 },

  modalFooter: { flexDirection: 'row', padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 12 },
  cancelBtn: { flex: 1, height: 54, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
  submitBtn: { flex: 1.5, height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#207450', shadowColor: '#207450', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});
