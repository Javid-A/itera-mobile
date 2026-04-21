import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../../components/ScreenContainer';
import RouteMapModal from '../../components/RouteMapModal';
import { Colors, Spacing, Typography } from '../../constants';
import apiClient from '../../src/services/apiClient';
import type { CompletedMission } from '../../src/types/CompletedMission';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  // Monday-first; getDay() returns 0=Sun..6=Sat
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

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m.toString().padStart(2, '0')}m`;
}

interface MissionRowData {
  id: string;
  name: string;
  location: string;
  time: string;
  duration: string;
  xp: number;
  status: 'completed' | 'missed';
}

function toMissionRow(m: CompletedMission): MissionRowData {
  return {
    id: m.id,
    name: m.missionName,
    location: m.missionName,
    time: formatTime(m.completedAt),
    duration: formatDuration(48),
    xp: m.earnedXP,
    status: 'completed',
  };
}

function MissionCard({ row }: { row: MissionRowData }) {
  const missed = row.status === 'missed';
  return (
    <View style={[styles.missionCard, missed && styles.missionCardMissed]}>
      <View style={styles.missionAccent} />
      <View
        style={[
          styles.missionIcon,
          missed
            ? { borderColor: 'rgba(239, 68, 68, 0.6)', backgroundColor: 'rgba(239, 68, 68, 0.12)' }
            : { borderColor: 'rgba(166, 230, 53, 0.55)', backgroundColor: Colors.accentSoft },
        ]}
      >
        <Ionicons
          name={missed ? 'alert-circle-outline' : 'checkmark'}
          size={20}
          color={missed ? Colors.danger : Colors.accent}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[Typography.bodyBold, { color: Colors.textPrimary }]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[Typography.caption, { color: Colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
          {missed ? `${row.location} · Not completed` : `${row.location} · ${row.time} · ${row.duration}`}
        </Text>
      </View>
      {missed ? (
        <View style={styles.missedPill}>
          <Text style={styles.missedPillText}>MISSED</Text>
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
  done: number;
  total: number;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<CompletedMission[]>([]);
  const [routeMapDate, setRouteMapDate] = useState<Date | null>(null);

  useFocusEffect(
    useCallback(() => {
      apiClient
        .get<CompletedMission[]>('/missions/history')
        .then(({ data }) => setHistory(data))
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

    const groupByDate = (date: Date): MissionRowData[] => {
      const key = isoDateKey(date);
      return history.filter((m) => isoDateKey(new Date(m.completedAt)) === key).map(toMissionRow);
    };

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const todayRows = groupByDate(today);
    const yesterdayRows = groupByDate(yesterday);

    return {
      weekTotals: totals,
      weekTotalXP: totals.reduce((a, b) => a + b, 0),
      todaySection: {
        key: isoDateKey(today),
        label: 'TODAY',
        date: today,
        rows: todayRows,
        done: todayRows.length,
        total: Math.max(todayRows.length, 3),
      } as DaySection,
      yesterdaySection: {
        key: isoDateKey(yesterday),
        label: 'YESTERDAY',
        date: yesterday,
        rows: yesterdayRows,
        done: yesterdayRows.length,
        total: Math.max(yesterdayRows.length, 3),
      } as DaySection,
    };
  }, [history]);

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
            <View style={styles.progressPill}>
              <Text style={styles.progressPillText}>
                {section.done}/{section.total}
              </Text>
            </View>
          </View>
          <Pressable style={styles.routeMapButton} onPress={() => setRouteMapDate(section.date)}>
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
              const heightPct = xp === 0 ? 6 : Math.max(12, (xp / maxBar) * 100);
              return (
                <View key={i} style={styles.chartBarCol}>
                  {xp > 0 && (
                    <Text style={[styles.chartBarValue, isToday && { color: Colors.accent }]}>{xp}</Text>
                  )}
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
                      <View
                        style={[
                          styles.chartBar,
                          xp === 0 && styles.chartBarEmpty,
                        ]}
                      />
                    )}
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

        {history.length === 0 && (
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
        visible={routeMapDate !== null}
        date={routeMapDate}
        missions={
          routeMapDate
            ? history.filter((m) => isoDateKey(new Date(m.completedAt)) === isoDateKey(routeMapDate))
            : []
        }
        onClose={() => setRouteMapDate(null)}
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
    height: 130,
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
  chartBarValue: {
    fontFamily: 'Rajdhani_600SemiBold',
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 2,
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
