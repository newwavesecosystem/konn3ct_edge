import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
};

import { apiClient } from '../api/client';
import { ActivityIndicator, Alert } from 'react-native';

export default function DashboardScreen({ navigation }: Props) {
  const [isCreating, setIsCreating] = React.useState(false);

  const handleJoin = () => {
    // For now, hardcode or ask user. We'll just alert for now since we need an input UI.
    Alert.prompt(
      "Join Meeting",
      "Enter Room ID (Slug)",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Join", onPress: (roomId) => { if(roomId) navigation.navigate('Meeting', { roomId }); } }
      ]
    );
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
          <Text style={styles.secondaryButtonText}>Join Room</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Upcoming</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTime}>10:00 AM - 11:00 AM</Text>
        <Text style={styles.cardTitle}>Weekly Sync</Text>
        <Text style={styles.cardSubtitle}>Room: test-room</Text>
      </View>
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
    marginBottom: 32,
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
});
