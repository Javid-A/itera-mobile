import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
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
  // HUD harita üzerinde blur'lu yüzüyor — light mode'da camsı surface scrim,
  // dark'ta orijinal koyu lacivert şeffaflık.
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
  const levelChipBorder = hexToRgba(C.accent, 0.4);
  // Pill içindeki "7D" badge'i sıcak turuncu — light mode'da yazı rengi koyu navy
  // okunsun diye değişiyor.
  const badgeTextColor = isDark ? "#1a0f06" : "#ffffff";

  return StyleSheet.create({
    topHud: {
      position: "absolute",
      top: 58,
      left: Spacing.md,
      right: Spacing.md,
      zIndex: 10,
    },
    hudCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: hudCardBg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: hudCardBorder,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      gap: 12,
      overflow: "hidden",
    },
    hudLevelLabel: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 11,
      letterSpacing: 1.6,
      color: C.textSecondary,
    },
    hudPillRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
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
    hudPillBadge: {
      backgroundColor: C.orange,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
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
    levelChip: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: levelChipBg,
      borderWidth: 1.5,
      borderColor: levelChipBorder,
      overflow: "hidden",
    },
    hudLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 5,
    },
    xpTrack: {
      height: 5,
      backgroundColor: xpTrackBg,
      borderRadius: 3,
      overflow: "hidden",
    },
    xpFill: {
      height: "100%",
      backgroundColor: C.accent,
      borderRadius: 3,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 6,
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
  const styles = useMemo(() => makeStyles(C, isDark), [C, isDark]);

  const xpForLevel = (profile?.currentLevel ?? 1) * XP_PER_LEVEL;
  const xpProgress = profile ? Math.min(1, profile.currentXP / xpForLevel) : 0;
  const showStreak =
    missions.length > 0 && missions.every((m) => m.status !== "completed");

  const blurTint = isDark ? "dark" : "light";

  return (
    <View style={styles.topHud} pointerEvents="box-none">
      <Pressable onPress={() => router.push("/profile")}>
        <BlurView
          intensity={45}
          tint={blurTint}
          style={styles.hudCard}
          experimentalBlurMethod="dimezisBlurView"
        >
          <BlurView
            intensity={30}
            tint={blurTint}
            style={styles.levelChip}
            experimentalBlurMethod="dimezisBlurView"
          >
            <Text style={[Typography.statMD, { color: C.accent }]}>
              {profile?.currentLevel ?? 1}
            </Text>
          </BlurView>
          <View style={{ flex: 1 }}>
            <View style={styles.hudLabelRow}>
              <Text style={styles.hudLevelLabel}>
                LEVEL {profile?.currentLevel ?? 1}
              </Text>
              <Text style={[Typography.statSM, { color: C.accent }]}>
                {(profile?.currentXP ?? 0).toLocaleString()} /{" "}
                {xpForLevel.toLocaleString()} XP
              </Text>
            </View>
            <View style={styles.xpTrack}>
              <View
                style={[styles.xpFill, { width: `${xpProgress * 100}%` }]}
              />
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={C.textSecondary}
          />
        </BlurView>
      </Pressable>

      {showStreak || bgDenied ? (
        <View style={styles.hudPillRow}>
          {showStreak && (
            <BlurView
              intensity={45}
              tint={blurTint}
              style={styles.hudPill}
              experimentalBlurMethod="dimezisBlurView"
            >
              <Text style={styles.hudPillFlame}>🔥</Text>
              <Text style={styles.hudPillText}>STREAK AT RISK</Text>
              <View style={styles.hudPillBadge}>
                <Text style={styles.hudPillBadgeText}>7D</Text>
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
                  AUTO-TRACKING OFF
                </Text>
                <Text style={styles.hudPillEnable}>FIX</Text>
              </BlurView>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
