import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
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
  const levelChipBorder = hexToRgba(C.accent, 0.8); // Increased opacity for a glowing ring effect
  const badgeTextColor = isDark ? "#1a0f06" : "#ffffff";

  return StyleSheet.create({
    topHud: {
      position: "absolute",
      top: 58,
      left: Spacing.md,
      zIndex: 10,
      alignItems: "flex-start",
    },
    hudContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: hudCardBg,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: hudCardBorder,
      padding: 4, // 4px padding + 1px border on each side = 10px. 50 - 10 = 40px for the inner chip
      overflow: "hidden",
      height: 50,
    },
    levelChip: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: levelChipBg,
      borderWidth: 1.5,
      borderColor: levelChipBorder,
      overflow: "hidden",
    },
    expandedContent: {
      flexDirection: "row",
      alignItems: "center",
      width: 210, 
      paddingLeft: 12,
      paddingRight: 8,
    },
    detailsWrap: {
      flex: 1,
      justifyContent: "center",
    },
    hudLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline", // Baseline aligns different font sizes perfectly
      marginBottom: 6,
    },
    hudLevelLabel: {
      fontFamily: "Rajdhani_700Bold",
      fontSize: 12, // Increased slightly for better legibility
      letterSpacing: 1.6,
      color: C.textSecondary,
    },
    xpTrack: {
      height: 6, // Slightly thicker track
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
      shadowOpacity: 0.8,
      shadowRadius: 8,
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

  const xpForLevel = (profile?.currentLevel ?? 1) * XP_PER_LEVEL;
  const xpProgress = profile ? Math.min(1, profile.currentXP / xpForLevel) : 0;
  const showStreak =
    missions.length > 0 && missions.every((m) => m.status !== "completed");

  const blurTint = isDark ? "dark" : "light";

  const [isExpanded, setIsExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const containerWidth = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 270], // Increased width slightly to accommodate adjusted paddings
  });

  const contentOpacity = expandAnim.interpolate({
    inputRange: [0.15, 1],
    outputRange: [0, 1],
  });

  const contentTranslateX = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0], // Adds a subtle slide-out effect to the text
  });

  const toggleExpand = useCallback(() => {
    if (!isExpanded) {
      setIsExpanded(true);
      Animated.spring(expandAnim, {
        toValue: 1,
        useNativeDriver: false,
        friction: 8,
        tension: 60,
      }).start();

      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = setTimeout(() => {
        setIsExpanded(false);
        Animated.spring(expandAnim, {
          toValue: 0,
          useNativeDriver: false,
          friction: 8,
          tension: 60,
        }).start();
      }, 4000);
    } else {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
      router.push("/profile");
    }
  }, [isExpanded, expandAnim]);

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Runs on focus
      return () => {
        // Runs on blur
        if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
        setIsExpanded(false);
        expandAnim.setValue(0); // Instantly collapse so it's ready for next focus
      };
    }, [expandAnim])
  );

  return (
    <View style={styles.topHud} pointerEvents="box-none">
      <Pressable onPress={toggleExpand}>
        <Animated.View style={[styles.hudContainer, { width: containerWidth }]}>
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
              {profile?.currentLevel ?? 1}
            </Text>
          </View>

          <Animated.View 
            style={[
              styles.expandedContent, 
              { opacity: contentOpacity, transform: [{ translateX: contentTranslateX }] }
            ]} 
            pointerEvents={isExpanded ? "auto" : "none"}
          >
            <View style={styles.detailsWrap}>
              <View style={styles.hudLabelRow}>
                <Text style={styles.hudLevelLabel}>
                  {t("topHud.levelLabel", { level: profile?.currentLevel ?? 1 })}
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
              style={{ marginLeft: 6 }}
            />
          </Animated.View>
        </Animated.View>
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
              <Text style={styles.hudPillText}>{t("topHud.streakAtRisk")}</Text>
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
