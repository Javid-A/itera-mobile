import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import ScreenContainer from '../../src/components/ScreenContainer';
import BackgroundLocationPrompt from '../../src/components/BackgroundLocationPrompt';
import LevelUpModal from '../../src/components/LevelUpModal';
import LanguagePickerModal from '../../src/components/LanguagePickerModal';
import SignOutModal from '../../src/components/SignOutModal';
import XPCountUp from '../../src/components/XPCountUp';
import { Spacing, Typography } from '../../src/constants';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage, AVAILABLE_LANGUAGES } from '../../src/context/LanguageContext';
import { resetProfileStats } from '../../src/api/profile';
import { useProfile } from '../../src/state/queries/useProfile';
import { useMissionHistory } from '../../src/state/queries/useMissionHistory';
import { qk } from '../../src/state/queryKeys';
import { requestBackgroundLocation } from '../../src/services/locationSettings';
import { LocationService } from '../../src/services/LocationService';
import { useBackgroundPermission } from '../../src/hooks/useBackgroundPermission';
import { STORAGE_KEYS, STREAK_BONUS_TIERS, XP_PER_LEVEL } from '../../src/config/gameConfig';
import type { ColorScheme } from '../../src/constants/colors';

const RING_SIZE = 128;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;


function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const PROFILE_FALLBACK = { username: '', currentLevel: 1, currentXP: 0, totalMissions: 0, totalXP: 0, currentStreak: 0 };

function makeStyles(C: ColorScheme) {
  return StyleSheet.create({
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
      backgroundColor: C.accentSoft,
      borderWidth: 1,
      borderColor: C.accentBorder,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    levelUpPillText: {
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 12,
      letterSpacing: 1.2,
      color: C.accent,
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
      backgroundColor: C.accentSoft,
      borderWidth: 1,
      borderColor: C.accentBorder,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 4,
    },
    tierPillText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: C.accent,
    },
    xpBarWrap: {
      height: 6,
      backgroundColor: C.surface2,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: Spacing.sm,
    },
    xpBarFill: {
      height: '100%',
      backgroundColor: C.accent,
      borderRadius: 3,
      shadowColor: C.accent,
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
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.borderBright,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.md,
    },
    statCardLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: C.textSecondary,
      marginTop: 2,
    },
    streakCard: {
      backgroundColor: C.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.borderBright,
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
      color: C.textSecondary,
    },
    todayPendingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.orangeDim,
      borderWidth: 1,
      borderColor: C.orangeBorder,
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
      color: C.orange,
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
      backgroundColor: C.accentSoft,
      borderColor: C.accent,
    },
    weekDotInactive: {
      backgroundColor: C.surface2,
      borderColor: C.border,
    },
    weekDotPending: {
      backgroundColor: C.orangeDim,
      borderColor: C.orangeBorder,
    },
    weekDotInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: C.accent,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
    },
    weekDotLabel: {
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 11,
      color: C.textSecondary,
      marginTop: 6,
      letterSpacing: 0.8,
    },
    reminderBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.orangeSubtle,
      borderWidth: 1,
      borderColor: C.orangeBorder,
      borderRadius: 12,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      marginTop: Spacing.md,
    },
    reminderText: {
      flex: 1,
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: C.orange,
    },
    streakBonusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: Spacing.md,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    streakBonusText: {
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 12,
      letterSpacing: 1,
      color: C.success,
    },
    streakBonusNoneText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: C.textSecondary,
    },
    sectionLabel: {
      fontFamily: 'Rajdhani_700Bold',
      fontSize: 11,
      letterSpacing: 1.4,
      color: C.textSecondary,
      marginTop: Spacing.xl,
      marginBottom: Spacing.sm,
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 16,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: C.borderBright,
    },
    settingsIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: C.surface2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
  });
}

export default function ProfileScreen() {
  const { username, logout } = useAuth();
  const { colors: C, isDark, toggleTheme } = useTheme();
  const { language, changeLanguage } = useLanguage();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const dayLabels = t('common.dayLabels', { returnObjects: true }) as string[];
  const { data: profileData } = useProfile();
  const { data: historyData } = useMissionHistory();
  const stats = profileData ?? PROFILE_FALLBACK;
  const history = historyData ?? [];
  const [isAutoTrackingOn, setIsAutoTrackingOn] = useState(false);
  const [showBgPrompt, setShowBgPrompt] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);

  const { granted: bgGranted, refresh: checkBgPermission, setGranted: setBgGranted } =
    useBackgroundPermission();

  // OS izninin dışarıdan iptal edilmesi durumunda auto-tracking flag'ini kapat
  useEffect(() => {
    if (!bgGranted) {
      setIsAutoTrackingOn(false);
      AsyncStorage.setItem(STORAGE_KEYS.autoTrackingEnabled, 'false');
    }
  }, [bgGranted]);

  const loadAutoTrackingState = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.autoTrackingEnabled);
      if (value !== null) {
        setIsAutoTrackingOn(value === 'true');
      }
    } catch (e) {
      console.error('Failed to load auto tracking state', e);
    }
  }, []);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.profile });
    queryClient.invalidateQueries({ queryKey: qk.missionHistory });
    checkBgPermission();
    loadAutoTrackingState();
  }, [queryClient, checkBgPermission, loadAutoTrackingState]);

  useFocusEffect(refresh);

  const streakDays = stats.currentStreak ?? 0;

  const { locationsCount, weekDots, todayDone } = useMemo(() => {
    const dayKeys = new Set(history.map((m) => isoDateKey(new Date(m.completedAt))));
    const uniqueRoutines = new Set(history.map((m) => m.id));

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
      locationsCount: uniqueRoutines.size,
      weekDots: dots,
      todayDone: dayKeys.has(isoDateKey(today)),
    };
  }, [history]);

  const styles = useMemo(() => makeStyles(C), [C]);

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
      await AsyncStorage.setItem(STORAGE_KEYS.autoTrackingEnabled, 'true');
      await LocationService.syncTodayGeofences();
    }
  };

  const handleAutoTrackingToggle = async () => {
    if (isAutoTrackingOn) {
      // OS-level geofencing'i de durdur — flag'i ignore etmek yetmiyor, OS
      // hâlâ konum dinlerse battery + privacy maliyeti devam ediyor.
      setIsAutoTrackingOn(false);
      await AsyncStorage.setItem(STORAGE_KEYS.autoTrackingEnabled, 'false');
      await LocationService.stopGeofences();
    } else {
      if (bgGranted) {
        setIsAutoTrackingOn(true);
        await AsyncStorage.setItem(STORAGE_KEYS.autoTrackingEnabled, 'true');
        await LocationService.syncTodayGeofences();
      } else {
        setShowBgPrompt(true);
      }
    }
  };

  const xpTarget = stats.currentLevel * XP_PER_LEVEL;
  const xpProgress = Math.min(1, stats.currentXP / xpTarget);
  const dashOffset = RING_CIRC * (1 - xpProgress);

  const handleLogout = () => setShowSignOut(true);

  const handleResetStats = () => {
    Alert.alert(t('profile.resetStatsConfirmTitle'), t('profile.resetStatsConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.reset'),
        style: 'destructive',
        onPress: async () => {
          try {
            await resetProfileStats();
            refresh();
          } catch {
            Alert.alert(t('common.error'), t('profile.resetStatsFailed'));
          }
        },
      },
    ]);
  };

  const handleLanguagePress = () => setShowLanguagePicker(true);

  const tier =
    stats.currentLevel >= 10
      ? t('profile.tierElite')
      : stats.currentLevel >= 5
      ? t('profile.tierOperative')
      : t('profile.tierRecruit');
  const activeBonusTier = STREAK_BONUS_TIERS.find((tier) => streakDays >= tier.minDays);

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
        <View style={styles.titleRow}>
          <Text style={[Typography.displayXL, { color: C.textPrimary }]}>{t('profile.title')}</Text>
          <Pressable style={styles.levelUpPill} onPress={() => setShowLevelUp(true)}>
            <Ionicons name="flash" size={14} color={C.accent} />
            <Text style={styles.levelUpPillText}>{t('profile.levelUpPill')}</Text>
          </Pressable>
        </View>

        <View style={styles.identityRow}>
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={C.borderBright}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={C.accent}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={[Typography.label, { color: C.textSecondary }]}>{t('profile.levelLabel')}</Text>
              <XPCountUp
                target={stats.currentLevel}
                duration={900}
                style={[Typography.statXL, { color: C.accent, marginTop: -2, fontSize: 40 }]}
              />
            </View>
          </View>

          <View style={styles.identityInfo}>
            <Text style={[Typography.displayLG, { color: C.textPrimary }]} numberOfLines={1}>
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
                style={[Typography.caption, { color: C.textSecondary }]}
              />
              <Text style={[Typography.caption, { color: C.textSecondary }]}>
                {t('profile.xpProgress', { xp: xpTarget.toLocaleString(), level: stats.currentLevel + 1 })}
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
              style={[Typography.statXL, { color: C.accent }]}
            />
            <Text style={styles.statCardLabel}>{t('profile.missions')}</Text>
          </View>
          <View style={styles.statCard}>
            <XPCountUp
              target={streakDays}
              duration={1000}
              delay={250}
              style={[Typography.statXL, { color: C.accent }]}
            />
            <Text style={styles.statCardLabel}>{t('profile.dayStreak')}</Text>
          </View>
          <View style={styles.statCard}>
            <XPCountUp
              target={locationsCount}
              duration={1000}
              delay={400}
              style={[Typography.statXL, { color: C.accent }]}
            />
            <Text style={styles.statCardLabel}>{t('profile.locations')}</Text>
          </View>
        </View>

        <View style={styles.streakCard}>
          <View style={styles.streakCardHeader}>
            <Text style={styles.streakCardTitle}>{t('profile.activeStreak')}</Text>
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
                <Text style={styles.todayPendingText}>{t('profile.todayPending')}</Text>
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
                  <Text style={[styles.weekDotLabel, isTodayIdx && { color: C.textPrimary }]}>
                    {dayLabels[i]}
                  </Text>
                </View>
              );
            })}
          </View>
          {!todayDone && streakDays > 0 && (
            <View style={styles.reminderBanner}>
              <Ionicons name="flash" size={14} color={C.orange} />
              <Text style={styles.reminderText}>
                {t('profile.streakReminder', { count: streakDays })}
              </Text>
            </View>
          )}
          <View style={styles.streakBonusRow}>
            {activeBonusTier ? (
              <>
                <Ionicons name="flash" size={13} color={C.success} />
                <Text style={styles.streakBonusText}>
                  {t('profile.streakBonusActive', { xp: activeBonusTier.bonusXP })}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="flash-outline" size={13} color={C.textSecondary} />
                <Text style={styles.streakBonusNoneText}>
                  {t('profile.streakBonusNone')}
                </Text>
              </>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('profile.settings')}</Text>

        <Pressable style={styles.settingsRow} onPress={toggleTheme}>
          <View style={[styles.settingsIcon, isDark && { backgroundColor: C.accentSoft, borderColor: C.accent }]}>
            <Ionicons
              name={isDark ? 'moon-outline' : 'sunny-outline'}
              size={18}
              color={isDark ? C.accent : C.textSecondary}
            />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.bodyBold, { color: C.textPrimary }]}>{t('profile.appearance')}</Text>
            <Text style={[Typography.caption, { color: C.textSecondary, marginTop: 2 }]}>
              {isDark ? t('profile.darkMode') : t('profile.lightMode')}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: C.surface3, true: C.accent }}
            thumbColor={isDark ? '#ffffff' : '#c9d2e6'}
          />
        </Pressable>

        <Pressable style={[styles.settingsRow, { marginTop: Spacing.sm }]} onPress={handleLanguagePress}>
          <View style={styles.settingsIcon}>
            <Ionicons name="language-outline" size={18} color={C.textSecondary} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.bodyBold, { color: C.textPrimary }]}>{t('profile.language')}</Text>
            <Text style={[Typography.caption, { color: C.textSecondary, marginTop: 2 }]}>
              {AVAILABLE_LANGUAGES.find((l) => l.code === language)?.label ?? 'English'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textSecondary} />
        </Pressable>

        <Pressable style={[styles.settingsRow, { marginTop: Spacing.sm }]} onPress={handleAutoTrackingToggle}>
          <View style={[styles.settingsIcon, isAutoTrackingOn && { backgroundColor: C.accentSoft, borderColor: C.accent }]}>
            <Ionicons name="star-outline" size={18} color={isAutoTrackingOn ? C.accent : C.textSecondary} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.bodyBold, { color: C.textPrimary }]}>{t('profile.autoTracking')}</Text>
            <Text style={[Typography.caption, { color: C.textSecondary, marginTop: 2 }]}>
              {isAutoTrackingOn ? t('profile.autoTrackingOn') : t('profile.autoTrackingOff')}
            </Text>
          </View>
          <Switch
            value={isAutoTrackingOn}
            onValueChange={handleAutoTrackingToggle}
            trackColor={{ false: C.surface3, true: C.accent }}
            thumbColor={isAutoTrackingOn ? '#ffffff' : '#c9d2e6'}
          />
        </Pressable>

        <Pressable style={[styles.settingsRow, { marginTop: Spacing.sm }]} onPress={handleLogout}>
          <View style={styles.settingsIcon}>
            <Ionicons name="log-out-outline" size={18} color={C.danger} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={[Typography.bodyBold, { color: C.textPrimary }]}>{t('profile.signOut')}</Text>
            <Text style={[Typography.caption, { color: C.textSecondary, marginTop: 2 }]}>
              {t('profile.signOutDesc')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textSecondary} />
        </Pressable>

        {__DEV__ && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>{t('profile.developer')}</Text>
            <Pressable style={styles.settingsRow} onPress={handleResetStats}>
              <View style={styles.settingsIcon}>
                <Ionicons name="refresh-outline" size={18} color={C.orange} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={[Typography.bodyBold, { color: C.textPrimary }]}>{t('profile.resetStats')}</Text>
                <Text style={[Typography.caption, { color: C.textSecondary, marginTop: 2 }]}>
                  {t('profile.resetStatsDesc')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textSecondary} />
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
      <LanguagePickerModal
        visible={showLanguagePicker}
        current={language}
        onSelect={changeLanguage}
        onClose={() => setShowLanguagePicker(false)}
      />
      <SignOutModal
        visible={showSignOut}
        onConfirm={logout}
        onClose={() => setShowSignOut(false)}
      />
    </ScreenContainer>
  );
}
