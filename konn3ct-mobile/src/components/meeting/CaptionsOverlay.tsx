import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useMeetingStore } from '../../store/useMeetingStore';

export const CaptionsOverlay: React.FC = () => {
  const captions = useMeetingStore(state => state.captions);
  const [fadeAnim] = useState(new Animated.Value(1));

  // Auto-hide captions after a few seconds of no updates
  useEffect(() => {
    fadeAnim.setValue(1);
    const timeout = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 5000);

    return () => clearTimeout(timeout);
  }, [captions, fadeAnim]);

  if (captions.length === 0) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]} pointerEvents="none">
      <View style={styles.captionsContainer}>
        {captions.map((caption, idx) => (
          <View key={`${caption.userId}-${caption.timestamp}-${idx}`} style={styles.captionRow}>
            <Text style={styles.captionName} numberOfLines={1}>{caption.name}: </Text>
            <Text style={[styles.captionText, !caption.isFinal && styles.captionTextDraft]}>
              {caption.text}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 120, // Sit above the toolbar
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 50,
  },
  captionsContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  captionName: {
    color: '#10b981', // brand-green
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 4,
  },
  captionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  captionTextDraft: {
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },
});
