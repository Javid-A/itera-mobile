import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import type { MissionTier } from '../src/types/Routine';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  briefcase: 'briefcase',
  barbell: 'barbell',
  cafe: 'cafe',
  star: 'star',
  home: 'home',
  school: 'school',
};

const GREEN = '#22C55E';

const TIER_ACCENT: Record<MissionTier, string> = {
  A: Colors.accent,
  B: '#22D3EE',
  C: '#A855F7',
};

interface Props {
  iconType: string;
  completed?: boolean;
  tier?: MissionTier;
}

export default function MissionPin({ iconType, completed = false, tier }: Props) {
  const iconName = ICON_MAP[iconType] ?? 'location';
  const baseAccent = tier ? TIER_ACCENT[tier] : Colors.accent;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(completed ? 1 : 0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [floatAnim]);

  useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: completed ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [completed, colorAnim]);

  const accentColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [baseAccent, GREEN],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: floatAnim }] }]}>
      <Animated.View
        style={[
          styles.pinHead,
          {
            backgroundColor: accentColor,
            shadowColor: completed ? GREEN : baseAccent,
          },
        ]}
      >
        <Ionicons name={iconName} size={14} color={Colors.background} />
      </Animated.View>
      <Animated.View
        style={[
          styles.pinTail,
          {
            borderTopColor: accentColor,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 32,
    height: 44,
  },
  pinHead: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
