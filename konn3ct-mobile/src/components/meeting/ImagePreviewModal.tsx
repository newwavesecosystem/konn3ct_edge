import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  ScrollView,
  StatusBar
} from 'react-native';
import { X, Download, AlertCircle, FileImage } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ImagePreviewData {
  uri: string;
  fileName: string;
  fileSize?: string;
  senderName: string;
  mimeType?: string;
}

interface ImagePreviewModalProps {
  visible: boolean;
  image: ImagePreviewData | null;
  onClose: () => void;
}

/** Accepted MIME types for image preview */
const PREVIEWABLE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** Accepted file extensions for image preview (fallback when MIME is unavailable) */
const PREVIEWABLE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

/**
 * Determines if a file can be previewed as an image.
 * Prioritises MIME type validation over extension for security.
 */
export function isPreviewableImage(fileName: string, mimeType?: string): boolean {
  // 1. Validate by MIME type first (most reliable)
  if (mimeType) {
    return PREVIEWABLE_MIME_TYPES.has(mimeType.toLowerCase());
  }
  // 2. Fall back to extension-based check
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return PREVIEWABLE_EXTENSIONS.has(ext);
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  image,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');

  // Reset state when a new image is opened
  useEffect(() => {
    if (visible && image) {
      setLoading(true);
      setError(false);
    }
  }, [visible, image]);

  const handleDownload = async () => {
    if (!image) return;
    try {
      setDownloading(true);
      
      // Download to cache directory (always available, no permissions needed)
      const fileUri = (FileSystem.cacheDirectory || '') + image.fileName;
      const { uri: localUri } = await FileSystem.downloadAsync(image.uri, fileUri);
      
      // Try to share the file so the user can save it wherever they want
      try {
        const Sharing = require('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri, {
            mimeType: image.mimeType || 'image/jpeg',
            dialogTitle: 'Save Image',
          });
        } else {
          Alert.alert('Success', `Image saved to: ${localUri}`);
        }
      } catch {
        // expo-sharing may not be installed, just show success
        Alert.alert('Success', 'Image downloaded successfully');
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Unable to save file. Please check storage permissions.');
    } finally {
      setDownloading(false);
    }
  };

  const truncatedFileName = image?.fileName
    ? (image.fileName.length > 30 ? image.fileName.substring(0, 27) + '...' : image.fileName)
    : 'Image Preview';

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      {visible && <StatusBar hidden />}
      
      <View style={styles.overlay}>
        {/* Header Bar */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={onClose}
            accessibilityLabel="Close image preview"
          >
            <X color="#FFFFFF" size={24} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle} numberOfLines={1}>
            {truncatedFileName}
          </Text>
          
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={handleDownload}
            disabled={downloading || !image}
            accessibilityLabel="Save image"
          >
            {downloading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Download color="#FFFFFF" size={24} />
            )}
          </TouchableOpacity>
        </View>

        {/* Center content */}
        <View style={styles.contentContainer}>
          {image && !error && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              <Image
                source={{ uri: image.uri }}
                style={{ width, height: height - 160 }}
                resizeMode="contain"
                accessibilityLabel={`Preview of ${image.fileName}`}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            </ScrollView>
          )}

          {loading && !error && (
            <View style={styles.centerAbsolute}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          {error && (
            <View style={styles.errorCard}>
              <AlertCircle color="#D93025" size={48} />
              <Text style={styles.errorText}>Unable to load image</Text>
              <Text style={styles.errorSubText}>{image?.fileName}</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setLoading(true);
                  setError(false);
                }}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom Info Bar */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.footerInfo}>
            <Text style={styles.senderText}>Shared by {image?.senderName}</Text>
            {image?.fileSize && (
              <Text style={styles.sizeText}>{image.fileSize}</Text>
            )}
          </View>
          <View style={styles.mimeBadge}>
            <FileImage color="#FFFFFF" size={14} />
            <Text style={styles.mimeText}>
              {image?.mimeType?.split('/')[1]?.toUpperCase() || image?.fileName.split('.').pop()?.toUpperCase() || 'IMAGE'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  headerButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerAbsolute: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: '80%',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorSubText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#1B6B46',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 24,
    paddingTop: 16,
    zIndex: 10,
  },
  footerInfo: {
    flex: 1,
  },
  senderText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  sizeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
  },
  mimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  mimeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
