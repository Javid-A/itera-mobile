import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Spacing, Typography } from "../../constants";
import { useTheme } from "../../context/ThemeContext";
import type { ColorScheme } from "../../constants/colors";
import { XP_PER_LEVEL } from "../../config/gameConfig";
import type { Profile } from "../../types/Profile";
import type { Mission } from "../../types/Mission";

interface Props {
  profile: Profile | null;
  missions: Mission[];
  bgDenied: boolean;
  onFixBackground: () => void;
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeStyles(C: ColorScheme, isDark: boolean) {
  const hudCardBg = isDark ? "rgba(11, 14, 26, 0.45)" : "rgba(255, 255, 255, 0.55)";
  const hudCardBorder = isDark
    ? "rgba(255, 255, 255, 0.15)"
    : "rgba(14, 15, 42, 0.18)";
  const hudPillBg = isDark ? "rgba(20, 14, 8, 0.4)" : "rgba(255, 255, 255, 0.65)";
  const hudPillWarningBg = isDark
    ? "rgba(11, 14, 26, 0.4)"
    : "rgba(255, 255, 255, 0.65)";
  const xpTrackBg = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(14, 15, 42, 0.10)";
  const levelChipBg = hexToRgba(C.accent, 0.16);
  const levelChipBorder = hexToRgba(C.accent, 0.8);
  const badgeTextColor = isDark ? "#1a0f06" : "#ffffff";

  return StyleSheet.create({
    topHud: {
      position: "absolute",
      top: 58,
      left: Spacing.md,
      zIndex: 10,
      alignItems: "flex-start",
    },
    hudPressable: {
      borderRadius: 25,
      overflow: "hidden",
    },
    hudPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    hudContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: hudCardBg,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: hudCardBorder,
      padding: 3,
      paddingRight: 10,
      height: 42,
      width: 180,
      overflow: "hidden",
    },
    levelChip: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: levelChipBg,
      borderWidth: 1.5,
      borderColor: levelChipBorder,
      overflow: "hidden",
    },
    detailsWrap: {
      flex: 1,
      justifyContent: "center",
      paddingLeft: 9,
    },
    hudXpText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 0.5,
      color: C.accent,
      marginBottom: 3,
    },
    xpTrack: {
      height: 4,
      backgroundColor: xpTrackBg,
      borderRadius: 2,
      overflow: "hidden",
    },
    xpFill: {
      height: "100%",
      backgroundColor: C.accent,
      borderRadius: 3,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 8,
    },
    chevron: {
      marginLeft: 4,
    },
    hudPillRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 10,
    },
    hudPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: hudPillBg,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: hexToRgba(C.orange, 0.45),
      paddingHorizontal: 10,
      paddingVertical: 6,
      overflow: "hidden",
    },
    hudPillSafe: {
      borderColor: hexToRgba(C.success, 0.6),
    },
    hudPillWarning: {
      backgroundColor: hudPillWarningBg,
      borderColor: hexToRgba(C.orange, 0.45),
    },
    hudPillFlame: {
      fontSize: 13,
    },
    hudPillText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1.2,
      color: C.orange,
    },
    hudPillTextSafe: {
      color: C.success,
    },
    hudPillBadge: {
      backgroundColor: C.orange,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    hudPillBadgeSafe: {
      backgroundColor: C.success,
    },
    hudPillBadgeText: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 10,
      color: badgeTextColor,
      letterSpacing: 0.5,
    },
    hudPillEnable: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1,
      color: C.accent,
    },
  });
}

export default function TopHud({
  profile,
  missions,
  bgDenied,
  onFixBackground,
}: Props) {
  const { colors: C, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const level = profile?.currentLevel ?? 1;
  const xpForLevel = level * XP_PER_LEVEL;
  const currentXP = profile?.currentXP ?? 0;
  const xpProgress = profile ? Math.min(1, currentXP / xpForLevel) : 0;
  const currentStreak = profile?.currentStreak ?? 0;
  const todayCompleted = missions.some((m) => m.status === "completed");
  const showStreak = currentStreak > 0;
  const streakSafe = todayCompleted;

  const blurTint = isDark ? "dark" : "light";

  return (
    <View style={styles.topHud} pointerEvents="box-none">
      <Pressable
        onPress={() => router.push("/profile")}
        style={({ pressed }) => [
          styles.hudPressable,
          pressed && styles.hudPressed,
        ]}
      >
        <View style={styles.hudContainer}>
          <BlurView
            intensity={45}
            tint={blurTint}
            style={StyleSheet.absoluteFill}
            experimentalBlurMethod="dimezisBlurView"
          />

          <View style={styles.levelChip}>
            <BlurView
              intensity={30}
              tint={blurTint}
              style={StyleSheet.absoluteFill}
              experimentalBlurMethod="dimezisBlurView"
            />
            <Text style={[Typography.statMD, { color: C.accent }]}>
              {level}
            </Text>
          </View>

          <View style={styles.detailsWrap}>
            <Text style={styles.hudXpText} numberOfLines={1}>
              {currentXP.toLocaleString()} / {xpForLevel.toLocaleString()} XP
            </Text>
            <View style={styles.xpTrack}>
              <View
                style={[styles.xpFill, { width: `${xpProgress * 100}%` }]}
              />
            </View>
          </View>

          <Ionicons
            name="chevron-forward"
            size={16}
            color={C.accent}
            style={styles.chevron}
          />
        </View>
      </Pressable>

      {showStreak || bgDenied ? (
        <View style={styles.hudPillRow}>
          {showStreak && (
            <BlurView
              intensity={45}
              tint={blurTint}
              style={[styles.hudPill, streakSafe && styles.hudPillSafe]}
              experimentalBlurMethod="dimezisBlurView"
            >
              <Text style={styles.hudPillFlame}>🔥</Text>
              <Text style={[styles.hudPillText, streakSafe && styles.hudPillTextSafe]}>
                {streakSafe ? t("topHud.streakSafe") : t("topHud.streakAtRisk")}
              </Text>
              <View style={[styles.hudPillBadge, streakSafe && styles.hudPillBadgeSafe]}>
                <Text style={styles.hudPillBadgeText}>{currentStreak}D</Text>
              </View>
            </BlurView>
          )}
          {bgDenied && (
            <Pressable
              style={{ borderRadius: 999, overflow: "hidden" }}
              onPress={onFixBackground}
            >
              <BlurView
                intensity={45}
                tint={blurTint}
                style={[styles.hudPill, styles.hudPillWarning]}
                experimentalBlurMethod="dimezisBlurView"
              >
                <Ionicons
                  name="warning-outline"
                  size={13}
                  color={C.orange}
                />
                <Text style={[styles.hudPillText, { color: C.orange }]}>
                  {t("topHud.autoTrackingOff")}
                </Text>
                <Text style={styles.hudPillEnable}>{t("topHud.fix")}</Text>
              </BlurView>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
