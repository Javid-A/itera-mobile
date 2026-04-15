import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  briefcase: 'briefcase',
  barbell: 'barbell',
  cafe: 'cafe',
  star: 'star',
  home: 'home',
  school: 'school',
};

const GREEN = '#22C55E';

interface Props {
  iconType: string;
  completed?: boolean;
}

export default function MissionPin({ iconType, completed = false }: Props) {
  const iconName = ICON_MAP[iconType] ?? 'location';
  const floatAnim = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(completed ? 1 : 0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -5,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 900,
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
    outputRange: [Colors.accent, GREEN],
  });

  const shadowOpacity = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0.7],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: floatAnim }] }]}>
      <Animated.View
        style={[
          styles.diamond,
          {
            backgroundColor: accentColor,
            shadowColor: completed ? GREEN : Colors.accent,
            shadowOpacity,
          },
        ]}
      >
        <View style={styles.iconInner}>
          <Ionicons name={iconName} size={12} color={Colors.textPrimary} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.stem, { backgroundColor: accentColor }]} />
      <Animated.View style={[styles.glow, { backgroundColor: accentColor }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 30,
    height: 42,
  },
  diamond: {
    width: 22,
    height: 22,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 6,
  },
  stem: {
    width: 2,
    height: 10,
    marginTop: -2,
  },
  iconInner: {
    transform: [{ rotate: '-45deg' }],
  },
  glow: {
    width: 10,
    height: 3,
    borderRadius: 6,
    opacity: 0.3,
    marginTop: 2,
  },
});
