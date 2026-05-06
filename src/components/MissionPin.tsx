import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants';
import type { MissionTier } from '../types/Mission';
import { TIER_COLORS } from '../config/tierConfig';
import { getMissionIconName } from '../config/missionIcons';

const GREEN = '#22C55E';

interface Props {
  iconType: string;
  completed?: boolean;
  tier?: MissionTier;
  armed?: boolean;
}

export default function MissionPin({
  iconType,
  completed = false,
  tier,
  armed = true,
}: Props) {
  const iconName = getMissionIconName(iconType);
  const baseAccent = tier ? TIER_COLORS[tier] : Colors.accent;
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
    outputRange: [baseAccent, GREEN],
  });

  // armed=false → mission'a yaklaşıldığında tamamlanmaz; pin soluk gözükür,
  // çevresinde kesik kenar var ve sağ üstte kilit overlay'i sebep iletir.
  const isLocked = !completed && !armed;
  const pinColor = isLocked ? Colors.lockedPin : accentColor;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: floatAnim }] },
      ]}
    >
      <Animated.View
        style={[
          styles.diamond,
          isLocked && styles.diamondLocked,
          {
            backgroundColor: pinColor,
            shadowColor: isLocked ? Colors.lockedPin : (completed ? GREEN : baseAccent),
          },
        ]}
      >
        <View style={styles.iconInner}>
          <Ionicons name={iconName} size={12} color={isLocked ? Colors.lockedPinIcon : Colors.textPrimary} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.stem, { backgroundColor: pinColor }]} />
      <Animated.View style={[styles.glow, { backgroundColor: pinColor }]} />
      {isLocked && (
        <View style={styles.lockBadge} pointerEvents="none">
          <Ionicons name="lock-closed" size={8} color="#0b0d12" />
        </View>
      )}
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
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  // RN'de borderStyle: 'dashed' borderRadius ile her zaman uyumlu çalışmaz; bu
  // yüzden locked diamond'da köşe yuvarlamasını sıfırlıyoruz ki kesik kenar
  // hem iOS hem Android'de doğru çizilsin.
  diamondLocked: {
    borderRadius: 0,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#ffffff',
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
  lockBadge: {
    position: 'absolute',
    top: -2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0b0d12',
  },
});
