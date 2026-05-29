import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export const WhiteboardPanel: React.FC = () => {
  // We use the hosted Excalidraw instance because embedding the entire React bundle
  // natively is too heavy and requires a complex local HTTP server.
  // We point to Excalidraw's official embed link.
  
  return (
    <View style={styles.container}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
