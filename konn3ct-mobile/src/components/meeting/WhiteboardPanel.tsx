import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { meetingThemeTokens } from '../../theme/meetingTheme';

export const WhiteboardPanel: React.FC = () => {
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const theme = useMeetingStore(state => state.theme);
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);

  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;

  // We use the hosted Excalidraw instance because embedding the entire React bundle
  // natively is too heavy and requires a complex local HTTP server.
  // We point to Excalidraw's official embed link.
  
  return (
    <View style={[styles.container, { paddingBottom: safeBottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Whiteboard</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
      <WebView 
        source={{ uri: 'https://excalidraw.com' }} 
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        )}
      />
    </View>
  );
};

const getStyles = (t: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '70%',
    backgroundColor: t.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: t.shadowOpacity, shadowRadius: 10, elevation: 10,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.border
  },
  title: { color: t.textPrimary, fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  closeText: { color: t.textMuted, fontSize: 20 },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
