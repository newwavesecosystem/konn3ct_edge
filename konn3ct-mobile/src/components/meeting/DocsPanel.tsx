import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export const DocsPanel: React.FC = () => {
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
    <View style={styles.container}>
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
