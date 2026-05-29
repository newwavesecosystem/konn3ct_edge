import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { apiClient } from '../api/client';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
};

export default function DashboardScreen({ navigation }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [pastRooms, setPastRooms] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  React.useEffect(() => {
    Promise.all([
      apiClient.get('/rooms').catch(() => ({ data: [] })),
      apiClient.get('/scheduling').catch(() => ({ data: [] }))
    ]).then(([roomsRes, schedRes]) => {
      setPastRooms(roomsRes.data.slice(0, 3));
      setUpcoming(schedRes.data.slice(0, 3));
      setIsLoadingRooms(false);
    });
  }, []);

  const handleJoin = () => {
    if (!showJoinInput) {
      setShowJoinInput(true);
      return;
    }

    if (joinRoomId.trim()) {
      navigation.navigate('Meeting', { roomId: joinRoomId.trim() });
      setShowJoinInput(false);
      setJoinRoomId('');
    } else {
      Alert.alert("Error", "Please enter a valid Room ID.");
    }
  };

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const payload = {
        name: 'Mobile Meeting ' + Math.floor(Math.random() * 1000),
        mode: 'meeting',
        recordingSetting: 'off',
        guestJoinAllowed: true,
        maxParticipants: 100,
        maxWebinarAudience: 1000,
        maxActiveCameras: 15
      };
      
      const res = await apiClient.post('/rooms', payload);
      const room = res.data;
      
      navigation.navigate('Meeting', { roomId: room.slug || room.id });
    } catch (e: any) {
      console.error('Failed to create room:', e.response?.data || e.message);
      Alert.alert('Error', 'Failed to create room on the backend.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back,</Text>
        <Text style={styles.subtitle}>Ready for your next meeting?</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleCreate}
          disabled={isCreating}
        >
          <Text style={styles.primaryButtonText}>
            {isCreating ? 'Creating...' : 'New Meeting'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={handleJoin}
        >
          <Text style={styles.secondaryButtonText}>
            {showJoinInput ? 'Go' : 'Join Room'}
          </Text>
        </TouchableOpacity>
      </View>

      {showJoinInput && (
        <View style={styles.joinInputContainer}>
          <TextInput
            style={styles.joinInput}
            placeholder="Enter Room ID (Slug)"
            value={joinRoomId}
            onChangeText={setJoinRoomId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity 
            style={styles.cancelJoinButton}
            onPress={() => {
              setShowJoinInput(false);
              setJoinRoomId('');
            }}
          >
            <Text style={styles.cancelJoinButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>Upcoming</Text>
      
      {isLoadingRooms ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : upcoming.length === 0 ? (
        <Text style={styles.emptyText}>No upcoming meetings.</Text>
      ) : (
        upcoming.map((meeting, i) => {
          const date = new Date(meeting.startTime);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <TouchableOpacity 
              key={i} 
              style={styles.card}
              onPress={() => navigation.navigate('Meeting', { roomId: meeting.room?.slug || meeting.roomId })}
            >
              <Text style={styles.cardTime}>{date.toLocaleDateString()} • {timeStr}</Text>
              <Text style={styles.cardTitle}>{meeting.title}</Text>
              <Text style={styles.cardSubtitle}>Room: {meeting.room?.name || 'Unknown'}</Text>
            </TouchableOpacity>
          );
        })
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Past Meetings Intelligence</Text>
      
      {isLoadingRooms ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : pastRooms.length === 0 ? (
        <Text style={styles.emptyText}>No past meetings found.</Text>
      ) : (
        pastRooms.map((room, i) => (
          <TouchableOpacity 
            key={i} 
            style={styles.pastRoomCard}
            onPress={() => navigation.navigate('MeetingSummary', { roomId: room.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{room.name}</Text>
              <Text style={styles.cardSubtitle}>ID: {room.slug}</Text>
            </View>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  header: {
    marginTop: 32,
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginLeft: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: 16,
  },
  joinInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  joinInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    fontSize: 16,
    marginRight: 12,
  },
  cancelJoinButton: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  cancelJoinButtonText: {
    color: '#64748b',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  cardTime: {
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardTitle: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 18,
  },
  cardSubtitle: {
    color: '#64748b',
    marginTop: 4,
  },
  pastRoomCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyText: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  aiBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  aiBadgeText: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: 12,
  }
});
