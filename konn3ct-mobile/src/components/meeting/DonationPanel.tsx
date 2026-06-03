import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { useAuthStore } from '../../store/useAuthStore';

export function DonationPanel() {
  const { setActivePane } = useMeetingStore();
  const { user } = useAuthStore();
  
  // Connect directly to the web app's donation flow if we had a dedicated route, 
  // or a direct Paystack payment link for MVP
  const paymentUrl = `https://paystack.com/pay/konn3ct-donate?email=${user?.email || 'guest@example.com'}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Support & Offering</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <X size={20} color="#94a3b8" />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <WebView 
          source={{ uri: paymentUrl }} 
          style={{ flex: 1 }}
          startInLoadingState={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    height: 400,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#0f172a',
  },
  title: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  content: { flex: 1, backgroundColor: 'white' },
});
