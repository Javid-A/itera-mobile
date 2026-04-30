import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenContainer from "../../src/components/ScreenContainer";
import RouteMapModal from "../../src/components/RouteMapModal";
import { Spacing, Typography } from "../../src/constants";
import { useTheme } from "../../src/context/ThemeContext";
import { useDaySummary } from "../../src/state/queries/useDaySummary";
import type { DayMission } from "../../src/types/DayMission";
import type { DaySummary } from "../../src/types/DaySummary";
import type { ColorScheme } from "../../src/constants/colors";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSectionLabel(sectionDate: string, todayDate: string): string {
  if (sectionDate === todayDate) return "TODAY";
  const today = parseLocalDate(todayDate);
  const target = parseLocalDate(sectionDate);
  const dayMs = 86400000;
  const diffDays = Math.round((today.getTime() - target.getTime()) / dayMs);
  if (diffDays === 1) return "YESTERDAY";
  return target
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "2-digit",
    })
    .toUpperCase();
}

interface MissionRowData {
  id: string;
  name: string;
  location: string;
  time: string;
  xp: number;
  status: "completed" | "pending" | "missed";
}

function makeStyles(C: ColorScheme) {
  // Helpers for status-tinted alpha colors derived from the active palette
  const dangerSoft = hexToRgba(C.danger, 0.18);
  const dangerBorder = hexToRgba(C.danger, 0.55);
  const dangerCardBorder = hexToRgba(C.danger, 0.35);
  const orangeBorderStrong = hexToRgba(C.orange, 0.5);
  const orangeCardBorder = hexToRgba(C.orange, 0.35);

  return StyleSheet.create({
    weekChipRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: Spacing.sm,
    },
    weekChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: C.accentSoft,
      borderWidth: 1,
      borderColor: C.accentBorder,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    weekChipText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1.2,
      color: C.accent,
    },
    chartCard: {
      backgroundColor: C.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: C.borderBright,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      marginTop: Spacing.md,
    },
    chartHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    chartTitle: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1.4,
      color: C.textSecondary,
    },
    chartBars: {
      flexDirection: "row",
      height: 150,
      alignItems: "flex-end",
      marginTop: Spacing.md,
      gap: 6,
    },
    chartBarCol: {
      flex: 1,
      height: "100%",
      alignItems: "center",
      justifyContent: "flex-end",
      position: "relative",
    },
    chartBarValueContainer: {
      height: 16,
      justifyContent: "flex-end",
      marginBottom: 4,
    },
    chartBarValue: {
      fontFamily: "Rajdhani_600SemiBold",
      fontSize: 10,
      color: C.textSecondary,
      textAlign: "center",
    },
    chartBarStackWrapper: {
      flex: 1,
      width: "100%",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    chartBarStack: {
      width: "78%",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    chartBar: {
      width: "100%",
      height: "100%",
      backgroundColor: C.accentDim,
      borderRadius: 4,
    },
    chartBarToday: {
      backgroundColor: C.accent,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 10,
    },
    chartBarEmpty: {
      backgroundColor: C.border,
      height: 4,
    },
    chartBarLabel: {
      fontFamily: "Inter_500Medium",
      fontSize: 11,
      color: C.textSecondary,
      marginTop: 6,
    },
    todayDot: {
      position: "absolute",
      bottom: -10,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.accent,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    sectionLabel: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 12,
      letterSpacing: 1.4,
      color: C.textSecondary,
    },
    progressPill: {
      backgroundColor: dangerSoft,
      borderWidth: 1,
      borderColor: dangerBorder,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    progressPillDone: {
      backgroundColor: C.accentSoft,
      borderColor: C.accentBorder,
    },
    progressPillText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      color: C.danger,
    },
    routeMapButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderWidth: 1,
      borderColor: C.accentBorder,
      backgroundColor: C.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    routeMapButtonText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1.2,
      color: C.accent,
    },
    sectionDivider: {
      height: 2,
      backgroundColor: C.accentBorder,
      marginTop: Spacing.sm,
      borderRadius: 2,
    },
    missionCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.borderBright,
      padding: Spacing.md,
      gap: Spacing.md,
      overflow: "hidden",
    },
    missionCardMissed: {
      borderColor: dangerCardBorder,
    },
    missionCardPending: {
      borderColor: orangeCardBorder,
    },
    missionAccent: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: C.accent,
    },
    missionIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
    },
    missionIconCompleted: {
      borderColor: C.accentBorder,
      backgroundColor: C.accentSoft,
    },
    missionIconMissed: {
      borderColor: dangerBorder,
      backgroundColor: dangerSoft,
    },
    missionIconPending: {
      borderColor: orangeBorderStrong,
      backgroundColor: C.orangeSubtle,
    },
    missedPill: {
      backgroundColor: dangerSoft,
      borderWidth: 1,
      borderColor: dangerBorder,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    missedPillText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1,
      color: C.danger,
    },
    pendingPill: {
      backgroundColor: C.orangeSubtle,
      borderWidth: 1,
      borderColor: orangeBorderStrong,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    pendingPillText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1,
      color: C.orange,
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: Spacing.xxl,
    },
    emptyAction: {
      marginTop: Spacing.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
  });
}

// Convert "#rrggbb" to rgba(r,g,b,a). Falls back to the input string for any
// non-hex value (rgba/named) so callers can pass already-tinted tokens through.
function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function MissionCard({
  row,
  C,
  styles,
}: {
  row: MissionRowData;
  C: ColorScheme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const missed = row.status === "missed";
  const pending = row.status === "pending";
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
          missed && { backgroundColor: C.danger },
          pending && { backgroundColor: C.orange },
        ]}
      />
      <View
        style={[
          styles.missionIcon,
          missed
            ? styles.missionIconMissed
            : pending
              ? styles.missionIconPending
              : styles.missionIconCompleted,
        ]}
      >
        <Ionicons
          name={
            missed
              ? "alert-circle-outline"
              : pending
                ? "time-outline"
                : "checkmark"
          }
          size={20}
          color={missed ? C.danger : pending ? C.orange : C.accent}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[Typography.bodyBold, { color: C.textPrimary }]}
          numberOfLines={1}
        >
          {row.name}
        </Text>
        <Text
          style={[Typography.caption, { color: C.textSecondary, marginTop: 2 }]}
          numberOfLines={1}
        >
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
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[Typography.statMD, { color: C.accent }]}>
            +{row.xp}
          </Text>
          <Text
            style={[
              Typography.label,
              { color: C.textSecondary, marginTop: -2 },
            ]}
          >
            XP
          </Text>
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
  const { colors: C } = useTheme();
  const { data: summary } = useDaySummary();
  const [routeMapSection, setRouteMapSection] = useState<{
    date: Date;
    dayMissions: DayMission[];
  } | null>(null);

  const styles = useMemo(() => makeStyles(C), [C]);

  const {
    weekTotals,
    weekTotalXP,
    todaySection,
    yesterdaySection,
    todayIndex,
  } = useMemo(() => {
    if (!summary) {
      return {
        weekTotals: new Array(7).fill(0) as number[],
        weekTotalXP: 0,
        todaySection: null as DaySection | null,
        yesterdaySection: null as DaySection | null,
        todayIndex: 0,
      };
    }

    const totals = summary.week.map((d) => d.totalXP);
    const totalXP = totals.reduce((a, b) => a + b, 0);
    const tIdx = summary.week.findIndex((d) => d.date === summary.today.date);

    const buildSection = (day: DaySummary, isToday: boolean): DaySection => {
      const completedRows: MissionRowData[] = day.completed.map((m) => ({
        id: m.id,
        name: m.missionName,
        location: m.missionName,
        time: formatTime(m.completedAt),
        xp: m.earnedXP,
        status: "completed",
      }));

      const pendingRows: MissionRowData[] = day.pending.map((p) => ({
        id: p.missionId,
        name: p.missionName,
        location: p.locationName,
        time: "",
        xp: p.potentialXP,
        status: isToday ? "pending" : "missed",
      }));

      const rows: MissionRowData[] = [...completedRows, ...pendingRows];

      const completedDayMissions: DayMission[] = day.completed.map((m) => ({
        id: m.id,
        missionName: m.missionName,
        locationName: m.missionName,
        latitude: m.latitude,
        longitude: m.longitude,
        status: "completed",
        completedAt: m.completedAt,
        earnedXP: m.earnedXP,
      }));

      const pendingDayMissions: DayMission[] = day.pending.map((p) => ({
        id: p.missionId,
        missionName: p.missionName,
        locationName: p.locationName,
        latitude: p.latitude,
        longitude: p.longitude,
        status: isToday ? "pending" : "missed",
        potentialXP: p.potentialXP,
      }));

      return {
        key: day.date,
        label: formatSectionLabel(day.date, summary.today.date),
        date: parseLocalDate(day.date),
        rows,
        dayMissions: [...completedDayMissions, ...pendingDayMissions],
        done: day.doneCount,
        total: day.totalCount,
      };
    };

    return {
      weekTotals: totals,
      weekTotalXP: totalXP,
      todaySection: buildSection(summary.today, true),
      yesterdaySection: buildSection(summary.yesterday, false),
      todayIndex: tIdx >= 0 ? tIdx : 0,
    };
  }, [summary]);

  const maxBar = Math.max(...weekTotals, 1);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const selfGlowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });
  const selfGlowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const renderSection = (section: DaySection | null, isToday: boolean) => {
    if (!section) return null;
    if (!isToday && section.rows.length === 0) return null;
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
                    ? { color: C.accent }
                    : undefined,
                ]}
              >
                {section.done}/{section.total}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.routeMapButton}
            onPress={() =>
              setRouteMapSection({
                date: section.date,
                dayMissions: section.dayMissions,
              })
            }
          >
            <Ionicons name="git-network-outline" size={14} color={C.accent} />
            <Text style={styles.routeMapButtonText}>ROUTE MAP</Text>
          </Pressable>
        </View>
        <View style={styles.sectionDivider} />
        <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
          {section.rows.length === 0 ? (
            <Text
              style={[
                Typography.body,
                {
                  color: C.textSecondary,
                  textAlign: "center",
                  padding: Spacing.md,
                },
              ]}
            >
              No missions today yet.
            </Text>
          ) : (
            section.rows.map((row) => (
              <MissionCard key={row.id} row={row} C={C} styles={styles} />
            ))
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Spacing.xxl,
          paddingTop: Spacing.md,
        }}
      >
        <Text style={[Typography.displayXL, { color: C.textPrimary }]}>
          Mission Log
        </Text>

        <View style={styles.weekChipRow}>
          <View style={styles.weekChip}>
            <Ionicons name="arrow-up" size={11} color={C.accent} />
            <Text style={styles.weekChipText}>THIS WEEK</Text>
          </View>
          <Text
            style={[
              Typography.body,
              { color: C.textSecondary, marginLeft: Spacing.sm },
            ]}
          >
            {weekTotalXP.toLocaleString()} XP earned
          </Text>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>THIS WEEK</Text>
            <Text style={[Typography.statMD, { color: C.accent }]}>
              {weekTotalXP.toLocaleString()} XP
            </Text>
          </View>
          <View style={styles.chartBars}>
            {weekTotals.map((xp, i) => {
              const isToday = i === todayIndex;
              const heightPct =
                xp === 0 ? 6 : Math.min(100, Math.max(12, (xp / maxBar) * 100));
              return (
                <View key={i} style={styles.chartBarCol}>
                  <View style={styles.chartBarValueContainer}>
                    {xp > 0 && (
                      <Text
                        style={[
                          styles.chartBarValue,
                          isToday && { color: C.accent },
                        ]}
                      >
                        {xp}
                      </Text>
                    )}
                  </View>
                  <View style={styles.chartBarStackWrapper}>
                    <View
                      style={[
                        styles.chartBarStack,
                        { height: `${heightPct}%` },
                      ]}
                    >
                      {isToday ? (
                        <Animated.View
                          style={[
                            styles.chartBar,
                            styles.chartBarToday,
                            {
                              opacity: selfGlowOpacity,
                              transform: [{ scaleY: selfGlowScale }],
                            },
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
                  </View>
                  <Text
                    style={[
                      styles.chartBarLabel,
                      isToday && { color: C.accent },
                    ]}
                  >
                    {DAY_LABELS[i]}
                  </Text>
                  {isToday && <View style={styles.todayDot} />}
                </View>
              );
            })}
          </View>
        </View>

        {renderSection(todaySection, true)}
        {renderSection(yesterdaySection, false)}

        {summary !== null &&
          todaySection?.total === 0 &&
          yesterdaySection?.total === 0 && (
            <View style={styles.empty}>
              <Ionicons
                name="map-outline"
                size={48}
                color={C.border}
                style={{ marginBottom: Spacing.md }}
              />
              <Text
                style={[
                  Typography.bodyLg,
                  { color: C.textSecondary, textAlign: "center" },
                ]}
              >
                No completed missions yet.
              </Text>
              <Pressable
                onPress={() => router.push("/(tabs)/map")}
                style={styles.emptyAction}
              >
                <Text
                  style={[Typography.cta, { color: C.accent, fontSize: 13 }]}
                >
                  GO TO MAP →
                </Text>
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
