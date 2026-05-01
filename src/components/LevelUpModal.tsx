import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Spacing, Typography } from '../constants';
import { useTheme } from '../context/ThemeContext';
import type { ColorScheme } from '../constants/colors';
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

function generateParticles(palette: string[]): Particle[] {
  return Array.from({ length: 24 }, (_, i) => {
    const angle = -180 + Math.random() * 360;
    const rad = (angle * Math.PI) / 180;
    const dist = 80 + Math.random() * 110;
    return {
      id: i,
      startX: CENTER_X + (Math.random() - 0.5) * 80,
      startY: CENTER_Y,
      size: 2 + Math.random() * 4,
      color: palette[Math.floor(Math.random() * palette.length)],
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

function PulseRing({ size, delay, ringStyle }: { size: number; delay: number; ringStyle: any }) {
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
        ringStyle,
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

function TwinkleDot({ x, y, delay, twinkleStyle }: { x: number; y: number; delay: number; twinkleStyle: any }) {
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
        twinkleStyle,
        { left: x, top: y, opacity },
      ]}
    />
  );
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeStyles(C: ColorScheme, isDark: boolean) {
  const overlayBg = isDark ? '#07080f' : C.background;
  const bgGlowBg = isDark ? '#0c1520' : C.surface2;
  const ringBorder = hexToRgba(C.accent, 0.4);
  const staticRing0 = hexToRgba(C.accent, 0.04);
  const staticRing1 = hexToRgba(C.accent, 0.07);
  const iconBoxBg = hexToRgba(C.accent, 0.18);
  // Reward kart arka planı: dark'ta orijinal lacivert şeffaflık, light'ta surface üstü ince border.
  const rewardCardBg = isDark ? 'rgba(13, 17, 32, 0.85)' : C.surface;

  return {
    styles: StyleSheet.create({
      overlay: {
        flex: 1,
        backgroundColor: overlayBg,
        overflow: 'hidden',
      },
      bgGlow: {
        position: 'absolute',
        top: -100,
        left: -100,
        right: -100,
        bottom: -100,
        backgroundColor: bgGlowBg,
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
        borderColor: ringBorder,
      },
      staticRing0: {
        position: 'absolute',
        left: CENTER_X,
        top: CENTER_Y,
        borderWidth: 1,
        borderColor: staticRing0,
      },
      staticRing1: {
        position: 'absolute',
        left: CENTER_X,
        top: CENTER_Y,
        borderWidth: 1,
        borderColor: staticRing1,
      },
      twinkle: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: C.accent,
        shadowColor: C.accent,
        shadowOpacity: 1,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
      },
      iconBox: {
        width: 100,
        height: 100,
        borderRadius: 28,
        backgroundColor: iconBoxBg,
        borderWidth: 2.5,
        borderColor: C.accent,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 24,
        elevation: 16,
      },
      congrats: {
        fontFamily: 'Rajdhani_700Bold',
        fontSize: 11,
        letterSpacing: 4,
        color: C.textSecondary,
        marginTop: Spacing.lg,
      },
      bigTitle: {
        fontFamily: 'Rajdhani_700Bold',
        fontSize: 64,
        letterSpacing: -1,
        color: C.accent,
        marginTop: Spacing.xs,
        textShadowColor: C.accent,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 16,
        lineHeight: 64,
      },
      reachedText: {
        fontFamily: 'Inter_500Medium',
        fontSize: 15,
        color: C.textSecondary,
        marginTop: Spacing.sm,
      },
      rewardRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        width: '100%',
      },
      rewardCard: {
        flex: 1,
        backgroundColor: rewardCardBg,
        borderWidth: 1,
        borderColor: C.borderBright,
        borderRadius: 18,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        shadowColor: C.accent,
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
      },
      rewardValue: {
        fontFamily: 'Rajdhani_700Bold',
        fontSize: 26,
        color: C.accent,
        textShadowColor: C.accent,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
      },
      rewardLabel: {
        fontFamily: 'Rajdhani_700Bold',
        fontSize: 10,
        letterSpacing: 1.2,
        color: C.textSecondary,
        marginTop: 4,
      },
      cta: {
        width: '100%',
        height: 56,
        borderRadius: 18,
        backgroundColor: C.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.md,
        shadowColor: C.accent,
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
    }),
    iconFill: hexToRgba(C.accent, 0.18),
  };
}

export default function LevelUpModal({ visible, level, earnedXP, onClose }: Props) {
  const { colors: C, isDark } = useTheme();
  const { t } = useTranslation();
  const { styles, iconFill } = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const particlePalette = useMemo(
    () => [C.accent, C.accent, C.accent, C.orange, C.blue, isDark ? '#ffffff' : C.textPrimary],
    [C, isDark],
  );
  const particles = useMemo(() => generateParticles(particlePalette), [particlePalette]);
  const runKey = useRef(0);
  if (visible) runKey.current += 0;

  const iconGlow = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
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

        {particles.map((p) => (
          <ParticleDot key={p.id} p={p} runKey={runKey.current} />
        ))}

        {STATIC_RING_SIZES.map((size, i) => (
          <View
            key={`s${i}`}
            pointerEvents="none"
            style={[
              i === 0 ? styles.staticRing0 : styles.staticRing1,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                marginLeft: -size / 2,
                marginTop: -size / 2,
              },
            ]}
          />
        ))}

        {RING_SIZES.map((size, i) => (
          <PulseRing key={`p${i}`} size={size} delay={i * 500} ringStyle={styles.ring} />
        ))}

        <TwinkleDot x={20} y={120} delay={0} twinkleStyle={styles.twinkle} />
        <TwinkleDot x={SCREEN_W - 30} y={90} delay={200} twinkleStyle={styles.twinkle} />
        <TwinkleDot x={10} y={300} delay={400} twinkleStyle={styles.twinkle} />
        <TwinkleDot x={SCREEN_W - 25} y={310} delay={600} twinkleStyle={styles.twinkle} />
        <TwinkleDot x={30} y={520} delay={800} twinkleStyle={styles.twinkle} />
        <TwinkleDot x={SCREEN_W - 40} y={500} delay={1000} twinkleStyle={styles.twinkle} />

        <View style={styles.content}>
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
                stroke={C.accent}
                strokeWidth={1.6}
                fill={iconFill}
              />
              <Path
                d="M12 8v4l3 2"
                stroke={C.accent}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>

          <Animated.Text style={[styles.congrats, { opacity: titleOpacity }]}>{t('levelUp.congratulations')}</Animated.Text>
          <Text style={styles.bigTitle}>{t('levelUp.title')}</Text>
          <Text style={styles.reachedText}>
            {t('levelUp.reachedPrefix')}{' '}
            <Text style={{ color: C.accent, fontFamily: 'Inter_700Bold' }}>
              {t('levelUp.levelDisplay', { level })}
            </Text>
          </Text>

          <View style={styles.rewardRow}>
            <View style={styles.rewardCard}>
              <XPCountUp
                target={earnedXP}
                prefix="+"
                duration={1100}
                delay={300}
                style={styles.rewardValue}
              />
              <Text style={styles.rewardLabel}>{t('levelUp.xpEarned')}</Text>
            </View>
            <View style={styles.rewardCard}>
              <XPCountUp
                target={level}
                duration={1100}
                delay={500}
                style={[styles.rewardValue, { color: C.textPrimary }]}
              />
              <Text style={styles.rewardLabel}>{t('levelUp.newLevel')}</Text>
            </View>
          </View>

          <Pressable style={styles.cta} onPress={onClose}>
            <Text style={[Typography.cta, { color: C.background, fontSize: 18, letterSpacing: 2 }]}>
              {t('levelUp.continueButton')}
            </Text>
          </Pressable>

          <Pressable style={styles.backLink} onPress={onClose}>
            <Ionicons name="arrow-back" size={14} color={C.textSecondary} />
            <Text style={[Typography.body, { color: C.textSecondary }]}>{t('levelUp.backToMap')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
