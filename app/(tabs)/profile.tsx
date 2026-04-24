import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenContainer from '../../components/ScreenContainer';
import BackgroundLocationPrompt from '../../components/BackgroundLocationPrompt';
import LevelUpModal from '../../components/LevelUpModal';
import XPCountUp from '../../components/XPCountUp';
import { Colors, Spacing, Typography } from '../../constants';
import { useAuth } from '../../src/context/AuthContext';
import apiClient from '../../src/services/apiClient';
import { requestBackgroundLocation } from '../../src/services/locationSettings';
import type { CompletedMission } from '../../src/types/CompletedMission';

const XP_PER_LEVEL = 1000;

interface ProfileStats {
  currentLevel: number;
  currentXP: number;
  totalMissions: number;
  totalXP: number;
}

const RING_SIZE = 128;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ProfileScreen() {
  const { username, logout } = useAuth();
  const [stats, setStats] = useState<ProfileStats>({ currentLevel: 1, currentXP: 0, totalMissions: 0, totalXP: 0 });
  const [history, setHistory] = useState<CompletedMission[]>([]);
  const [bgGranted, setBgGranted] = useState(false);
  const [isAutoTrackingOn, setIsAutoTrackingOn] = useState(false);
  const [showBgPrompt, setShowBgPrompt] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const appState = useRef(AppState.currentState);

  const checkBgPermission = useCallback(() => {
    Location.getBackgroundPermissionsAsync().then((bg) => {
      const granted = bg.status === 'granted';
      setBgGranted(granted);
      // If OS permission was revoked outside the app, turn off the feature automatically
      if (!granted) {
        setIsAutoTrackingOn(false);
        AsyncStorage.setItem('autoTrackingEnabled', 'false');
      }
    });
  }, []);

  const loadAutoTrackingState = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem('autoTrackingEnabled');
      if (value !== null) {
        setIsAutoTrackingOn(value === 'true');
      }
    } catch (e) {
      console.error('Failed to load auto tracking state', e);
    }
  }, []);

  const refresh = useCallback(() => {
    apiClient
      .get<ProfileStats>('/profile')
      .then(({ data }) => setStats(data))
      .catch(() => {});
    apiClient
      .get<CompletedMission[]>('/missions/history')
      .then(({ data }) => setHistory(data))
      .catch(() => {});
    checkBgPermission();
    loadAutoTrackingState();
  }, [checkBgPermission, loadAutoTrackingState]);

  useFocusEffect(refresh);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkBgPermission();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [checkBgPermission]);

  const { streakDays, locationsCount, weekDots, todayDone } = useMemo(() => {
    const dayKeys = new Set(history.map((m) => isoDateKey(new Date(m.completedAt))));

    // Streak: consecutive days ending today with at least one mission
    let streak = 0;
    const cursor = startOfDay(new Date());
    // If today has no mission, streak starts from yesterday
    if (!dayKeys.has(isoDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (dayKeys.has(isoDateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Unique routineIds — proxy for locations
    const uniqueRoutines = new Set(history.map((m) => m.routineId));

    // Week dots (Mon..Sun)
    const today = startOfDay(new Date());
    const weekStart = new Date(today);
    const dayIdx = (today.getDay() + 6) % 7;
    weekStart.setDate(today.getDate() - dayIdx);

    const dots: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dots.push(dayKeys.has(isoDateKey(d)));
    }

    return {
      streakDays: streak,
      locationsCount: uniqueRoutines.size,
      weekDots: dots,
      todayDone: dayKeys.has(isoDateKey(today)),
    };
  }, [history]);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const selfGlowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const selfGlowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const flameScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  const handleEnableAutoTracking = async () => {
    setShowBgPrompt(false);
    const granted = await requestBackgroundLocation();
    if (granted) {
      setBgGranted(true);
      setIsAutoTrackingOn(true);
      await AsyncStorage.setItem('autoTrackingEnabled', 'true');
    }
  };

  const handleAutoTrackingToggle = async () => {
    if (isAutoTrackingOn) {
      // Turn off logic purely at app level
      setIsAutoTrackingOn(false);
      await AsyncStorage.setItem('autoTrackingEnabled', 'false');
    } else {
      // Trying to turn on
      if (bgGranted) {
        setIsAutoTrackingOn(true);
        await AsyncStorage.setItem('autoTrackingEnabled', 'true');
      } else {
        setShowBgPrompt(true);
      }
    }
  };

  const xpTarget = stats.currentLevel * XP_PER_LEVEL;
  const xpProgress = Math.min(1, stats.currentXP / xpTarget);
  const dashOffset = RING_CIRC * (1 - xpProgress);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleResetStats = () => {
    Alert.alert('Reset Stats', 'This wipes all completed missions and resets XP/level to zero. Dev use only.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete('/profile/stats');
            refresh();
          } catch {
            Alert.alert('Error', 'Failed to reset stats.');
          }
        },
      },
    ]);
  };

  const tier = stats.currentLevel >= 10 ? 'Elite Operative' : stats.currentLevel >= 5 ? 'Operative' : 'Recruit';

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
        <View style={styles.titleRow}>
          <Text style={[Typography.displayXL, { color: Colors.textPrimary }]}>Profile</Text>
          <Pressable style={styles.levelUpPill} onPress={() => setShowLevelUp(true)}>
            <Ionicons name="flash" size={14} color={Colors.accent} />
            <Text style={styles.levelUpPillText}>LEVEL UP</Text>
          </Pressable>
        </View>

        <View style={styles.identityRow}>
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={Colors.borderBright}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={Colors.accent}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={[Typography.label, { color: Colors.textSecondary }]}>LEVEL</Text>
              <XPCountUp
                target={stats.currentLevel}
                duration={900}
                style={[Typography.statXL, { color: Colors.accent, marginTop: -2, fontSize: 40 }]}
              />
            </View>
          </View>

          <View style={styles.identityInfo}>
            <Text style={[Typography.displayLG, { color: Colors.textPrimary }]} numberOfLines={1}>
              {username ?? '...'}
            </Text>
            <View style={styles.tierPill}>
              <Text style={styles.tierPillText}>{tier}</Text>
            </View>
            <View style={styles.xpBarWrap}>
              <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` }]} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
              <XPCountUp
                target={stats.currentXP}
                duration={1100}
                style={[Typography.caption, { color: Colors.textSecondary }]}
              />
              <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
                {` / ${xpTarget.toLocaleString()} XP to Lv ${stats.currentLevel + 1}`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <XPCountUp
              target={stats.totalMissions}
              duration={1000}
              delay={100}
              style={[Typography.statXL, { color: Colors.accent }]}
            />
            <Text style={styles.statCardLabel}>Missions</Text>
          </View>
          <View style={styles.statCard}>
            <XPCountUp
              target={streakDays}
              duration={1000}
              delay={250}
              style={[Typography.statXL, { color: Colors.accent }]}
            />
            <Text style={styles.statCardLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <XPCountUp
              target={locationsCount}
              duration={1000}
              delay={400}
              style={[Typography.statXL, { color: Colors.accent }]}
            />
            <Text style={styles.statCardLabel}>Locations</Text>
          </View>
        </View>

        <View style={styles.streakCard}>
          <View style={styles.streakCardHeader}>
            <Text style={styles.streakCardTitle}>ACTIVE STREAK</Text>
            {!todayDone && (
              <Animated.View
                style={[
                  styles.todayPendingPill,
                  { opacity: selfGlowOpacity, transform: [{ scale: selfGlowScale }] },
                ]}
              >
                <Animated.Text style={[styles.todayPendingFlame, { transform: [{ scale: flameScale }] }]}>
                  🔥
                </Animated.Text>
                <Text style={styles.todayPendingText}>TODAY PENDING</Text>
              </Animated.View>
            )}
          </View>
          <View style={styles.weekDotsRow}>
            {weekDots.map((active, i) => {
              const isTodayIdx = i === (new Date().getDay() + 6) % 7;
              return (
                <View key={i} style={styles.weekDotCol}>
                  {isTodayIdx && !todayDone ? (
                    <Animated.View
                      style={[
                        styles.weekDot,
                        styles.weekDotPending,
                        { opacity: selfGlowOpacity, transform: [{ scale: selfGlowScale }] },
                      ]}
                    >
                      <Animated.Text style={{ fontSize: 12, transform: [{ scale: flameScale }] }}>🔥</Animated.Text>
                    </Animated.View>
                  ) : (
                    <View
                      style={[
                        styles.weekDot,
                        active ? styles.weekDotActive : styles.weekDotInactive,
                      ]}
                    >
                      {active && <View style={styles.weekDotInner} />}
                    </View>
                  )}
                  <Text style={[styles.weekDotLabel, isTodayIdx && { color: Colors.textPrimary }]}>
                    {DAY_LABELS[i]}
                  </Text>
                </View>
              );
            })}
          </View>
          {!todayDone && streakDays > 0 && (
            <View style={styles.reminderBanner}>
              <Ionicons name="flash" size={14} color={Colors.orange} />
              <Text style={styles.reminderText}>
                Complete 1 mission today to maintain your {streakDays}-day streak
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>SETTINGS</Text>

        <Pressable style={styles.settingsRow} onPress={handleAutoTrackingToggle}>
          <View style={[styles.settingsIcon, isAutoTrackingOn && { backgroundColor: Colors.accentSoft, borderColor: Colors.accent }]}>
            <Ionicons name="star-outline" size={18} color={isAutoTrackingOn ? Colors.accent : Colors.textSecondary} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.bodyBold, { color: Colors.textPrimary }]}>Auto-Tracking</Text>
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
              {isAutoTrackingOn ? 'Missions complete automatically' : 'Tap to enable background location'}
            </Text>
          </View>
          <Switch
            value={isAutoTrackingOn}
            onValueChange={handleAutoTrackingToggle}
            trackColor={{ false: Colors.surface3, true: Colors.accent }}
            thumbColor={isAutoTrackingOn ? '#ffffff' : '#c9d2e6'}
          />
        </Pressable>

        <Pressable style={[styles.settingsRow, { marginTop: Spacing.sm }]} onPress={handleLogout}>
          <View style={styles.settingsIcon}>
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.bodyBold, { color: Colors.textPrimary }]}>Sign Out</Text>
            <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
              End your current session
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </Pressable>

        {__DEV__ && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>DEVELOPER</Text>
            <Pressable style={styles.settingsRow} onPress={handleResetStats}>
              <View style={styles.settingsIcon}>
                <Ionicons name="refresh-outline" size={18} color={Colors.orange} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={[Typography.bodyBold, { color: Colors.textPrimary }]}>Reset Stats</Text>
                <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]}>
                  Wipe completed missions, XP and level
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </Pressable>
          </>
        )}
      </ScrollView>

      <BackgroundLocationPrompt
        visible={showBgPrompt}
        onEnable={handleEnableAutoTracking}
        onSkip={() => setShowBgPrompt(false)}
      />
      <LevelUpModal
        visible={showLevelUp}
        level={stats.currentLevel}
        earnedXP={stats.currentXP}
        onClose={() => setShowLevelUp(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  levelUpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(166, 230, 53, 0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelUpPillText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    color: Colors.accent,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityInfo: {
    flex: 1,
  },
  tierPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(166, 230, 53, 0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  tierPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.accent,
  },
  xpBarWrap: {
    height: 6,
    backgroundColor: Colors.surface2,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  statCardLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  streakCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  streakCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakCardTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
  },
  todayPendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.55)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayPendingFlame: {
    fontSize: 10,
  },
  todayPendingText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.orange,
  },
  weekDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  weekDotCol: {
    alignItems: 'center',
    flex: 1,
  },
  weekDot: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  weekDotActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  weekDotInactive: {
    backgroundColor: Colors.surface2,
    borderColor: Colors.border,
  },
  weekDotPending: {
    backgroundColor: 'rgba(249, 115, 22, 0.18)',
    borderColor: 'rgba(249, 115, 22, 0.55)',
  },
  weekDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  weekDotLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
    letterSpacing: 0.8,
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    marginTop: Spacing.md,
  },
  reminderText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.orange,
  },
  sectionLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
