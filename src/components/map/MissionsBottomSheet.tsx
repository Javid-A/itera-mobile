import { useMemo } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { GestureResponderHandlers } from "react-native";
import { useTranslation } from "react-i18next";
import { Spacing, Typography } from "../../constants";
import { useTheme, useTierColors } from "../../context/ThemeContext";
import type { ColorScheme } from "../../constants/colors";
import type { Mission } from "../../types/Mission";

interface Props {
  missions: Mission[];
  sheetY: Animated.AnimatedInterpolation<number> | Animated.Value;
  isExpanded: boolean;
  panHandlers: GestureResponderHandlers;
  backdropOpacity: Animated.AnimatedInterpolation<number> | Animated.Value;
  onCollapse: () => void;
  onMissionPress: (mission: Mission) => void;
  onMissionEdit: (mission: Mission) => void;
}

const SHEET_COLLAPSED_HEIGHT = 82;
const SHEET_EXPANDED_HEIGHT = 320;

export const SHEET_HEIGHTS = {
  collapsed: SHEET_COLLAPSED_HEIGHT,
  expanded: SHEET_EXPANDED_HEIGHT,
};

// Light-mode sheet uses the lavender surface so it doesn't feel like a dark
// modal punched out of a light app; dark-mode keeps the original deep-navy.
function sheetBackground(C: ColorScheme, isDark: boolean): string {
  return isDark ? "rgba(6, 7, 14, 0.96)" : C.surface;
}

function makeStyles(C: ColorScheme, isDark: boolean) {
  return StyleSheet.create({
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: SHEET_COLLAPSED_HEIGHT,
      backgroundColor: "#000",
      zIndex: 20,
      elevation: 20,
    },
    sheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: SHEET_EXPANDED_HEIGHT,
      backgroundColor: sheetBackground(C, isDark),
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: C.borderBright,
      zIndex: 25,
      elevation: 25,
    },
    sheetHeader: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      backgroundColor: C.muted,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: Spacing.sm,
    },
    sheetTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    countPill: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: C.accentSoft,
      borderWidth: 1,
      borderColor: C.accentBorder,
    },
    sheetList: {
      flex: 1,
    },
    emptySheet: {
      padding: Spacing.xl,
      alignItems: "center",
    },
    missionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
    },
    missionRowBorder: {
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    missionIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
      borderWidth: 1,
    },
    missionIconDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: C.accent,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 6,
    },
    missionInfo: {
      flex: 1,
    },
    editPill: {
      marginLeft: Spacing.sm,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: C.accentSoft,
      borderWidth: 1,
      borderColor: C.accentBorder,
    },
    notArmedPill: {
      alignSelf: "flex-start",
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: C.orangeSubtle,
      borderWidth: 1,
      borderColor: C.orangeBorder,
    },
    notArmedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: C.orange,
      marginRight: 6,
    },
    notArmedRow: {
      flexDirection: "row",
      alignItems: "center",
    },
  });
}

export default function MissionsBottomSheet({
  missions,
  sheetY,
  isExpanded,
  panHandlers,
  backdropOpacity,
  onCollapse,
  onMissionPress,
  onMissionEdit,
}: Props) {
  const { colors: C, isDark } = useTheme();
  const { t } = useTranslation();
  const tierColors = useTierColors();
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);
  const activeMissions = missions.filter((m) => m.status !== "completed");

  return (
    <>
      <Animated.View
        pointerEvents={isExpanded ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={onCollapse} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}
      >
        <View style={styles.sheetHeader} {...panHandlers}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <Text style={[Typography.displaySM, { color: C.textPrimary }]}>
              {t("bottomSheet.title")}
            </Text>
            <View style={styles.countPill}>
              <Text style={[Typography.label, { color: C.accent }]}>
                {t("bottomSheet.activeCount", { count: activeMissions.length })}
              </Text>
            </View>
          </View>
        </View>
        <ScrollView
          style={styles.sheetList}
          scrollEnabled={isExpanded}
          showsVerticalScrollIndicator={false}
        >
          {activeMissions.length === 0 ? (
            <View style={styles.emptySheet}>
              <Text
                style={[
                  Typography.body,
                  { color: C.textSecondary, textAlign: "center" },
                ]}
              >
                {t("bottomSheet.empty")}
              </Text>
            </View>
          ) : (
            activeMissions.map((mission, i) => {
              const tierColor = tierColors[mission.tier] ?? C.accent;
              const notArmed = !mission.armed;
              return (
                <Pressable
                  key={mission.id}
                  style={[styles.missionRow, i > 0 && styles.missionRowBorder]}
                  onPress={() => onMissionPress(mission)}
                >
                  <View
                    style={[
                      styles.missionIconWrap,
                      {
                        backgroundColor: `${tierColor}1F`,
                        borderColor: `${tierColor}66`,
                        opacity: notArmed ? 0.55 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.missionIconDot,
                        { backgroundColor: tierColor, shadowColor: tierColor },
                      ]}
                    />
                  </View>
                  <View style={styles.missionInfo}>
                    <Text
                      style={[
                        Typography.bodyMedium,
                        {
                          color: C.textPrimary,
                          opacity: notArmed ? 0.65 : 1,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {mission.missionName}
                    </Text>
                    {notArmed ? (
                      <View style={styles.notArmedPill}>
                        <View style={styles.notArmedRow}>
                          <View style={styles.notArmedDot} />
                          <Text
                            style={[Typography.label, { color: C.orange }]}
                          >
                            {t("mission.notArmedBadge")}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Text
                        style={[
                          Typography.caption,
                          { color: C.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {mission.locationName}
                      </Text>
                    )}
                  </View>
                  <Text style={[Typography.statSM, { color: tierColor }]}>
                    +{mission.potentialXP} XP
                  </Text>
                  <Pressable
                    style={styles.editPill}
                    onPress={() => onMissionEdit(mission)}
                    hitSlop={8}
                  >
                    <Text style={[Typography.label, { color: C.accent }]}>
                      {t("mission.editButton")}
                    </Text>
                  </Pressable>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}
