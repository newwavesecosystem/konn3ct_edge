import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';
import { meetingThemeTokens } from '../../theme/meetingTheme';

export const DocsPanel: React.FC = () => {
  const setActivePane = useMeetingStore(state => state.setActivePane);
  const theme = useMeetingStore(state => state.theme);
  const tokens = meetingThemeTokens[theme];
  const styles = getStyles(tokens);

  const insets = useSafeAreaInsets();
  const safeBottom = Platform.OS === 'android' ? Math.max(insets.bottom, 24) : insets.bottom;

  // A lightweight QuillJS HTML wrapper
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
      <style>
        body, html { margin: 0; padding: 0; height: 100%; background: #0f172a; color: white; }
        #editor { height: calc(100vh - 42px); font-size: 16px; border: none; }
        .ql-toolbar { background: #1e293b; border: none !important; border-bottom: 1px solid #334155 !important; }
        .ql-container { border: none !important; font-family: -apple-system, sans-serif; }
        .ql-stroke { stroke: #94a3b8 !important; }
        .ql-fill { fill: #94a3b8 !important; }
        .ql-picker { color: #94a3b8 !important; }
        .ql-editor.ql-blank::before { color: #64748b; font-style: italic; }
      </style>
    </head>
    <body>
      <div id="editor"></div>
      <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
      <script>
        var quill = new Quill('#editor', {
          theme: 'snow',
          placeholder: 'Start typing collaborative notes...',
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline'],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              ['link']
            ]
          }
        });
        
        quill.on('text-change', function(delta, oldDelta, source) {
          if (source === 'user') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'text-change',
              html: quill.root.innerHTML
            }));
          }
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { paddingBottom: safeBottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Docs</Text>
        <TouchableOpacity onPress={() => setActivePane('none')} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
      <WebView 
        originWhitelist={['*']}
        source={{ html: htmlContent }} 
        style={styles.webview}
        onMessage={(event) => {
          // Handle messages from Quill (e.g. syncing to WebRTC)
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'text-change') {
              // TODO: Sync to useMeetingStore.sharedNoteContent
            }
          } catch (e) {}
        }}
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
