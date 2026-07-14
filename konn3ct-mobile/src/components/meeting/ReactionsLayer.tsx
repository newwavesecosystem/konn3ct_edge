import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { useMeetingStore } from '../../store/useMeetingStore';

export const ReactionsLayer: React.FC = () => {
  const reactions = useMeetingStore(state => state.reactions);
  const removeReaction = useMeetingStore(state => state.removeReaction);

  return (
    <View style={styles.container} pointerEvents="none">
      {reactions.map((r) => (
        <ReactionAnimation 
          key={r.id} 
          reaction={r} 
          onComplete={() => removeReaction(r.id)} 
        />
      ))}
    </View>
  );
};

const ReactionAnimation = ({ reaction, onComplete }: { reaction: any, onComplete: () => void }) => {
  const [position] = useState(new Animated.ValueXY({ x: (Math.random() * 100) - 50, y: SCREEN_HEIGHT - 250 }));
  const [opacity] = useState(new Animated.Value(1));
  const [scale] = useState(new Animated.Value(0.5));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(position.y, {
        toValue: SCREEN_HEIGHT - 650,
        duration: 4000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 2000,
        delay: 2000,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.5,
        friction: 3,
        useNativeDriver: true,
      })
    ]).start(() => {
      onComplete();
    });
  }, []);

  return (
    <Animated.View style={[
      styles.reactionWrapper,
      {
        opacity,
        transform: [
          { translateX: position.x },
          { translateY: position.y },
          { scale }
        ]
      }
    ]}>
      <Text style={styles.emoji}>{reaction.emoji}</Text>
      <Text style={styles.name}>{reaction.name}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 150,
    zIndex: 90,
  },
  reactionWrapper: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  emoji: { fontSize: 28 },
  name: { color: 'white', fontSize: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, borderRadius: 4, marginTop: 4 }
});
