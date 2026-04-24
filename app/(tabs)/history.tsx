import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../../components/ScreenContainer';
import RouteMapModal from '../../components/RouteMapModal';
import { Colors, Spacing, Typography } from '../../constants';
import apiClient from '../../src/services/apiClient';
import type { CompletedMission } from '../../src/types/CompletedMission';
import type { Routine } from '../../src/types/Routine';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface DayMission {
  id: string;
  missionName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  status: 'completed' | 'pending' | 'missed';
  completedAt?: string;
  earnedXP?: number;
  potentialXP?: number;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDateKey(d: Date): string {
  // Local-date key (not UTC) so "today" matches completedAt's local day — otherwise
  // users in +TZ zones bucket completions into the wrong day and everything looks pending.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface MissionRowData {
  id: string;
  name: string;
  location: string;
  time: string;
  xp: number;
  status: 'completed' | 'pending' | 'missed';
}

function MissionCard({ row }: { row: MissionRowData }) {
  const missed = row.status === 'missed';
  const pending = row.status === 'pending';
  return (
    <View
      style={[
        styles.missionCard,
        missed && styles.missionCardMissed,
        pending && styles.missionCardPending,
      ]}
    >
      <View
        style={[
          styles.missionAccent,
          missed && { backgroundColor: Colors.danger },
          pending && { backgroundColor: Colors.orange },
        ]}
      />
      <View
        style={[
          styles.missionIcon,
          missed
            ? { borderColor: 'rgba(239, 68, 68, 0.6)', backgroundColor: 'rgba(239, 68, 68, 0.12)' }
            : pending
            ? { borderColor: 'rgba(249, 115, 22, 0.6)', backgroundColor: 'rgba(249, 115, 22, 0.12)' }
            : { borderColor: 'rgba(166, 230, 53, 0.55)', backgroundColor: Colors.accentSoft },
        ]}
      >
        <Ionicons
          name={missed ? 'alert-circle-outline' : pending ? 'time-outline' : 'checkmark'}
          size={20}
          color={missed ? Colors.danger : pending ? Colors.orange : Colors.accent}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[Typography.bodyBold, { color: Colors.textPrimary }]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
          {missed
            ? `${row.location} · Not completed`
            : pending
            ? row.location
            : `${row.location} · ${row.time}`}
        </Text>
      </View>
      {missed ? (
        <View style={styles.missedPill}>
          <Text style={styles.missedPillText}>MISSED</Text>
        </View>
      ) : pending ? (
        <View style={styles.pendingPill}>
          <Text style={styles.pendingPillText}>PENDING</Text>
        </View>
      ) : (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[Typography.statMD, { color: Colors.accent }]}>+{row.xp}</Text>
          <Text style={[Typography.label, { color: Colors.textSecondary, marginTop: -2 }]}>XP</Text>
        </View>
      )}
    </View>
  );
}

interface DaySection {
  key: string;
  label: string;
  date: Date;
  rows: MissionRowData[];
  dayMissions: DayMission[];
  done: number;
  total: number;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<CompletedMission[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routeMapSection, setRouteMapSection] = useState<{ date: Date; dayMissions: DayMission[] } | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiClient
        .get<CompletedMission[]>('/missions/history')
        .then(({ data }) => setHistory(data))
        .catch(() => {});
      apiClient
        .get<Routine[]>('/routines')
        .then(({ data }) => setRoutines(data))
        .catch(() => {});
    }, []),
  );

  const { weekTotals, weekTotalXP, todaySection, yesterdaySection } = useMemo(() => {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today);
    const totals = new Array(7).fill(0);

    for (const m of history) {
      const d = startOfDay(new Date(m.completedAt));
      const diff = Math.floor((d.getTime() - weekStart.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) totals[diff] += m.earnedXP;
    }

    const buildSection = (date: Date, label: string, isToday: boolean): DaySection => {
      const key = isoDateKey(date);
      const completedOnDay = history.filter(
        (m) => isoDateKey(new Date(m.completedAt)) === key,
      );
      const completedRoutineIds = new Set(completedOnDay.map((m) => m.routineId));

      const completedRows: MissionRowData[] = completedOnDay.map((m) => ({
        id: m.id,
        name: m.missionName,
        location: m.missionName,
        time: formatTime(m.completedAt),
        xp: m.earnedXP,
        status: 'completed',
      }));

      const incompleteRows: MissionRowData[] = routines
        .filter((r) => !completedRoutineIds.has(r.id))
        .map((r) => ({
          id: r.id,
          name: r.missionName,
          location: r.locationName,
          time: '',
          xp: r.potentialXP,
          status: isToday ? 'pending' : 'missed',
        }));

      const rows: MissionRowData[] = [...completedRows, ...incompleteRows];

      const completedDayMissions: DayMission[] = completedOnDay.map((m) => ({
        id: m.id,
        missionName: m.missionName,
        locationName: m.missionName,
        latitude: m.latitude,
        longitude: m.longitude,
        status: 'completed',
        completedAt: m.completedAt,
        earnedXP: m.earnedXP,
      }));

      const incompleteDayMissions: DayMission[] = routines
        .filter((r) => !completedRoutineIds.has(r.id))
        .map((r) => ({
          id: r.id,
          missionName: r.missionName,
          locationName: r.locationName,
          latitude: r.latitude,
          longitude: r.longitude,
          status: isToday ? 'pending' : 'missed',
          potentialXP: r.potentialXP,
        }));

      return {
        key,
        label,
        date,
        rows,
        dayMissions: [...completedDayMissions, ...incompleteDayMissions],
        done: completedRows.length,
        total: rows.length,
      };
    };

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    return {
      weekTotals: totals,
      weekTotalXP: totals.reduce((a, b) => a + b, 0),
      todaySection: buildSection(today, 'TODAY', true),
      yesterdaySection: buildSection(yesterday, 'YESTERDAY', false),
    };
  }, [history, routines]);

  const todayIndex = (new Date().getDay() + 6) % 7;
  const maxBar = Math.max(...weekTotals, 1);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const selfGlowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const selfGlowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  const renderSection = (section: DaySection) => {
    if (section.rows.length === 0 && section.label === 'YESTERDAY') return null;
    return (
      <View style={{ marginTop: Spacing.lg }}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <View
              style={[
                styles.progressPill,
                section.done === section.total && section.total > 0
                  ? styles.progressPillDone
                  : undefined,
              ]}
            >
              <Text
                style={[
                  styles.progressPillText,
                  section.done === section.total && section.total > 0
                    ? { color: Colors.accent }
                    : undefined,
                ]}
              >
                {section.done}/{section.total}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.routeMapButton}
            onPress={() => setRouteMapSection({ date: section.date, dayMissions: section.dayMissions })}
          >
            <Ionicons name="git-network-outline" size={14} color={Colors.accent} />
            <Text style={styles.routeMapButtonText}>ROUTE MAP</Text>
          </Pressable>
        </View>
        <View style={styles.sectionDivider} />
        <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
          {section.rows.length === 0 ? (
            <Text style={[Typography.body, { color: Colors.textSecondary, textAlign: 'center', padding: Spacing.md }]}>
              No missions today yet.
            </Text>
          ) : (
            section.rows.map((row) => <MissionCard key={row.id} row={row} />)
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Spacing.xxl, paddingTop: Spacing.md }}
      >
        <Text style={[Typography.displayXL, { color: Colors.textPrimary }]}>Mission Log</Text>

        <View style={styles.weekChipRow}>
          <View style={styles.weekChip}>
            <Ionicons name="arrow-up" size={11} color={Colors.accent} />
            <Text style={styles.weekChipText}>THIS WEEK</Text>
          </View>
          <Text style={[Typography.body, { color: Colors.textSecondary, marginLeft: Spacing.sm }]}>
            {weekTotalXP.toLocaleString()} XP earned
          </Text>
        </View>

        {/* Weekly bar chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>THIS WEEK</Text>
            <Text style={[Typography.statMD, { color: Colors.accent }]}>
              {weekTotalXP.toLocaleString()} XP
            </Text>
          </View>
          <View style={styles.chartBars}>
            {weekTotals.map((xp, i) => {
              const isToday = i === todayIndex;
              const heightPct = xp === 0 ? 6 : Math.min(100, Math.max(12, (xp / maxBar) * 100));
              return (
                <View key={i} style={styles.chartBarCol}>
                  <View style={styles.chartBarValueContainer}>
                    {xp > 0 && (
                      <Text style={[styles.chartBarValue, isToday && { color: Colors.accent }]}>{xp}</Text>
                    )}
                  </View>
                  <View style={styles.chartBarStackWrapper}>
                    <View style={[styles.chartBarStack, { height: `${heightPct}%` }]}>
                      {isToday ? (
                        <Animated.View
                          style={[
                            styles.chartBar,
                            styles.chartBarToday,
                            { opacity: selfGlowOpacity, transform: [{ scaleY: selfGlowScale }] },
                          ]}
                        />
                      ) : (
                        <View style={[styles.chartBar, xp === 0 && styles.chartBarEmpty]} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.chartBarLabel, isToday && { color: Colors.accent }]}>{DAY_LABELS[i]}</Text>
                  {isToday && <View style={styles.todayDot} />}
                </View>
              );
            })}
          </View>
        </View>

        {renderSection(todaySection)}
        {renderSection(yesterdaySection)}

        {history.length === 0 && routines.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={48} color={Colors.border} style={{ marginBottom: Spacing.md }} />
            <Text style={[Typography.bodyLg, { color: Colors.textSecondary, textAlign: 'center' }]}>
              No completed missions yet.
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/map')} style={styles.emptyAction}>
              <Text style={[Typography.cta, { color: Colors.accent, fontSize: 13 }]}>GO TO MAP →</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <RouteMapModal
        visible={routeMapSection !== null}
        date={routeMapSection?.date ?? null}
        missions={routeMapSection?.dayMissions ?? []}
        onClose={() => setRouteMapSection(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  weekChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  weekChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(166, 230, 53, 0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekChipText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.accent,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chartTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
  },
  chartBars: {
    flexDirection: 'row',
    height: 150,
    alignItems: 'flex-end',
    marginTop: Spacing.md,
    gap: 6,
  },
  chartBarCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  chartBarValueContainer: {
    height: 16,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  chartBarValue: {
    fontFamily: 'Rajdhani_600SemiBold',
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  chartBarStackWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBarStack: {
    width: '78%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(166, 230, 53, 0.45)',
    borderRadius: 4,
  },
  chartBarToday: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  chartBarEmpty: {
    backgroundColor: Colors.border,
    height: 4,
  },
  chartBarLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  todayDot: {
    position: 'absolute',
    bottom: -10,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 1.4,
    color: Colors.textSecondary,
  },
  progressPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.55)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  progressPillDone: {
    backgroundColor: Colors.accentSoft,
    borderColor: 'rgba(166, 230, 53, 0.55)',
  },
  progressPillText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    color: Colors.danger,
  },
  routeMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(166, 230, 53, 0.55)',
    backgroundColor: Colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  routeMapButtonText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.accent,
  },
  sectionDivider: {
    height: 2,
    backgroundColor: 'rgba(166, 230, 53, 0.55)',
    marginTop: Spacing.sm,
    borderRadius: 2,
  },
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    padding: Spacing.md,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  missionCardMissed: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  missionCardPending: {
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  missionAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.accent,
  },
  missionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  missedPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.55)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  missedPillText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.danger,
  },
  pendingPill: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingPillText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.orange,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
  },
  emptyAction: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});
