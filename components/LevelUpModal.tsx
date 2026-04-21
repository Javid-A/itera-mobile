import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../constants';
import XPCountUp from './XPCountUp';

interface Props {
  visible: boolean;
  level: number;
  earnedXP: number;
  onClose: () => void;
}

const { width: SCREEN_W } = Dimensions.get('window');
const CENTER_X = SCREEN_W / 2;
const CENTER_Y = 230;

const RING_SIZES = [280, 220, 170, 120];
const STATIC_RING_SIZES = [320, 260];
const PARTICLE_COLORS = [Colors.accent, Colors.accent, Colors.accent, Colors.orange, Colors.blue, '#ffffff'];

interface Particle {
  id: number;
  startX: number;
  startY: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  dx: number;
  dy: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: 24 }, (_, i) => {
    const angle = -180 + Math.random() * 360;
    const rad = (angle * Math.PI) / 180;
    const dist = 80 + Math.random() * 110;
    return {
      id: i,
      startX: CENTER_X + (Math.random() - 0.5) * 80,
      startY: CENTER_Y,
      size: 2 + Math.random() * 4,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      delay: Math.random() * 700,
      duration: 1400 + Math.random() * 800,
      dx: Math.sin(rad) * dist,
      dy: -(Math.abs(Math.cos(rad)) * dist * 0.6 + dist * 0.4),
    };
  });
}

function ParticleDot({ p, runKey }: { p: Particle; runKey: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const timeout = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 1,
        duration: p.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, p.delay);
    return () => clearTimeout(timeout);
  }, [anim, p.delay, p.duration, runKey]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const opacity = anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.6, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: p.startX - p.size / 2,
        top: p.startY - p.size / 2,
        width: p.size,
        height: p.size,
        borderRadius: p.size / 2,
        backgroundColor: p.color,
        shadowColor: p.color,
        shadowOpacity: 0.9,
        shadowRadius: p.size * 2.5,
        shadowOffset: { width: 0, height: 0 },
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
}

function PulseRing({ size, delay }: { size: number; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

function TwinkleDot({ x, y, delay }: { x: number; y: number; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.twinkle,
        { left: x, top: y, opacity },
      ]}
    />
  );
}

export default function LevelUpModal({ visible, level, earnedXP, onClose }: Props) {
  const particles = useMemo(generateParticles, []);
  const runKey = useRef(0);
  if (visible) runKey.current += 0; // capture but reset on remount via key

  // Center icon: self-glow (opacity+scale) + float
  const iconGlow = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  // Title shimmer
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const iconGlowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconGlow, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(iconGlow, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    iconGlowLoop.start();
    floatLoop.start();
    shimmerLoop.start();
    return () => {
      iconGlowLoop.stop();
      floatLoop.stop();
      shimmerLoop.stop();
    };
  }, [visible, iconGlow, float, shimmer]);

  const iconOpacity = iconGlow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const iconScale = iconGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const titleOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} key={visible ? 'open' : 'closed'}>
      <View style={styles.overlay}>
        <View style={styles.bgGlow} />

        {/* Particles */}
        {particles.map((p) => (
          <ParticleDot key={p.id} p={p} runKey={runKey.current} />
        ))}

        {/* Static decorative rings */}
        {STATIC_RING_SIZES.map((size, i) => (
          <View
            key={`s${i}`}
            pointerEvents="none"
            style={[
              styles.staticRing,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderColor: i === 0 ? 'rgba(166, 230, 53, 0.04)' : 'rgba(166, 230, 53, 0.07)',
              },
            ]}
          />
        ))}

        {/* Pulse rings */}
        {RING_SIZES.map((size, i) => (
          <PulseRing key={`p${i}`} size={size} delay={i * 500} />
        ))}

        {/* Twinkle dots */}
        <TwinkleDot x={20} y={120} delay={0} />
        <TwinkleDot x={SCREEN_W - 30} y={90} delay={200} />
        <TwinkleDot x={10} y={300} delay={400} />
        <TwinkleDot x={SCREEN_W - 25} y={310} delay={600} />
        <TwinkleDot x={30} y={520} delay={800} />
        <TwinkleDot x={SCREEN_W - 40} y={500} delay={1000} />

        <View style={styles.content}>
          {/* Center glowing icon */}
          <Animated.View
            style={[
              styles.iconBox,
              {
                opacity: iconOpacity,
                transform: [{ translateY: floatY }, { scale: iconScale }],
              },
            ]}
          >
            <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                stroke={Colors.accent}
                strokeWidth={1.6}
                fill="rgba(166, 230, 53, 0.18)"
              />
              <Path
                d="M12 8v4l3 2"
                stroke={Colors.accent}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>

          {/* Title */}
          <Animated.Text style={[styles.congrats, { opacity: titleOpacity }]}>CONGRATULATIONS</Animated.Text>
          <Text style={styles.bigTitle}>LEVEL UP!</Text>
          <Text style={styles.reachedText}>
            You reached <Text style={{ color: Colors.accent, fontFamily: 'Inter_700Bold' }}>Level {level}</Text>
          </Text>

          {/* Reward cards with count-up */}
          <View style={styles.rewardRow}>
            <View style={styles.rewardCard}>
              <XPCountUp
                target={earnedXP}
                prefix="+"
                duration={1100}
                delay={300}
                style={styles.rewardValue}
              />
              <Text style={styles.rewardLabel}>XP EARNED</Text>
            </View>
            <View style={styles.rewardCard}>
              <XPCountUp
                target={level}
                duration={1100}
                delay={500}
                style={[styles.rewardValue, { color: Colors.textPrimary }]}
              />
              <Text style={styles.rewardLabel}>NEW LEVEL</Text>
            </View>
          </View>

          <Pressable style={styles.cta} onPress={onClose}>
            <Text style={[Typography.cta, { color: Colors.background, fontSize: 18, letterSpacing: 2 }]}>
              CONTINUE →
            </Text>
          </Pressable>

          <Pressable style={styles.backLink} onPress={onClose}>
            <Ionicons name="arrow-back" size={14} color={Colors.textSecondary} />
            <Text style={[Typography.body, { color: Colors.textSecondary }]}>Back to Map</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#07080f',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'absolute',
    top: -100,
    left: -100,
    right: -100,
    bottom: -100,
    backgroundColor: '#0c1520',
    opacity: 0.5,
    borderRadius: 800,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  ring: {
    position: 'absolute',
    left: CENTER_X,
    top: CENTER_Y,
    borderWidth: 1.5,
    borderColor: 'rgba(166, 230, 53, 0.4)',
  },
  staticRing: {
    position: 'absolute',
    left: CENTER_X,
    top: CENTER_Y,
    borderWidth: 1,
  },
  twinkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  iconBox: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: 'rgba(166, 230, 53, 0.18)',
    borderWidth: 2.5,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 16,
  },
  congrats: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 4,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  bigTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 64,
    letterSpacing: -1,
    color: Colors.accent,
    marginTop: Spacing.xs,
    textShadowColor: Colors.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    lineHeight: 64,
  },
  reachedText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  rewardRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  rewardCard: {
    flex: 1,
    backgroundColor: 'rgba(13, 17, 32, 0.85)',
    borderWidth: 1,
    borderColor: Colors.borderBright,
    borderRadius: 18,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  rewardValue: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 26,
    color: Colors.accent,
    textShadowColor: Colors.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  rewardLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  cta: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 10,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
});
