import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Plus, X, Clock, Video } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { apiClient } from '../api/client';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
};

export default function ScheduleScreen({ navigation }: Props) {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMeetings = async () => {
    try {
      const res = await apiClient.get('/scheduling');
      setMeetings(res.data);
    } catch (e) {
      console.error("Failed to fetch meetings", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMeetings();
    }, [])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMeetings();
  };

  const handleSchedule = async () => {
    if (!title.trim()) {
      Alert.alert("Required", "Please enter a meeting title.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post('/scheduling', {
        title: title.trim(),
        startTime: date.toISOString(),
      });
      setModalVisible(false);
      setTitle('');
      setDate(new Date());
      fetchMeetings();
      Alert.alert("Success", "Meeting scheduled successfully!");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to schedule meeting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
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
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={meetings}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Calendar size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Upcoming Meetings</Text>
              <Text style={styles.emptySubtitle}>Tap the + button to schedule your first meeting.</Text>
            </View>
          }
        />
      )}

      {/* Schedule Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Schedule Meeting</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Meeting Title</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g., Team Sync"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Date & Time</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowDatePicker(true)}>
                <Calendar size={18} color="#2563eb" />
                <Text style={styles.dateTimeText}>{date.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowTimePicker(true)}>
                <Clock size={18} color="#2563eb" />
                <Text style={styles.dateTimeText}>
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

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

          <View style={{ flex: 1 }} />
          
          <TouchableOpacity 
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSchedule}
            disabled={isSubmitting}
          >
            <Text style={styles.submitBtnText}>
              {isSubmitting ? 'Scheduling...' : 'Schedule Meeting'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },
  fab: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', shadowColor: '#2563eb', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  dateBadge: { backgroundColor: '#eff6ff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', marginRight: 16 },
  dateDay: { color: '#2563eb', fontSize: 20, fontWeight: 'bold' },
  dateMonth: { color: '#3b82f6', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
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
  modalContainer: { flex: 1, backgroundColor: '#ffffff', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  closeBtn: { padding: 8 },
  formGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 16, color: '#0f172a' },
  dateTimeRow: { flexDirection: 'row', gap: 12 },
  dateTimeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, padding: 16 },
  dateTimeText: { color: '#2563eb', fontWeight: 'bold', marginLeft: 8 },
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 16, padding: 20, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }
});
